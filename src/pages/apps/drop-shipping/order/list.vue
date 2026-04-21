<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions, normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)
const warehouseOptions = ref([])
const snack = ref({ show: false, text: '', color: 'info' })
const warehousePersistReady = ref(false)

const statusTextMap = {
  1: '待确认',
  2: '已确认',
  3: '待付款',
  4: '待发货',
  6: '海外仓已发货',
  14: '问题订单',
  15: '已退运费',
}

const statusItems = [
  { title: '全部订单', value: '100' },
  { title: '待确认', value: 1 },
  { title: '已确认', value: 2 },
  { title: '待发货', value: 4 },
  { title: '海外仓已发出', value: 6 },
  { title: '已退运费', value: 15 },
  { title: '问题订单', value: 14 },
]

/** 与下单线路 ID 及旧版 order-list 筛选一致（接口 transport_type 为数字） */
const transportTypeItems = [
  { title: '全部运输方式', value: '' },
  { title: '自提', value: 200 },
  { title: 'USPS（非预上网）', value: 29 },
  { title: 'USPS（T5）', value: 27 },
  { title: 'SPEEDX', value: 53 },
  { title: 'Amazon', value: 56 },
  { title: 'UPS Ground', value: 50 },
  { title: 'FedEx 2Day', value: 52 },
  { title: 'Fedex', value: 59 },
  { title: 'Gofo', value: 210 },
  { title: 'UNI（', value: 211 },
  { title: 'NEXTDAY', value: 213 },
  { title: 'USPS-Y', value: 214 },
]

const erpTypeItems = [
  { title: '全部来源', value: '' },
  { title: '系统', value: 1 },
  { title: '马帮', value: 2 },
  { title: '第三方ERP', value: 3 },
  { title: 'TikTok', value: 4 },
  { title: 'Temu', value: 5 },
]

const remoteItems = [
  { title: '全部', value: '' },
  { title: '偏远地区', value: 1 },
  { title: '非偏远', value: 0 },
]

const filters = ref({
  status: '100',
  cankaohao: '',
  recipientName: '',
  skuName: '',
  htTrackingNo: '',
  warehouseId: null,
  transportType: '',
  erpType: '',
  isQujian: '',
  createRange: '',
  sendRange: '',
  questionReason: '',
})

const headers = [
  { title: '订单号', key: 'order_info', minWidth: '220' },
  { title: '参考号', key: 'cankaohao', minWidth: '130' },
  { title: '收件人', key: 'name', minWidth: '120' },
  { title: '仓库', key: 'warehouse_name', minWidth: '120' },
  { title: 'SKU', key: 'sku', minWidth: '120' },
  { title: '运单号', key: 'ht_tracking_no', minWidth: '170' },
  { title: '费用', key: 'total_fee', minWidth: '90' },
  { title: '状态', key: 'status_name', minWidth: '110', align: 'center' },
  { title: '操作', key: 'actions', sortable: false, width: '230', align: 'center', fixed: 'end' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function getStatusText(row) {
  const raw = row?.status_name
  if (raw && String(raw).trim())
    return String(raw).trim()

  return statusTextMap[Number(row?.status)] || `状态(${row?.status ?? '-'})`
}

function trackUrl(trackingNo) {
  const v = String(trackingNo || '').trim()
  if (!v)
    return ''

  return `https://t.17track.net/zh-cn#nums=${encodeURIComponent(v)}`
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
  }

  if (filters.value.status !== '' && filters.value.status != null) {
    body.status = String(filters.value.status) === 'xl'
      ? 'xl'
      : Number(filters.value.status)
  }
  if (filters.value.warehouseId)
    body['warehouse_id'] = Number(filters.value.warehouseId)
  if (filters.value.cankaohao.trim())
    body.cankaohao = filters.value.cankaohao.trim()
  if (filters.value.recipientName.trim())
    body['recipient_name'] = filters.value.recipientName.trim()
  if (filters.value.skuName.trim())
    body.skuName = filters.value.skuName.trim()
  if (filters.value.htTrackingNo.trim())
    body['ht_tracking_no'] = filters.value.htTrackingNo.trim()
  if (filters.value.transportType !== '' && filters.value.transportType != null)
    body['transport_type'] = Number(filters.value.transportType)
  if (filters.value.erpType !== '' && filters.value.erpType != null)
    body['erp_type'] = Number(filters.value.erpType)
  if (filters.value.isQujian !== '' && filters.value.isQujian != null)
    body['is_qujian'] = Number(filters.value.isQujian)
  if (filters.value.questionReason.trim())
    body['question_reason'] = filters.value.questionReason.trim()

  const range = normalizeRangeText(filters.value.createRange)
  if (range)
    body.createtime = range
  const sendRange = normalizeRangeText(filters.value.sendRange)
  if (sendRange)
    body.fahuotime = sendRange

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/order/orderListV2', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      rows.value = Array.isArray(res.data.data) ? res.data.data : []
      total.value = Number(res.data.count) || 0
    }
    else {
      rows.value = []
      total.value = 0
      toast(res?.msg || '加载订单列表失败', 'error')
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
  if (filters.value.status === '' || filters.value.status == null) {
    toast('状态为必选项，请先选择状态', 'warning')

    return
  }

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

/** 状态快捷筛选：与 filters.status 同步并拉取列表 */
function onStatusTabChange(v) {
  if (v === '' || v == null) {
    toast('状态为必选项，请先选择状态', 'warning')

    return
  }

  filters.value.status = v

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    status: '100',
    cankaohao: '',
    recipientName: '',
    skuName: '',
    htTrackingNo: '',
    warehouseId: null,
    transportType: '',
    erpType: '',
    isQujian: '',
    createRange: '',
    sendRange: '',
    questionReason: '',
  }
  searchList()
}

async function exportOrders() {
  try {
    const res = await $api('/order/excelYjdf', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1) {
      toast('导出任务已提交', 'success')
    }
    else {
      toast(res?.msg || '导出失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '导出失败', 'error')
  }
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
    class="pa-4 pa-sm-6 ds-order-list-page"
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
          <span class="text-h5 font-weight-medium">订单列表</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">填写条件后点查询；状态在查询按钮下方快捷切换；仓库、运输方式与时间等展开「高级搜索」。</span>
        </template>
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              :to="{ name: 'apps-drop-shipping-order-create' }"
            >
              创建订单
            </VBtn>
            <VBtn
              color="primary"
              size="small"
              variant="tonal"
              prepend-icon="tabler-upload"
              :to="{ name: 'apps-drop-shipping-order-batch' }"
            >
              批量创建
            </VBtn>
          </div>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <AppQueryPanel
          class="mb-4"
          expandable
          :loading="loading"
          actions-position="bottom"
          :quick-filter-items="statusItems"
          :quick-filter="filters.status"
          @search="searchList"
          @reset="resetFilters"
          @update:quick-filter="onStatusTabChange"
        >
          <template #export>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-download"
              @click="exportOrders"
            >
              导出订单
            </VBtn>
          </template>
          <template #primary>
            <VRow class="ds-order-list-page__filters">
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppTextField
                  v-model="filters.cankaohao"
                  label="订单号"
                  placeholder="订单号或参考号"
                  hide-details
                  density="compact"
                  @keyup.enter="searchList"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppTextField
                  v-model="filters.recipientName"
                  label="收件人"
                  placeholder="收件人姓名"
                  hide-details
                  density="compact"
                  @keyup.enter="searchList"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppTextField
                  v-model="filters.skuName"
                  label="SKU"
                  placeholder="SKU 编码"
                  hide-details
                  density="compact"
                  @keyup.enter="searchList"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppTextField
                  v-model="filters.htTrackingNo"
                  label="国际单号"
                  placeholder="国际单号/追踪号"
                  hide-details
                  density="compact"
                  @keyup.enter="searchList"
                />
              </VCol>
            </VRow>
          </template>
          <template #advanced>
            <VRow class="ds-order-list-page__filters">
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
                <AppSelect
                  v-model="filters.transportType"
                  :items="transportTypeItems"
                  item-title="title"
                  item-value="value"
                  label="运输方式"
                  hide-details
                  density="compact"
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <AppSelect
                  v-model="filters.erpType"
                  :items="erpTypeItems"
                  item-title="title"
                  item-value="value"
                  label="来源"
                  hide-details
                  density="compact"
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <AppSelect
                  v-model="filters.isQujian"
                  :items="remoteItems"
                  item-title="title"
                  item-value="value"
                  label="偏远地区"
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
              <VCol
                cols="12"
                md="3"
              >
                <AppTextField
                  v-model="filters.questionReason"
                  label="问题原因"
                  placeholder="输入问题原因"
                  hide-details
                  density="compact"
                  @keyup.enter="searchList"
                />
              </VCol>
            </VRow>
          </template>
        </AppQueryPanel>

        <VDataTableServer
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="id"
          class="text-body-2 ds-order-list-page__table"
        >
          <template #item.order_info="{ item }">
            <div class="order-info-cell">
              <div class="order-info-cell__sn">
                {{ item.order_sn || '-' }}
              </div>
              <div class="order-info-cell__time">
                <VIcon
                  icon="tabler-clock"
                  size="14"
                  class="me-1"
                />
                {{ item.createtime || '-' }}
              </div>
            </div>
          </template>

          <template #item.ht_tracking_no="{ item }">
            <a
              v-if="item.ht_tracking_no"
              :href="trackUrl(item.ht_tracking_no)"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-decoration-none"
            >
              {{ item.ht_tracking_no }}
            </a>
            <span v-else>-</span>
          </template>

          <template #item.status_name="{ item }">
            <div class="d-flex justify-center">
              <VChip
                size="small"
                variant="tonal"
                :color="getStatusText(item).includes('问题') ? 'error' : 'primary'"
              >
                {{ getStatusText(item) }}
              </VChip>
            </div>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex align-center justify-center gap-2">
              <VBtn
                size="small"
                variant="tonal"
                color="secondary"
                @click="router.push({ name: 'apps-drop-shipping-order-create', query: { id: item.id, mode: 'detail' } })"
              >
                详情
              </VBtn>
              <VBtn
                size="small"
                variant="tonal"
                color="primary"
                @click="router.push({ name: 'apps-drop-shipping-order-create', query: { id: item.id, mode: 'copy' } })"
              >
                复制
              </VBtn>
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
.ds-order-list-page__filters :deep(.v-col) {
  padding-block: 0.375rem;
}

.ds-order-list-page__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-order-list-page__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

.order-info-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.order-info-cell__sn {
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.9);
  line-height: 1.2;
}

.order-info-cell__time {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  line-height: 1.1;
  color: rgba(var(--v-theme-on-surface), 0.68);
  background: rgba(var(--v-theme-on-surface), 0.05);
}
</style>
