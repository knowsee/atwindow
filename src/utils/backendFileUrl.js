/** 后端静态资源根：主标 / 箱唛等相对路径拼在此域名下 */
export const BACKEND_FILE_ORIGIN = 'https://backend.atwindow.com'

/**
 * 将后端返回的相对路径转为浏览器可直接打开的绝对 URL。
 * 已以 http:// 或 https:// 开头则原样返回；data:、// 也不改写。
 *
 * @param {unknown} path
 * @returns {string}
 */
export function resolveBackendFileUrl(path) {
  const s = String(path ?? '').trim()
  if (!s)
    return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://'))
    return s
  if (lower.startsWith('data:'))
    return s
  if (s.startsWith('//'))
    return s
  const base = BACKEND_FILE_ORIGIN.replace(/\/$/, '')
  const rel = s.replace(/^\/+/, '')

  return `${base}/${rel}`
}
