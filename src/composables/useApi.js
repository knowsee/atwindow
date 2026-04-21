import { createFetch } from '@vueuse/core'
import { destr } from 'destr'
import { applyFormUrlEncodedPost } from '@/utils/formUrlEncodedPost'
import { handleHttpUnauthorized } from '@/utils/handleHttpUnauthorized'

export const useApi = createFetch({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  fetchOptions: {
    headers: {
      Accept: 'application/json',
    },
  },
  options: {
    refetch: true,
    async beforeFetch({ options }) {
      const accessToken = useCookie('accessToken').value
      if (accessToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
          token: accessToken,
        }

        if (options.query && typeof options.query === 'object' && !('token' in options.query))
          options.query = { ...options.query, token: accessToken }

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !('token' in options.body))
          options.body = { ...options.body, token: accessToken }
      }

      applyFormUrlEncodedPost(options)

      return { options }
    },
    afterFetch(ctx) {
      const { data, response } = ctx

      // Parse data if it's JSON
      let parsedData = null
      try {
        parsedData = destr(data)
      }
      catch (error) {
        console.error(error)
      }
      
      return { data: parsedData, response }
    },
    async onFetchError(ctx) {
      if (ctx.response?.status === 401)
        await handleHttpUnauthorized()

      return { error: ctx.error, data: ctx.data }
    },
  },
})
