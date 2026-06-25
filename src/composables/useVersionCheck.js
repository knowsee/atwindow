const VERSION_KEY = '__app_version__'

const currentVersion = useLocalStorage(VERSION_KEY, null)
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

      if (currentVersion.value === null) {
        currentVersion.value = remoteVersion
        
        return
      }

      if (currentVersion.value !== remoteVersion) {
        currentVersion.value = remoteVersion
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