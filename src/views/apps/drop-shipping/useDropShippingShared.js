import { $api } from '@/utils/api'

export const DS_STATUS_ITEMS = [
  { title: '全部', value: '' },
  { title: '未到库', value: 1 },
  { title: '已到库', value: 2 },
  { title: '已到库未上报', value: 3 },
]

export function normalizeRangeText(raw) {
  const s = String(raw || '').trim()
  if (!s)
    return ''

  if (s.includes(' to '))
    return s.replace(' to ', ' - ')

  return s
}

/**
 * 入库单预计到仓时间（仅年月日）：
 * - 接口 `yjdc_time` 常为「2026-02-04 至 2026-02-10」
 * - 回填给 flatpickr range 须用英文默认分隔符 ` to `，否则无法识别为区间
 * - 无文案时用 `yjdcstime` / `yjdcetime` 秒级时间戳，格式化为 Y-m-d
 */
export function resolvePackageYjdcTimeRange(pkg) {
  const p = pkg || {}
  const text = String(p.yjdc_time ?? p.yjdc_Time ?? '').trim()
  if (text) {
    let parts
    if (text.includes('至'))
      parts = text.split(/\s*至\s*/).map(part => part.trim()).filter(Boolean)
    else if (/\s+to\s+/i.test(text))
      parts = text.split(/\s+to\s+/i).map(part => part.trim()).filter(Boolean)
    else if (text.includes(' - '))
      parts = text.split(/\s*-\s*/).map(part => part.trim()).filter(Boolean)
    else
      parts = [text]

    if (parts.length >= 2)
      return `${parts[0]} to ${parts[1]}`

    return parts[0] || ''
  }

  const a = p.yjdcstime
  const b = p.yjdcetime
  if (a == null && b == null)
    return ''
  if (a === '' && b === '')
    return ''

  const toUnixSec = v => {
    const n = Number(v)

    return Number.isFinite(n) ? n : NaN
  }

  const sa = toUnixSec(a)
  const sb = toUnixSec(b)
  if (!Number.isFinite(sa) || !Number.isFinite(sb))
    return [a, b].filter(v => v !== '' && v != null).join(' to ')

  const fmtDate = sec => {
    const d = new Date(sec * 1000)
    const pad = n => String(n).padStart(2, '0')

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  return `${fmtDate(sa)} to ${fmtDate(sb)}`
}

export async function loadWarehouseOptions() {
  const res = await $api('/package/queryWarehouses', {
    method: 'POST',
    body: { id: 1 },
  })

  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: item.warehouse || item.warehouse_name || `仓库${item.id}`,
    value: Number(item.id),
  }))
}

export async function loadCountryOptions() {
  const res = await $api('/order/queryCountry', { method: 'POST' })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.cn_name || item.en_name || item.short_name || ''}`.trim(),
    value: item.short_name || item.en_name || item.cn_name,
  })).filter(item => item.value)
}
