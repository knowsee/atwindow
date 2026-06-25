/* eslint-disable camelcase -- Fields match ordernew/orderDdList and getChannelList APIs. */
import { getI18n } from '@/plugins/i18n'
import { $api } from '@/utils/api'

/** Filter "all" sentinel; keep it distinct from valid status/type values. */
export const ORDER_DD_FILTER_ALL = -1

/** Legacy order status filter options, including status=6 for rows with error_message. */
export const ORDER_DD_STATUS_FILTER_DEFS = [
  { titleKey: 'pages.printLabelOrders.statusFilters.all', value: ORDER_DD_FILTER_ALL },
  { titleKey: 'pages.printLabelOrders.statuses.paidWaiting', value: 1 },
  { titleKey: 'pages.printLabelOrders.statuses.completed', value: 2 },
  { titleKey: 'pages.printLabelOrders.statuses.cancelled', value: 3 },
  { titleKey: 'pages.printLabelOrders.statuses.cancelling', value: 33 },
  { titleKey: 'pages.printLabelOrders.statuses.failed', value: 4 },
  { titleKey: 'pages.printLabelOrders.statuses.orderedWaitingFee', value: 5 },
  { titleKey: 'pages.printLabelOrders.statuses.exception', value: 6 },
]

/** Row status chip definitions. Adjust here if backend enums change. */
export const YUNDAN_STATUS_MAP = {
  1: { textKey: 'pages.printLabelOrders.statuses.paidWaiting', color: 'warning' },
  2: { textKey: 'pages.printLabelOrders.statuses.completed', color: 'success' },
  3: { textKey: 'pages.printLabelOrders.statuses.cancelled', color: 'secondary' },
  33: { textKey: 'pages.printLabelOrders.statuses.cancelling', color: 'warning' },
  4: { textKey: 'pages.printLabelOrders.statuses.failed', color: 'error' },
  5: { textKey: 'pages.printLabelOrders.statuses.orderedWaitingFee', color: 'info' },
  6: { textKey: 'pages.printLabelOrders.statuses.exception', color: 'error' },
}

function globalT(key, params) {
  try {
    return getI18n().global.t(key, params)
  }
  catch {
    return key
  }
}

export function resolveYundanStatus(status, translate = globalT) {
  const n = Number(status)
  const row = YUNDAN_STATUS_MAP[n]

  return row
    ? { text: translate(row.textKey), color: row.color }
    : { text: translate('pages.printLabelOrders.statuses.unknown', { status: Number.isFinite(n) ? n : '—' }), color: 'secondary' }
}

/** Shipping fee: take the amount prefix to avoid overlong descriptive text. */
export function formatYundanShippingFee(raw) {
  if (raw == null || raw === '')
    return '—'
  const s = String(raw)
  const lead = s.match(/^[\d.]+/)

  return lead ? lead[0] : s
}

export function formatTotalWeight(raw) {
  if (raw == null || raw === '')
    return '—'
  const n = Number(raw)

  return Number.isFinite(n) ? n.toString() : String(raw)
}

export function useYundanList() {
  const { t } = useI18n({ useScope: 'global' })
  const items = ref([])
  const total = ref(0)
  const loading = ref(false)
  const page = ref(1)
  const itemsPerPage = ref(20)
  const loadError = ref('')

  const filterStatus = ref(ORDER_DD_FILTER_ALL)
  const filterType = ref(ORDER_DD_FILTER_ALL)
  const filterCankaohao = ref('')
  const filterRecipientName = ref('')
  const filterCreateRange = ref('')

  const loadedChannelTypeItems = ref([])

  const statusFilterItems = computed(() => ORDER_DD_STATUS_FILTER_DEFS.map(item => ({
    title: t(item.titleKey),
    value: item.value,
  })))

  const channelTypeItems = computed(() => [
    { title: t('pages.printLabelOrders.filters.allChannels'), value: ORDER_DD_FILTER_ALL },
    ...loadedChannelTypeItems.value,
  ])

  async function loadChannelList() {
    try {
      const res = await $api('/ordernew/getChannelList', { method: 'GET' })
      if (Number(res?.code) === 1 && Array.isArray(res.data)) {
        const mapped = res.data.map(c => ({
          title: String(c.name ?? '').trim() || t('pages.printLabelOrders.filters.unnamedChannel'),
          value: Number(c.qid),
        }))

        loadedChannelTypeItems.value = mapped
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  onMounted(() => {
    loadChannelList()
  })

  function buildOrderDdBody() {
    const body = {
      current_page: page.value,
      per_page_num: itemsPerPage.value,
    }

    const st = filterStatus.value
    if (st != null && st !== '' && Number(st) !== ORDER_DD_FILTER_ALL)
      body.status = Number(st)
    const tp = filterType.value
    if (tp != null && tp !== '' && Number(tp) !== ORDER_DD_FILTER_ALL)
      body.type = Number(tp)
    const ck = filterCankaohao.value.trim()
    if (ck)
      body.cankaohao = ck
    const rn = filterRecipientName.value.trim()
    if (rn)
      body.recipient_name = rn
    const ct = normalizeCreateRange(filterCreateRange.value)
    if (ct)
      body.create_time = ct

    return body
  }

  /**
    * Common AppDateTimePicker range values:
   * - "2026-04-01 to 2026-04-16"
   * - "2026-04-01 - 2026-04-16"
   */
  function normalizeCreateRange(raw) {
    const s = String(raw || '').trim()
    if (!s)
      return ''
    if (s.includes(' to '))
      return s.replace(' to ', ' - ')

    return s
  }

  async function loadList() {
    loading.value = true
    loadError.value = ''
    try {
      const res = await $api('/ordernew/orderDdList', {
        method: 'POST',
        body: buildOrderDdBody(),
      })

      if (Number(res?.code) === 1 && res.data) {
        items.value = Array.isArray(res.data.data) ? res.data.data : []
        total.value = Number(res.data.count) || 0
      }
      else {
        items.value = []
        total.value = 0
        loadError.value = res?.msg || t('pages.printLabelOrders.messages.loadFailed')
      }
    }
    catch (e) {
      items.value = []
      total.value = 0
      loadError.value = e?.data?.msg || e?.message || t('pages.printLabelOrders.messages.networkFailed')
      console.error(e)
    }
    finally {
      loading.value = false
    }
  }

  /** Search from page 1; load directly when already on page 1 because the watcher will not fire. */
  function searchOrders() {
    const alreadyFirst = page.value === 1

    page.value = 1
    if (alreadyFirst)
      return loadList()
  }

  function resetFilters() {
    filterStatus.value = ORDER_DD_FILTER_ALL
    filterType.value = ORDER_DD_FILTER_ALL
    filterCankaohao.value = ''
    filterRecipientName.value = ''
    filterCreateRange.value = ''

    const alreadyFirst = page.value === 1

    page.value = 1
    if (alreadyFirst)
      return loadList()
  }

  watch([page, itemsPerPage], loadList, { immediate: true })

  return {
    items,
    total,
    loading,
    page,
    itemsPerPage,
    loadList,
    loadError,
    filterStatus,
    filterType,
    filterCankaohao,
    filterRecipientName,
    filterCreateRange,
    statusFilterItems,
    channelTypeItems,
    searchOrders,
    resetFilters,
  }
}
