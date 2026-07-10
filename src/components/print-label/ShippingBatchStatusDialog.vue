<script setup>
/* eslint-disable camelcase -- /Ordernewapi/* query params and row_data fields match backend field names */
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'

const props = defineProps({
  modelValue: { type: Boolean, default: false },

  /** Prefill batch number on open for exact matching. */
  initialBatchSn: { type: String, default: '' },

  /** Filter by batch ID on open, either with or instead of batch_sn. */
  initialBatchId: { type: Number, default: null },

  /** Open the order-detail dialog automatically after the batch list loads. */
  autoOpenBatchDetail: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const { t, locale } = useI18n({ useScope: 'global' })

const snack = ref({ show: false, text: '', color: 'info' })
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const lastPage = ref(1)
const itemsPerPage = ref(20)

const filters = ref({
  status: null,
  batch_sn: '',

  /** Optional GET shippingBatches param. */
  batch_id: null,
})

/** Avoid duplicate requests from [page, itemsPerPage] while the main dialog opens. */
const batchListOpening = ref(false)

/** Hide the outer batch list while jumping directly to detail from the order list. */
const hideMainBatchDialog = ref(false)

/** Close the parent as well after the direct-detail scenario closes. */
const closeParentWhenDetailClosed = ref(false)

/** Batch shipping status: 0 = processing, 1 = completed, 2 = failed. */
const STATUS_ITEMS = computed(() => [
  { title: t('pages.printLabelShippingList.batchDialog.statuses.all'), value: null },
  { title: t('pages.printLabelShippingList.batchDialog.statuses.processing'), value: 0 },
  { title: t('pages.printLabelShippingList.batchDialog.statuses.completed'), value: 1 },
  { title: t('pages.printLabelShippingList.batchDialog.statuses.failed'), value: 2 },
])

const headers = computed(() => [
  { title: t('pages.printLabelShippingList.batchDialog.headers.batchNo'), key: 'batch_sn', minWidth: '160' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.total'), key: 'total_count', width: '72', align: 'end' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.success'), key: 'success_count', width: '72', align: 'end' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.failed'), key: 'fail_count', width: '72', align: 'end' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.status'), key: 'status', width: '96', align: 'center' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.createdAt'), key: 'createtime', minWidth: '158' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.actions'), key: 'actions', sortable: false, minWidth: '168', width: '168', align: 'end', fixed: 'end' },
])

const detailLoading = ref(false)
const detailBatch = ref(null)
const downloadingId = ref(null)

/** Separate batch detail dialog to avoid expanding hundreds of rows below the main table. */
const detailDialogVisible = ref(false)
const detailFilters = ref({ cankaohao: '' })
const detailPage = ref(1)
const detailItemsPerPage = ref(20)

/** Tab switcher between successful orders and failure rows. */
const detailTab = ref('orders')
const orderRows = ref([])
const orderTotal = ref(0)
const failureRows = ref([])
const failureTotal = ref(0)

/** Auto-switch to the failures tab on first load when failures exist. */
const detailFirstLoad = ref(true)

/** Whether the failures tab should be highlighted (has failure rows). */
const hasFailures = computed(() => failureTotal.value > 0)

const detailRows = computed(() => detailTab.value === 'orders' ? orderRows.value : failureRows.value)
const detailTotal = computed(() => detailTab.value === 'orders' ? orderTotal.value : failureTotal.value)

const pageLength = computed(() => Math.max(1, lastPage.value))
const detailPageLength = computed(() => Math.max(1, Math.ceil(detailTotal.value / detailItemsPerPage.value) || 1))
const dateLocale = computed(() => ({ zh: 'zh-CN', en: 'en-US', fr: 'fr-FR' })[locale.value] || undefined)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function formatTs(ts) {
  if (ts == null || ts === '')
    return '—'
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0)
    return '—'

  return new Date(n * 1000).toLocaleString(dateLocale.value, { hour12: false })
}

function batchStatusLabel(s) {
  const m = {
    0: t('pages.printLabelShippingList.batchDialog.statuses.processing'),
    1: t('pages.printLabelShippingList.batchDialog.statuses.completed'),
    2: t('pages.printLabelShippingList.batchDialog.statuses.failed'),
  }

  
  return m[Number(s)] ?? (s == null || s === '' ? '—' : t('pages.printLabelShippingList.batchDialog.statuses.unknown', { status: s }))
}

function batchStatusColor(s) {
  const n = Number(s)
  if (n === 1)
    return 'success'
  if (n === 2)
    return 'error'
  if (n === 0)
    return 'info'

  return 'secondary'
}

/** Show batch label ZIP only for completed rows. */
function showBatchZipButton(row) {
  return Number(row?.status) === 1
}

/**
 * Supports Laravel paginate, custom pagination, and top-level array payloads.
 */
function normalizeBatchesPayload(raw) {
  if (raw == null)
    return { list: [], total: 0, last_page: 1, per_page: 20 }
  if (Array.isArray(raw)) {
    return {
      list: raw,
      total: raw.length,
      last_page: 1,
      per_page: raw.length || 20,
    }
  }
  if (typeof raw !== 'object')
    return { list: [], total: 0, last_page: 1, per_page: 20 }

  const list = Array.isArray(raw.data)
    ? raw.data
    : Array.isArray(raw.records)
      ? raw.records
      : Array.isArray(raw.list)
        ? raw.list
        : Array.isArray(raw.items)
          ? raw.items
          : []

  const totalCount = Number(raw.total ?? raw.count ?? raw.totalCount ?? list.length) || 0
  const per_page = Number(raw.per_page ?? raw.per_page_num ?? 20) || 20

  const last_page = Math.max(
    1,
    Number(raw.last_page) || (totalCount ? Math.ceil(totalCount / per_page) : 1),
  )

  return { list, total: totalCount, last_page, per_page }
}

function buildQuery() {
  const q = {
    per_page: Number(itemsPerPage.value) || 20,
    page: Number(page.value) || 1,
  }

  const f = filters.value
  if (f.status !== null && f.status !== '' && Number.isFinite(Number(f.status)))
    q.status = Number(f.status)
  const sn = String(f.batch_sn || '').trim()
  if (sn)
    q.batch_sn = sn
  const bid = f.batch_id
  if (bid != null && bid !== '' && Number.isFinite(Number(bid)) && Number(bid) > 0)
    q.batch_id = Number(bid)

  return q
}

async function loadBatches() {
  loading.value = true
  try {
    const res = await $api('/Ordernewapi/shippingBatches', {
      method: 'GET',
      query: buildQuery(),
    })

    if (Number(res?.code) === 1 && res?.data != null) {
      const { list, total: t, last_page: lp, per_page: ipp } = normalizeBatchesPayload(res.data)

      rows.value = list
      total.value = t
      lastPage.value = lp
      if (Number.isFinite(Number(ipp)) && Number(ipp) > 0)
        itemsPerPage.value = Number(ipp)

      return
    }
    rows.value = []
    total.value = 0
    lastPage.value = 1
    toast(res?.msg || t('pages.printLabelShippingList.batchDialog.messages.loadBatchesFailed'), 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    lastPage.value = 1
    toast(e?.data?.msg || e?.message || t('pages.printLabelShippingList.batchDialog.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function searchBatches() {
  const atFirst = page.value === 1

  page.value = 1
  if (atFirst)
    loadBatches()
}

function resetFilters() {
  filters.value = { status: null, batch_sn: '', batch_id: null }
  searchBatches()
}

function resetDetailFilters() {
  detailFilters.value = { cankaohao: '' }
  detailSearch()
}

function detailSearch() {
  detailPage.value = 1
  loadBatchDetailList()
}

function switchDetailTab(tab) {
  if (detailTab.value === tab)
    return
  detailTab.value = tab
  detailPage.value = 1
  loadBatchDetailList()
}

function closeDialog() {
  emit('update:modelValue', false)
}

function openSourceFile(row) {
  const url = resolveBackendFileUrl(row?.xlspath)
  if (!url) {
    toast(t('pages.printLabelShippingList.batchDialog.messages.noSourceFile'), 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

function normalizeDetailSection(section) {
  if (section == null)
    return { list: [], total: 0 }
  if (Array.isArray(section))
    return { list: section, total: section.length }
  if (typeof section !== 'object')
    return { list: [], total: 0 }

  const list = Array.isArray(section.list)
    ? section.list
    : Array.isArray(section.data)
      ? section.data
      : Array.isArray(section.records)
        ? section.records
        : Array.isArray(section.items)
          ? section.items
          : []

  const pagination = section.pagination || {}
  const total = Number(pagination.total ?? section.total ?? section.count ?? list.length) || 0
  const pageSize = Number(pagination.page_size ?? pagination.per_page ?? section.per_page ?? 20) || 20

  return { list, total, pageSize }
}

async function loadBatchDetailList() {
  if (!detailBatch.value?.id)
    return

  detailLoading.value = true
  try {
    const q = {
      batch_id: detailBatch.value.id,
      page: Number(detailPage.value) || 1,
      per_page: Number(detailItemsPerPage.value) || 20,
    }

    const ck = String(detailFilters.value.cankaohao ?? '').trim()
    if (ck)
      q.cankaohao = ck

    const res = await $api('/Ordernewapi/shippingBatchStatus', {
      method: 'GET',
      query: q,
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      orderRows.value = []
      orderTotal.value = 0
      failureRows.value = []
      failureTotal.value = 0
      toast(res?.msg || t('pages.printLabelShippingList.batchDialog.messages.loadBatchOrdersFailed'), 'error')

      return
    }

    const data = res.data

    // New structured format: { orders: { list, pagination }, failures: { list, pagination } }
    if (data.orders || data.failures) {
      const orders = normalizeDetailSection(data.orders)
      const failures = normalizeDetailSection(data.failures)

      orderRows.value = orders.list
      orderTotal.value = orders.total
      failureRows.value = failures.list
      failureTotal.value = failures.total
      if (Number.isFinite(orders.pageSize) && orders.pageSize > 0)
        detailItemsPerPage.value = orders.pageSize

      if (detailFirstLoad.value && failures.total > 0)
        detailTab.value = 'failures'
      detailFirstLoad.value = false

      return
    }

    // Backward compat: legacy array or paginated payload treated as orders.
    const legacy = normalizeBatchesPayload(data)

    orderRows.value = legacy.list
    orderTotal.value = legacy.total
    failureRows.value = []
    failureTotal.value = 0
    if (Number.isFinite(legacy.per_page) && legacy.per_page > 0)
      detailItemsPerPage.value = legacy.per_page
  }
  catch (e) {
    orderRows.value = []
    orderTotal.value = 0
    failureRows.value = []
    failureTotal.value = 0
    toast(e?.data?.msg || e?.message || t('pages.printLabelShippingList.batchDialog.messages.loadBatchOrdersFailed'), 'error')
  }
  finally {
    detailLoading.value = false
  }
}

/**
 * @param {object} row
 * @param {{ hideMainWhileDetailOpen?: boolean }} [opts]
 */
function openBatchDetail(row, opts = {}) {
  if (!row?.id) {
    toast(t('pages.printLabelShippingList.batchDialog.messages.invalidBatchId'), 'warning')

    return
  }
  detailTab.value = 'orders'
  detailFirstLoad.value = true
  detailFilters.value = { cankaohao: '' }
  detailPage.value = 1
  detailItemsPerPage.value = 20
  orderRows.value = []
  orderTotal.value = 0
  failureRows.value = []
  failureTotal.value = 0
  detailBatch.value = row
  detailDialogVisible.value = true
  if (opts.hideMainWhileDetailOpen) {
    hideMainBatchDialog.value = true
    closeParentWhenDetailClosed.value = true
  }
}

function onDetailDialogUpdate(v) {
  detailDialogVisible.value = v
  if (!v) {
    const closeAll = closeParentWhenDetailClosed.value

    closeParentWhenDetailClosed.value = false
    hideMainBatchDialog.value = false
    clearDetail()
    if (closeAll)
      emit('update:modelValue', false)
  }
}

function clearDetail() {
  detailBatch.value = null
  detailTab.value = 'orders'
  detailFirstLoad.value = true
  orderRows.value = []
  orderTotal.value = 0
  failureRows.value = []
  failureTotal.value = 0
  detailPage.value = 1
  detailItemsPerPage.value = 20
  detailFilters.value = { cankaohao: '' }
}

function orderStatusLabel(s) {
  const m = {
    0: t('pages.printLabelShippingList.statuses.pending'),
    1: t('pages.printLabelShippingList.statuses.requesting'),
    2: t('pages.printLabelShippingList.statuses.success'),
    3: t('pages.printLabelShippingList.statuses.failed'),
    4: t('pages.printLabelShippingList.statuses.cancelled'),
  }

  
  return m[Number(s)] ?? (s == null || s === '' ? '—' : String(s))
}

function orderStatusColor(s) {
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

function openOrderLabel(row) {
  const url = resolveBackendFileUrl(row?.label_url)
  if (!url) {
    toast(t('pages.printLabelShippingList.batchDialog.messages.noLabelFile'), 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

function pickBatchZipDownloadUrl(data) {
  if (data == null || typeof data !== 'object')
    return ''
  const raw = data.download_url ?? data.url

  return String(raw ?? '').trim()
}

/** In async callbacks, an anchor click is less likely to be blocked than window.open. */
function openDownloadUrlInNewTab(url) {
  let href = String(url ?? '').trim()
  if (!href)
    return false
  if (!/^https?:\/\//i.test(href))
    href = new URL(href, window.location.origin).href

  const a = document.createElement('a')

  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()

  return true
}

async function downloadBatchZip(row) {
  if (!row?.id) {
    toast(t('pages.printLabelShippingList.batchDialog.messages.invalidBatchId'), 'warning')

    return
  }
  downloadingId.value = row.id
  try {
    const res = await $api('/Ordernewapi/shippingBatchDownload', {
      method: 'GET',
      query: { batch_id: row.id },
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || t('pages.printLabelShippingList.batchDialog.messages.getDownloadLinkFailed'), 'error')

      return
    }
    const downloadUrl = pickBatchZipDownloadUrl(res.data)
    if (!downloadUrl) {
      toast(t('pages.printLabelShippingList.batchDialog.messages.noDownloadUrl'), 'warning')

      return
    }
    openDownloadUrlInNewTab(downloadUrl)
    toast(t('pages.printLabelShippingList.batchDialog.messages.downloadOpened'), 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.printLabelShippingList.batchDialog.messages.getDownloadLinkFailed'), 'error')
  }
  finally {
    downloadingId.value = null
  }
}

const detailHeaders = computed(() => [
  { title: t('pages.printLabelShippingList.headers.id'), key: 'id', width: '72', align: 'end' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.orderNo'), key: 'order_sn', minWidth: '128' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.refNo'), key: 'cankaohao', minWidth: '120' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.trackingNo'), key: 'tracking_number', minWidth: '128' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.status'), key: 'status', width: '100', align: 'center' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.failReason'), key: 'fail_reason', minWidth: '120' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.actions'), key: 'd_actions', sortable: false, minWidth: '100', width: '100', align: 'end' },
])

const failureHeaders = computed(() => [
  { title: '', key: 'data-table-expand' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.rowNumber'), key: 'row_number', width: '80', align: 'end' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.refNo'), key: 'cankaohao', minWidth: '140' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.failureType'), key: 'failure_type', width: '120', align: 'center' },
  { title: t('pages.printLabelShippingList.batchDialog.headers.reason'), key: 'reason', minWidth: '200' },
])

function failureTypeColor(type) {
  const s = String(type || '').toLowerCase()
  if (s === 'validation')
    return 'warning'
  if (s === 'business')
    return 'error'

  return 'secondary'
}

function failureTypeLabel(type) {
  const s = String(type || '').trim()
  if (!s)
    return '—'

  const map = {
    validation: t('pages.printLabelShippingList.batchDialog.failureTypes.validation'),
    business: t('pages.printLabelShippingList.batchDialog.failureTypes.business'),
  }

  const key = map[s.toLowerCase()]

  return key || s
}

/** Extract key fields from uploaded row_data into labelled groups for the expand panel. */
function buildRowDataGroups(rowData) {
  if (!rowData || typeof rowData !== 'object')
    return []
  const rd = rowData
  const groups = []

  const senderFields = [
    ['sender_name', rd.sender_name],
    ['sender_phone', rd.sender_phone],
    ['sender_country', rd.sender_country],
    ['sender_state', rd.sender_state],
    ['sender_city', rd.sender_city],
    ['sender_address1', rd.sender_address1],
    ['sender_address2', rd.sender_address2],
    ['sender_postcode', rd.sender_postcode],
  ].filter(([, v]) => v != null && String(v).trim() !== '')

  if (senderFields.length)
    groups.push({ label: t('pages.printLabelShippingList.batchDialog.rowData.sender'), fields: senderFields })

  const recipientFields = [
    ['recipient_name', rd.recipient_name],
    ['recipient_phone', rd.recipient_phone],
    ['recipient_country', rd.recipient_country],
    ['recipient_state', rd.recipient_state],
    ['recipient_city', rd.recipient_city],
    ['recipient_address1', rd.recipient_address1],
    ['recipient_address2', rd.recipient_address2],
    ['recipient_postcode', rd.recipient_postcode],
  ].filter(([, v]) => v != null && String(v).trim() !== '')

  if (recipientFields.length)
    groups.push({ label: t('pages.printLabelShippingList.batchDialog.rowData.recipient'), fields: recipientFields })

  const pkgFields = [
    ['package_weight', rd.package_weight],
    ['package_length', rd.package_length],
    ['package_width', rd.package_width],
    ['package_height', rd.package_height],
    ['package_weight_unit', rd.package_weight_unit],
    ['package_dim_unit', rd.package_dim_unit],
    ['declared_value', rd.declared_value],
  ].filter(([, v]) => v != null && String(v).trim() !== '')

  if (pkgFields.length)
    groups.push({ label: t('pages.printLabelShippingList.batchDialog.rowData.package'), fields: pkgFields })

  const itemFields = [
    ['sku', rd.sku],
    ['cn_name', rd.cn_name],
    ['en_name', rd.en_name],
    ['qty', rd.qty],
    ['weight', rd.weight],
    ['values', rd.values],
    ['hs_code', rd.hs_code],
    ['origin_country', rd.origin_country],
  ].filter(([, v]) => v != null && String(v).trim() !== '')

  if (itemFields.length)
    groups.push({ label: t('pages.printLabelShippingList.batchDialog.rowData.item'), fields: itemFields })

  return groups
}

function rowDataFieldLabel(key) {
  const map = {
    sender_name: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderName'),
    sender_phone: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderPhone'),
    sender_country: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderCountry'),
    sender_state: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderState'),
    sender_city: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderCity'),
    sender_address1: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderAddress1'),
    sender_address2: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderAddress2'),
    sender_postcode: t('pages.printLabelShippingList.batchDialog.rowData.fields.senderPostcode'),
    recipient_name: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientName'),
    recipient_phone: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientPhone'),
    recipient_country: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientCountry'),
    recipient_state: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientState'),
    recipient_city: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientCity'),
    recipient_address1: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientAddress1'),
    recipient_address2: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientAddress2'),
    recipient_postcode: t('pages.printLabelShippingList.batchDialog.rowData.fields.recipientPostcode'),
    package_weight: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageWeight'),
    package_length: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageLength'),
    package_width: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageWidth'),
    package_height: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageHeight'),
    package_weight_unit: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageWeightUnit'),
    package_dim_unit: t('pages.printLabelShippingList.batchDialog.rowData.fields.packageDimUnit'),
    declared_value: t('pages.printLabelShippingList.batchDialog.rowData.fields.declaredValue'),
    sku: t('pages.printLabelShippingList.batchDialog.rowData.fields.sku'),
    cn_name: t('pages.printLabelShippingList.batchDialog.rowData.fields.cnName'),
    en_name: t('pages.printLabelShippingList.batchDialog.rowData.fields.enName'),
    qty: t('pages.printLabelShippingList.batchDialog.rowData.fields.qty'),
    weight: t('pages.printLabelShippingList.batchDialog.rowData.fields.weight'),
    values: t('pages.printLabelShippingList.batchDialog.rowData.fields.values'),
    hs_code: t('pages.printLabelShippingList.batchDialog.rowData.fields.hsCode'),
    origin_country: t('pages.printLabelShippingList.batchDialog.rowData.fields.originCountry'),
  }

  return map[key] || key
}

watch([page, itemsPerPage], () => {
  if (props.modelValue && !batchListOpening.value)
    loadBatches()
})

watch([detailDialogVisible, detailPage, detailItemsPerPage], () => {
  if (!detailDialogVisible.value || !detailBatch.value?.id)
    return
  loadBatchDetailList()
})

async function applyMainDialogOpenFromProps() {
  hideMainBatchDialog.value = false
  closeParentWhenDetailClosed.value = false
  detailDialogVisible.value = false
  clearDetail()

  const sn = String(props.initialBatchSn || '').trim()
  const bid = props.initialBatchId

  filters.value.status = null
  filters.value.batch_sn = sn
  filters.value.batch_id = (typeof bid === 'number' && Number.isFinite(bid) && bid > 0) ? bid : null
  batchListOpening.value = true
  try {
    page.value = 1
    await loadBatches()
    if (props.autoOpenBatchDetail) {
      let hit = null
      if (filters.value.batch_id != null)
        hit = rows.value.find(r => Number(r?.id) === Number(filters.value.batch_id))
      if (!hit && sn)
        hit = rows.value.find(r => String(r?.batch_sn || '').trim() === sn)
      if (!hit && rows.value.length === 1)
        hit = rows.value[0]
      if (hit?.id)
        openBatchDetail(hit, { hideMainWhileDetailOpen: true })
      else if (sn || filters.value.batch_id != null)
        toast(t('pages.printLabelShippingList.batchDialog.messages.batchNotFound'), 'warning')
    }
  }
  finally {
    batchListOpening.value = false
  }
}

watch(() => props.modelValue, v => {
  if (v) {
    applyMainDialogOpenFromProps()
  }
  else {
    detailDialogVisible.value = false
    clearDetail()
    hideMainBatchDialog.value = false
    closeParentWhenDetailClosed.value = false
  }
})
</script>

<template>
  <VDialog
    v-if="modelValue && !hideMainBatchDialog"
    model-value
    max-width="960"
    scrollable
    @update:model-value="v => { if (!v) emit('update:modelValue', false) }"
  >
    <VCard class="shipping-batch-dialog d-flex flex-column rounded-lg">
      <VCardItem class="shipping-batch-dialog__head pb-3 pt-5 px-5">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.printLabelShippingList.batchDialog.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelShippingList.batchDialog.subtitle') }}</span>
        </template>
        <template #append>
          <VBtn
            icon
            size="small"
            variant="text"
            :aria-label="$t('pages.printLabelShippingList.batchDialog.close')"
            @click="closeDialog"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </template>
      </VCardItem>

      <VDivider />

      <VCardText class="flex-grow-1 pa-4 pa-sm-5">
        <AppQueryPanel
          class="mb-4"
          :title="$t('pages.printLabelShippingList.batchDialog.filterTitle')"
          :loading="loading"
          actions-position="bottom"
          @search="searchBatches"
          @reset="resetFilters"
        >
          <VRow dense>
            <VCol
              cols="12"
              sm="6"
              md="5"
            >
              <AppTextField
                v-model="filters.batch_sn"
                :label="$t('pages.printLabelShippingList.batchDialog.filters.batchNo')"
                :placeholder="$t('pages.printLabelShippingList.batchDialog.filters.exact')"
                density="compact"
                hide-details
                @keyup.enter="searchBatches"
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
                :label="$t('pages.printLabelShippingList.batchDialog.filters.status')"
                clearable
                hide-details
                density="compact"
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
          class="shipping-batch-dialog__table text-body-2"
          density="compact"
          hover
          fixed-header
          :height="400"
          hide-default-footer
        >
          <template #item.createtime="{ item }">
            {{ formatTs(item.createtime) }}
          </template>
          <template #item.status="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="batchStatusColor(item.status)"
            >
              {{ batchStatusLabel(item.status) }}
            </VChip>
          </template>
          <template #item.actions="{ item }">
            <div
              class="shipping-batch-dialog__actions-toolbar"
              role="toolbar"
              :aria-label="$t('pages.printLabelShippingList.batchDialog.aria.batchActions', { batch: String(item?.batch_sn ?? item?.id ?? '').trim() || `#${item?.id ?? ''}` })"
            >
              <VTooltip
                location="top"
                :text="$t('pages.printLabelShippingList.batchDialog.tooltips.detail')"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    density="compact"
                    color="primary"
                    variant="tonal"
                    class="text-none shipping-batch-dialog__toolbar-btn shipping-batch-dialog__toolbar-btn--primary"
                    prepend-icon="tabler-list-details"
                    @click="openBatchDetail(item)"
                  >
                    {{ $t('pages.printLabelShippingList.batchDialog.actions.detail') }}
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                :text="$t('pages.printLabelShippingList.batchDialog.tooltips.sourceFile')"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    icon
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="secondary"
                    class="shipping-batch-dialog__toolbar-btn"
                    :aria-label="$t('pages.printLabelShippingList.batchDialog.aria.sourceFile')"
                    :disabled="!item.xlspath"
                    @click="openSourceFile(item)"
                  >
                    <VIcon
                      icon="tabler-file-spreadsheet"
                      size="18"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                v-if="showBatchZipButton(item)"
                location="top"
                :text="$t('pages.printLabelShippingList.batchDialog.tooltips.downloadZip')"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    icon
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="primary"
                    class="shipping-batch-dialog__toolbar-btn"
                    :aria-label="$t('pages.printLabelShippingList.batchDialog.aria.labelZip')"
                    :loading="downloadingId === item.id"
                    @click="downloadBatchZip(item)"
                  >
                    <VIcon
                      icon="tabler-file-zip"
                      size="18"
                    />
                  </VBtn>
                </template>
              </VTooltip>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-10 px-4">
              <VIcon
                icon="tabler-packages"
                size="44"
                class="text-disabled mb-3"
              />
              <div class="text-body-1 text-medium-emphasis">
                {{ loading ? $t('pages.printLabelShippingList.batchDialog.empty.loading') : $t('pages.printLabelShippingList.batchDialog.empty.noData') }}
              </div>
              <div
                v-if="!loading"
                class="text-body-2 text-disabled mt-1"
              >
                {{ $t('pages.printLabelShippingList.batchDialog.empty.hint') }}
              </div>
            </div>
          </template>
        </VDataTableServer>
      </VCardText>

      <VDivider />

      <VCardActions class="shipping-batch-dialog__footer px-4 px-sm-5 py-3">
        <div class="d-flex align-center justify-space-between flex-wrap gap-x-4 gap-y-2 w-100">
          <span class="text-body-2 text-medium-emphasis flex-shrink-0">{{ $t('pages.printLabelShippingList.pagination.total', { total }) }}</span>
          <div class="d-flex align-center flex-wrap gap-x-4 gap-y-2 ms-auto">
            <div class="d-flex align-center gap-2 flex-shrink-0">
              <span class="text-body-2 text-medium-emphasis text-no-wrap">{{ $t('pages.printLabelShippingList.pagination.perPage') }}</span>
              <AppSelect
                :model-value="itemsPerPage"
                :items="[10, 20, 50, 100]"
                density="compact"
                hide-details
                class="shipping-batch-dialog__per-page-select"
                @update:model-value="itemsPerPage = Number($event)"
              />
            </div>
            <VPagination
              v-model="page"
              :length="pageLength"
              rounded
              show-first-last-page
              class="shipping-batch-dialog__pagination flex-shrink-0"
              :total-visible="$vuetify.display.xs ? 1 : 7"
            />
          </div>
        </div>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog
    :model-value="detailDialogVisible"
    max-width="920"
    scrollable
    @update:model-value="onDetailDialogUpdate"
  >
    <VCard class="shipping-batch-detail-card d-flex flex-column rounded-lg">
      <VCardItem class="pb-2 pt-4 px-4 px-sm-5">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.printLabelShippingList.batchDialog.detailTitle') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis d-flex flex-wrap align-center gap-2">
            <VChip
              v-if="detailBatch?.batch_sn"
              size="small"
              variant="tonal"
              class="text-medium-emphasis"
            >
              {{ detailBatch.batch_sn }}
            </VChip>
          </span>
        </template>
        <template #append>
          <VBtn
            icon
            size="small"
            variant="text"
            :aria-label="$t('pages.printLabelShippingList.batchDialog.closeDetail')"
            @click="onDetailDialogUpdate(false)"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </template>
      </VCardItem>

      <VDivider />

      <VCardText class="flex-grow-1 pa-4 pa-sm-5">
        <VAlert
          v-if="hasFailures"
          type="error"
          variant="tonal"
          density="compact"
          border="start"
          class="mb-4"
          icon="tabler-alert-triangle"
        >
          {{ $t('pages.printLabelShippingList.batchDialog.messages.hasFailures', { count: failureTotal }) }}
        </VAlert>
        <div class="d-flex align-center gap-2 mb-4">
          <VBtn
            variant="text"
            size="small"
            density="comfortable"
            :color="detailTab === 'orders' ? 'primary' : 'secondary'"
            class="text-none"
            @click="switchDetailTab('orders')"
          >
            <VIcon
              icon="tabler-checks"
              size="16"
              class="me-1"
            />
            {{ $t('pages.printLabelShippingList.batchDialog.tabs.orders') }}
            <VChip
              size="x-small"
              variant="flat"
              class="ms-1"
              :color="detailTab === 'orders' ? 'primary' : 'secondary'"
            >
              {{ orderTotal }}
            </VChip>
          </VBtn>
          <VBtn
            :variant="hasFailures && detailTab !== 'failures' ? 'tonal' : 'text'"
            size="small"
            density="comfortable"
            color="error"
            class="text-none"
            :class="{ 'failure-tab--alert': hasFailures && detailTab !== 'failures' }"
            @click="switchDetailTab('failures')"
          >
            <VIcon
              icon="tabler-alert-triangle"
              size="16"
              class="me-1"
            />
            {{ $t('pages.printLabelShippingList.batchDialog.tabs.failures') }}
            <VChip
              size="x-small"
              variant="flat"
              class="ms-1"
              color="error"
            >
              {{ failureTotal }}
            </VChip>
          </VBtn>
        </div>

        <AppQueryPanel
          class="mb-4"
          :title="$t('pages.printLabelShippingList.batchDialog.detailFilterTitle')"
          :loading="detailLoading"
          actions-position="bottom"
          @search="detailSearch"
          @reset="resetDetailFilters"
        >
          <VRow dense>
            <VCol
              cols="12"
              sm="8"
              md="6"
            >
              <AppTextField
                v-model="detailFilters.cankaohao"
                :label="$t('pages.printLabelShippingList.filters.refNo')"
                :placeholder="$t('pages.printLabelShippingList.filters.fuzzy')"
                density="compact"
                hide-details
                clearable
                @keyup.enter="detailSearch"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          v-if="detailTab === 'orders'"
          :headers="detailHeaders"
          :items="orderRows"
          :items-length="orderTotal"
          :loading="detailLoading"
          item-value="id"
          density="compact"
          class="shipping-batch-dialog__table shipping-batch-dialog__detail-body-table text-body-2"
          fixed-header
          :height="380"
          hide-default-footer
        >
          <template #item.cankaohao="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 160px;"
            >{{ item.cankaohao || '—' }}</span>
          </template>
          <template #item.status="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="orderStatusColor(item.status)"
            >
              {{ orderStatusLabel(item.status) }}
            </VChip>
          </template>
          <template #item.fail_reason="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 200px;"
              :title="item.fail_reason || ''"
            >{{ item.fail_reason || '—' }}</span>
          </template>
          <template #item.d_actions="{ item }">
            <div class="shipping-batch-dialog__actions-toolbar shipping-batch-dialog__actions-toolbar--solo">
              <VTooltip
                location="top"
                :text="$t('pages.printLabelShippingList.batchDialog.tooltips.openLabel')"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    density="compact"
                    variant="tonal"
                    color="primary"
                    class="text-none shipping-batch-dialog__toolbar-btn shipping-batch-dialog__toolbar-btn--primary"
                    prepend-icon="tabler-file-text"
                    :disabled="!item.label_url"
                    @click="openOrderLabel(item)"
                  >
                    {{ $t('pages.printLabelShippingList.batchDialog.actions.label') }}
                  </VBtn>
                </template>
              </VTooltip>
            </div>
          </template>
          <template #no-data>
            <div class="text-medium-emphasis text-body-2 pa-4 text-center">
              {{ detailLoading ? $t('pages.printLabelShippingList.batchDialog.empty.loading') : $t('pages.printLabelShippingList.batchDialog.empty.noOrderData') }}
            </div>
          </template>
        </VDataTableServer>

        <VDataTableServer
          v-else
          :headers="failureHeaders"
          :items="failureRows"
          :items-length="failureTotal"
          :loading="detailLoading"
          item-value="id"
          density="compact"
          class="shipping-batch-dialog__table shipping-batch-dialog__detail-body-table text-body-2"
          fixed-header
          :height="380"
          hide-default-footer
          expand-on-click
        >
          <template #item.cankaohao="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 200px;"
              :title="item.cankaohao || ''"
            >{{ item.cankaohao || '—' }}</span>
          </template>
          <template #item.failure_type="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="failureTypeColor(item.failure_type)"
            >
              {{ failureTypeLabel(item.failure_type) }}
            </VChip>
          </template>
          <template #item.reason="{ item }">
            <span class="text-body-2">{{ item.reason || '—' }}</span>
          </template>
          <template #expanded-row="{ item }">
            <tr>
              <td :colspan="failureHeaders.length">
                <div class="pa-3">
                  <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                    {{ $t('pages.printLabelShippingList.batchDialog.rowData.title') }}
                  </div>
                  <VRow dense>
                    <VCol
                      v-for="group in buildRowDataGroups(item.row_data)"
                      :key="group.label"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <div class="failure-row-data__group">
                        <div class="text-caption font-weight-medium text-medium-emphasis mb-1">
                          {{ group.label }}
                        </div>
                        <div
                          v-for="([key, val]) in group.fields"
                          :key="key"
                          class="d-flex justify-space-between gap-2 text-body-2 py-1"
                        >
                          <span class="text-medium-emphasis">{{ rowDataFieldLabel(key) }}</span>
                          <span class="font-weight-medium text-end">{{ val }}</span>
                        </div>
                      </div>
                    </VCol>
                  </VRow>
                </div>
              </td>
            </tr>
          </template>
          <template #no-data>
            <div class="text-medium-emphasis text-body-2 pa-4 text-center">
              {{ detailLoading ? $t('pages.printLabelShippingList.batchDialog.empty.loading') : $t('pages.printLabelShippingList.batchDialog.empty.noOrderData') }}
            </div>
          </template>
        </VDataTableServer>
      </VCardText>

      <VDivider />

      <VCardActions class="shipping-batch-dialog__footer shipping-batch-dialog__detail-footer px-4 px-sm-5 py-3">
        <div class="d-flex align-center justify-space-between flex-wrap gap-x-4 gap-y-2 w-100">
          <span class="text-body-2 text-medium-emphasis flex-shrink-0">{{ $t('pages.printLabelShippingList.pagination.detailTotal', { count: detailRows.length, total: detailTotal }) }}</span>
          <div class="d-flex align-center flex-wrap gap-x-4 gap-y-2 ms-auto">
            <div class="d-flex align-center gap-2 flex-shrink-0">
              <span class="text-body-2 text-medium-emphasis text-no-wrap">{{ $t('pages.printLabelShippingList.pagination.perPage') }}</span>
              <AppSelect
                :model-value="detailItemsPerPage"
                :items="[10, 20, 50, 100]"
                density="compact"
                hide-details
                class="shipping-batch-dialog__per-page-select"
                @update:model-value="detailItemsPerPage = Number($event)"
              />
            </div>
            <VPagination
              v-model="detailPage"
              :length="detailPageLength"
              rounded
              show-first-last-page
              class="shipping-batch-dialog__pagination flex-shrink-0"
              :total-visible="$vuetify.display.xs ? 1 : 7"
            />
          </div>
        </div>
      </VCardActions>
    </VCard>
  </VDialog>

  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2800"
  >
    {{ snack.text }}
  </VSnackbar>
</template>

<style scoped>
.shipping-batch-dialog__head :deep(.v-card-item__content) {
  gap: 0.125rem;
}

.shipping-batch-dialog__table {
  border-radius: 0.5rem;
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.shipping-batch-dialog__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  text-transform: none;
  background: rgba(var(--v-theme-on-surface), 0.04) !important;
  border-block-end: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}

.shipping-batch-dialog__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
  padding-block: 10px !important;
}

/* Action column: single-line alignment without an outer grouped frame. */
.shipping-batch-dialog__actions-toolbar {
  display: inline-flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  max-inline-size: 100%;
}

.shipping-batch-dialog__actions-toolbar--solo {
  justify-content: flex-end;
}

.shipping-batch-dialog__actions-toolbar :deep(.v-btn) {
  flex-shrink: 0;
}

.shipping-batch-dialog__toolbar-btn {
  min-inline-size: 0;
}

.shipping-batch-dialog__toolbar-btn--primary {
  padding-inline: 10px !important;
}

.shipping-batch-dialog__detail-body-table {
  max-block-size: 380px;
}

.shipping-batch-dialog__footer {
  align-items: stretch;
}

/* AppSelect defaults to flex-grow: 1; keep it compact beside footer pagination. */
.shipping-batch-dialog__per-page-select {
  flex: 0 0 auto;
  inline-size: 88px;
  min-inline-size: 88px;
}

.shipping-batch-dialog__footer :deep(.shipping-batch-dialog__per-page-select.app-select) {
  flex-grow: 0 !important;
}

.shipping-batch-dialog__pagination :deep(.v-pagination__list) {
  margin-block: 0;
}

.failure-row-data__group {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 8px;
  padding: 10px 12px;
}

.failure-tab--alert {
  animation: failure-tab-pulse 1.8s ease-in-out infinite;
}

@keyframes failure-tab-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-error), 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(var(--v-theme-error), 0.12);
  }
}
</style>
