const VERSION_KEY = '__app_version__'

// ⚠️ 不要在模块顶层使用 useLocalStorage（组合式函数，需在 setup 内调用）
// 改用原生 localStorage，避免 HMR / 并发场景下响应式状态不稳定导致误判版本
function getStoredVersion() {
  try {
    return localStorage.getItem(VERSION_KEY)
  }
  catch {
    return null
  }
}

function setStoredVersion(v) {
  try {
    localStorage.setItem(VERSION_KEY, v)
  }
  catch {}
}

const newVersionAvailable = ref(false)
let checkingPromise = null

async function checkVersion() {
  if (checkingPromise)
    return checkingPromise

  checkingPromise = (async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`)
      if (!res.ok)
        return
      const data = await res.json()
      const remoteVersion = data?.version
      if (!remoteVersion)
        return

      const storedVersion = getStoredVersion()

      if (storedVersion === null) {
        // 首次访问，记录当前版本，不弹提示
        setStoredVersion(remoteVersion)
        
        return
      }

      if (storedVersion !== remoteVersion) {
        setStoredVersion(remoteVersion)
        newVersionAvailable.value = true
      }
    }
    catch {
    }
    finally {
      checkingPromise = null
    }
  })()

  return checkingPromise
}

function applyUpdate() {
  location.reload()
}

export { checkVersion, newVersionAvailable, applyUpdate }