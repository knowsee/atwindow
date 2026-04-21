import { ofetch } from 'ofetch'
import { applyFormUrlEncodedPost } from '@/utils/formUrlEncodedPost'
import { handleHttpUnauthorized } from '@/utils/handleHttpUnauthorized'

async function onResponseUnauthorized(context) {
  if (context.response?.status === 401)
    await handleHttpUnauthorized()
}

export const $api = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  async onRequest({ options }) {
    const accessToken = useCookie('accessToken').value
    if (accessToken) {
      // Support both `Headers` and plain object headers.
      if (options.headers instanceof Headers) {
        options.headers.set('Authorization', `Bearer ${accessToken}`)
        options.headers.set('token', accessToken)
      }
      else {
        options.headers = {
          ...(options.headers || {}),
          Authorization: `Bearer ${accessToken}`,
          token: accessToken,
        }
      }

      // Some legacy endpoints expect token in query/body field instead of headers.
      if (options.query && typeof options.query === 'object' && !('token' in options.query))
        options.query = { ...options.query, token: accessToken }

      if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !('token' in options.body))
        options.body = { ...options.body, token: accessToken }
    }

    applyFormUrlEncodedPost(options)
  },
  onResponseError: onResponseUnauthorized,
})

/** 运单试算/下单等接口仍要求 JSON Body（与表单 POST 区分） */
export const $apiJson = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  async onRequest({ options }) {
    const accessToken = useCookie('accessToken').value
    if (accessToken) {
      if (options.headers instanceof Headers) {
        options.headers.set('Authorization', `Bearer ${accessToken}`)
        options.headers.set('token', accessToken)
      }
      else {
        options.headers = {
          ...(options.headers || {}),
          Authorization: `Bearer ${accessToken}`,
          token: accessToken,
        }
      }
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      const merged = { ...options.body }
      if (accessToken && merged.token == null)
        merged.token = accessToken
      options.body = JSON.stringify(merged)
      if (options.headers instanceof Headers) {
        options.headers.set('Content-Type', 'application/json; charset=UTF-8')
      }
      else {
        options.headers = {
          ...(options.headers || {}),
          'Content-Type': 'application/json; charset=UTF-8',
        }
      }
    }
  },
  onResponseError: onResponseUnauthorized,
})
