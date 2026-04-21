/**
 * 用户选择的仓库 ID 持久化到 localStorage，供各页筛选/表单预选。
 * Key 仅存数字 id；选「全部」或未选时清除缓存。
 */

const STORAGE_KEY = 'wms_preferred_warehouse_id'

export function getPreferredWarehouseId() {
  if (typeof localStorage === 'undefined')
    return null

  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw == null || raw === '')
    return null

  const n = Number(raw)

  return Number.isFinite(n) ? n : null
}

export function setPreferredWarehouseId(id) {
  if (typeof localStorage === 'undefined')
    return

  if (id == null || id === '')
    localStorage.removeItem(STORAGE_KEY)
  else
    localStorage.setItem(STORAGE_KEY, String(Number(id)))
}

/**
 * @param {Array<{ title: string, value: number | null | string }>} items 下拉项（可含「全部」value: null）
 * @param {{ preferFirstWhenNoCache?: boolean }} [options]
 * - preferFirstWhenNoCache：无有效缓存时选第一个真实仓库 id（用于 Dashboard 等无「全部」场景）
 * @returns {number | null}
 */
export function resolveInitialWarehouseId(items, options = {}) {
  const { preferFirstWhenNoCache = false } = options

  const ids = (Array.isArray(items) ? items : [])
    .map(i => i?.value)
    .filter(v => v != null && v !== '' && Number.isFinite(Number(v)))
    .map(Number)

  const pref = getPreferredWarehouseId()
  if (pref != null && ids.includes(pref))
    return pref

  if (preferFirstWhenNoCache && ids.length > 0)
    return ids[0]

  return null
}
