<script setup>
/* eslint-disable camelcase -- /Ordernewapi/shippingList query params match backend field names */
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
const selectedIds = ref([])
const mergeDownloading = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })
const batchDialogOpen = ref(false)
const { t, locale } = useI18n({ useScope: 'global' })

/** Prefill and direct-detail settings when opening the batch dialog from an order row. */
const batchDialogProps = ref({
  initialBatchSn: '',
  initialBatchId: null,
  autoOpenBatchDetail: false,
})

const router = useRouter()
const cancellingId = ref(null)

// Reference cankaohao; channel channelType; createRange maps to create_time.
const filters = ref({
  cankaohao: '',
  channelType: ORDER_DD_FILTER_ALL,
  status: null,
  createRange: '',
  tracking_number: '',
})

const loadedChannelTypeItems = ref([])

const channelTypeItems = computed(() => [
  { title: t('pages.printLabelShippingList.filters.allChannels'), value: ORDER_DD_FILTER_ALL },
  ...loadedChannelTypeItems.value,
])

/** Same source as filters: provider / QID maps to channel display name from getChannelList. */
const channelNameByQid = shallowRef(new Map())

async function loadChannelList() {
  try {
    const res = await $api('/ordernew/getChannelList', { method: 'GET' })
    if (Number(res?.code) === 1 && Array.isArray(res.data)) {
      const nameByQid = new Map()

      const mapped = res.data.map(c => {
        const qid = Number(c.qid)
        const title = String(c.name ?? '').trim() || t('pages.printLabelShippingList.filters.unnamedChannel')
        if (Number.isFinite(qid))
          nameByQid.set(qid, title)

        return { title, value: qid }
      })

      channelNameByQid.value = nameByQid
      loadedChannelTypeItems.value = mapped
    }
  }
  catch (e) {
    console.error(e)
  }
}

/** Match row provider (QID) to getChannelList for the list channel name. */
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

/** Channel plus channel code when present. */
function channelTableCell(row) {
  const namePart = channelDisplayName(row)
  const code = String(row?.channel_code ?? '').trim()
  if (!code)
    return namePart

  return `${namePart} (${code})`
}

const STATUS_ITEMS = computed(() => [
  { title: t('pages.printLabelShippingList.statuses.all'), value: null },
  { title: t('pages.printLabelShippingList.statuses.pending'), value: 0 },
  { title: t('pages.printLabelShippingList.statuses.requesting'), value: 1 },
  { title: t('pages.printLabelShippingList.statuses.success'), value: 2 },
  { title: t('pages.printLabelShippingList.statuses.failed'), value: 3 },
  { title: t('pages.printLabelShippingList.statuses.cancelled'), value: 4 },
])

const headers = computed(() => [
  { title: t('pages.printLabelShippingList.headers.id'), key: 'id', width: '88', align: 'end' },
  { title: t('pages.printLabelShippingList.headers.createdAt'), key: 'createtime', minWidth: '158' },
  { title: t('pages.printLabelShippingList.headers.orderNo'), key: 'order_sn', minWidth: '168' },
  { title: t('pages.printLabelShippingList.headers.refNo'), key: 'cankaohao', minWidth: '120' },
  { title: t('pages.printLabelShippingList.headers.trackingNo'), key: 'tracking_number', minWidth: '160' },
  { title: t('pages.printLabelShippingList.headers.channelWithCode'), key: 'provider', minWidth: '200' },
  { title: t('pages.printLabelShippingList.headers.fee'), key: 'customer_fee', minWidth: '96', align: 'end' },
  { title: t('pages.printLabelShippingList.headers.status'), key: 'status', minWidth: '100', align: 'center' },
  { title: t('pages.printLabelShippingList.headers.failReason'), key: 'fail_reason', minWidth: '160' },
  { title: t('pages.printLabelShippingList.headers.actions'), key: 'actions', sortable: false, minWidth: '220', width: '220', align: 'end', fixed: 'end' },
])

const dateLocale = computed(() => ({ zh: 'zh-CN', en: 'en-US', fr: 'fr-FR' })[locale.value] || undefined)

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
  
  return new Date(n * 1000).toLocaleString(dateLocale.value, { hour12: false })
}

function statusLabel(s) {
  const m = {
    0: t('pages.printLabelShippingList.statuses.pending'),
    1: t('pages.printLabelShippingList.statuses.requesting'),
    2: t('pages.printLabelShippingList.statuses.success'),
    3: t('pages.printLabelShippingList.statuses.failed'),
    4: t('pages.printLabelShippingList.statuses.cancelled'),
  }

  
  return m[Number(s)] ?? (s == null || s === '' ? '—' : String(s))
}

function statusLabelWithCancel(row) {
  const base = statusLabel(row?.status)
  if (Number(row?.cancel_status) === 1)
    return `${base} (${t('pages.printLabelShippingList.statuses.cancelling')})`
  if (Number(row?.status) === 2 && !String(row?.tracking_number || '').trim())
    return `${base} (${t('pages.printLabelShippingList.statuses.shipping')})`

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
 * AppDateTimePicker range matches the legacy shipment list and submits create_time.
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
    toast(res?.msg || t('pages.printLabelShippingList.messages.loadFailed'), 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    lastPage.value = 1
    toast(e?.data?.msg || e?.message || t('pages.printLabelShippingList.messages.networkFailed'), 'error')
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

/** Valid batch: batch_id > 0 or batch_sn is non-empty and not "0". */
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
    toast(t('pages.printLabelShippingList.messages.noLabelFile'), 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

function openView(row) {
  const id = row?.id
  if (id == null || id === '') {
    toast(t('pages.printLabelShippingList.messages.invalidOrderId'), 'warning')

    return
  }
  router.push({
    name: 'apps-print-label-order-new-detail-id',
    params: { id: String(id) },
    query: row?.order_sn ? { orderSn: String(row.order_sn) } : undefined,
  })
}

/** Can cancel successful shipments (status = 2); backend controls the actual endpoint semantics. */
function showCancelButton(row) {
  return Number(row?.status) === 2 && Number(row?.cancel_status) !== 1
}

function isLabelFetching(row) {
  return !row?.label_url && (Number(row?.status) === 1 || (Number(row?.status) === 2 && !String(row?.tracking_number || '').trim()))
}

function showLabelButton(row) {
  return isLabelFetching(row) || !!row?.label_url
}

const hasFetchingLabels = computed(() => rows.value.some(r => isLabelFetching(r)))

let fetchPollTimer = null

function startFetchPolling() {
  if (fetchPollTimer)
    return
  fetchPollTimer = setInterval(() => {
    if (!hasFetchingLabels.value) {
      stopFetchPolling()
      return
    }
    loadList()
  }, 10000)
}

function stopFetchPolling() {
  if (fetchPollTimer) {
    clearInterval(fetchPollTimer)
    fetchPollTimer = null
  }
}

watch(hasFetchingLabels, (fetching) => {
  if (fetching)
    startFetchPolling()
  else
    stopFetchPolling()
})

onBeforeUnmount(() => {
  stopFetchPolling()
})

async function cancelShipping(row) {
  const orderId = Number(row?.id)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    toast(t('pages.printLabelShippingList.messages.invalidOrderIdentifier'), 'warning')

    return
  }
  if (!window.confirm(t('pages.printLabelShippingList.messages.cancelConfirm')))
    return

  cancellingId.value = row.id
  try {
    const res = await $api('/Ordernewapi/shippingOrderCancel', {
      method: 'POST',
      body: { order_id: orderId },
    })

    if (Number(res?.code) === 1 || Number(res?.code) === 200) {
      toast(res?.message || res?.msg || t('pages.printLabelShippingList.messages.cancelSubmitted'), 'success')
      loadList()

      return
    }
    toast(res?.message || res?.msg || t('pages.printLabelShippingList.messages.cancelFailed'), 'error')
  }
  catch (e) {
    toast(e?.data?.message || e?.data?.msg || e?.message || t('pages.printLabelShippingList.messages.cancelFailed'), 'error')
  }
  finally {
    cancellingId.value = null
  }
}

async function mergeDownload() {
  if (!selectedIds.value.length) {
    toast(t('pages.printLabelShippingList.messages.selectMergeDownloadRequired'), 'warning')
    
    return
  }

  mergeDownloading.value = true
  try {
    const accessToken = useCookie('accessToken').value
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

    const body = {
      order_ids: selectedIds.value.map(id => Number(id)).filter(n => Number.isFinite(n)),
      ...(accessToken ? { token: accessToken } : {}),
    }

    const res = await fetch(`${baseURL}/Ordernewapi/shippingMergeDownload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}`, token: accessToken } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')

      toast(text || t('pages.printLabelShippingList.messages.mergeDownloadFailed'), 'error')
      
      return
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null)
      if (json) {
        toast(json.msg || t('pages.printLabelShippingList.messages.mergeDownloadFailed'), 'error')
      }
      
      return
    }

    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = 'merged-labels.pdf'
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match)
        filename = match[1].replace(/['"]/g, '')
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    selectedIds.value = []
    toast(t('pages.printLabelShippingList.messages.mergeDownloadSuccess'), 'success')
  }
  catch (e) {
    toast(e?.message || t('pages.printLabelShippingList.messages.mergeDownloadFailed'), 'error')
  }
  finally {
    mergeDownloading.value = false
  }
}

watch([page, itemsPerPage], loadList, { immediate: true })
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

  <ShippingBatchStatusDialog
    :model-value="batchDialogOpen"
    :initial-batch-sn="batchDialogProps.initialBatchSn"
    :initial-batch-id="batchDialogProps.initialBatchId"
    :auto-open-batch-detail="batchDialogProps.autoOpenBatchDetail"
    @update:model-value="onBatchDialogUpdate"
  />

  <VCard class="rounded-lg">
    <VCardItem class="pb-3">
      <template #title>
        <span class="text-h5 font-weight-medium">{{ $t('pages.printLabelShippingList.title') }}</span>
      </template>
      <template #subtitle>
        <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelShippingList.subtitle') }}</span>
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
            {{ $t('pages.printLabelShippingList.actions.batchStatus') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            class="text-none"
            :to="{ name: 'apps-print-label-create' }"
          >
            {{ $t('pages.printLabelShippingList.actions.create') }}
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
              :label="$t('pages.printLabelShippingList.filters.refNo')"
              :placeholder="$t('pages.printLabelShippingList.filters.fuzzy')"
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
              :label="$t('pages.printLabelShippingList.filters.channel')"
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
              :label="$t('pages.printLabelShippingList.filters.status')"
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
              :label="$t('pages.printLabelShippingList.filters.createdDate')"
              density="compact"
              hide-details
              :placeholder="$t('pages.printLabelShippingList.filters.dateRange')"
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
              :label="$t('pages.printLabelShippingList.filters.trackingNo')"
              hide-details
              density="compact"
              clearable
              @keyup.enter="searchList"
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <Transition name="slide-down">
        <div
          v-if="selectedIds.length"
          class="batch-action-bar mb-4 px-4 py-3 rounded-lg d-flex align-center justify-space-between flex-wrap gap-3"
        >
          <div class="d-flex align-center gap-2">
            <VAvatar
              color="primary"
              variant="tonal"
              size="28"
              rounded="circle"
            >
              <VIcon
                icon="tabler-checkbox"
                size="16"
              />
            </VAvatar>
            <span class="text-body-2 font-weight-medium">
              {{ $t('pages.printLabelShippingList.selection.selected', { count: selectedIds.length }) }}
            </span>
          </div>
          <div class="d-flex align-center gap-2">
            <VBtn
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="tabler-file-download"
              class="text-none"
              :loading="mergeDownloading"
              @click="mergeDownload"
            >
              {{ $t('pages.printLabelShippingList.actions.mergeDownload') }}
            </VBtn>
            <VBtn
              variant="text"
              size="small"
              color="secondary"
              class="text-none"
              @click="selectedIds = []"
            >
              {{ $t('pages.printLabelShippingList.actions.cancelSelection') }}
            </VBtn>
          </div>
        </div>
      </Transition>

      <VDataTableServer
        v-model="selectedIds"
        :headers="headers"
        :items="rows"
        :items-length="total"
        :loading="loading"
        item-value="id"
        show-select
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
            :title="item.channel_name"
          >{{ item.channel_name }}</span>
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
          <div class="d-flex align-center justify-end gap-1">
            <template v-if="cancellingId === item.id">
              <VProgressCircular
                indeterminate
                size="20"
                width="2"
                color="error"
              />
              <span class="text-caption text-error">{{ $t('pages.printLabelShippingList.messages.cancelling') }}</span>
            </template>
            <template v-else>
              <VTooltip :text="$t('pages.printLabelShippingList.tooltips.view')">
                <template #activator="{ props: tipProps }">
                  <IconBtn
                    v-bind="tipProps"
                    size="small"
                    color="primary"
                    @click="openView(item)"
                  >
                    <VIcon
                      icon="tabler-eye"
                      size="20"
                    />
                  </IconBtn>
                </template>
              </VTooltip>
              <VTooltip
                v-if="showLabelButton(item)"
                :text="isLabelFetching(item) ? $t('pages.printLabelShippingList.statuses.shipping') : $t('pages.printLabelShippingList.tooltips.label')"
              >
                <template #activator="{ props: tipProps }">
                  <IconBtn
                    v-bind="tipProps"
                    size="small"
                    color="secondary"
                    :disabled="!item.label_url"
                    @click="item.label_url && openLabel(item)"
                  >
                    <VProgressCircular
                      v-if="isLabelFetching(item)"
                      indeterminate
                      size="16"
                      width="2"
                      color="secondary"
                    />
                    <VIcon
                      v-else
                      icon="tabler-download"
                      size="20"
                    />
                  </IconBtn>
                </template>
              </VTooltip>
              <VTooltip :text="$t('pages.printLabelShippingList.tooltips.copy')">
                <template #activator="{ props: tipProps }">
                  <IconBtn
                    v-bind="tipProps"
                    size="small"
                    color="secondary"
                    @click="router.push({ name: 'apps-print-label-create', query: { copyFrom: item.id } })"
                  >
                    <VIcon
                      icon="tabler-copy"
                      size="20"
                    />
                  </IconBtn>
                </template>
              </VTooltip>
              <VTooltip
                v-if="showCancelButton(item)"
                :text="$t('pages.printLabelShippingList.actions.cancelShipment')"
              >
                <template #activator="{ props: tipProps }">
                  <IconBtn
                    v-bind="tipProps"
                    size="small"
                    color="error"
                    @click="cancelShipping(item)"
                  >
                    <VIcon
                      icon="tabler-ban"
                      size="20"
                    />
                  </IconBtn>
                </template>
              </VTooltip>
            </template>
          </div>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
            <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelShippingList.pagination.total', { total }) }}</span>
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
.ds-shipping-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-shipping-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

/* Match the batch-status dialog action column: primary button plus secondary icon actions. */
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

.batch-action-bar {
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
