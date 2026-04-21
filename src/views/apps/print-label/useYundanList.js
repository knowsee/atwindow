/* eslint-disable camelcase -- 与 ordernew/orderDdList、getChannelList 接口字段一致 */
import { $api } from '@/utils/api'

/** 筛选「全部」占位，勿与合法 status/type 冲突 */
export const ORDER_DD_FILTER_ALL = -1

/** 订单列表 status 筛选下拉（含服务端约定 status=6：含 error_message 的异常单） */
export const ORDER_DD_STATUS_FILTER_ITEMS = [
  { title: '全部状态', value: ORDER_DD_FILTER_ALL },
  { title: '已支付等待出单', value: 1 },
  { title: '出单完成', value: 2 },
  { title: '已取消', value: 3 },
  { title: '取消中', value: 33 },
  { title: '出单失败', value: 4 },
  { title: '已下单，等待出单扣费', value: 5 },
  { title: '异常', value: 6 },
]

/** 行上状态 Chip 展示（与后端枚举不一致时在此改） */
export const YUNDAN_STATUS_MAP = {
  1: { text: '已支付等待出单', color: 'warning' },
  2: { text: '出单完成', color: 'success' },
  3: { text: '已取消', color: 'secondary' },
  33: { text: '取消中', color: 'warning' },
  4: { text: '出单失败', color: 'error' },
  5: { text: '已下单，等待出单扣费', color: 'info' },
  6: { text: '异常', color: 'error' },
}

export function resolveYundanStatus(status) {
  const n = Number(status)
  const row = YUNDAN_STATUS_MAP[n]

  return row || { text: `状态(${Number.isFinite(n) ? n : '—'})`, color: 'secondary' }
}

/** 运费：取金额前缀，避免整段说明过长 */
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

  const channelTypeItems = ref([
    { title: '全部渠道', value: ORDER_DD_FILTER_ALL },
  ])

  async function loadChannelList() {
    try {
      const res = await $api('/ordernew/getChannelList', { method: 'GET' })
      if (Number(res?.code) === 1 && Array.isArray(res.data)) {
        const mapped = res.data.map(c => ({
          title: String(c.name ?? '').trim() || '未命名渠道',
          value: Number(c.qid),
        }))

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
   * AppDateTimePicker range 常见值：
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
        loadError.value = res?.msg || '加载订单列表失败'
      }
    }
    catch (e) {
      items.value = []
      total.value = 0
      loadError.value = e?.data?.msg || e?.message || '网络请求失败'
      console.error(e)
    }
    finally {
      loading.value = false
    }
  }

  /** 条件查询：回到第 1 页；若已在第 1 页则需直接拉取（避免 watch 不触发） */
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
    channelTypeItems,
    searchOrders,
    resetFilters,
  }
}
