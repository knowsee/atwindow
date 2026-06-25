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
const { t } = useI18n({ useScope: 'global' })

const statusTextKeys = {
  1: 'pages.dropShippingOrderList.status.pendingConfirm',
  2: 'pages.dropShippingOrderList.status.confirmed',
  3: 'pages.dropShippingOrderList.status.pendingPayment',
  4: 'pages.dropShippingOrderList.status.pendingShipment',
  6: 'pages.dropShippingOrderList.status.overseasShipped',
  14: 'pages.dropShippingOrderList.status.problem',
  15: 'pages.dropShippingOrderList.status.refundedShipping',
}

const statusItems = computed(() => [
  { title: t('pages.dropShippingOrderList.status.all'), value: '100' },
  { title: t('pages.dropShippingOrderList.status.pendingConfirm'), value: 1 },
  { title: t('pages.dropShippingOrderList.status.confirmed'), value: 2 },
  { title: t('pages.dropShippingOrderList.status.pendingShipment'), value: 4 },
  { title: t('pages.dropShippingOrderList.status.overseasSent'), value: 6 },
  { title: t('pages.dropShippingOrderList.status.refundedShipping'), value: 15 },
  { title: t('pages.dropShippingOrderList.status.problem'), value: 14 },
])

/** Keep transport_type IDs aligned with order creation and the legacy order-list filters. */
const transportTypeItems = computed(() => [
  { title: t('pages.dropShippingOrderList.transport.all'), value: '' },
  { title: t('pages.dropShippingOrderList.transport.pickup'), value: 200 },
  { title: t('pages.dropShippingOrderList.transport.uspsNoPreOnline'), value: 29 },
  { title: t('pages.dropShippingOrderList.transport.uspsT5'), value: 27 },
  { title: 'SPEEDX', value: 53 },
  { title: 'Amazon', value: 56 },
  { title: 'UPS Ground', value: 50 },
  { title: 'FedEx 2Day', value: 52 },
  { title: 'Fedex', value: 59 },
  { title: 'Gofo', value: 210 },
  { title: t('pages.dropShippingOrderList.transport.uni'), value: 211 },
  { title: 'NEXTDAY', value: 213 },
  { title: 'USPS-Y', value: 214 },
])

const erpTypeItems = computed(() => [
  { title: t('pages.dropShippingOrderList.source.all'), value: '' },
  { title: t('pages.dropShippingOrderList.source.system'), value: 1 },
  { title: t('pages.dropShippingOrderList.source.mabang'), value: 2 },
  { title: t('pages.dropShippingOrderList.source.thirdPartyErp'), value: 3 },
  { title: 'TikTok', value: 4 },
  { title: 'Temu', value: 5 },
])

const remoteItems = computed(() => [
  { title: t('pages.dropShippingOrderList.remote.all'), value: '' },
  { title: t('pages.dropShippingOrderList.remote.remote'), value: 1 },
  { title: t('pages.dropShippingOrderList.remote.nonRemote'), value: 0 },
])

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

const headers = computed(() => [
  { title: t('pages.dropShippingOrderList.headers.orderNo'), key: 'order_info', minWidth: '220' },
  { title: t('pages.dropShippingOrderList.headers.referenceNo'), key: 'cankaohao', minWidth: '130' },
  { title: t('pages.dropShippingOrderList.headers.recipient'), key: 'name', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.warehouse'), key: 'warehouse_name', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.sku'), key: 'sku', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.trackingNo'), key: 'ht_tracking_no', minWidth: '170' },
  { title: t('pages.dropShippingOrderList.headers.fee'), key: 'total_fee', minWidth: '90' },
  { title: t('pages.dropShippingOrderList.headers.status'), key: 'status_name', minWidth: '110', align: 'center' },
  { title: t('pages.dropShippingOrderList.headers.actions'), key: 'actions', sortable: false, width: '130', align: 'end', fixed: 'end' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function getStatusText(row) {
  const raw = row?.status_name
  if (raw && String(raw).trim())
    return String(raw).trim()

  const statusKey = statusTextKeys[Number(row?.status)]

  return statusKey
    ? t(statusKey)
    : t('pages.dropShippingOrderList.status.unknown', { status: row?.status ?? '-' })
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
      toast(res?.msg || t('pages.dropShippingOrderList.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderList.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function searchList() {
  if (filters.value.status === '' || filters.value.status == null) {
    toast(t('pages.dropShippingOrderList.messages.statusRequired'), 'warning')

    return
  }

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

/** Keep the quick status filter synced with filters.status and reload the list. */
function onStatusTabChange(v) {
  if (v === '' || v == null) {
    toast(t('pages.dropShippingOrderList.messages.statusRequired'), 'warning')

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
      toast(t('pages.dropShippingOrderList.messages.exportSubmitted'), 'success')
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderList.messages.exportFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderList.messages.exportFailed'), 'error')
  }
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
  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2600"
  >
    {{ snack.text }}
  </VSnackbar>

  <VCard class="rounded-lg ds-order-list-page">
    <VCardItem class="pb-3">
      <template #title>
        <span class="text-h5 font-weight-medium">{{ $t('pages.dropShippingOrderList.title') }}</span>
      </template>
      <template #subtitle>
        <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderList.subtitle') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2 justify-end">
          <VBtn
            color="primary"
            size="small"
            variant="tonal"
            prepend-icon="tabler-upload"
            :to="{ name: 'apps-drop-shipping-order-batch' }"
          >
            {{ $t('pages.dropShippingOrderList.actions.batchCreate') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            :to="{ name: 'apps-drop-shipping-order-create' }"
          >
            {{ $t('pages.dropShippingOrderList.actions.create') }}
          </VBtn>
        </div>
      </template>
    </VCardItem>
    <VDivider />
    <VCardText>
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
            {{ $t('pages.dropShippingOrderList.actions.export') }}
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
                :label="$t('pages.dropShippingOrderList.filters.orderNo')"
                :placeholder="$t('pages.dropShippingOrderList.filters.orderNoPlaceholder')"
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
                :label="$t('pages.dropShippingOrderList.filters.recipient')"
                :placeholder="$t('pages.dropShippingOrderList.filters.recipientPlaceholder')"
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
                :placeholder="$t('pages.dropShippingOrderList.filters.skuPlaceholder')"
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
                :label="$t('pages.dropShippingOrderList.filters.trackingNo')"
                :placeholder="$t('pages.dropShippingOrderList.filters.trackingNoPlaceholder')"
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
                :label="$t('pages.dropShippingOrderList.filters.warehouse')"
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
                :label="$t('pages.dropShippingOrderList.filters.transport')"
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
                :label="$t('pages.dropShippingOrderList.filters.source')"
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
                :label="$t('pages.dropShippingOrderList.filters.remoteArea')"
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
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.questionReason"
                :label="$t('pages.dropShippingOrderList.filters.questionReason')"
                :placeholder="$t('pages.dropShippingOrderList.filters.questionReasonPlaceholder')"
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
              :color="Number(item.status) === 14 || getStatusText(item).includes('\u95ee\u9898') ? 'error' : 'primary'"
            >
              {{ getStatusText(item) }}
            </VChip>
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-end gap-1">
            <VTooltip :text="$t('pages.dropShippingOrderList.tooltips.detail')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="primary"
                  @click="router.push({ name: 'apps-drop-shipping-order-detail', query: { id: item.id } })"
                >
                  <VIcon
                    icon="tabler-eye"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VTooltip :text="$t('pages.dropShippingOrderList.tooltips.copy')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="secondary"
                  @click="router.push({ name: 'apps-drop-shipping-order-create', query: { id: item.id, mode: 'copy' } })"
                >
                  <VIcon
                    icon="tabler-copy"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
          </div>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
            <span class="text-body-2 text-medium-emphasis">
              {{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}
            </span>
            <div class="d-flex align-center gap-3">
              <AppSelect
                :model-value="itemsPerPage"
                :items="[10, 20, 50, 100]"
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
