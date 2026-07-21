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
      const executeAttempt = async (attempt) => {
        const ctrl = new AbortController()
        currentCtrl = ctrl
        
        let fullJsonStr = ''
        let streamEndedNormally = false

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
                      if (fullJsonStr) {
                        finalData = JSON.parse(fullJsonStr)
                      }
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

                    if (!finalData && fullJsonStr && fullJsonStr.trim().length > 0) {
                      // Parse completely failed
                      streamEndedNormally = false
                      ctrl.abort()
                      reject(new Error("Parse Failed"))
                      return
                    }

                    if (state.data && finalData) {
                      state.data.analysis = {
                        ...state.data.analysis,
                        markdown: finalData.markdown || state.data.analysis.markdown,
                        chartData: finalData.chartData,
                        alerts: finalData.alerts || []
                      }
                    }
                    streamEndedNormally = true
                    state.loadingPhase = 'rendering' // 正在渲染
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
                    if (!msg.data) return
                    if (msg.data === '[DONE]') {
                      handleStreamDone()
                      return
                    }

                    let chunkData = {}
                    try {
                      chunkData = JSON.parse(msg.data)
                    } catch (err) {
                      console.warn('Skipping invalid JSON chunk:', msg.data)
                      return
                    }
                    
                    // 1. 核心判断：是否接收到了结束标志
                    if (chunkData.is_end === true) {
                      if (chunkData.chartData && state.data) {
                        state.data.analysis.chartData = chunkData.chartData
                      }
                      if (chunkData.alerts && state.data) {
                        state.data.analysis.alerts = chunkData.alerts
                      }
                      handleStreamDone()
                      return
                    }
                    
                    // 2. 兼容后端把 code: 200 成功消息当成 message/done 发送
                    if (chunkData.code === 200 && (chunkData.message === 'success' || chunkData.msg === 'success')) {
                      if (chunkData.data && typeof chunkData.data === 'object') {
                        fullJsonStr = JSON.stringify(chunkData.data)
                      }
                      handleStreamDone()
                      return
                    }

                    // 3. 处理流式 chunk
                    if (chunkData.chunk !== undefined) {
                      fullJsonStr += (chunkData.chunk || '')

                      const trimmed = fullJsonStr.trim()
                      const match = fullJsonStr.match(/"markdown"\s*:\s*"((?:[^"\\]|\\.)*)/)
                      
                      if (match && state.data && state.data.analysis) {
                        // 旧模式：JSON 字符串拼接，正则提取 markdown
                        let rawText = match[1]
                        if (rawText.endsWith('\\')) rawText = rawText.slice(0, -1)
                        try {
                          state.data.analysis.markdown = JSON.parse('"' + rawText + '"')
                        } catch (e) {
                          state.data.analysis.markdown = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
                        }
                      } else if (trimmed.length > 0 && !trimmed.startsWith('{') && state.data && state.data.analysis) {
                        // 新模式：纯 Markdown 片段拼接 (如果不是以 { 开头，肯定不是 JSON)
                        state.data.analysis.markdown = fullJsonStr
                      }
                    }
                  } else if (msg.event === 'done') {
                    if (msg.data && msg.data !== '[DONE]') {
                      try {
                        const doneData = JSON.parse(msg.data)
                        if (doneData.chartData && state.data) state.data.analysis.chartData = doneData.chartData
                        if (doneData.alerts && state.data) state.data.analysis.alerts = doneData.alerts
                      } catch (e) {}
                    }
                    handleStreamDone()
                  } else if (msg.event === 'error') {
                    const errData = JSON.parse(msg.data)
                    // 如果是 AI JSON 损坏报错，尝试用之前接收到的截断数据进行图表渲染，而不是直接崩溃
                    if (errData.message?.includes('Invalid JSON') || errData.code === 500) {
                      console.warn('Backend reported invalid JSON from AI, attempting to salvage received data...')
                      handleStreamDone()
                    } else {
                      state.errorMsg = errData.message || errData.msg || fallbackErrorMsgFn()
                      streamEndedNormally = false
                      ctrl.abort()
                      reject(new Error(state.errorMsg))
                    }
                  }
                } catch (e) {
                  console.error('SSE Message Parse Error', e)
                }
              },
              onclose() {
                if (!streamEndedNormally) {
                  // 异常终止
                  reject(new Error("Abnormal Termination"))
                } else {
                  resolve()
                }
                ctrl.abort()
              },
              onerror(err) {
                if (err.name === 'AbortError') return // 忽略主动终止的错误
                streamEndedNormally = false
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
            if (attempt < 1 && (err.message === 'Parse Failed' || err.message === 'Abnormal Termination' || !err.message?.includes('Unauthorized'))) {
              console.warn(`SSE fetch or parse failed (attempt ${attempt + 1}), retrying once...`, err)
              state.loadingPhase = 'queued'
              return await executeAttempt(attempt + 1)
            } else {
              throw err
            }
          }
        }
      }

      try {
        await executeAttempt(0)
      } catch (err) {
        if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
          console.error('aiStart or SSE Error (final):', err)
          state.errorMsg = err?.message || fallbackErrorMsgFn()
          state.loadingPhase = 'error'
        } else {
          state.loadingPhase = 'idle'
        }
      }
    })().finally(() => {
      if (state.loadingPhase === 'rendering') {
        setTimeout(() => {
          state.loading = false
        }, 800) // 给予图表 800ms 的渲染时间缓冲，显示"正在渲染"
      } else {
        state.loading = false
      }
      
      if (state.loadingPhase !== 'error' && state.loadingPhase !== 'done' && state.loadingPhase !== 'idle' && state.loadingPhase !== 'rendering') {
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

