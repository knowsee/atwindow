<script setup>
import { $api } from '@/utils/api'
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
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

const filters = ref({
  skuName: '',
  warehouseId: null,
  createRange: '',
  sendRange: '',
})

const headers = [
  { title: '序号', key: 'index', width: '72', sortable: false },
  { title: 'SKU', key: 'en_sku', minWidth: '160' },
  { title: '产品中文名', key: 'cn_name', minWidth: '200' },
  { title: '仓库', key: 'warehouse_name', minWidth: '140' },
  { title: '库存数量', key: 'sku_num', minWidth: '110', align: 'end' },
  { title: '销售数量', key: 'order_num', minWidth: '110', align: 'end' },
  { title: '库存比率', key: 'inventory_ratio', minWidth: '130', align: 'end' },
  { title: '库存评估', key: 'status', minWidth: '140', align: 'center' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function getInventoryStatusText(status) {
  const map = {
    0: '正常',
    1: '库存偏低',
    2: '库存偏高',
    3: '缺货',
  }

  return map[status] !== undefined ? map[status] : '-'
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
      toast(res?.msg || '获取导出数据失败', 'error')

      return
    }

    const list = Array.isArray(res.data.data) ? res.data.data : []
    if (!list.length) {
      toast('当前条件下无数据可导出', 'warning')

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
      filename: makeExportBasename('销量分析'),
      sheetName: '销量分析',
      columns: [
        { key: 'index', title: '序号' },
        { key: 'en_sku', title: 'SKU' },
        { key: 'cn_name', title: '产品中文名' },
        { key: 'warehouse_name', title: '仓库' },
        { key: 'sku_num', title: '库存数量' },
        { key: 'order_num', title: '销售数量' },
        { key: 'inventory_ratio', title: '库存比率' },
        { key: 'status_text', title: '库存评估' },
      ],
      rows,
    })
    toast(`已导出 ${list.length} 条（单次最多 ${EXPORT_PAGE_SIZE} 条）`, 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '导出失败', 'error')
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
      toast(res?.msg || '加载销量数据失败', 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
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
  const remote = await loadWarehouseOptions()

  warehouseOptions.value = [
    { title: '全部仓库', value: null },
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
          <span class="text-h5 font-weight-medium">销量分析</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">
            与订单列表「销量」视图一致：按 SKU / 仓库汇总库存与销售；库存评估需在筛选仓库后更准确。
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
              导出 Excel
            </VBtn>
          </template>
          <VRow class="dc-sales-analysis-page__filters">
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.skuName"
                label="SKU编码"
                placeholder="输入SKU编码"
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
                label="仓库"
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
                label="创建时间"
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
                label="发货时间"
                hide-details
                density="compact"
                :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="__key"
          class="text-body-2 dc-sales-analysis-page__table"
        >
          <template #header.inventory_ratio>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              库存比率
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
                  库存比率 = 库存数量 ÷ 销售数量<br>
                  数据统计范围：上月1日 到 本月1日
                </div>
              </VTooltip>
            </span>
          </template>

          <template #header.status>
            <span class="d-inline-flex align-center justify-center gap-1 w-100">
              库存评估
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
                  正常： 0.3 ≤ 比率 ≤ 3.0<br>
                  库存偏低： 比率 &lt; 0.3 且库存 &gt; 0<br>
                  库存偏高： 比率 &gt; 3.0 或无出库<br>
                  缺货： 库存 ≤ 0 且有出库<br>
                  注：需筛选仓库后查询
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
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
              <span class="text-body-2 text-medium-emphasis">共 {{ total }} 条</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[20, 50, 100]"
                  style="inline-size: 96px;"
                  density="compact"
                  hide-details
                  @update:model-value="itemsPerPage = Number($event)"
                />
                <VPagination
                  v-model="page"
                  :length="pageLength"
                  :total-visible="7"
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
