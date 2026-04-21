<script setup>
/* eslint-disable camelcase -- /Ordernewapi/shippingList 查询参数与后端字段名一致 */
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import ShippingBatchStatusDialog from '@/components/print-label/ShippingBatchStatusDialog.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { ORDER_DD_FILTER_ALL } from '@/views/apps/print-label/useYundanList'

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
const lastPage = ref(1)
const itemsPerPage = ref(20)
const snack = ref({ show: false, text: '', color: 'info' })
const batchDialogOpen = ref(false)

/** 从订单行打开批次弹窗时的预填与是否直达明细 */
const batchDialogProps = ref({
  initialBatchSn: '',
  initialBatchId: null,
  autoOpenBatchDetail: false,
})

const router = useRouter()
const cancellingId = ref(null)

// 参考号 cankaohao；渠道 channelType；创建区间 createRange → create_time
const filters = ref({
  cankaohao: '',
  channelType: ORDER_DD_FILTER_ALL,
  status: null,
  createRange: '',
  tracking_number: '',
})

const channelTypeItems = ref([
  { title: '全部渠道', value: ORDER_DD_FILTER_ALL },
])

/** 与筛选同源：provider / QID → 渠道展示名（getChannelList） */
const channelNameByQid = shallowRef(new Map())

async function loadChannelList() {
  try {
    const res = await $api('/ordernew/getChannelList', { method: 'GET' })
    if (Number(res?.code) === 1 && Array.isArray(res.data)) {
      const nameByQid = new Map()

      const mapped = res.data.map(c => {
        const qid = Number(c.qid)
        const title = String(c.name ?? '').trim() || '未命名渠道'
        if (Number.isFinite(qid))
          nameByQid.set(qid, title)

        return { title, value: qid }
      })

      channelNameByQid.value = nameByQid
      channelTypeItems.value = [
        { title: '全部渠道', value: ORDER_DD_FILTER_ALL },
        ...mapped,
      ]
    }
  }
  catch (e) {
    console.error(e)
  }
}

/** 列表渠道名称：按行 provider（QID）匹配 getChannelList */
function channelDisplayName(row) {
  const raw = row?.provider
  if (raw == null || raw === '')
    return '—'
  const qid = Number(raw)
  if (!Number.isFinite(qid))
    return String(raw)
  const name = channelNameByQid.value.get(qid)

  return name || String(qid)
}

/** 渠道 + 渠道编码：有编码时为「名称（编码）」，无编码则仅名称 */
function channelTableCell(row) {
  const namePart = channelDisplayName(row)
  const code = String(row?.channel_code ?? '').trim()
  if (!code)
    return namePart

  return `${namePart}（${code}）`
}

const STATUS_ITEMS = [
  { title: '全部', value: null },
  { title: '待处理', value: 0 },
  { title: '请求中', value: 1 },
  { title: '成功', value: 2 },
  { title: '失败', value: 3 },
  { title: '已取消', value: 4 },
]

const headers = [
  { title: 'ID', key: 'id', width: '88', align: 'end' },
  { title: '创建时间', key: 'createtime', minWidth: '158' },
  { title: '订单号', key: 'order_sn', minWidth: '168' },
  { title: '参考号', key: 'cankaohao', minWidth: '120' },
  { title: '跟踪号', key: 'tracking_number', minWidth: '160' },
  { title: '渠道（渠道编码）', key: 'provider', minWidth: '200' },
  { title: '费用', key: 'customer_fee', minWidth: '96', align: 'end' },
  { title: '状态', key: 'status', minWidth: '100', align: 'center' },
  { title: '失败原因', key: 'fail_reason', minWidth: '160' },
  { title: '操作', key: 'actions', sortable: false, minWidth: '220', width: '220', align: 'end', fixed: 'end' },
]

const pageLength = computed(() => Math.max(1, lastPage.value))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function formatMoney(v, cur) {
  if (v == null || v === '')
    return '—'
  const n = Number(v)
  const s = Number.isFinite(n) ? n.toFixed(2) : String(v)
  
  return cur ? `${s} ${cur}` : s
}

function formatTs(ts) {
  if (ts == null || ts === '')
    return '—'
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0)
    return '—'
  
  return new Date(n * 1000).toLocaleString('zh-CN', { hour12: false })
}

function statusLabel(s) {
  const m = {
    0: '待处理',
    1: '请求中',
    2: '成功',
    3: '失败',
    4: '已取消',
  }

  
  return m[Number(s)] ?? (s == null || s === '' ? '—' : String(s))
}

function statusLabelWithCancel(row) {
  const base = statusLabel(row?.status)
  if (Number(row?.cancel_status) === 1)
    return `${base}（取消中）`

  return base
}

function statusColor(s) {
  const n = Number(s)
  if (n === 2)
    return 'success'
  if (n === 3)
    return 'error'
  if (n === 4)
    return 'secondary'
  if (n === 1)
    return 'info'
  
  return 'warning'
}

/**
 * AppDateTimePicker range：与运单旧列表一致，提交为 create_time
 * @param {unknown} raw
 */
function normalizeCreateRange(raw) {
  const s = String(raw ?? '').trim()
  if (!s)
    return ''
  if (s.includes(' to '))
    return s.replace(' to ', ' - ')

  return s
}

function buildQuery() {
  const q = {
    per_page: Number(itemsPerPage.value) || 20,
    page: Number(page.value) || 1,
  }

  const f = filters.value
  const ck = String(f.cankaohao || '').trim()
  if (ck)
    q.cankaohao = ck
  const tp = f.channelType
  if (tp != null && tp !== '' && Number(tp) !== ORDER_DD_FILTER_ALL && Number.isFinite(Number(tp)))
    q.provider = Number(tp)
  if (f.status !== null && f.status !== '' && Number.isFinite(Number(f.status)))
    q.status = Number(f.status)
  const ct = normalizeCreateRange(f.createRange)
  if (ct)
    q.create_time = ct
  const tn = String(f.tracking_number || '').trim()
  if (tn)
    q.tracking_number = tn

  return q
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/Ordernewapi/shippingList', {
      method: 'GET',
      query: buildQuery(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      const d = res.data

      rows.value = Array.isArray(d.data) ? d.data : []
      total.value = Number(d.total) || 0

      const ipp = Number(d.per_page) || Number(itemsPerPage.value) || 20

      lastPage.value = Math.max(
        1,
        Number(d.last_page) || (total.value ? Math.ceil(total.value / ipp) : 1),
      )

      return
    }

    rows.value = []
    total.value = 0
    lastPage.value = 1
    toast(res?.msg || '加载订单列表失败', 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    lastPage.value = 1
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    loading.value = false
  }
}

function searchList() {
  const atFirst = page.value === 1

  page.value = 1
  if (atFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    cankaohao: '',
    channelType: ORDER_DD_FILTER_ALL,
    status: null,
    createRange: '',
    tracking_number: '',
  }
  searchList()
}

function shippingRowBatchDisplay(row) {
  const sn = String(row?.batch_sn ?? '').trim()
  if (sn)
    return sn
  const bid = Number(row?.batch_id)
  if (Number.isFinite(bid) && bid > 0)
    return String(bid)

  return '—'
}

/** 有有效批次：batch_id>0 或 batch_sn 非空且非 "0" */
function hasShippingBatch(row) {
  const bid = Number(row?.batch_id)
  if (Number.isFinite(bid) && bid > 0)
    return true
  const sn = String(row?.batch_sn ?? '').trim()

  return Boolean(sn && sn !== '0')
}

function openBatchDetailFromOrderRow(row) {
  if (!hasShippingBatch(row))
    return

  const bid = Number(row?.batch_id)
  const sn = String(row?.batch_sn ?? '').trim()

  batchDialogProps.value = {
    initialBatchSn: sn && sn !== '0' ? sn : '',
    initialBatchId: Number.isFinite(bid) && bid > 0 ? bid : null,
    autoOpenBatchDetail: true,
  }
  batchDialogOpen.value = true
}

function openBatchDialogFromToolbar() {
  batchDialogProps.value = {
    initialBatchSn: '',
    initialBatchId: null,
    autoOpenBatchDetail: false,
  }
  batchDialogOpen.value = true
}

function onBatchDialogUpdate(v) {
  batchDialogOpen.value = v
  if (!v) {
    batchDialogProps.value = {
      initialBatchSn: '',
      initialBatchId: null,
      autoOpenBatchDetail: false,
    }
  }
}

onMounted(() => {
  loadChannelList()
})

function openLabel(row) {
  const url = resolveBackendFileUrl(row?.label_url)
  if (!url) {
    toast('暂无面单文件', 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

function openView(row) {
  const id = row?.id
  if (id == null || id === '') {
    toast('订单 ID 无效', 'warning')

    return
  }
  router.push({
    name: 'apps-print-label-order-new-detail-id',
    params: { id: String(id) },
    query: row?.order_sn ? { orderSn: String(row.order_sn) } : undefined,
  })
}

/** 成功（status=2）时可取消；接口名以后端为准 */
function showCancelButton(row) {
  return Number(row?.status) === 2
}

async function cancelShipping(row) {
  const orderId = Number(row?.id)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    toast('订单标识无效', 'warning')

    return
  }
  if (!window.confirm('确定取消该运单？'))
    return

  cancellingId.value = row.id
  try {
    const res = await $api('/Ordernewapi/shippingOrderCancel', {
      method: 'POST',
      body: { order_id: orderId },
    })

    if (Number(res?.code) === 1 || Number(res?.code) === 200) {
      toast(res?.message || res?.msg || '已提交取消', 'success')
      loadList()

      return
    }
    toast(res?.message || res?.msg || '取消失败', 'error')
  }
  catch (e) {
    toast(e?.data?.message || e?.data?.msg || e?.message || '取消失败', 'error')
  }
  finally {
    cancellingId.value = null
  }
}

watch([page, itemsPerPage], loadList, { immediate: true })
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <ShippingBatchStatusDialog
      :model-value="batchDialogOpen"
      :initial-batch-sn="batchDialogProps.initialBatchSn"
      :initial-batch-id="batchDialogProps.initialBatchId"
      :auto-open-batch-detail="batchDialogProps.autoOpenBatchDetail"
      @update:model-value="onBatchDialogUpdate"
    />

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">订单列表</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">填写条件后点击「查询」，分页切换会自动刷新。</span>
        </template>
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              variant="tonal"
              size="small"
              class="text-none"
              prepend-icon="tabler-packages"
              @click="openBatchDialogFromToolbar"
            >
              批量出单状态
            </VBtn>
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              class="text-none"
              :to="{ name: 'apps-print-label-create' }"
            >
              新建运单
            </VBtn>
          </div>
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
          <VRow dense>
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <AppTextField
                v-model="filters.cankaohao"
                label="参考号"
                placeholder="模糊匹配"
                hide-details
                density="compact"
                clearable
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <AppSelect
                v-model="filters.channelType"
                :items="channelTypeItems"
                item-title="title"
                item-value="value"
                label="渠道"
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <AppSelect
                v-model="filters.status"
                :items="STATUS_ITEMS"
                item-title="title"
                item-value="value"
                label="状态"
                clearable
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="6"
            >
              <AppDateTimePicker
                v-model="filters.createRange"
                label="创建日期"
                density="compact"
                hide-details
                placeholder="选择日期区间"
                :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="6"
            >
              <AppTextField
                v-model="filters.tracking_number"
                label="跟踪号"
                hide-details
                density="compact"
                clearable
                @keyup.enter="searchList"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="id"
          class="text-body-2 ds-shipping-list__table"
        >
          <template #item.createtime="{ item }">
            {{ formatTs(item.createtime) }}
          </template>
          <template #item.batch_sn="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 140px;"
            >{{ shippingRowBatchDisplay(item) }}</span>
          </template>
          <template #item.provider="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 280px;"
              :title="channelTableCell(item)"
            >{{ channelTableCell(item) }}</span>
          </template>
          <template #item.customer_fee="{ item }">
            <span class="tabular-nums">{{ formatMoney(item.customer_fee, item.currency) }}</span>
          </template>
          <template #item.status="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="statusColor(item.status)"
            >
              {{ statusLabelWithCancel(item) }}
            </VChip>
          </template>
          <template #item.fail_reason="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 220px;"
              :title="item.fail_reason || ''"
            >{{ item.fail_reason || '—' }}</span>
          </template>
          <template #item.actions="{ item }">
            <div
              class="shipping-list__actions-toolbar"
              role="toolbar"
              :aria-label="`订单操作 ${String(item?.order_sn ?? item?.id ?? '')}`"
            >
              <VTooltip
                location="top"
                text="查看订单详情"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    density="compact"
                    color="primary"
                    variant="tonal"
                    class="text-none shipping-list__toolbar-btn shipping-list__toolbar-btn--primary"
                    prepend-icon="tabler-list-details"
                    @click="openView(item)"
                  >
                    查看
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                text="在新窗口打开面单"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    icon
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="primary"
                    class="shipping-list__toolbar-btn"
                    aria-label="面单"
                    :disabled="!item.label_url"
                    @click="openLabel(item)"
                  >
                    <VIcon
                      icon="tabler-file-text"
                      size="18"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                v-if="hasShippingBatch(item)"
                location="top"
                text="打开该批次导入明细"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    icon
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="secondary"
                    class="shipping-list__toolbar-btn"
                    aria-label="批次明细"
                    @click="openBatchDetailFromOrderRow(item)"
                  >
                    <VIcon
                      icon="tabler-packages"
                      size="18"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                v-if="showCancelButton(item)"
                location="top"
                text="取消运单"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    icon
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="error"
                    class="shipping-list__toolbar-btn"
                    aria-label="取消"
                    :loading="cancellingId === item.id"
                    @click="cancelShipping(item)"
                  >
                    <VIcon
                      icon="tabler-ban"
                      size="18"
                    />
                  </VBtn>
                </template>
              </VTooltip>
            </div>
          </template>

          <template #bottom>
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
              <span class="text-body-2 text-medium-emphasis">共 {{ total }} 条</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[10, 20, 50, 100]"
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
.ds-shipping-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-shipping-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

/* 与批量出单状态弹窗操作列一致：主按钮 + 图标次操作，无外框 */
.shipping-list__actions-toolbar {
  display: inline-flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  max-inline-size: 100%;
}

.shipping-list__actions-toolbar :deep(.v-btn) {
  flex-shrink: 0;
}

.shipping-list__toolbar-btn {
  min-inline-size: 0;
}

.shipping-list__toolbar-btn--primary {
  padding-inline: 10px !important;
}
</style>
