<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { downloadXlsx, EXPORT_PAGE_SIZE, makeExportBasename } from '@/utils/exportXlsx'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions, normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)
const warehouseOptions = ref([])
const snack = ref({ show: false, text: '', color: 'info' })
const exporting = ref(false)
const warehousePersistReady = ref(false)
const { t } = useI18n({ useScope: 'global' })

const filters = ref({
  skuName: '',
  warehouseId: null,
  createRange: '',
  sendRange: '',
})

const headers = computed(() => [
  { title: t('pages.dataCenterSalesAnalysis.headers.index'), key: 'index', width: '72', sortable: false },
  { title: 'SKU', key: 'en_sku', minWidth: '160' },
  { title: t('pages.dataCenterSalesAnalysis.headers.productCnName'), key: 'cn_name', minWidth: '200' },
  { title: t('pages.dropShippingOrderCreate.sections.logistics.warehouse'), key: 'warehouse_name', minWidth: '140' },
  { title: t('pages.dataCenterSalesAnalysis.headers.stockQty'), key: 'sku_num', minWidth: '110', align: 'end' },
  { title: t('pages.dataCenterSalesAnalysis.headers.salesQty'), key: 'order_num', minWidth: '110', align: 'end' },
  { title: t('pages.dataCenterSalesAnalysis.headers.inventoryRatio'), key: 'inventory_ratio', minWidth: '130', align: 'end' },
  { title: t('pages.dataCenterSalesAnalysis.headers.inventoryStatus'), key: 'status', minWidth: '140', align: 'center' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function getInventoryStatusText(status) {
  const map = {
    0: 'pages.dataCenterSalesAnalysis.status.normal',
    1: 'pages.dataCenterSalesAnalysis.status.low',
    2: 'pages.dataCenterSalesAnalysis.status.high',
    3: 'pages.dataCenterSalesAnalysis.status.out',
  }

  return map[status] !== undefined ? t(map[status]) : '-'
}

function getInventoryStatusColor(status) {
  const map = {
    0: 'success',
    1: 'warning',
    2: 'info',
    3: 'error',
  }

  return map[status] || 'default'
}

function formatRatio(val) {
  if (val === null || val === undefined || val === '')
    return '-'

  const n = Number(val)
  if (Number.isFinite(n))
    return n.toFixed(2)

  return String(val)
}

function buildBody(pagination = null) {
  const body = {
    'current_page': pagination?.current_page ?? page.value,
    'per_page_num': pagination?.per_page_num ?? itemsPerPage.value,
    status: 'xl',
  }

  if (filters.value.warehouseId)
    body['warehouse_id'] = Number(filters.value.warehouseId)
  if (filters.value.skuName.trim())
    body.skuName = filters.value.skuName.trim()

  const range = normalizeRangeText(filters.value.createRange)
  if (range)
    body.createtime = range
  const sendRange = normalizeRangeText(filters.value.sendRange)
  if (sendRange)
    body.fahuotime = sendRange

  return body
}

async function exportToExcel() {
  if (exporting.value)
    return

  exporting.value = true
  try {
    const res = await $api('/order/orderListV2', {
      method: 'POST',
      body: buildBody({ 'current_page': 1, 'per_page_num': EXPORT_PAGE_SIZE }),
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      toast(res?.msg || t('pages.dataCenterSalesAnalysis.messages.exportLoadFailed'), 'error')

      return
    }

    const list = Array.isArray(res.data.data) ? res.data.data : []
    if (!list.length) {
      toast(t('pages.dataCenterSalesAnalysis.messages.exportNoData'), 'warning')

      return
    }

    const rows = list.map((row, i) => ({
      index: i + 1,
      'en_sku': row.en_sku ?? '',
      'cn_name': row.cn_name ?? '',
      'warehouse_name': row.warehouse_name ?? '',
      'sku_num': row.sku_num ?? '',
      'order_num': row.order_num ?? '',
      'inventory_ratio': formatRatio(row.inventory_ratio),
      'status_text': getInventoryStatusText(row.status),
    }))

    await downloadXlsx({
      filename: makeExportBasename(t('pages.dataCenterSalesAnalysis.title')),
      sheetName: t('pages.dataCenterSalesAnalysis.title'),
      columns: [
        { key: 'index', title: t('pages.dataCenterSalesAnalysis.headers.index') },
        { key: 'en_sku', title: 'SKU' },
        { key: 'cn_name', title: t('pages.dataCenterSalesAnalysis.headers.productCnName') },
        { key: 'warehouse_name', title: t('pages.dropShippingOrderCreate.sections.logistics.warehouse') },
        { key: 'sku_num', title: t('pages.dataCenterSalesAnalysis.headers.stockQty') },
        { key: 'order_num', title: t('pages.dataCenterSalesAnalysis.headers.salesQty') },
        { key: 'inventory_ratio', title: t('pages.dataCenterSalesAnalysis.headers.inventoryRatio') },
        { key: 'status_text', title: t('pages.dataCenterSalesAnalysis.headers.inventoryStatus') },
      ],
      rows,
    })
    toast(t('pages.dataCenterSalesAnalysis.messages.exportSuccess', { count: list.length, max: EXPORT_PAGE_SIZE }), 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dataCenterSalesAnalysis.messages.exportFailed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/order/orderListV2', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      const raw = Array.isArray(res.data.data) ? res.data.data : []

      rows.value = raw.map((row, i) => ({
        ...row,
        __key: `${page.value}-${i}-${row.en_sku || ''}-${row.warehouse_name || ''}`,
      }))
      total.value = Number(res.data.count) || 0
    }
    else {
      rows.value = []
      total.value = 0
      toast(res?.msg || t('pages.dataCenterSalesAnalysis.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dataCenterSalesAnalysis.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function searchList() {
  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    skuName: '',
    warehouseId: null,
    createRange: '',
    sendRange: '',
  }
  searchList()
}

watch([page, itemsPerPage], loadList, { immediate: true })

watch(() => filters.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  const remote = await loadWarehouseOptions(t)

  warehouseOptions.value = [
    { title: t('pages.dropShippingOrderList.filters.allWarehouses'), value: null },
    ...remote,
  ]
  filters.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: false })
  await nextTick()
  warehousePersistReady.value = true
})
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 dc-sales-analysis-page"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">{{ $t('pages.dataCenterSalesAnalysis.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">
            {{ $t('pages.dataCenterSalesAnalysis.subtitle') }}
          </span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <AppQueryPanel
          class="mb-4"
          :loading="loading"
          actions-position="bottom"
          @search="searchList"
          @reset="resetFilters"
        >
          <template #export>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-file-export"
              :loading="exporting"
              :disabled="loading"
              @click="exportToExcel"
            >
              {{ $t('pages.dataCenterSalesAnalysis.actions.exportExcel') }}
            </VBtn>
          </template>
          <VRow class="dc-sales-analysis-page__filters">
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.skuName"
                :label="$t('pages.dataCenterSalesAnalysis.filters.skuCode')"
                :placeholder="$t('pages.dataCenterSalesAnalysis.filters.skuCodePlaceholder')"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppSelect
                v-model="filters.warehouseId"
                :items="warehouseOptions"
                item-title="title"
                item-value="value"
                :label="$t('pages.dropShippingOrderCreate.sections.logistics.warehouse')"
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppDateTimePicker
                v-model="filters.createRange"
                :label="$t('pages.dropShippingOrderList.filters.createdAt')"
                hide-details
                density="compact"
                :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppDateTimePicker
                v-model="filters.sendRange"
                :label="$t('pages.dropShippingOrderList.filters.shippedAt')"
                hide-details
                density="compact"
                :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          disable-sort
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="__key"
          class="text-body-2 dc-sales-analysis-page__table"
        >
          <template #header.inventory_ratio>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              {{ $t('pages.dataCenterSalesAnalysis.headers.inventoryRatio') }}
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                <div>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.ratioLine1') }}<br>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.ratioLine2') }}
                </div>
              </VTooltip>
            </span>
          </template>

          <template #header.status>
            <span class="d-inline-flex align-center justify-center gap-1 w-100">
              {{ $t('pages.dataCenterSalesAnalysis.headers.inventoryStatus') }}
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                <div>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.statusNormal') }}<br>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.statusLow') }}<br>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.statusHigh') }}<br>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.statusOut') }}<br>
                  {{ $t('pages.dataCenterSalesAnalysis.tooltips.statusNote') }}
                </div>
              </VTooltip>
            </span>
          </template>

          <template #item.index="{ index }">
            {{ (page - 1) * itemsPerPage + index + 1 }}
          </template>

          <template #item.cn_name="{ item }">
            {{ item.cn_name || '-' }}
          </template>

          <template #item.warehouse_name="{ item }">
            {{ item.warehouse_name || '-' }}
          </template>

          <template #item.order_num="{ item }">
            <span class="text-primary font-weight-semibold">{{ item.order_num }}</span>
          </template>

          <template #item.inventory_ratio="{ item }">
            {{ formatRatio(item.inventory_ratio) }}
          </template>

          <template #item.status="{ item }">
            <div class="d-flex justify-center">
              <VChip
                size="small"
                variant="tonal"
                :color="getInventoryStatusColor(item.status)"
              >
                {{ getInventoryStatusText(item.status) }}
              </VChip>
            </div>
          </template>

          <template #bottom>
            <VDivider />
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
              <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[20, 50, 100]"
                  style="inline-size: 100px;"
                  density="compact"
                  hide-details
                  @update:model-value="itemsPerPage = Number($event)"
                />
                <VPagination
                  v-model="page"
                  :length="pageLength"
                  :total-visible="5"
                  size="small"
                  active-color="primary"
                />
              </div>
            </div>
          </template>
        </VDataTableServer>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<style scoped>
.dc-sales-analysis-page__filters :deep(.v-col) {
  padding-block: 0.375rem;
}

.dc-sales-analysis-page__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.dc-sales-analysis-page__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}
</style>
