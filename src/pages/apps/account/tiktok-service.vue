<script setup>
import { $api } from '@/utils/api'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const userData = useCookie('userData')
const accessToken = useCookie('accessToken')
const { t } = useI18n({ useScope: 'global' })

// ─── Global snackbar ─────────────────────────────────────────────────────────
const snack = ref({ show: false, text: '', color: 'info' })
function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
const activeTab = ref('shops')

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Shop list
// ═══════════════════════════════════════════════════════════════════════════════
const shopsLoading = ref(false)
const shops = ref([])

async function loadShops() {
  shopsLoading.value = true
  try {
    const res = await $api('/tiktoknewapi/getShops', { method: 'GET' })
    if (Number(res?.code) === 1) {
      shops.value = Array.isArray(res.data) ? res.data : []
    }
    else {
      toast(res?.msg || t('pages.tiktokService.messages.shopsFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.tiktokService.messages.networkFailed'), 'error')
  }
  finally {
    shopsLoading.value = false
  }
}

function goToAuthManagement() {
  router.push({ name: 'apps-account-auth-management' })
}

function resolveCurrentAccessToken() {
  const rawToken = accessToken.value
    ?? userData.value?.token
    ?? userData.value?.accessToken

  return typeof rawToken === 'string' ? rawToken.trim() : ''
}

function openAuthUrl(region) {
  const token = resolveCurrentAccessToken()
  if (!token) {
    toast(t('pages.tiktokService.messages.logsNoUser'), 'error')

    return
  }

  const url = new URL('https://next.atwindow.com/api/tiktok/auth/redirect')

  url.searchParams.set('region', region)
  url.searchParams.set('token', token)

  window.open(
    url.toString(),
    '_blank',
    'noopener',
  )
}

// Token status display
function tokenStatusColor(expired) {
  return expired ? 'error' : 'success'
}
function tokenStatusText(expired) {
  return expired ? t('pages.tiktokService.token.expired') : t('pages.tiktokService.token.normal')
}
function formatUnixTime(ts) {
  if (!ts)
    return '-'

  return new Date(ts * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveCurrentUserId() {
  const rawUserId = userData.value?.['user_id']
    ?? userData.value?.id
    ?? userData.value?.uid
    ?? userData.value?.userid

  const normalizedUserId = Number(rawUserId)

  return Number.isInteger(normalizedUserId) && normalizedUserId > 0 ? normalizedUserId : null
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Warehouse binding management
// ═══════════════════════════════════════════════════════════════════════════════

// Binding data for each shop, keyed by shop.id.
const bindingsMap = reactive({})
const bindingsLoadingSet = reactive(new Set())

async function loadBindings(shop) {
  if (bindingsLoadingSet.has(shop.id))
    return

  bindingsLoadingSet.add(shop.id)
  try {
    const res = await $api('/tiktoknewapi/getWarehouseBindings', {
      method: 'GET',
      query: { ['shop_db_id']: shop.id },
    })

    if (Number(res?.code) === 1) {
      bindingsMap[shop.id] = res.data?.bindings ?? []
    }
    else {
      toast(res?.msg || t('pages.tiktokService.messages.bindingsFailed'), 'error')
      bindingsMap[shop.id] = []
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.tiktokService.messages.networkFailed'), 'error')
    bindingsMap[shop.id] = []
  }
  finally {
    bindingsLoadingSet.delete(shop.id)
  }
}

// ── WMS warehouse options for the binding dialog ────────────────────────────
const wmsWarehouseOptions = ref([])

async function ensureWmsWarehouses() {
  if (wmsWarehouseOptions.value.length)
    return

  const list = await loadWarehouseOptions()

  wmsWarehouseOptions.value = list
}

// ── TK warehouse list, cached by shop ───────────────────────────────────────
const tkWarehousesMap = reactive({})
const tkWarehousesLoading = ref(false)

async function loadTkWarehouses(shopDbId) {
  if (tkWarehousesMap[shopDbId])
    return

  tkWarehousesLoading.value = true
  try {
    const res = await $api('/tiktoknewapi/getTkWarehouseList', {
      method: 'GET',
      query: { ['shop_db_id']: shopDbId },
    })

    if (Number(res?.code) === 1) {
      tkWarehousesMap[shopDbId] = Array.isArray(res.data?.warehouses) ? res.data.warehouses : []
    }
    else {
      toast(res?.msg || t('pages.tiktokService.messages.tkWarehousesFailed'), 'error')
      tkWarehousesMap[shopDbId] = []
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.tiktokService.messages.requestFailed'), 'error')
    tkWarehousesMap[shopDbId] = []
  }
  finally {
    tkWarehousesLoading.value = false
  }
}

// ── Binding dialog ──────────────────────────────────────────────────────────
const bindingDialog = reactive({
  visible: false,
  mode: 'add',   // 'add' | 'edit'
  submitting: false,
  currentShop: null,
  currentRecord: null,
  form: {
    ['warehouse_id']: null,
    ['wms_warehouse_id']: null,
    status: 1,
  },
})

const bindingFormRef = ref()

async function openAddBinding(shop) {
  bindingDialog.mode = 'add'
  bindingDialog.currentShop = shop
  bindingDialog.currentRecord = null
  bindingDialog.form = { ['warehouse_id']: null, ['wms_warehouse_id']: null, status: 1 }
  bindingDialog.visible = true
  await Promise.all([
    loadTkWarehouses(shop.id),
    ensureWmsWarehouses(),
  ])
}

async function openEditBinding(shop, record) {
  bindingDialog.mode = 'edit'
  bindingDialog.currentShop = shop
  bindingDialog.currentRecord = record
  bindingDialog.form = {
    ['warehouse_id']: record['warehouse_id'],
    ['wms_warehouse_id']: record['wms_warehouse_id'],
    status: record.status,
  }
  bindingDialog.visible = true
  await Promise.all([
    loadTkWarehouses(shop.id),
    ensureWmsWarehouses(),
  ])
}

function closeBindingDialog() {
  bindingDialog.visible = false
  bindingFormRef.value?.resetValidation()
}

async function submitBinding() {
  const { valid } = await bindingFormRef.value.validate()
  if (!valid)
    return

  bindingDialog.submitting = true
  try {
    const shop = bindingDialog.currentShop
    let res

    if (bindingDialog.mode === 'add') {
      res = await $api('/tiktoknewapi/addWarehouseBinding', {
        method: 'POST',
        body: {
          ['shop_id']: shop['shop_id'],
          ['warehouse_id']: bindingDialog.form['warehouse_id'],
          ['wms_warehouse_id']: Number(bindingDialog.form['wms_warehouse_id']),
          status: bindingDialog.form.status ?? 1,
        },
      })
    }
    else {
      res = await $api('/tiktoknewapi/updateWarehouseBinding', {
        method: 'POST',
        body: {
          id: bindingDialog.currentRecord.id,
          ['wms_warehouse_id']: Number(bindingDialog.form['wms_warehouse_id']),
          status: bindingDialog.form.status,
        },
      })
    }

    if (Number(res?.code) === 1) {
      toast(bindingDialog.mode === 'add' ? t('pages.tiktokService.messages.bindSuccess') : t('pages.tiktokService.messages.updateSuccess'), 'success')
      closeBindingDialog()
      await loadBindings(shop)
    }
    else {
      toast(res?.msg || t('pages.tiktokService.messages.operationFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.tiktokService.messages.requestError'), 'error')
  }
  finally {
    bindingDialog.submitting = false
  }
}

function getTkWarehouseName(shopDbId, warehouseId) {
  const list = tkWarehousesMap[shopDbId] || []
  
  return list.find(w => w.id === warehouseId)?.name || warehouseId || '-'
}

// If wms_warehouse is an object, combine uniID/city; strings are returned as-is.
function getWmsWarehouseLabel(binding) {
  // Prefer the loaded WMS warehouse option label by ID.
  if (wmsWarehouseOptions.value.length && binding['wms_warehouse_id']) {
    const match = wmsWarehouseOptions.value.find(
      w => Number(w.value) === Number(binding['wms_warehouse_id']),
    )

    if (match)
      return match.title
  }

  // Fallback: combine fields from the API object.
  const w = binding['wms_warehouse']
  if (!w)
    return '-'
  if (typeof w === 'string')
    return w

  // Object: uniID + city, country.
  const parts = []
  if (w.uniID)
    parts.push(w.uniID)
  if (w.city)
    parts.push(w.city)
  if (w.country)
    parts.push(w.country)
  
  return parts.length ? parts.join(' · ') : String(binding['wms_warehouse_id'] || '-')
}

function getWmsWarehouseSubtitle(binding) {
  const w = binding['wms_warehouse']
  if (!w || typeof w === 'string')
    return ''
  
  return [w.address, w.city, w.state, w.code].filter(Boolean).join(', ')
}

function bindingStatusColor(status) {
  return Number(status) === 1 ? 'success' : 'default'
}
function bindingStatusText(status) {
  return Number(status) === 1 ? t('pages.tiktokService.options.enabled') : t('pages.tiktokService.options.disabled')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Order fetch logs
// ═══════════════════════════════════════════════════════════════════════════════
const logsLoading = ref(false)
const logs = ref([])
const logsTotal = ref(0)

const logFilters = reactive({
  shopId: null,
  type: null,
  page: 1,
  pageSize: 20,
})

const logTypeOptions = computed(() => [
  { title: t('pages.tiktokService.options.all'), value: null },
  { title: t('pages.tiktokService.options.fetchOption'), value: 'fetch' },
  { title: t('pages.tiktokService.options.itemOption'), value: 'item' },
  { title: t('pages.tiktokService.options.errorOption'), value: 'error' },
  { title: t('pages.tiktokService.options.noPackageOption'), value: 'no_package' },
  { title: t('pages.tiktokService.options.inventoryOkOption'), value: 'inventory_ok' },
  { title: t('pages.tiktokService.options.inventoryFailOption'), value: 'inventory_fail' },
])

const selfCheckShopOptions = computed(() => {
  return shops.value.map(shop => ({
    title: t('pages.tiktokService.selfCheck.shopOption', {
      name: shop.shop_name,
      shopId: shop['shop_id'],
    }),
    value: Number(shop.id),
  }))
})

const logColumns = computed(() => [
  { title: t('pages.tiktokService.logs.event'), key: 'event', minWidth: 200 },
  { title: t('pages.tiktokService.logs.logType'), key: 'type', width: 132 },
  { title: t('pages.tiktokService.logs.orderInfo'), key: 'orderInfo', minWidth: 210 },
  { title: t('pages.tiktokService.logs.summary'), key: 'summary', minWidth: 320 },
  { title: t('pages.tiktokService.logs.time'), key: 'createtime', minWidth: 156 },
])

const bindingStatusOptions = computed(() => [
  { title: t('pages.tiktokService.options.enabled'), value: 1 },
  { title: t('pages.tiktokService.options.disabled'), value: 0 },
])

async function loadLogs() {
  const currentUserId = resolveCurrentUserId()
  if (!currentUserId) {
    logs.value = []
    logsTotal.value = 0
    toast(t('pages.tiktokService.messages.logsNoUser'), 'error')

    return
  }

  logsLoading.value = true
  try {
    const query = {
      'user_id': currentUserId,
      page: logFilters.page,
      'page_size': logFilters.pageSize,
    }

    if (logFilters.shopId)
      query['shop_id'] = logFilters.shopId
    if (logFilters.type)
      query.type = logFilters.type

    const res = await $api('/tiktoknewapi/getOrderFetchLogs', { method: 'GET', query })
    const responseCode = Number(res?.code)
    if (responseCode === 1 || responseCode === 200) {
      const data = res?.data || {}

      logs.value = Array.isArray(data.list) ? data.list : []
      logsTotal.value = Number(data.total) || 0
      logFilters.page = Number(data.page) || logFilters.page
      logFilters.pageSize = Number(data['page_size']) || logFilters.pageSize
    }
    else {
      toast(res?.message || res?.msg || t('pages.tiktokService.messages.logsFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.message || e?.data?.msg || e?.message || t('pages.tiktokService.messages.networkFailed'), 'error')
  }
  finally {
    logsLoading.value = false
  }
}

function onLogsPageChange(page) {
  logFilters.page = page
  loadLogs()
}

function logTypeColor(type) {
  const map = {
    fetch: 'primary',
    item: 'info',
    error: 'error',
    'no_package': 'warning',
    'inventory_ok': 'success',
    'inventory_fail': 'error',
  }
  
  return map[type] ?? 'default'
}

function getLogTypeLabel(log) {
  if (log?.type_label)
    return log.type_label

  const map = {
    fetch: t('pages.tiktokService.options.fetch'),
    item: t('pages.tiktokService.options.item'),
    error: t('pages.tiktokService.options.error'),
    'no_package': t('pages.tiktokService.options.noPackage'),
    'inventory_ok': t('pages.tiktokService.options.inventoryOk'),
    'inventory_fail': t('pages.tiktokService.options.inventoryFail'),
  }

  return map[log?.type] || log?.type || '-'
}

function getLogRelationText(log) {
  return Number(log?.fetch_id) > 0
    ? t('pages.tiktokService.logs.relatedFetch', { id: log.fetch_id })
    : t('pages.tiktokService.logs.mainFetch')
}

function getLogOrderStatus(log) {
  return log?.tk_order_status || log?.order_status || '-'
}

function getLogSummary(log) {
  if (log?.error_msg)
    return log.error_msg

  if (log?.type === 'fetch') {
    const orderStatus = log?.order_status || t('pages.tiktokService.logs.allStatus')
    const fetchCount = Number(log?.fetch_count) || 0

    return t('pages.tiktokService.logs.fetchSummary', { status: orderStatus, count: fetchCount })
  }

  if (log?.type === 'item')
    return t('pages.tiktokService.logs.itemSummary')

  if (log?.type === 'inventory_ok')
    return t('pages.tiktokService.logs.inventoryOk')

  if (log?.type === 'no_package')
    return t('pages.tiktokService.logs.noPackage')

  if (log?.type === 'error')
    return t('pages.tiktokService.logs.errorSummary')

  return '-'
}

function getLogSummaryColor(log) {
  if (['error', 'inventory_fail'].includes(log?.type) || log?.error_msg)
    return 'text-error'
  if (log?.type === 'inventory_ok')
    return 'text-success'

  return 'text-body-2'
}

// ── Query by TK order ID ────────────────────────────────────────────────────
const orderQueryDialog = reactive({
  visible: false,
  loading: false,
  tkOrderId: '',
  result: null,
})

async function queryByOrderId() {
  if (!orderQueryDialog.tkOrderId.trim())
    return

  orderQueryDialog.loading = true
  try {
    const res = await $api('/tiktoknewapi/getOrderFetchLogsByOrder', {
      method: 'GET',
      query: { ['tk_order_id']: orderQueryDialog.tkOrderId.trim() },
    })

    if (Number(res?.code) === 1) {
      orderQueryDialog.result = res.data
    }
    else {
      toast(res?.msg || t('pages.tiktokService.messages.queryFailed'), 'error')
      orderQueryDialog.result = null
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.tiktokService.messages.requestFailed'), 'error')
    orderQueryDialog.result = null
  }
  finally {
    orderQueryDialog.loading = false
  }
}

// ── TikTok order self-check ────────────────────────────────────────────────
const selfCheckDialog = reactive({
  visible: false,
  loading: false,
  tkOrderId: '',
  shopDbId: null,
  result: null,
})

function openSelfCheckDialog() {
  selfCheckDialog.visible = true
  selfCheckDialog.loading = false
  selfCheckDialog.tkOrderId = ''
  selfCheckDialog.shopDbId = null
  selfCheckDialog.result = null
}

function normalizeCheckItems(rawChecks) {
  if (!Array.isArray(rawChecks))
    return []

  return rawChecks.map((item, index) => ({
    ...item,
    _id: `${item?.key || 'check'}-${index}`,
  }))
}

function getSelfCheckExtraLines(checkItem) {
  const lines = []

  if (checkItem?.key === 'status_eligible' && !checkItem?.passed) {
    if (checkItem.current_status)
      lines.push(t('pages.tiktokService.selfCheck.currentStatus', { status: checkItem.current_status }))
    if (checkItem.expected_status)
      lines.push(t('pages.tiktokService.selfCheck.expectedStatus', { status: checkItem.expected_status }))
  }

  return lines
}

function getSelfCheckKeyLabel(checkKey) {
  if (!checkKey)
    return '-'

  const localeKey = `pages.tiktokService.selfCheck.checkKeys.${checkKey}`
  const translated = t(localeKey)

  return translated === localeKey ? checkKey : translated
}

function getInventoryMissingItems() {
  const inventoryCheck = selfCheckDialog.result?.checks?.find(c => c?.key === 'inventory_ok')
  const list = inventoryCheck?.missing_items

  return Array.isArray(list) ? list : []
}

async function runOrderSelfCheck() {
  const tkOrderId = selfCheckDialog.tkOrderId.trim()
  const shopDbId = Number.parseInt(String(selfCheckDialog.shopDbId ?? ''), 10)

  if (!tkOrderId) {
    toast(t('pages.tiktokService.messages.selfCheckOrderRequired'), 'error')

    return
  }

  if (!Number.isInteger(shopDbId) || shopDbId <= 0) {
    toast(t('pages.tiktokService.messages.selfCheckShopRequired'), 'error')

    return
  }

  selfCheckDialog.loading = true
  selfCheckDialog.result = null
  try {
    const res = await $api('/tiktoknewapi/orderSelfCheck', {
      method: 'GET',
      query: {
        ['tk_order_id']: tkOrderId,
        shopDbId,
        ['shop_db_id']: shopDbId,
      },
    })

    if (Number(res?.code) === 1) {
      const data = res?.data || {}

      selfCheckDialog.result = {
        ...data,
        checks: normalizeCheckItems(data.checks),
      }
    }
    else {
      toast(res?.msg || res?.message || t('pages.tiktokService.messages.selfCheckFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.data?.message || e?.message || t('pages.tiktokService.messages.requestFailed'), 'error')
  }
  finally {
    selfCheckDialog.loading = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════════════════════
onMounted(async () => {
  await loadShops()

  // Preload bindings, TK warehouses for display names, and WMS options.
  await Promise.all([
    ...shops.value.map(s => loadBindings(s)),
    ...shops.value.map(s => loadTkWarehouses(s.id)),
    ensureWmsWarehouses(),
  ])
})

watch(activeTab, val => {
  if (val === 'logs' && !logs.value.length)
    loadLogs()
})
</script>

<template>
  <VContainer
    fluid
    class="tiktok-service-page pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      :timeout="2600"
      location="top"
    >
      {{ snack.text }}
    </VSnackbar>

    <!-- Page title -->
    <div class="tiktok-page-header d-flex align-center justify-space-between flex-wrap gap-3 mb-5">
      <div>
        <h5 class="text-h5 font-weight-medium">
          {{ $t('pages.tiktokService.title') }}
        </h5>
        <p class="text-body-2 text-medium-emphasis mt-1 mb-0">
          {{ $t('pages.tiktokService.subtitle') }}
        </p>
      </div>
      <VMenu location="bottom end">
        <template #activator="{ props: menuProps }">
          <VBtn
            color="primary"
            prepend-icon="tabler-brand-tiktok"
            v-bind="menuProps"
          >
            {{ $t('pages.tiktokService.authShop') }}
            <VIcon
              end
              icon="tabler-chevron-down"
              size="16"
            />
          </VBtn>
        </template>
        <VList
          density="compact"
          min-width="180"
        >
          <VListItem
            prepend-icon="tabler-map-pin"
            :title="$t('pages.tiktokService.usSite')"
            @click="openAuthUrl('US')"
          />
          <VListItem
            prepend-icon="tabler-map-pin"
            :title="$t('pages.tiktokService.ukSite')"
            @click="openAuthUrl('EU')"
          />
        </VList>
      </VMenu>
    </div>

    <!-- Tabs -->
    <VTabs
      v-model="activeTab"
      class="mb-5"
    >
      <VTab value="shops">
        <VIcon
          start
          icon="tabler-building-store"
        />
        {{ $t('pages.tiktokService.tabs.shops') }}
      </VTab>
      <VTab value="logs">
        <VIcon
          start
          icon="tabler-file-text"
        />
        {{ $t('pages.tiktokService.tabs.logs') }}
      </VTab>
    </VTabs>

    <!--
      ══════════════════════════════════════════════════════════════════════
      Tab 1: Shops and warehouses
      ═══════════════════════════════════════════════════════════════════════ 
    -->
    <VWindow
      v-model="activeTab"
      :touch="false"
    >
      <VWindowItem value="shops">
        <!-- Loading -->
        <div
          v-if="shopsLoading"
          class="d-flex justify-center py-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
        </div>

        <!-- Empty state -->
        <VCard
          v-else-if="!shops.length"
          class="rounded-lg"
        >
          <VCardText class="d-flex flex-column align-center py-14 gap-4">
            <VIcon
              icon="tabler-brand-tiktok"
              size="64"
              color="medium-emphasis"
            />
            <p class="text-body-1 text-medium-emphasis mb-0">
              {{ $t('pages.tiktokService.shops.empty') }}
            </p>
            <VBtn
              color="primary"
              prepend-icon="tabler-link"
              @click="goToAuthManagement"
            >
              {{ $t('pages.tiktokService.shops.goAuth') }}
            </VBtn>
          </VCardText>
        </VCard>

        <!-- Shop list -->
        <div
          v-else
          class="d-flex flex-column gap-5"
        >
          <VCard
            v-for="shop in shops"
            :key="shop.id"
            class="rounded-lg"
          >
            <!-- Shop header -->
            <VCardItem class="pb-3 pt-5 px-4 px-sm-6">
              <template #prepend>
                <VIcon
                  icon="tabler-brand-tiktok"
                  color="primary"
                  class="me-1"
                />
              </template>
              <template #title>
                <span class="tiktok-shop-name text-h6 font-weight-medium">{{ shop.shop_name }}</span>
                <VChip
                  class="ms-2"
                  size="x-small"
                  variant="tonal"
                  color="secondary"
                >
                  {{ shop.seller_base_region }}
                </VChip>
              </template>
              <template #subtitle>
                <span class="text-caption text-medium-emphasis">Shop ID: {{ shop['shop_id'] }}</span>
              </template>
              <template #append>
                <div class="tiktok-shop-actions d-flex align-center justify-end gap-2 flex-wrap">
                  <VChip
                    size="small"
                    :color="tokenStatusColor(shop.token_expired)"
                    variant="tonal"
                  >
                    {{ $t('pages.tiktokService.token.access', { status: tokenStatusText(shop.token_expired) }) }}
                  </VChip>
                  <VChip
                    size="small"
                    :color="tokenStatusColor(shop.refresh_token_expired)"
                    variant="tonal"
                  >
                    {{ $t('pages.tiktokService.token.refresh', { status: tokenStatusText(shop.refresh_token_expired) }) }}
                  </VChip>
                  <VBtn
                    size="small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    @click="openAddBinding(shop)"
                  >
                    {{ $t('pages.tiktokService.shops.bindWarehouse') }}
                  </VBtn>
                </div>
              </template>
            </VCardItem>

            <!-- Token expiration time -->
            <VCardText class="px-4 px-sm-6 pt-0 pb-3">
              <div class="tiktok-token-meta d-flex flex-wrap gap-x-4 gap-x-sm-6 gap-y-2 text-caption text-medium-emphasis">
                <span>{{ $t('pages.tiktokService.token.accessExpire', { time: formatUnixTime(shop.access_token_expire) }) }}</span>
                <span>{{ $t('pages.tiktokService.token.refreshExpire', { time: formatUnixTime(shop.refresh_token_expire) }) }}</span>
                <span>{{ $t('pages.tiktokService.token.updatedAt', { time: formatUnixTime(shop.updatetime) }) }}</span>
              </div>
            </VCardText>

            <VDivider />

            <!-- Warehouse binding sublist -->
            <VCardText class="pa-0">
              <!-- Binding loading -->
              <div
                v-if="bindingsLoadingSet.has(shop.id)"
                class="d-flex justify-center py-8"
              >
                <VProgressCircular
                  indeterminate
                  size="24"
                  color="primary"
                />
              </div>

              <!-- No binding -->
              <div
                v-else-if="!bindingsMap[shop.id]?.length"
                class="d-flex flex-column align-center py-8 gap-3 text-medium-emphasis"
              >
                <VIcon
                  icon="tabler-building-warehouse"
                  size="36"
                  color="medium-emphasis"
                />
                <span class="text-body-2">{{ $t('pages.tiktokService.shops.noBinding') }}</span>
              </div>

              <!-- Binding list -->
              <div
                v-else
                class="tiktok-table-scroll tiktok-binding-table"
              >
                <VTable
                  density="default"
                  hover
                >
                  <thead>
                    <tr>
                      <th
                        class="ps-4 ps-sm-6"
                        style="min-width:180px"
                      >
                        {{ $t('pages.tiktokService.shops.tkWarehouse') }}
                      </th>
                      <th style="min-width:220px">
                        {{ $t('pages.tiktokService.shops.wmsWarehouse') }}
                      </th>
                      <th
                        class="text-center"
                        style="width:96px"
                      >
                        {{ $t('pages.tiktokService.shops.status') }}
                      </th>
                      <th
                        class="text-center pe-4"
                        style="width:112px"
                      >
                        {{ $t('pages.tiktokService.shops.actions') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="binding in bindingsMap[shop.id]"
                      :key="binding.id"
                    >
                      <!-- TK warehouse -->
                      <td class="ps-4 ps-sm-6">
                        <div class="tiktok-cell-title font-weight-medium text-body-2">
                          {{ getTkWarehouseName(shop.id, binding['warehouse_id']) }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ binding['warehouse_id'] }}
                        </div>
                      </td>
                      <!-- WMS warehouse -->
                      <td>
                        <div class="tiktok-cell-title font-weight-medium text-body-2">
                          {{ getWmsWarehouseLabel(binding) }}
                        </div>
                        <div
                          v-if="getWmsWarehouseSubtitle(binding)"
                          class="tiktok-cell-subtitle text-caption text-medium-emphasis"
                        >
                          {{ getWmsWarehouseSubtitle(binding) }}
                        </div>
                      </td>
                      <td class="text-center">
                        <VChip
                          size="small"
                          :color="bindingStatusColor(binding.status)"
                          variant="tonal"
                        >
                          {{ bindingStatusText(binding.status) }}
                        </VChip>
                      </td>
                      <td class="text-center">
                        <VBtn
                          size="small"
                          variant="text"
                          icon="tabler-pencil"
                          @click="openEditBinding(shop, binding)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </VCardText>
          </VCard>
        </div>
      </VWindowItem>

      <!--
        ══════════════════════════════════════════════════════════════════════
        Tab 2: Order fetch logs
        ═══════════════════════════════════════════════════════════════════════ 
      -->
      <VWindowItem value="logs">
        <VCard class="rounded-lg">
          <VCardItem class="pb-3 pt-5 px-6">
            <template #title>
              <span class="text-h6 font-weight-medium">{{ $t('pages.tiktokService.tabs.logs') }}</span>
            </template>
            <template #append>
              <div class="tiktok-log-actions d-flex align-center justify-end gap-2 flex-wrap">
                <VBtn
                  size="small"
                  variant="text"
                  prepend-icon="tabler-stethoscope"
                  @click="openSelfCheckDialog"
                >
                  {{ $t('pages.tiktokService.selfCheck.button') }}
                </VBtn>
                <VBtn
                  size="small"
                  variant="text"
                  prepend-icon="tabler-search"
                  @click="orderQueryDialog.visible = true; orderQueryDialog.result = null; orderQueryDialog.tkOrderId = ''"
                >
                  {{ $t('pages.tiktokService.logs.queryByOrder') }}
                </VBtn>
                <VBtn
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="tabler-refresh"
                  :loading="logsLoading"
                  @click="loadLogs"
                >
                  {{ $t('pages.tiktokService.logs.refresh') }}
                </VBtn>
              </div>
            </template>
          </VCardItem>
          <VDivider />

          <!-- Filters -->
          <VCardText class="pa-4 pa-sm-5">
            <VRow dense>
              <VCol
                cols="12"
                sm="6"
                md="4"
              >
                <AppSelect
                  v-model="logFilters.shopId"
                  :label="$t('pages.tiktokService.logs.shop')"
                  :placeholder="$t('pages.tiktokService.logs.allShops')"
                  clearable
                  :items="[{ title: $t('pages.tiktokService.options.all'), value: null }, ...shops.map(s => ({ title: s.shop_name, value: s['shop_id'] }))]"
                  item-title="title"
                  item-value="value"
                  density="compact"
                  @update:model-value="logFilters.page = 1; loadLogs()"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                md="4"
              >
                <AppSelect
                  v-model="logFilters.type"
                  :label="$t('pages.tiktokService.logs.type')"
                  clearable
                  :items="logTypeOptions"
                  item-title="title"
                  item-value="value"
                  density="compact"
                  @update:model-value="logFilters.page = 1; loadLogs()"
                />
              </VCol>
            </VRow>
          </VCardText>

          <VDivider />

          <VCardText class="tiktok-log-summary-bar d-flex align-center justify-space-between flex-wrap gap-3 py-3 px-4 px-sm-5">
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ $t('pages.tiktokService.logs.description') }}
            </p>
            <VChip
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ $t('pages.tiktokService.logs.total', { total: logsTotal }) }}
            </VChip>
          </VCardText>

          <VDivider />

          <div class="tiktok-table-scroll tiktok-log-table">
            <VDataTable
              :headers="logColumns"
              :items="logs"
              :loading="logsLoading"
              :items-per-page="logFilters.pageSize"
              hide-default-footer
              density="comfortable"
              class="tiktok-log-data-table"
              :no-data-text="$t('pages.tiktokService.logs.noData')"
            >
              <template #item.event="{ item }">
                <div class="tiktok-log-cell">
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <span class="font-weight-medium text-body-2">#{{ item.id }}</span>
                    <span class="text-body-2">{{ item.shop_name || '-' }}</span>
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Shop ID: {{ item['shop_id'] || '-' }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ getLogRelationText(item) }}
                  </div>
                </div>
              </template>
              <template #item.type="{ item }">
                <div class="tiktok-log-cell d-flex flex-column align-start">
                  <VChip
                    size="small"
                    :color="logTypeColor(item.type)"
                    variant="tonal"
                  >
                    {{ getLogTypeLabel(item) }}
                  </VChip>
                  <span
                    v-if="item.type"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    {{ item.type }}
                  </span>
                </div>
              </template>
              <template #item.orderInfo="{ item }">
                <div class="tiktok-log-cell">
                  <div class="font-weight-medium text-body-2">
                    {{ item.tk_order_id || '-' }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ $t('pages.tiktokService.logs.status', { status: getLogOrderStatus(item) }) }}
                  </div>
                  <div
                    v-if="item.tk_create_time"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    {{ $t('pages.tiktokService.logs.orderedAt', { time: formatUnixTime(item.tk_create_time) }) }}
                  </div>
                  <div
                    v-if="item.tk_update_time"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    {{ $t('pages.tiktokService.logs.updatedAt', { time: formatUnixTime(item.tk_update_time) }) }}
                  </div>
                </div>
              </template>
              <template #item.summary="{ item }">
                <div class="tiktok-log-cell">
                  <div
                    :class="getLogSummaryColor(item)"
                    class="tiktok-log-summary-text"
                  >
                    {{ getLogSummary(item) }}
                  </div>
                  <div
                    v-if="Number(item.error_code)"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    {{ $t('pages.tiktokService.logs.errorCode', { code: item.error_code }) }}
                  </div>
                  <div
                    v-if="item.next_page_token"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    next_page_token：{{ item.next_page_token }}
                  </div>
                </div>
              </template>
              <template #item.createtime="{ item }">
                <div class="tiktok-log-cell">
                  <div class="font-weight-medium text-body-2">
                    {{ formatUnixTime(item.createtime) }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ $t('pages.tiktokService.logs.createdAt') }}
                  </div>
                </div>
              </template>
            </VDataTable>
          </div>

          <!-- Pagination -->
          <VCardText
            v-if="logsTotal > logFilters.pageSize"
            class="tiktok-log-pagination d-flex justify-end pa-4"
          >
            <VPagination
              :model-value="logFilters.page"
              :length="Math.ceil(logsTotal / logFilters.pageSize)"
              :total-visible="5"
              density="compact"
              @update:model-value="onLogsPageChange"
            />
          </VCardText>
        </VCard>
      </VWindowItem>
    </VWindow>

    <!--
      ══════════════════════════════════════════════════════════════════════
      Dialog: add/edit warehouse binding
      ═══════════════════════════════════════════════════════════════════════ 
    -->
    <VDialog
      v-model="bindingDialog.visible"
      width="calc(100vw - 32px)"
      max-width="500"
      @after-leave="bindingFormRef?.resetValidation()"
    >
      <VCard class="rounded-lg">
        <VCardItem :title="bindingDialog.mode === 'add' ? $t('pages.tiktokService.dialogs.addBinding') : $t('pages.tiktokService.dialogs.editBinding')" />
        <VDivider />
        <VCardText class="pt-5">
          <VForm ref="bindingFormRef">
            <!-- TK warehouse, selectable when adding and read-only when editing -->
            <template v-if="bindingDialog.mode === 'add'">
              <AppSelect
                v-model="bindingDialog.form['warehouse_id']"
                :label="$t('pages.tiktokService.shops.tkWarehouse')"
                :placeholder="$t('pages.tiktokService.dialogs.tkWarehousePlaceholder')"
                :items="(tkWarehousesMap[bindingDialog.currentShop?.id] || []).map(w => ({ title: w.name, value: w.id, subtitle: w.type }))"
                item-title="title"
                item-value="value"
                :loading="tkWarehousesLoading"
                :rules="[v => !!v || $t('pages.tiktokService.messages.tkWarehouseRequired')]"
                class="mb-4"
              >
                <template #item="{ item, props: itemProps }">
                  <VListItem v-bind="itemProps">
                    <template #subtitle>
                      <span class="text-caption text-medium-emphasis">{{ item.raw.subtitle }}</span>
                    </template>
                  </VListItem>
                </template>
              </AppSelect>
            </template>
            <template v-else>
              <VTextField
                :model-value="getTkWarehouseName(bindingDialog.currentShop?.id, bindingDialog.form['warehouse_id'])"
                :label="$t('pages.tiktokService.shops.tkWarehouse')"
                readonly
                variant="outlined"
                density="compact"
                class="mb-4"
              />
            </template>

            <!-- WMS warehouse -->
            <AppSelect
              v-model="bindingDialog.form['wms_warehouse_id']"
              :label="$t('pages.tiktokService.shops.wmsWarehouse')"
              :placeholder="$t('pages.tiktokService.dialogs.wmsWarehousePlaceholder')"
              :items="wmsWarehouseOptions"
              item-title="title"
              item-value="value"
              :rules="[v => !!v || $t('pages.tiktokService.messages.wmsWarehouseRequired')]"
              class="mb-4"
            />

            <!-- Status -->
            <AppSelect
              v-model="bindingDialog.form.status"
              :label="$t('pages.tiktokService.shops.status')"
              :items="bindingStatusOptions"
              item-title="title"
              item-value="value"
            />
          </VForm>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            @click="closeBindingDialog"
          >
            {{ $t('pages.dropShippingPackageCreate.actions.cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="bindingDialog.submitting"
            @click="submitBinding"
          >
            {{ bindingDialog.mode === 'add' ? $t('pages.tiktokService.dialogs.confirmBind') : $t('pages.tiktokService.dialogs.saveEdit') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!--
      ══════════════════════════════════════════════════════════════════════
      Dialog: query fetch history by TK order number
      ═══════════════════════════════════════════════════════════════════════ 
    -->
    <VDialog
      v-model="orderQueryDialog.visible"
      width="calc(100vw - 32px)"
      max-width="600"
    >
      <VCard class="rounded-lg">
        <VCardItem :title="$t('pages.tiktokService.dialogs.queryTitle')" />
        <VDivider />
        <VCardText class="pt-5">
          <div class="tiktok-query-row d-flex gap-3">
            <VTextField
              v-model="orderQueryDialog.tkOrderId"
              :label="$t('pages.tiktokService.dialogs.orderId')"
              :placeholder="$t('pages.tiktokService.dialogs.orderPlaceholder')"
              density="compact"
              variant="outlined"
              hide-details
              class="flex-grow-1"
              @keyup.enter="queryByOrderId"
            />
          </div>

          <!-- Results -->
          <template v-if="orderQueryDialog.result">
            <VDivider class="my-4" />
            <p class="text-subtitle-2 mb-3">
              {{ $t('pages.tiktokService.logs.historyTitle', { order: orderQueryDialog.result.tk_order_id }) }}
            </p>
            <VTable
              density="compact"
              hover
              class="tiktok-query-table"
            >
              <thead>
                <tr>
                  <th>{{ $t('pages.tiktokService.logs.shop') }}</th>
                  <th>{{ $t('pages.tiktokService.logs.syncStatus') }}</th>
                  <th>{{ $t('pages.tiktokService.logs.recordTime') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rec in orderQueryDialog.result.fetch_records"
                  :key="rec.id"
                >
                  <td>{{ rec.shop_name }}</td>
                  <td>{{ rec.type_label }}</td>
                  <td>{{ formatUnixTime(rec.createtime) }}</td>
                </tr>
                <tr v-if="!orderQueryDialog.result.fetch_records?.length">
                  <td
                    colspan="5"
                    class="text-center text-medium-emphasis py-4"
                  >
                    {{ $t('pages.tiktokService.logs.noRecords') }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </template>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            @click="orderQueryDialog.visible = false"
          >
            {{ $t('pages.tiktokService.dialogs.close') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="orderQueryDialog.loading"
            @click="queryByOrderId"
          >
            {{ $t('pages.tiktokService.dialogs.query') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!--
      ══════════════════════════════════════════════════════════════════════
      Dialog: TikTok order self-check
      ═══════════════════════════════════════════════════════════════════════
    -->
    <VDialog
      v-model="selfCheckDialog.visible"
      width="calc(100vw - 32px)"
      max-width="760"
    >
      <VCard class="rounded-lg">
        <VCardItem :title="$t('pages.tiktokService.selfCheck.title')" />
        <VDivider />
        <VCardText class="pt-5">
          <VRow
            dense
            class="tiktok-self-check-form-row"
          >
            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="selfCheckDialog.shopDbId"
                :label="$t('pages.tiktokService.selfCheck.shopLabel')"
                :placeholder="$t('pages.tiktokService.selfCheck.shopPlaceholder')"
                :items="selfCheckShopOptions"
                item-title="title"
                item-value="value"
                density="compact"
                hide-details="auto"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="selfCheckDialog.tkOrderId"
                :label="$t('pages.tiktokService.selfCheck.orderIdLabel')"
                :placeholder="$t('pages.tiktokService.selfCheck.orderIdPlaceholder')"
                density="compact"
                hide-details="auto"
                @keyup.enter="runOrderSelfCheck"
              />
            </VCol>
          </VRow>

          <template v-if="selfCheckDialog.result">
            <VDivider class="my-4" />

            <VAlert
              :type="selfCheckDialog.result.can_fetch ? 'success' : 'error'"
              variant="tonal"
              class="mb-4"
            >
              <div class="font-weight-medium">
                {{ selfCheckDialog.result.can_fetch ? $t('pages.tiktokService.selfCheck.fetchable') : $t('pages.tiktokService.selfCheck.notFetchable') }}
              </div>
              <div class="text-caption mt-1">
                {{ $t('pages.tiktokService.selfCheck.orderIdValue', { id: selfCheckDialog.result.order?.tk_order_id || selfCheckDialog.tkOrderId }) }}
              </div>
            </VAlert>

            <div class="tiktok-self-check-list d-flex flex-column gap-3">
              <VCard
                v-for="check in selfCheckDialog.result.checks"
                :key="check._id"
                variant="outlined"
              >
                <VCardText class="py-3">
                  <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                    <div class="font-weight-medium text-body-2">
                      {{ getSelfCheckKeyLabel(check.key) }}
                    </div>
                    <VChip
                      size="small"
                      :color="check.passed ? 'success' : 'error'"
                      variant="tonal"
                    >
                      {{ check.passed ? $t('pages.tiktokService.selfCheck.passed') : $t('pages.tiktokService.selfCheck.failed') }}
                    </VChip>
                  </div>

                  <div class="text-body-2 mt-2">
                    {{ check.message || '-' }}
                  </div>

                  <div
                    v-for="line in getSelfCheckExtraLines(check)"
                    :key="`${check._id}-${line}`"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    {{ line }}
                  </div>
                </VCardText>
              </VCard>
            </div>

            <template v-if="getInventoryMissingItems().length">
              <VDivider class="my-4" />
              <p class="text-subtitle-2 mb-2">
                {{ $t('pages.tiktokService.selfCheck.missingTitle') }}
              </p>
              <VTable
                density="compact"
                hover
                class="tiktok-self-check-missing-table"
              >
                <thead>
                  <tr>
                    <th>{{ $t('pages.tiktokService.selfCheck.sku') }}</th>
                    <th>{{ $t('pages.tiktokService.selfCheck.required') }}</th>
                    <th>{{ $t('pages.tiktokService.selfCheck.available') }}</th>
                    <th>{{ $t('pages.tiktokService.selfCheck.reason') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, idx) in getInventoryMissingItems()"
                    :key="`${item?.sku || 'sku'}-${idx}`"
                  >
                    <td>{{ item?.sku || '-' }}</td>
                    <td>{{ item?.required ?? '-' }}</td>
                    <td>{{ item?.available ?? '-' }}</td>
                    <td>{{ item?.reason || '-' }}</td>
                  </tr>
                </tbody>
              </VTable>
            </template>
          </template>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            @click="selfCheckDialog.visible = false"
          >
            {{ $t('pages.tiktokService.dialogs.close') }}
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="tabler-search"
            :loading="selfCheckDialog.loading"
            class="tiktok-self-check-run-btn"
            @click="runOrderSelfCheck"
          >
            {{ $t('pages.tiktokService.selfCheck.run') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style scoped>
.tiktok-page-header {
  row-gap: 12px;
}

.tiktok-shop-name,
.tiktok-cell-title,
.tiktok-cell-subtitle {
  overflow-wrap: anywhere;
}

.tiktok-shop-actions,
.tiktok-log-actions {
  max-inline-size: 100%;
}

.tiktok-token-meta {
  line-height: 1.45;
}

.tiktok-table-scroll {
  overflow-x: auto;
}

.tiktok-binding-table :deep(table) {
  min-inline-size: 640px;
}

.tiktok-binding-table :deep(th) {
  font-weight: 600;
  padding-block: 12px;
  white-space: nowrap;
}

.tiktok-binding-table :deep(td) {
  padding-block: 14px;
  vertical-align: middle;
}

.tiktok-cell-subtitle {
  margin-block-start: 2px;
  line-height: 1.45;
}

.tiktok-log-table :deep(table) {
  min-inline-size: 1040px;
}

.tiktok-log-table :deep(th) {
  font-weight: 600;
  white-space: nowrap;
}

.tiktok-log-table :deep(td) {
  vertical-align: top;
}

.tiktok-log-cell {
  padding-block: 10px;
  line-height: 1.45;
}

.tiktok-log-summary-text {
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: normal;
}

.tiktok-query-row {
  align-items: flex-start;
}

.tiktok-query-table :deep(.v-table__wrapper) {
  overflow-x: auto;
}

.tiktok-query-table :deep(table) {
  min-inline-size: 520px;
}

.tiktok-self-check-missing-table :deep(.v-table__wrapper) {
  overflow-x: auto;
}

.tiktok-self-check-missing-table :deep(table) {
  min-inline-size: 560px;
}

.tiktok-self-check-form-row {
  align-items: start;
}

.tiktok-self-check-run-btn {
  min-inline-size: 132px;
}

@media (max-width: 959px) {
  .tiktok-self-check-run-btn {
    min-inline-size: 120px;
  }
}

@media (max-width: 600px) {
  .tiktok-page-header {
    align-items: stretch !important;
    flex-direction: column;
  }

  .tiktok-shop-actions,
  .tiktok-log-actions {
    inline-size: 100%;
    justify-content: flex-start !important;
    margin-block-start: 8px;
  }

  .tiktok-shop-actions .v-btn,
  .tiktok-log-actions .v-btn {
    flex: 1 1 auto;
  }

  .tiktok-log-summary-bar {
    align-items: flex-start !important;
    flex-direction: column;
  }

  .tiktok-log-pagination {
    justify-content: center !important;
  }

  .tiktok-binding-table :deep(table) {
    min-inline-size: 600px;
  }

  .tiktok-log-table :deep(table) {
    min-inline-size: 980px;
  }

  .tiktok-query-row {
    flex-direction: column;
  }

  .tiktok-self-check-form-row {
    row-gap: 4px;
  }
}
</style>
