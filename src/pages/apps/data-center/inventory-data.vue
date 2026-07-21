<script setup>
import { $api } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
import { downloadXlsx, makeExportBasename } from '@/utils/exportXlsx'

import { useTheme } from 'vuetify'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, LineChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const { t } = useI18n({ useScope: 'global' })
const vuetifyTheme = useTheme()

// State
const warehouseOptions = ref([])
const warehouseId = ref(null)
const warehousePersistReady = ref(false)

const dashboardLoading = ref(false)
const loading = ref(false)
const isGenerating = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

const isExporting = ref(false)
const exportProgress = ref(0)
const exportTotal = ref(0)

const overviewData = ref(null)
const ageData = ref(null)
const skuData = ref({ total: 0, list: [] })

const skuType = ref('all')
const skuLimit = ref(50)
const skuPage = ref(1)
const skuSearch = ref('')

// Helper
function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

async function fetchDashboard() {
  if (!warehouseId.value) return
  
  dashboardLoading.value = true
  loading.value = true
  isGenerating.value = false
  const q = { warehouse_id: warehouseId.value }
  
  try {
    const [overviewRes, ageRes, skusRes] = await Promise.all([
      $api('/ordernewapi/inventoryAnalysisOverview', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisAge', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisSkus', { method: 'GET', query: { ...q, type: skuType.value, limit: skuLimit.value, page: skuPage.value, sku: skuSearch.value || undefined } }).catch(e => e)
    ])
    
    // Check for 404 Generating
    const has404 = [overviewRes, ageRes, skusRes].some(r => Number(r?.code) === 404 || r?.data?.code === 404 || r?.status === 404)
    if (has404) {
      isGenerating.value = true
      return
    }
    
    overviewData.value = overviewRes?.data || null
    ageData.value = ageRes?.data?.warehouse_age || null
    skuData.value = {
      total: skusRes?.data?.total_matches || 0,
      list: skusRes?.data?.list || []
    }
    
  } catch (err) {
    console.error(err)
    toast(err?.data?.message || err?.message || 'Failed to load analysis', 'error')
  } finally {
    dashboardLoading.value = false
    loading.value = false
  }
}

async function fetchSkusOnly() {
  if (!warehouseId.value) return
  loading.value = true
  try {
    const res = await $api('/ordernewapi/inventoryAnalysisSkus', { 
      method: 'GET',
      query: { warehouse_id: warehouseId.value, type: skuType.value, limit: skuLimit.value, page: skuPage.value, sku: skuSearch.value || undefined } 
    })
    if ((Number(res?.code) === 200 || Number(res?.code) === 1) && res.data) {
      skuData.value = {
        total: res.data.total_matches || 0,
        list: res.data.list || []
      }
    }
  } catch (err) {
    toast(err?.data?.message || err?.message || 'Failed to load SKUs', 'error')
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  if (!warehouseId.value) return
  isExporting.value = true
  exportProgress.value = 0
  
  try {
    // Fetch first page to get total
    const firstRes = await $api('/ordernewapi/inventoryAnalysisSkus', {
      method: 'GET',
      query: { warehouse_id: warehouseId.value, type: skuType.value, limit: 1000, page: 1, sku: skuSearch.value || undefined }
    })
    
    const total = firstRes?.data?.total_matches || 0
    exportTotal.value = total
    if (total === 0) {
      toast(t('pages.dataCenterInventoryAnalysis.table.noData') || 'No data', 'warning')
      isExporting.value = false
      return
    }

    let allRows = [...(firstRes?.data?.list || [])]
    exportProgress.value = allRows.length
    
    const totalPages = Math.ceil(total / 1000)
    for (let p = 2; p <= totalPages; p++) {
      const res = await $api('/ordernewapi/inventoryAnalysisSkus', {
        method: 'GET',
        query: { warehouse_id: warehouseId.value, type: skuType.value, limit: 1000, page: p, sku: skuSearch.value || undefined }
      })
      const list = res?.data?.list || []
      allRows = allRows.concat(list)
      exportProgress.value = allRows.length
    }

    const formattedRows = allRows.map(sku => ({
      sku: sku.sku,
      nameCat: `${sku.en_name || ''}\n${sku.cn_name || ''} | ${sku.category || ''}`.trim(),
      price: Number(sku.price_usd).toFixed(2),
      stockWarn: `${sku.current_stock} (${sku.stock_warn_threshold})`,
      status: sku.stock_status ? t(`pages.dataCenterInventoryAnalysis.table.status.${sku.stock_status}`) : '',
      daysLeft: sku.days_of_stock_left,
      inOut60d: `${sku.past_60d_inbound} / ${sku.past_60d_outbound}`,
      noSaleDays: sku.days_no_sale
    }))

    const columns = [
      { key: 'sku', title: t('pages.dataCenterInventoryAnalysis.table.columns.sku') },
      { key: 'nameCat', title: t('pages.dataCenterInventoryAnalysis.table.columns.nameCat') },
      { key: 'price', title: t('pages.dataCenterInventoryAnalysis.table.columns.price') },
      { key: 'stockWarn', title: t('pages.dataCenterInventoryAnalysis.table.columns.stockWarn') },
      { key: 'status', title: t('pages.dataCenterInventoryAnalysis.table.columns.status') },
      { key: 'daysLeft', title: t('pages.dataCenterInventoryAnalysis.table.columns.daysLeft') },
      { key: 'inOut60d', title: t('pages.dataCenterInventoryAnalysis.table.columns.inOut60d') },
      { key: 'noSaleDays', title: t('pages.dataCenterInventoryAnalysis.table.columns.noSaleDays') },
    ]

    const tabNameMap = {
      all: t('pages.dataCenterInventoryAnalysis.table.tabs.all'),
      stagnant: t('pages.dataCenterInventoryAnalysis.table.tabs.stagnant'),
      critical: t('pages.dataCenterInventoryAnalysis.table.tabs.critical'),
      top_sellers: t('pages.dataCenterInventoryAnalysis.table.tabs.topSellers'),
    }
    const tabName = tabNameMap[skuType.value] || skuType.value
    const filename = makeExportBasename(`${t('pages.dataCenterInventoryAnalysis.table.title')}_${tabName}`)
    
    await downloadXlsx({ filename, columns, rows: formattedRows })
    toast('Export successful', 'success')
  } catch (err) {
    console.error(err)
    toast(err?.data?.message || err?.message || 'Export failed', 'error')
  } finally {
    isExporting.value = false
    exportProgress.value = 0
  }
}

watch(() => warehouseId.value, v => {
  if (!warehousePersistReady.value) return
  setPreferredWarehouseId(v)
  if (v) fetchDashboard()
})

watch([skuType, skuLimit], () => {
  if (skuPage.value !== 1) {
    skuPage.value = 1
  } else if (warehouseId.value && warehousePersistReady.value) {
    fetchSkusOnly()
  }
})

let searchTimeout = null
watch(skuSearch, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (skuPage.value !== 1) {
      skuPage.value = 1
    } else if (warehouseId.value && warehousePersistReady.value) {
      fetchSkusOnly()
    }
  }, 500)
})

watch(skuPage, () => {
  if (warehouseId.value && warehousePersistReady.value) {
    fetchSkusOnly()
  }
})

onMounted(async () => {
  const remote = await loadWarehouseOptions(undefined, 3)
  warehouseOptions.value = [
    ...remote,
  ]
  warehouseId.value = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
  await nextTick()
  warehousePersistReady.value = true
  if (warehouseId.value) {
    fetchDashboard()
  }
})



const ageOptions = computed(() => {
  if (!ageData.value) return {}
  const themeColors = vuetifyTheme.current.value.colors
  const age = ageData.value
  const data = [
    { value: age['0_30']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days0_30'), itemStyle: { color: themeColors.success } },
    { value: age['31_60']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days31_60'), itemStyle: { color: themeColors.warning } },
    { value: age['61_90']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days61_90'), itemStyle: { color: themeColors.error } },
    { value: age['90_plus']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days90Plus'), itemStyle: { color: '#888888' } },
  ].filter(i => i.value > 0)
  
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['35%', '60%'], center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
        labelLine: { show: false },
        data
      }
    ]
  }
})
</script>

<template>
  <VContainer fluid class="pa-4 pa-sm-6 position-relative">
    <VOverlay
      :model-value="dashboardLoading"
      class="align-center justify-center"
      contained
      persistent
      z-index="999"
    >
      <VProgressCircular color="primary" indeterminate size="64" />
    </VOverlay>

    <VSnackbar v-model="snack.show" :color="snack.color" location="top" :timeout="2600">
      {{ snack.text }}
    </VSnackbar>

    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h2 class="text-h4 font-weight-bold mb-1">{{ $t('pages.dataCenterInventoryAnalysis.title') }}</h2>
        <div class="text-body-2 text-medium-emphasis">{{ $t('pages.dataCenterInventoryAnalysis.subtitle') }}</div>
      </div>
      <div style="width: 300px">
        <AppSelect
          v-model="warehouseId"
          :items="warehouseOptions"
          item-title="title"
          item-value="value"
          :label="$t('pages.dataCenterInventoryAnalysis.selectWarehouse')"
          variant="outlined"
          density="compact"
          hide-details
        />
      </div>
    </div>

    <!-- Generating State -->
    <VCard v-if="isGenerating" class="mb-6 pa-12 text-center" border>
      <VIcon icon="tabler-loader" class="mdi-spin text-primary mb-4" size="48" />
      <h3 class="text-h5 font-weight-medium mb-2">{{ $t('pages.dataCenterInventoryAnalysis.dataGenerating') }}</h3>
      <p class="text-body-1 text-medium-emphasis">{{ $t('pages.dataCenterInventoryAnalysis.dataGeneratingDesc') }}</p>
    </VCard>

    <template v-else>
      <!-- Overview Cards -->
      <VRow v-if="overviewData" class="mb-4 match-height">
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">{{ $t('pages.dataCenterInventoryAnalysis.overview.totalSkus') }}</div>
            <div class="text-h4 font-weight-bold text-primary">{{ overviewData.sku_count || 0 }}</div>
            <div class="text-caption text-medium-emphasis mt-2">{{ $t('pages.dataCenterInventoryAnalysis.overview.generatedAt') }} {{ overviewData.generated_at || '--' }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">{{ $t('pages.dataCenterInventoryAnalysis.overview.gmv60d') }}</div>
            <div class="text-h4 font-weight-bold text-success">${{ Number(overviewData.total_gmv_60d || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">{{ $t('pages.dataCenterInventoryAnalysis.overview.inventoryValue') }}</div>
            <div class="text-h4 font-weight-bold text-info">${{ Number(overviewData.total_inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">{{ $t('pages.dataCenterInventoryAnalysis.overview.turnover60d') }}</div>
            <div class="d-flex align-center gap-2 mb-2">
              <span class="text-h4 font-weight-bold">{{ overviewData.warehouse_turnover?.turnover_rate_60d || '0%' }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption text-medium-emphasis">
              <span>{{ $t('pages.dataCenterInventoryAnalysis.overview.outbound') }} {{ overviewData.warehouse_turnover?.total_outbound_60d || 0 }}</span>
              <span>{{ $t('pages.dataCenterInventoryAnalysis.overview.stock') }} {{ overviewData.warehouse_turnover?.current_inventory || 0 }}</span>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Charts & Insights -->
      <VRow class="mb-4">
        <!-- Inventory Age -->
        <VCol cols="12" md="6">
          <VCard border class="h-100">
            <VCardItem>
              <VCardTitle>{{ $t('pages.dataCenterInventoryAnalysis.charts.inventoryAge') }}</VCardTitle>
            </VCardItem>
            <VCardText>
              <VChart :option="ageOptions" style="height: 300px" autoresize />
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- SKU Analytics Table -->
      <VCard border class="mt-6">
        <VCardItem class="pb-2">
          <VCardTitle>{{ $t('pages.dataCenterInventoryAnalysis.table.title') }}</VCardTitle>
        </VCardItem>
        <VCardText>
          <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-4">
            <!-- Left: Filter Tabs -->
            <VTabs
              v-model="skuType"
              color="primary"
              density="compact"
            >
              <VTab value="all" class="text-none">
                <VIcon start icon="tabler-box" size="18" />
                {{ $t('pages.dataCenterInventoryAnalysis.table.tabs.all') }}
              </VTab>
              <VTab value="stagnant" class="text-none">
                <VIcon start icon="tabler-package-off" size="18" />
                {{ $t('pages.dataCenterInventoryAnalysis.table.tabs.stagnant') }}
              </VTab>
              <VTab value="critical" class="text-none">
                <VIcon start icon="tabler-alert-triangle" size="18" />
                {{ $t('pages.dataCenterInventoryAnalysis.table.tabs.critical') }}
              </VTab>
              <VTab value="top_sellers" class="text-none">
                <VIcon start icon="tabler-trending-up" size="18" />
                {{ $t('pages.dataCenterInventoryAnalysis.table.tabs.topSellers') }}
              </VTab>
            </VTabs>
            
            <!-- Right: Actions & Tools -->
            <div class="d-flex align-center gap-3">
              <div style="width: 200px">
                <AppTextField
                  v-model="skuSearch"
                  :placeholder="$t('pages.dataCenterReturnInventory.filters.skuPlaceholder')"
                  density="compact"
                  hide-details
                  prepend-inner-icon="tabler-search"
                  clearable
                />
              </div>

              <VBtn
                variant="outlined"
                color="secondary"
                prepend-icon="tabler-refresh"
                :loading="loading"
                @click="fetchSkusOnly"
                class="text-none"
              >
                {{ $t('pages.dataCenterInventoryAnalysis.table.refresh') }}
              </VBtn>

              <VBtn
                variant="elevated"
                color="primary"
                prepend-icon="tabler-file-export"
                :loading="isExporting"
                @click="handleExport"
                class="text-none px-4"
              >
                导出
                <template #loader>
                  <div class="d-flex align-center gap-2">
                    <VProgressCircular indeterminate size="16" width="2" />
                    <span class="text-caption font-weight-medium">{{ exportTotal ? Math.round((exportProgress / exportTotal) * 100) : 0 }}%</span>
                  </div>
                </template>
              </VBtn>
            </div>
          </div>
          
          <VTable density="comfortable" class="border rounded text-body-2" hover>
            <thead>
              <tr>
                <th>{{ $t('pages.dataCenterInventoryAnalysis.table.columns.sku') }}</th>
                <th>{{ $t('pages.dataCenterInventoryAnalysis.table.columns.nameCat') }}</th>
                <th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.price') }}</th>
                <th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.stockWarn') }}</th>
                <th class="text-center">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.status') }}</th>
                <th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.daysLeft') }}</th>
                <th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.inOut60d') }}</th>
                <th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.noSaleDays') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sku in skuData.list" :key="sku.sku">
                <td class="font-weight-medium text-primary">{{ sku.sku }}</td>
                <td>
                  <div>{{ sku.en_name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ sku.cn_name }} | {{ sku.category }}</div>
                </td>
                <td class="text-right">${{ Number(sku.price_usd).toFixed(2) }}</td>
                <td class="text-right">
                  <strong>{{ sku.current_stock }}</strong>
                  <span class="text-medium-emphasis"> ({{ sku.stock_warn_threshold }})</span>
                </td>
                <td class="text-center">
                  <VChip size="small" :color="sku.stock_status === 'out_of_stock' ? 'error' : (sku.stock_status === 'critical' ? 'error' : (sku.stock_status === 'low' ? 'warning' : (sku.stock_status === 'moderate' ? 'primary' : 'success')))">
                    {{ sku.stock_status ? $t(`pages.dataCenterInventoryAnalysis.table.status.${sku.stock_status}`) : '' }}
                  </VChip>
                </td>
                <td class="text-right">{{ sku.days_of_stock_left }}</td>
                <td class="text-right">{{ sku.past_60d_inbound }} / {{ sku.past_60d_outbound }}</td>
                <td class="text-right">{{ sku.days_no_sale }}</td>
              </tr>
              <tr v-if="!skuData.list.length && !loading">
                <td colspan="8" class="text-center py-8 text-medium-emphasis">{{ $t('pages.dataCenterInventoryAnalysis.table.noData') }}</td>
              </tr>
              <tr v-if="loading && !skuData.list.length">
                <td colspan="8" class="text-center py-8">
                  <VProgressCircular indeterminate color="primary" />
                </td>
              </tr>
            </tbody>
          </VTable>
          
          <div class="d-flex align-center justify-space-between flex-wrap gap-4 mt-4" v-if="skuData.total">
            <div class="d-flex align-center gap-4">
              <div class="text-body-2 text-medium-emphasis">
                {{ $t('pages.dataCenterInventoryAnalysis.table.showingText', { limit: skuLimit, total: skuData.total }) }}
              </div>
              <div style="width: 100px">
                <AppSelect
                  v-model="skuLimit"
                  :items="[50, 100, 200, 500]"
                  density="compact"
                  hide-details
                  variant="outlined"
                />
              </div>
            </div>
            <VPagination
              v-model="skuPage"
              :length="Math.ceil(skuData.total / skuLimit)"
              :total-visible="7"
              density="compact"
            />
          </div>
        </VCardText>
      </VCard>
    </template>
  </VContainer>
</template>

<style scoped>
</style>
