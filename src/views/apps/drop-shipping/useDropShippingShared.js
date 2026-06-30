import { getI18n } from '@/plugins/i18n'
import { $api } from '@/utils/api'

const globalT = (key, params) => {
  try {
    return getI18n().global.t(key, params)
  }
  catch {
    return key
  }
}

export const DS_STATUS_DEFS = [
  { titleKey: 'domain.dropShipping.packageStatuses.all', value: '' },
  { titleKey: 'domain.dropShipping.packageStatuses.notArrived', value: 1 },
  { titleKey: 'domain.dropShipping.packageStatuses.arrived', value: 2 },
  { titleKey: 'domain.dropShipping.packageStatuses.arrivedNotReported', value: 3 },
]

export const createDsStatusItems = (translate = globalT) => DS_STATUS_DEFS.map(item => ({
  title: translate(item.titleKey),
  value: item.value,
}))

export const DS_STATUS_ITEMS = createDsStatusItems()

export function normalizeRangeText(raw) {
  const s = String(raw || '').trim()
  if (!s)
    return ''

  if (s.includes(' to '))
    return s.replace(' to ', ' - ')

  return s
}

/**
 * Expected inbound arrival date range:
 * - API `yjdc_time` may use a localized separator.
 * - Flatpickr range needs the default ` to ` separator.
 * - If text is missing, use `yjdcstime` / `yjdcetime` Unix seconds and format as Y-m-d.
 */
export function resolvePackageYjdcTimeRange(pkg) {
  const p = pkg || {}
  const text = String(p.yjdc_time ?? p.yjdc_Time ?? '').trim()
  if (text) {
    let parts
    if (text.includes('\u81f3'))
      parts = text.split(/\s*\u81f3\s*/).map(part => part.trim()).filter(Boolean)
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

export async function loadWarehouseOptions(translate = globalT, warehouseId = 1) {
  const res = await $api('/package/queryWarehouses', {
    method: 'POST',
    body: { id: warehouseId },
  })

  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: item.warehouse || item.warehouse_name || translate('common.warehouseFallback', { id: item.id }),
    value: Number(item.id),
    sendName: item.send_name || '',
    address: item.address || '',
    telephone: item.telephone || '',
    country: item.country || '',
    city: item.city || '',
    state: item.state || '',
    code: item.code || '',
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

export async function loadCartonOptions(translate = globalT) {
  const res = await $api('/ordernew/getCartonList', { method: 'GET' })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return [{ title: translate('common.options.notRequired'), value: 0, price: 0 }]

  return [
    { title: translate('common.options.notRequired'), value: 0, price: 0 },
    ...res.data.map(item => ({
      title: item.name,
      value: Number(item.id),
      price: Number(item.price) || 0,
    })),
  ]
}
