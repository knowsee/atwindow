<script setup>
import { $api } from '@/utils/api'
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

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
const snack = ref({ show: false, text: '', color: 'info' })

const statusTextMap = {
  1: '待确认',
  2: '已确认',
  4: '待发货',
  6: '已发货',
  14: '问题订单',
}

const statusItems = [
  { title: '全部状态', value: 100 },
  { title: '待确认', value: 1 },
  { title: '已确认', value: 2 },
  { title: '待发货', value: 4 },
  { title: '已发货', value: 6 },
  { title: '问题订单', value: 14 },
]

const filters = ref({
  status: 100,
  orderSn: '',
  cankaohao: '',
  skuName: '',
  createRange: '',
  sendRange: '',
})

const headers = [
  { title: '参考号', key: 'cankaohao', minWidth: '200' },
  { title: '运单号', key: 'ht_tracking_no', minWidth: '180' },
  { title: '收件人', key: 'name', minWidth: '120' },
  { title: 'SKU', key: 'sku', minWidth: '120' },
  { title: '状态', key: 'status_name', minWidth: '110', align: 'center' },
  { title: '运输方式', key: 'transport_type', minWidth: '120' },
  { title: '费用', key: 'total_fee', minWidth: '96', align: 'end' },
  { title: '创建时间', key: 'createtime', minWidth: '150' },
  { title: '操作', key: 'actions', sortable: false, width: '120', align: 'center', fixed: 'end' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function formatMoney(v) {
  if (v == null || v === '')
    return '—'
  const n = Number(v)

  return Number.isFinite(n) ? n.toFixed(2) : String(v)
}

function getStatusText(row) {
  const raw = row?.status_name
  if (raw && String(raw).trim())
    return String(raw).trim()

  return statusTextMap[Number(row?.status)] || `状态(${row?.status ?? '—'})`
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
    status: Number(filters.value.status) || 100,
  }

  if (filters.value.orderSn.trim())
    body['order_sn'] = filters.value.orderSn.trim()
  if (filters.value.cankaohao.trim())
    body.cankaohao = filters.value.cankaohao.trim()
  if (filters.value.skuName.trim())
    body.skuName = filters.value.skuName.trim()

  const cr = normalizeRangeText(filters.value.createRange)
  if (cr)
    body.createtime = cr
  const fr = normalizeRangeText(filters.value.sendRange)
  if (fr)
    body.fahuotime = fr

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/order/returnOrder', {
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
      toast(res?.msg || '加载退货订单失败', 'error')
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

function onQuickStatusChange(v) {
  filters.value.status = v

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    status: 100,
    orderSn: '',
    cankaohao: '',
    skuName: '',
    createRange: '',
    sendRange: '',
  }
  searchList()
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

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">退货订单列表</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">一件代发退货订单；状态在查询按钮下方快捷切换。</span>
        </template>
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              :to="{ name: 'apps-drop-shipping-return-order-create' }"
            >
              创建退货订单
            </VBtn>
            <VBtn
              color="primary"
              size="small"
              variant="tonal"
              prepend-icon="tabler-upload"
              :to="{ name: 'apps-drop-shipping-return-order-batch' }"
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
          :loading="loading"
          actions-position="bottom"
          :quick-filter-items="statusItems"
          :quick-filter="filters.status"
          @search="searchList"
          @reset="resetFilters"
          @update:quick-filter="onQuickStatusChange"
        >
          <VRow dense>
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.orderSn"
                label="订单号"
                placeholder="订单号"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.cankaohao"
                label="参考号"
                placeholder="参考号"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.skuName"
                label="SKU"
                placeholder="SKU 名称"
                hide-details
                density="compact"
                @keyup.enter="searchList"
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
          item-value="id"
          class="text-body-2 ds-return-order-list__table"
        >
          <template #item.cankaohao="{ item }">
            <span class="font-weight-medium">
              {{ item.cankaohao || '—' }}
              <span
                v-if="Number(item.is_qujian) === 1"
                class="text-error"
              >（偏远）</span>
            </span>
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
            <span
              v-else
              class="text-medium-emphasis"
            >—</span>
          </template>

          <template #item.status_name="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="getStatusText(item).includes('问题') ? 'error' : 'primary'"
            >
              {{ getStatusText(item) }}
            </VChip>
          </template>

          <template #item.total_fee="{ item }">
            <span class="tabular-nums">{{ formatMoney(item.total_fee) }}</span>
          </template>

          <template #item.actions="{ item }">
            <VBtn
              size="small"
              variant="tonal"
              color="secondary"
              class="text-none"
              @click="router.push({ name: 'apps-drop-shipping-return-order-create', query: { id: item.id, mode: 'detail' } })"
            >
              详情
            </VBtn>
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
.ds-return-order-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-return-order-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}
</style>
