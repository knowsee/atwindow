/** 与后端约定：POST 使用表单编码 */
export const FORM_URLENCODED_CT = 'application/x-www-form-urlencoded; charset=UTF-8'

/**
 * 将 POST 的 JSON 风格 body 转为 x-www-form-urlencoded 字符串并设置 Content-Type。
 * 跳过 FormData、Blob、已有字符串、URLSearchParams。
 * 嵌套对象/数组字段使用 JSON.stringify，与常见 PHP 接口兼容。
 */
export function applyFormUrlEncodedPost(options) {
  const method = String(options.method || 'GET').toUpperCase()
  if (method !== 'POST')
    return

  const body = options.body
  if (body == null)
    return

  if (
    typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
  )
    return

  if (typeof body !== 'object')
    return

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined)
      continue
    if (value === null) {
      params.append(key, '')
    }
    else if (typeof value === 'object') {
      params.append(key, JSON.stringify(value))
    }
    else {
      params.append(key, String(value))
    }
  }

  options.body = params.toString()

  if (options.headers instanceof Headers) {
    options.headers.set('Content-Type', FORM_URLENCODED_CT)
  }
  else {
    options.headers = {
      ...(options.headers || {}),
      'Content-Type': FORM_URLENCODED_CT,
    }
  }
}
