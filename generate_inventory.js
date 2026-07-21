const fs = require('fs')

const content = `<script setup>
import { $api } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

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

const loading = ref(false)
const isGenerating = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

const overviewData = ref(null)
const trendsData = ref(null)
const ageData = ref(null)
const insightsData = ref(null)
const skuData = ref({ total: 0, list: [] })

const skuType = ref('all')
const skuLimit = ref(50)

// Helper
function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

async function fetchDashboard() {
  if (!warehouseId.value) return
  
  loading.value = true
  isGenerating.value = false
  const q = { warehouse_id: warehouseId.value }
  
  try {
    const [overviewRes, trendsRes, ageRes, insightsRes, skusRes] = await Promise.all([
      $api('/ordernewapi/inventoryAnalysisOverview', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisTrends', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisAge', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisInsights', { method: 'GET', query: q }).catch(e => e),
      $api('/ordernewapi/inventoryAnalysisSkus', { method: 'GET', query: { ...q, type: skuType.value, limit: skuLimit.value } }).catch(e => e)
    ])
    
    // Check for 404 Generating
    const has404 = [overviewRes, trendsRes, ageRes, insightsRes, skusRes].some(r => Number(r?.code) === 404 || r?.data?.code === 404 || r?.status === 404)
    if (has404) {
      isGenerating.value = true
      return
    }
    
    overviewData.value = overviewRes?.data || null
    trendsData.value = trendsRes?.data || null
    ageData.value = ageRes?.data?.warehouse_age || null
    insightsData.value = insightsRes?.data || null
    skuData.value = {
      total: skusRes?.data?.total_matches || 0,
      list: skusRes?.data?.list || []
    }
    
  } catch (err) {
    console.error(err)
    toast(err?.data?.message || err?.message || 'Failed to load analysis', 'error')
  } finally {
    loading.value = false
  }
}

async function fetchSkusOnly() {
  if (!warehouseId.value) return
  loading.value = true
  try {
    const res = await $api('/ordernewapi/inventoryAnalysisSkus', { 
      method: 'GET',
      query: { warehouse_id: warehouseId.value, type: skuType.value, limit: skuLimit.value } 
    })
    if (Number(res?.code) === 200 && res.data) {
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

watch(() => warehouseId.value, v => {
  if (!warehousePersistReady.value) return
  setPreferredWarehouseId(v)
  if (v) fetchDashboard()
})

watch(() => skuType.value, () => {
  if (warehouseId.value && warehousePersistReady.value) {
    fetchSkusOnly()
  }
})

onMounted(async () => {
  const remote = await loadWarehouseOptions(t)
  warehouseOptions.value = remote
  warehouseId.value = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
  await nextTick()
  warehousePersistReady.value = true
  if (warehouseId.value) {
    fetchDashboard()
  }
})

// Charts Options
const trendsOptions = computed(() => {
  if (!trendsData.value) return {}
  const themeColors = vuetifyTheme.current.value.colors
  const wOutbound = trendsData.value.global_weekly_outbound || []
  const wGmv = trendsData.value.global_weekly_gmv || []
  
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['Outbound Units', 'GMV ($)'] },
    grid: { left: '3%', right: '3%', bottom: '5%', containLabel: true },
    xAxis: { type: 'category', data: ['W1','W2','W3','W4','W5','W6','W7','W8'] },
    yAxis: [
      { type: 'value', name: 'Units', position: 'left' },
      { type: 'value', name: 'GMV', position: 'right', axisLabel: { formatter: '$\\{value}' } }
    ],
    series: [
      { name: 'Outbound Units', type: 'bar', itemStyle: { color: themeColors.primary }, data: wOutbound },
      { name: 'GMV ($)', type: 'line', yAxisIndex: 1, itemStyle: { color: themeColors.success }, smooth: true, data: wGmv }
    ]
  }
})

const ageOptions = computed(() => {
  if (!ageData.value) return {}
  const themeColors = vuetifyTheme.current.value.colors
  const age = ageData.value
  const data = [
    { value: age['0_30']?.units || 0, name: '0-30 Days', itemStyle: { color: themeColors.success } },
    { value: age['31_60']?.units || 0, name: '31-60 Days', itemStyle: { color: themeColors.warning } },
    { value: age['61_90']?.units || 0, name: '61-90 Days', itemStyle: { color: themeColors.error } },
    { value: age['90_plus']?.units || 0, name: '90+ Days', itemStyle: { color: '#888888' } },
  ].filter(i => i.value > 0)
  
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
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
  <VContainer fluid class="pa-4 pa-sm-6">
    <VSnackbar v-model="snack.show" :color="snack.color" location="top" :timeout="2600">
      {{ snack.text }}
    </VSnackbar>

    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h2 class="text-h4 font-weight-bold mb-1">Inventory Analysis</h2>
        <div class="text-body-2 text-medium-emphasis">Comprehensive overview and insights of your warehouse stock.</div>
      </div>
      <div style="width: 300px">
        <AppSelect
          v-model="warehouseId"
          :items="warehouseOptions"
          item-title="title"
          item-value="value"
          label="Select Warehouse"
          variant="outlined"
          density="compact"
          hide-details
        />
      </div>
    </div>

    <!-- Generating State -->
    <VCard v-if="isGenerating" class="mb-6 pa-12 text-center" border>
      <VIcon icon="tabler-loader" class="mdi-spin text-primary mb-4" size="48" />
      <h3 class="text-h5 font-weight-medium mb-2">Data is Generating</h3>
      <p class="text-body-1 text-medium-emphasis">No inventory data found. Analytics are currently being generated, please try again later.</p>
    </VCard>

    <template v-else>
      <!-- Overview Cards -->
      <VRow v-if="overviewData" class="mb-4 match-height">
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">Total SKUs Analyzed</div>
            <div class="text-h4 font-weight-bold text-primary">{{ overviewData.sku_count || 0 }}</div>
            <div class="text-caption text-medium-emphasis mt-2">Generated at: {{ overviewData.generated_at || '--' }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">60-Day GMV</div>
            <div class="text-h4 font-weight-bold text-success">${{ Number(overviewData.total_gmv_60d || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4 d-flex flex-column justify-center">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">Total Inventory Value</div>
            <div class="text-h4 font-weight-bold text-info">${{ Number(overviewData.total_inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" md="3">
          <VCard border class="h-100 pa-4">
            <div class="text-subtitle-2 text-medium-emphasis mb-1">Warehouse Turnover (60d)</div>
            <div class="d-flex align-center gap-2 mb-2">
              <span class="text-h4 font-weight-bold">{{ overviewData.warehouse_turnover?.turnover_rate_60d || '0%' }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption text-medium-emphasis">
              <span>Outbound: {{ overviewData.warehouse_turnover?.total_outbound_60d || 0 }}</span>
              <span>Stock: {{ overviewData.warehouse_turnover?.current_inventory || 0 }}</span>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Charts & Insights -->
      <VRow class="mb-4">
        <!-- Trends -->
        <VCol cols="12" md="7">
          <VCard border class="h-100">
            <VCardItem>
              <VCardTitle>Sales Trends (Last 8 Weeks)</VCardTitle>
            </VCardItem>
            <VCardText>
              <VChart :option="trendsOptions" style="height: 300px" autoresize />
            </VCardText>
          </VCard>
        </VCol>

        <!-- Inventory Age -->
        <VCol cols="12" md="5">
          <VCard border class="h-100">
            <VCardItem>
              <VCardTitle>Inventory Age Distribution (FIFO)</VCardTitle>
            </VCardItem>
            <VCardText>
              <VChart :option="ageOptions" style="height: 300px" autoresize />
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
      
      <VRow class="mb-4" v-if="insightsData">
        <!-- Category Summary -->
        <VCol cols="12" md="6">
          <VCard border class="h-100">
            <VCardItem>
              <VCardTitle>Top Categories</VCardTitle>
            </VCardItem>
            <VCardText>
              <VTable density="comfortable" class="text-body-2">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th class="text-right">Outbound (60d)</th>
                    <th class="text-right">GMV (60d)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(data, cat) in insightsData.category_summary" :key="cat">
                    <td class="font-weight-medium">{{ cat }}</td>
                    <td class="text-right">{{ data.total_outbound }}</td>
                    <td class="text-right">${{ Number(data.gmv_60d).toLocaleString() }}</td>
                  </tr>
                </tbody>
              </VTable>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Co-occurrences -->
        <VCol cols="12" md="6">
          <VCard border class="h-100">
            <VCardItem>
              <VCardTitle>SKU Affinity (Co-occurrences)</VCardTitle>
            </VCardItem>
            <VCardText>
              <VList lines="one" density="compact">
                <VListItem v-for="(aff, idx) in insightsData.sku_affinity" :key="idx" border class="mb-2 rounded">
                  <template #prepend>
                    <VIcon icon="tabler-link" color="primary" class="mr-3" />
                  </template>
                  <VListItemTitle class="font-weight-medium">{{ aff.skus }}</VListItemTitle>
                  <template #append>
                    <VChip size="small" color="primary" variant="tonal">
                      {{ aff.co_occurrences }} orders
                    </VChip>
                  </template>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- SKU Analytics Table -->
      <VCard border class="mt-6">
        <VCardItem class="pb-2">
          <VCardTitle>SKU Analytics List</VCardTitle>
        </VCardItem>
        <VCardText>
          <div class="d-flex align-center gap-4 mb-4 flex-wrap">
            <VTabs v-model="skuType" color="primary">
              <VTab value="all">All SKUs</VTab>
              <VTab value="stagnant">Stagnant Risks</VTab>
              <VTab value="critical">Critical Shortages</VTab>
              <VTab value="top_sellers">Top Sellers</VTab>
            </VTabs>
            <VSpacer />
            <div style="width: 150px">
              <AppSelect
                v-model="skuLimit"
                :items="[50, 100, 200, 500]"
                label="Limit"
                density="compact"
                hide-details
                variant="outlined"
              />
            </div>
            <VBtn prepend-icon="tabler-refresh" :loading="loading" @click="fetchSkusOnly">
              Refresh
            </VBtn>
          </div>
          
          <VTable density="comfortable" class="border rounded text-body-2" hover>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name / Category</th>
                <th class="text-right">Price</th>
                <th class="text-right">Stock (Warn)</th>
                <th class="text-center">Status</th>
                <th class="text-right">Days Left</th>
                <th class="text-right">60d In/Out</th>
                <th class="text-right">No Sale (Days)</th>
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
                  <VChip size="small" :color="sku.stock_status === 'out_of_stock' ? 'error' : (sku.stock_status === 'critical' ? 'error' : (sku.stock_status === 'low' ? 'warning' : 'success'))">
                    {{ sku.stock_status }}
                  </VChip>
                </td>
                <td class="text-right">{{ sku.days_of_stock_left }}</td>
                <td class="text-right">{{ sku.past_60d_inbound }} / {{ sku.past_60d_outbound }}</td>
                <td class="text-right">{{ sku.days_no_sale }}</td>
              </tr>
              <tr v-if="!skuData.list.length && !loading">
                <td colspan="8" class="text-center py-8 text-medium-emphasis">No SKUs found for this criteria.</td>
              </tr>
              <tr v-if="loading && !skuData.list.length">
                <td colspan="8" class="text-center py-8">
                  <VProgressCircular indeterminate color="primary" />
                </td>
              </tr>
            </tbody>
          </VTable>
          
          <div class="d-flex justify-end mt-4 text-caption text-medium-emphasis" v-if="skuData.total">
            Showing up to {{ skuLimit }} of {{ skuData.total }} total matching SKUs.
          </div>
        </VCardText>
      </VCard>
    </template>
  </VContainer>
</template>
`

fs.writeFileSync('src/pages/apps/data-center/inventory-data.vue', content)
console.log('File written successfully')
