<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { downloadXlsx, makeExportBasename } from '@/utils/exportXlsx'
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
const exporting = ref(false)
const { t } = useI18n({ useScope: 'global' })

const FILTERS_CACHE_KEY = 'ds-order-list-filters'

function getDefaultFilters() {
  return {
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
}

function loadCachedFilters() {
  try {
    const raw = sessionStorage.getItem(FILTERS_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)

      return { ...getDefaultFilters(), ...parsed }
    }
  }
  catch {}

  return null
}

function saveCachedFilters(f) {
  try {
    sessionStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(f))
  }
  catch {}
}

function clearCachedFilters() {
  try {
    sessionStorage.removeItem(FILTERS_CACHE_KEY)
  }
  catch {}
}

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

const filters = ref(loadCachedFilters() || getDefaultFilters())

const headers = computed(() => [
  { title: t('pages.dropShippingOrderList.headers.orderNo'), key: 'order_info', minWidth: '220' },
  { title: t('pages.dropShippingOrderList.headers.referenceNo'), key: 'cankaohao', minWidth: '130' },
  { title: t('pages.dropShippingOrderList.headers.recipient'), key: 'name', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.warehouse'), key: 'warehouse_name', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.sku'), key: 'sku', minWidth: '140' },
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

const statusKinds = {
  1: 'info',
  2: 'info',
  3: 'info',
  4: 'info',
  6: 'success',
  14: 'error',
  15: 'neutral',
}

function statusChipClass(row) {
  return `ds-status-chip--${statusKinds[Number(row?.status)] || 'neutral'}`
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

  saveCachedFilters(filters.value)

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
  saveCachedFilters(filters.value)

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = getDefaultFilters()
  clearCachedFilters()
  searchList()
}

async function exportOrders() {
  if (exporting.value)
    return

  exporting.value = true
  try {
    const res = await $api('/order/excelYjdf', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      toast(res?.msg || t('pages.dropShippingOrderList.messages.exportLoadFailed'), 'error')

      return
    }

    const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : [])
    if (!list.length) {
      toast(t('pages.dropShippingOrderList.messages.exportNoData'), 'warning')

      return
    }

    const rows = list.map(row => ({
      'order_sn': row.order_sn ?? '',
      'cankaohao': row.cankaohao ?? '',
      'ht_orderno': row.ht_orderno ?? '',
      'name': row.receive_name ?? '',
      'receive_telephone': row.receive_telephone ?? '',
      'receive_address': row.receive_address ?? '',
      'receive_city': row.receive_city ?? '',
      'receive_province': row.receive_province ?? '',
      'receive_country': row.receive_country ?? '',
      'receive_postcode': row.receive_postcode ?? '',
      'country': row.country ?? '',
      'warehouse_name': row.warehouse_name ?? '',
      'transport_type': row.transport_type ?? '',
      'erp_type': row.erp_type ?? '',
      'sku': row.sku ?? '',
      'sku_num': row.sku_num ?? '',
      'cn_name': row.cn_name ?? '',
      'total_weight': row.total_weight ?? '',
      'ht_tracking_no': row.ht_tracking_no ?? '',
      'total_fee': row.total_fee ?? '',
      'handle_fee': row.handle_fee ?? '',
      'paisong_fee': row.paisong_fee ?? '',
      'zitick_fee': row.zitick_fee ?? '',
      'pp_fee': row.pp_fee ?? '',
      'material_fee': row.material_fee ?? '',
      'status_name': row.status_name || getStatusText(row),
      'username': row.username ?? '',
      'create_time': row.create_time ?? '',
      'fahuo_time': row.fahuo_time ?? '',
    }))

    await downloadXlsx({
      filename: makeExportBasename(t('pages.dropShippingOrderList.title')),
      sheetName: t('pages.dropShippingOrderList.title'),
      columns: [
        { key: 'order_sn', title: t('pages.dropShippingOrderList.headers.orderNo') },
        { key: 'cankaohao', title: t('pages.dropShippingOrderList.headers.referenceNo') },
        { key: 'create_time', title: t('pages.dropShippingOrderList.headers.createdAt') },
        { key: 'fahuo_time', title: t('pages.dropShippingOrderList.headers.shippedAt') },
        { key: 'ht_orderno', title: t('pages.dropShippingOrderList.headers.htOrderNo') },
        { key: 'name', title: t('pages.dropShippingOrderList.headers.recipient') },
        { key: 'receive_telephone', title: t('pages.dropShippingOrderList.headers.receiveTelephone') },
        { key: 'receive_address', title: t('pages.dropShippingOrderList.headers.receiveAddress') },
        { key: 'receive_city', title: t('pages.dropShippingOrderList.headers.receiveCity') },
        { key: 'receive_province', title: t('pages.dropShippingOrderList.headers.receiveProvince') },
        { key: 'receive_country', title: t('pages.dropShippingOrderList.headers.receiveCountry') },
        { key: 'receive_postcode', title: t('pages.dropShippingOrderList.headers.receivePostcode') },
        { key: 'country', title: t('pages.dropShippingOrderList.headers.country') },
        { key: 'warehouse_name', title: t('pages.dropShippingOrderList.headers.warehouse') },
        { key: 'transport_type', title: t('pages.dropShippingOrderList.headers.transport') },
        { key: 'erp_type', title: t('pages.dropShippingOrderList.headers.source') },
        { key: 'sku', title: t('pages.dropShippingOrderList.headers.sku') },
        { key: 'sku_num', title: t('pages.dropShippingOrderList.headers.skuNum') },
        { key: 'cn_name', title: t('pages.dropShippingOrderList.headers.cnName') },
        { key: 'total_weight', title: t('pages.dropShippingOrderList.headers.totalWeight') },
        { key: 'ht_tracking_no', title: t('pages.dropShippingOrderList.headers.trackingNo') },
        { key: 'total_fee', title: t('pages.dropShippingOrderList.headers.fee') },
        { key: 'handle_fee', title: t('pages.dropShippingOrderList.headers.handleFee') },
        { key: 'paisong_fee', title: t('pages.dropShippingOrderList.headers.paisongFee') },
        { key: 'zitick_fee', title: t('pages.dropShippingOrderList.headers.zitickFee') },
        { key: 'material_fee', title: t('pages.dropShippingOrderList.headers.materialFee') },
        { key: 'status_name', title: t('pages.dropShippingOrderList.headers.status') },
      ],
      rows,
    })
    toast(t('pages.dropShippingOrderList.messages.exportSuccess', { count: list.length }), 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderList.messages.exportFailed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

watch([page, itemsPerPage], loadList, { immediate: true })

watch(() => filters.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  const remote = await loadWarehouseOptions(t, 3)

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

  <VCard class="ds-order-list-page">
    <VCardItem class="ds-order-list-page__header">
      <template #title>
        <div class="d-flex align-center gap-2">
          <span class="ds-order-list-page__title">{{ $t('pages.dropShippingOrderList.title') }}</span>
          <span
            v-if="total > 0"
            class="ds-order-list-page__count"
          >{{ total }}</span>
        </div>
      </template>
      <template #subtitle>
        <span class="ds-order-list-page__subtitle">{{ $t('pages.dropShippingOrderList.subtitle') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2 justify-end">
          <VBtn
            color="primary"
            size="small"
            variant="tonal"
            prepend-icon="tabler-upload"
            class="ds-order-list-page__action"
            :to="{ name: 'apps-drop-shipping-order-batch' }"
          >
            {{ $t('pages.dropShippingOrderList.actions.batchCreate') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            class="ds-order-list-page__action"
            :to="{ name: 'apps-drop-shipping-order-create' }"
          >
            {{ $t('pages.dropShippingOrderList.actions.create') }}
          </VBtn>
        </div>
      </template>
    </VCardItem>
    <VDivider class="ds-order-list-page__divider" />
    <VCardText class="ds-order-list-page__body">
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
            prepend-icon="tabler-file-export"
            :loading="exporting"
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
        disable-sort
        :headers="headers"
        :items="rows"
        :items-length="total"
        :loading="loading"
        item-value="id"
        hover
        class="ds-order-list-page__table"
      >
        <template #no-data>
          <div class="ds-empty">
            <VIcon
              icon="tabler-package-off"
              size="44"
              class="ds-empty__icon"
            />
            <div class="ds-empty__title">
              {{ $t('pages.dropShippingOrderList.messages.empty') }}
            </div>
            <div class="ds-empty__hint">
              {{ $t('pages.dropShippingOrderList.messages.emptyHint') }}
            </div>
          </div>
        </template>

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

        <template #item.sku="{ item }">
          <div class="sku-info-cell">
            <div
              v-if="item.sku"
              class="sku-info-cell__row"
            >
              <template
                v-for="(sku, i) in String(item.sku).split(',')"
                :key="i"
              >
                <div class="sku-info-cell__pair">
                  <span class="sku-info-cell__code">{{ sku.trim() }}</span>
                  <span
                    v-if="item.sku_num"
                    class="sku-info-cell__qty"
                  >×{{ (String(item.sku_num).split(',')[i] || '').trim() || '-' }}</span>
                </div>
              </template>
            </div>
            <span v-else>-</span>
          </div>
        </template>

        <template #item.ht_tracking_no="{ item }">
          <a
            v-if="item.ht_tracking_no"
            :href="trackUrl(item.ht_tracking_no)"
            target="_blank"
            rel="noopener noreferrer"
            class="ds-tracking-link"
          >
            {{ item.ht_tracking_no }}
          </a>
          <span
            v-else
            class="ds-muted"
          >-</span>
        </template>

        <template #item.status_name="{ item }">
          <div class="d-flex justify-center">
            <span
              class="ds-status-chip"
              :class="statusChipClass(item)"
            >
              {{ getStatusText(item) }}
            </span>
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
          <VDivider class="ds-order-list-page__divider" />
          <div class="ds-footer">
            <span class="ds-footer__count">
              {{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}
            </span>
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
                :total-visible="5"
                size="small"
                active-color="primary"
                class="ds-pagination"
              />
            </div>
          </div>
        </template>
      </VDataTableServer>
    </VCardText>
  </VCard>
</template>

<style scoped>
/* ===== Card shell (Apple inset-grouped look) ===== */
.ds-order-list-page {
  border-radius: 16px !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.05) !important;
  overflow: hidden;
}

.ds-order-list-page__header {
  padding-block: 1.25rem !important;
  padding-inline: 1.5rem !important;
}

.ds-order-list-page__title {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: rgba(var(--v-theme-on-surface), 0.92);
}

.ds-order-list-page__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding-inline: 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-primary), 0.9);
  background: rgba(var(--v-theme-primary), 0.1);
}

.ds-order-list-page__subtitle {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.ds-order-list-page__action {
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-weight: 500 !important;
}

.ds-order-list-page__divider {
  border-color: rgba(var(--v-theme-on-surface), 0.07) !important;
  opacity: 1 !important;
}

.ds-order-list-page__body {
  padding: 1rem 1.5rem 1.5rem !important;
}

/* ===== Filter rows ===== */
.ds-order-list-page__filters :deep(.v-col) {
  padding-block: 0.375rem;
}

/* ===== Query panel softening ===== */
.ds-order-list-page :deep(.app-query-panel) {
  border-radius: 12px !important;
  border-color: rgba(var(--v-theme-on-surface), 0.08) !important;
}

/* ===== Data table ===== */
.ds-order-list-page__table {
  border-radius: 12px;
  background: transparent !important;
}

.ds-order-list-page__table :deep(.v-data-table) {
  background: transparent !important;
}

/* Header cells — small caps, secondary label */
.ds-order-list-page__table :deep(thead .v-data-table__th) {
  font-size: 0.6875rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(var(--v-theme-on-surface), 0.45) !important;
  padding-block: 0.75rem !important;
  padding-inline: 1rem !important;
  white-space: nowrap;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
  background: transparent !important;
}

/* Body cells — comfortable padding, hairline dividers */
.ds-order-list-page__table :deep(tbody .v-data-table__td) {
  padding-block: 0.875rem !important;
  padding-inline: 1rem !important;
  vertical-align: middle;
  font-size: 0.8125rem !important;
  color: rgba(var(--v-theme-on-surface), 0.85);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06) !important;
}

.ds-order-list-page__table :deep(tbody .v-data-table__tr) {
  transition: background-color 0.15s ease;
}

/* Subtle hover tint */
.ds-order-list-page__table :deep(tbody .v-data-table__tr:hover .v-data-table__td) {
  background: rgba(var(--v-theme-on-surface), 0.035) !important;
}

/* Clean last-row divider for grouped look */
.ds-order-list-page__table :deep(tbody .v-data-table__tr:last-child .v-data-table__td) {
  border-bottom: none !important;
}

/* Loading progress accent */
.ds-order-list-page__table :deep(.v-progress-linear__determinate) {
  background: rgba(var(--v-theme-primary), 0.8) !important;
}

/* ===== Order info cell ===== */
.order-info-cell {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.order-info-cell__sn {
  font-weight: 600;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  line-height: 1.3;
  letter-spacing: -0.005em;
}

.order-info-cell__time {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.125rem 0.4375rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.5);
  background: rgba(var(--v-theme-on-surface), 0.05);
}

/* ===== SKU cell ===== */
.sku-info-cell {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sku-info-cell__row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sku-info-cell__pair {
  display: flex;
  align-items: baseline;
  gap: 0.4375rem;
}

.sku-info-cell__code {
  font-weight: 600;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  line-height: 1.3;
  word-break: break-all;
}

.sku-info-cell__qty {
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  line-height: 1.3;
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-primary), 0.85);
  background: rgba(var(--v-theme-primary), 0.09);
}

/* ===== Tracking link ===== */
.ds-tracking-link {
  color: rgba(var(--v-theme-primary), 0.95);
  text-decoration: none;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.ds-tracking-link:hover {
  border-bottom-color: rgba(var(--v-theme-primary), 0.45);
}

.ds-muted {
  color: rgba(var(--v-theme-on-surface), 0.32);
}

/* ===== Status chip (iOS soft-fill pill) ===== */
.ds-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.6875rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.ds-status-chip--error {
  color: rgba(var(--v-theme-error), 0.92);
  background: rgba(var(--v-theme-error), 0.12);
}

.ds-status-chip--success {
  color: rgba(var(--v-theme-success), 0.95);
  background: rgba(var(--v-theme-success), 0.12);
}

.ds-status-chip--info {
  color: rgba(var(--v-theme-primary), 0.92);
  background: rgba(var(--v-theme-primary), 0.1);
}

.ds-status-chip--neutral {
  color: rgba(var(--v-theme-on-surface), 0.62);
  background: rgba(var(--v-theme-on-surface), 0.07);
}

/* ===== Empty state ===== */
.ds-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding-block: 3.5rem;
  padding-inline: 1rem;
  text-align: center;
}

.ds-empty__icon {
  color: rgba(var(--v-theme-on-surface), 0.22);
}

.ds-empty__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.58);
}

.ds-empty__hint {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.42);
  max-width: 26rem;
}

/* ===== Footer / pagination ===== */
.ds-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
}

.ds-footer__count {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-variant-numeric: tabular-nums;
}

.ds-pagination :deep(.v-pagination__item) {
  border-radius: 8px !important;
}

.ds-pagination :deep(.v-pagination__item--is-active) {
  font-weight: 600 !important;
}
</style>
