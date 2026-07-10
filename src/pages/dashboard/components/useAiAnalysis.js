import { fetchEventSource } from '@microsoft/fetch-event-source'
import { computed, reactive, unref } from 'vue'

// 抽取到外部的全局缓存字典，以保证组件销毁后状态依旧保留
const cache = reactive({})

export function useAiAnalysis(warehouseIdRef, localeRef, fallbackErrorMsgFn) {
  // 必须在 setup 阶段调用 composable
  const accessTokenCookie = useCookie('accessToken')
  
  let currentCtrl = null

  const fetchAnalysis = () => {
    const warehouseId = unref(warehouseIdRef)
    const locale = unref(localeRef)
    
    if (!warehouseId) return
    
    // 中断上一个未完成的请求，防止不同仓库的数据串行/互相覆盖
    if (currentCtrl) {
      currentCtrl.abort()
      currentCtrl = null
    }

    const key = `${warehouseId}_${locale}`
    
    // 初始化该维度的状态
    if (!cache[key]) {
      cache[key] = {
        data: null,
        loading: false,
        loadingPhase: 'idle',
        errorMsg: '',
        promise: null,
      }
    }
    
    const state = cache[key]
    
    // 如果已经有数据，或者正在请求中，则直接跳过，防止切换页面时重复发起请求
    if (state.data || state.promise) {
      return state.promise
    }
    
    state.loading = true
    state.loadingPhase = 'queued'
    state.errorMsg = ''
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    const accessToken = accessTokenCookie.value || ''
    
    // 使用 AbortController 阻止底层 fetch 默认的无限重连，同时提供手动 abort 能力
    const ctrl = new AbortController()
    currentCtrl = ctrl
    
    state.promise = (async () => {
      try {
        // 1. 发起分析请求 (获取 Job ID)
        const aiStartUrl = `${baseUrl}/ordernewapi/aiStart`
        const reqBody = {
          warehouse_id: Number(warehouseId),
          language: locale || 'zh-CN'
        }
        
        // 本地开发调试时强制刷新缓存
        if (import.meta.env.DEV) {
          reqBody.force_refresh = false
        }

        const startRes = await fetch(aiStartUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'token': accessToken
          },
          body: JSON.stringify(reqBody),
          signal: ctrl.signal
        })
        
        const startJson = await startRes.json()
        const code = Number(startJson.code)
        if ((code !== 200 && code !== 1) || !startJson.data?.job_id) {
          throw new Error(startJson.msg || startJson.message || fallbackErrorMsgFn())
        }
        
        const jobId = startJson.data.job_id
        
        // 2. 连接 SSE 接收实时流式数据
        const sseUrl = new URL(`${baseUrl}/ordernewapi/aiStream`, window.location.origin)
        sseUrl.searchParams.append('job_id', jobId)
        
        let fullJsonStr = ''
        
        await new Promise((resolve, reject) => {
          fetchEventSource(sseUrl.toString(), {
            method: 'GET',
            signal: ctrl.signal,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'token': accessToken,
              'Accept': 'text/event-stream',
            },
            async onopen(response) {
              if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
                return // success
              }
              if (response.status === 401 || response.status === 403) {
                throw new Error('Unauthorized')
              }
              if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`)
              }
            },
            onmessage(msg) {
              try {
                const handleStreamDone = () => {
                  let finalData = null
                  try {
                    finalData = JSON.parse(fullJsonStr)
                  } catch (e) {
                    console.warn('SSE JSON parse failed, trying fallback extraction:', e)
                    try {
                      const chartDataIdx = fullJsonStr.indexOf('"chartData"')
                      if (chartDataIdx > -1) {
                        let fallbackStr = '{' + fullJsonStr.substring(chartDataIdx)
                        // Auto-fix truncated JSON from AI
                        let cleanStr = fallbackStr.replace(/,\s*$/, '').replace(/:"[^"]*$/, '""')
                        const suffixes = ['', '}', '}}', '}}}', ']}', ']}}', ']}}}', '}]}', '}]}}', '}}]}']
                        
                        for (const suf of suffixes) {
                          try {
                            finalData = JSON.parse(cleanStr + suf)
                            break // Success!
                          } catch (err) {}
                        }
                      }
                    } catch (fallbackErr) {
                      console.error('Fallback parse failed:', fallbackErr)
                    }
                  }

                  if (state.data && finalData) {
                    state.data.analysis = {
                      ...state.data.analysis,
                      chartData: finalData.chartData,
                      alerts: finalData.alerts || []
                    }
                  }
                  state.loading = false
                  state.loadingPhase = 'done'
                  ctrl.abort()
                  resolve()
                }

                if (msg.event === 'meta') {
                  state.loadingPhase = 'thinking'
                  const metaData = JSON.parse(msg.data)
                  state.data = {
                    warehouse: metaData.warehouse,
                    sku_count: metaData.sku_count,
                    generated_at: metaData.generated_at || '',
                    analysis: { markdown: '' }
                  }
                } else if (msg.event === 'message' || !msg.event) {
                  if (state.loadingPhase !== 'streaming') {
                    state.loadingPhase = 'streaming'
                  }
                  
                  const chunkData = JSON.parse(msg.data)
                  
                  // 兼容后端把 code: 200 成功消息当成 message/done 发送
                  if (chunkData.code === 200 && chunkData.message === 'success') {
                    handleStreamDone()
                    return
                  }

                  fullJsonStr += (chunkData.chunk || '')
                  
                  const match = fullJsonStr.match(/"markdown"\s*:\s*"((?:[^"\\]|\\.)*)/)
                  if (match && state.data && state.data.analysis) {
                    let rawText = match[1]
                    if (rawText.endsWith('\\')) {
                      rawText = rawText.slice(0, -1)
                    }
                    try {
                      state.data.analysis.markdown = JSON.parse('"' + rawText + '"')
                    } catch (e) {
                      // Fallback for mid-escape sequence boundaries
                      state.data.analysis.markdown = rawText
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                    }
                  }
                } else if (msg.event === 'done') {
                  handleStreamDone()
                } else if (msg.event === 'error') {
                  const errData = JSON.parse(msg.data)
                  // 如果是 AI JSON 损坏报错，尝试用之前接收到的截断数据进行图表渲染，而不是直接崩溃
                  if (errData.message?.includes('Invalid JSON') || errData.code === 500) {
                    console.warn('Backend reported invalid JSON from AI, attempting to salvage received data...')
                    handleStreamDone()
                  } else {
                    state.errorMsg = errData.message || errData.msg || fallbackErrorMsgFn()
                    state.loading = false
                    state.loadingPhase = 'error'
                    ctrl.abort()
                    reject(new Error(state.errorMsg))
                  }
                }
              } catch (e) {
                console.error('SSE Message Parse Error', e)
              }
            },
            onclose() {
              state.loading = false
              state.loadingPhase = 'done'
              resolve()
              ctrl.abort()
            },
            onerror(err) {
              if (err.name === 'AbortError') return // 忽略主动终止的错误
              state.errorMsg = err?.message || fallbackErrorMsgFn()
              state.loading = false
              state.loadingPhase = 'error'
              reject(err)
              throw err // Stop fetchEventSource from retrying
            }
          }).catch(err => {
            if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
              console.error('fetchEventSource Error:', err)
            }
            reject(err)
          })
        })
      } catch (err) {
        if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
          console.error('aiStart or SSE Error:', err)
          state.errorMsg = err?.message || fallbackErrorMsgFn()
          state.loadingPhase = 'error'
        } else {
          state.loadingPhase = 'idle'
        }
        state.loading = false
      }
    })().finally(() => {
      state.loading = false
      if (state.loadingPhase !== 'error' && state.loadingPhase !== 'done' && state.loadingPhase !== 'idle') {
        state.loadingPhase = 'done'
      }
      state.promise = null
    })
    
    return state.promise
  }

  // 计算当前维度的实时状态
  const currentState = computed(() => {
    const warehouseId = unref(warehouseIdRef)
    const locale = unref(localeRef)
    if (!warehouseId) return { data: null, loading: false, loadingPhase: 'idle', errorMsg: '' }
    
    const key = `${warehouseId}_${locale}`
    
    return cache[key] || { data: null, loading: false, loadingPhase: 'idle', errorMsg: '' }
  })

  const data = computed(() => currentState.value.data)
  const loading = computed(() => currentState.value.loading)
  const loadingPhase = computed(() => currentState.value.loadingPhase)
  const errorMsg = computed(() => currentState.value.errorMsg)

  return {
    fetchAnalysis,
    data,
    loading,
    loadingPhase,
    errorMsg,
  }
}

