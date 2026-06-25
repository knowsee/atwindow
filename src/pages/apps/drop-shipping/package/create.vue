<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api, $apiJson } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions, normalizeRangeText, resolvePackageYjdcTimeRange } from '@/views/apps/drop-shipping/useDropShippingShared'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const loading = ref(false)

/** Create page: wait for warehouse, country, default address, and SKU bootstrap APIs. */
const initialLoading = ref(true)
const submitting = ref(false)
const productLoading = ref(false)
const senderLoading = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })
const formRef = ref()
const warehouseOptions = ref([])
const warehousePersistReady = ref(false)
const senderCountryOptions = ref([])

const senderInfo = ref({
  country: '',
  name: '',
  phone: '',
  address: '',
  sendName: '',
})

const expressOptions = computed(() => [
  { title: t('pages.dropShippingPackageCreate.express.courier'), value: 1 },
  { title: t('pages.dropShippingPackageCreate.express.truck'), value: 2 },
  { title: t('pages.dropShippingPackageCreate.express.sea'), value: 3 },
  { title: t('pages.dropShippingPackageCreate.express.air'), value: 4 },
])

const skuOptions = ref([])

const mode = computed(() => String(route.query.mode || 'create'))
const isEdit = computed(() => mode.value === 'edit')
const editingId = computed(() => Number(route.query.id || 0) || null)

const pageBlocking = computed(() => loading.value || initialLoading.value)

const pageOverlayMessage = computed(() => {
  if (loading.value)
    return t('pages.dropShippingPackageCreate.overlay.detail')

  if (initialLoading.value)
    return t('pages.dropShippingPackageCreate.overlay.initial')

  return t('pages.dropShippingPackageCreate.overlay.default')
})

const form = ref({
  warehouseId: null,
  expressId: null,
  boxNum: 1,
  trackingNo: '',
  timeRange: '',
  products: [{ id: '', enSku: '', cnName: '', qty: 1 }],
})

const currentWarehouseName = computed(() => {
  return warehouseOptions.value.find(o => o.value === form.value.warehouseId)?.title || '—'
})

const currentWarehouseInfo = computed(() =>
  warehouseOptions.value.find(w => Number(w.value) === Number(form.value.warehouseId)) || null,
)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-package-list' })
}

function addProduct() {
  form.value.products.push({ id: '', enSku: '', cnName: '', qty: 1 })
}

function removeProduct(index) {
  if (form.value.products.length <= 1)
    return
  form.value.products.splice(index, 1)
}

function syncSkuMeta(row) {
  const key = String(row.id ?? row.enSku ?? '').trim()
  if (!key)
    return

  const hit = skuOptions.value.find(item => String(item.value) === key)
  if (!hit)
    return

  row.id = hit.value
  row.enSku = hit.enSku
  row.cnName = hit.cnName
}

/** When `express_id` is 0, map the shipping method from the `box_type` label. */
function resolveExpressIdFromPackage(pkg) {
  const raw = pkg?.express_id ?? pkg?.expressId
  const num = Number(raw)
  if (Number.isFinite(num) && num > 0)
    return num

  const label = String(pkg?.box_type || '').trim()
  if (label) {
    const hit = expressOptions.value.find(o => o.title === label)
    if (hit)
      return hit.value
  }

  return null
}

function skuSearchFilter(_, queryText, item) {
  const query = String(queryText || '').trim().toLowerCase()
  if (!query)
    return true

  const raw = item?.raw || {}
  const target = `${raw.enSku || ''} ${raw.cnName || ''} ${raw.title || ''}`.toLowerCase()

  return target.includes(query)
}

async function loadSkuOptions(wId = form.value.warehouseId) {
  productLoading.value = true
  try {
    const reqBody = {}
    if (wId) {
      reqBody.warehouse_id = wId
    }
    const res = await $api('/package/getSku', { method: 'POST', body: reqBody })
    if (Number(res?.code) === 1 && Array.isArray(res?.data)) {
      skuOptions.value = res.data.map(item => ({
        title: `${item.en_sku || ''} ${item.cn_name ? `(${item.cn_name})` : ''} (${t('pages.dropShippingPackageCreate.availableStock', { stock: item.available_stock || 0 })})`.trim(),
        value: item.en_sku || '',
        enSku: item.en_sku || '',
        cnName: item.cn_name || '',
        availableStock: item.available_stock || 0,
      }))
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageCreate.messages.skuLoadFailed'), 'error')
  }
  finally {
    productLoading.value = false
  }
}

function resolveCountryValue(rawCountry) {
  if (!rawCountry)
    return ''

  const opt = senderCountryOptions.value.find(
    o => o.shortName === rawCountry || o.value === rawCountry,
  )

  
  return opt ? opt.value : ''
}

function normalizeSenderInfo(raw) {
  const row = raw || {}
  const rawCountry = row.country || row.send_country || row.sender_country || row.country_code || ''
  const country = resolveCountryValue(rawCountry)
  const name = row.name || row.sender_name || row.contact || row.linkman || ''
  const phone = row.phone || row.mobile || row.telephone || row.tel || ''
  const sendName = row.send_name || row.name || row.sender_name || row.contact || row.linkman || ''

  const lineParts = [
    row.province,
    row.city,
    row.area,
    row.address,
    row.address1,
    row.address2,
    row.detail_address,
  ].filter(Boolean)

  const address = lineParts.length
    ? lineParts.join(' ')
    : [rawCountry, row.address].filter(Boolean).join(' ').trim()

  return { country, name, phone, address, sendName }
}

async function loadSenderCountryOptions() {
  try {
    const res = await $api('/order/queryCountry', { method: 'POST' })
    if (Number(res?.code) === 1 && Array.isArray(res?.data)) {
      senderCountryOptions.value = res.data.map(item => ({
        title: `${item.short_name || ''} - ${item.en_name || ''} - ${item.cn_name || ''}`.trim(),
        value: item.cn_name,
        shortName: item.short_name || '',
      })).filter(item => item.value)
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageCreate.messages.countryLoadFailed'), 'error')
  }
}

async function loadPackAddress() {
  senderLoading.value = true
  try {
    const res = await $api('/package/getPackAddress', { method: 'POST' })
    if (Number(res?.code) !== 1)
      return

    const source = Array.isArray(res?.data) ? res.data[0] : res?.data

    senderInfo.value = normalizeSenderInfo(source)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    senderLoading.value = false
  }
}

async function loadDetail(withLoading = true) {
  if (!editingId.value)
    return

  if (withLoading)
    loading.value = true
  try {
    const res = await $api('/package/detail', {
      method: 'POST',
      body: { id: editingId.value },
    })

    if (Number(res?.code) === 1 && res?.data) {
      const data = res.data
      const pkg = data.package || {}
      const sendData = data.sendData || data.send_data || {}
      const productRows = Array.isArray(data.product) ? data.product : []

      senderInfo.value = {
        ...senderInfo.value,
        ...normalizeSenderInfo(pkg),
        ...normalizeSenderInfo(sendData),
      }

      form.value = {
        warehouseId: Number(pkg.warehouse_id || res.data.warehouse_id || 0) || null,
        expressId: resolveExpressIdFromPackage(pkg),
        boxNum: Number(pkg.box_num || 1),
        trackingNo: pkg.tracking_no || '',
        timeRange: resolvePackageYjdcTimeRange(pkg),
        products: productRows.length
          ? productRows.map(item => ({
            id: item.en_sku || item.sku || item.id || '',
            enSku: item.en_sku || item.sku || '',
            cnName: item.cn_name || '',
            qty: Number(item.kucun_warn || item.sku_num || 1),
          }))
          : [{ id: '', enSku: '', cnName: '', qty: 1 }],
      }

      for (const row of form.value.products)
        syncSkuMeta(row)

      const loadedRef = String(pkg.tracking_no || '').trim()
      if (loadedRef && !/^\w+$/.test(loadedRef))
        toast(t('pages.dropShippingPackageCreate.messages.invalidLoadedReference'), 'warning')
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageCreate.messages.loadDetailFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageCreate.messages.loadDetailFailed'), 'error')
  }
  finally {
    if (withLoading)
      loading.value = false
  }
}

function toYmdPart(raw) {
  const t = String(raw || '').trim()
  if (!t)
    return ''

  return t.split(/[\sT]/)[0] || t
}

function buildPayload() {
  const range = normalizeRangeText(form.value.timeRange)

  const [start, end] = range.includes(' - ')
    ? range.split(' - ').map(s => s.trim())
    : ['', '']

  const boxTypeTitle = expressOptions.value.find(o => o.value === form.value.expressId)?.title
    || expressOptions.value[0]?.title
    || t('pages.dropShippingPackageCreate.express.courier')

  const packageSku = form.value.products
    .map(item => ({
      'en_sku': String(item.enSku || item.id || '').trim(),
      'sku_num': String(Math.max(0, Math.floor(Number(item.qty || 0)))),
    }))
    .filter(row => row['en_sku'] && Number(row['sku_num']) > 0)

  return {
    'send-people-name': senderInfo.value.sendName.trim(),
    'send-people-id': '',
    'send-people-country': senderInfo.value.country || '',
    'send-people-address': senderInfo.value.address.trim(),
    'send-people-telephone': senderInfo.value.phone.trim(),
    'send_name': senderInfo.value.sendName.trim(),
    'warehouse_id': String(form.value.warehouseId ?? ''),
    'box_type': boxTypeTitle,
    'pdf_type': '1',
    type: '',
    id: isEdit.value && editingId.value ? String(editingId.value) : '',
    'tracking_no': form.value.trackingNo.trim(),
    'package_sku': packageSku,
    yjdcstime: toYmdPart(start),
    yjdcetime: toYmdPart(end),
  }
}

async function submitForm() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  // Validate the reference again before submitting.
  const rawRef = String(form.value.trackingNo || '').trim()
  if (!rawRef || !/^\w+$/.test(rawRef)) {
    toast(t('pages.dropShippingPackageCreate.messages.referenceInvalid'), 'error')
    
    return
  }

  const payload = buildPayload()
  if (!payload['package_sku'].length) {
    toast(t('pages.dropShippingPackageCreate.messages.productRequired'), 'warning')

    return
  }

  submitting.value = true
  try {
    const res = await $apiJson('/package/ruku', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingPackageCreate.messages.saveSuccess'), 'success')
      setTimeout(goList, 500)
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageCreate.messages.saveFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageCreate.messages.saveFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => form.value.warehouseId, async v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
  await loadSkuOptions(v)
})

onMounted(async () => {
  const shouldPreload = !!editingId.value && isEdit.value
  if (shouldPreload)
    loading.value = true

  try {
    warehouseOptions.value = await loadWarehouseOptions()
    await loadSenderCountryOptions()
    if (!editingId.value)
      form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
    if (!isEdit.value)
      await loadPackAddress()
    await loadSkuOptions()
    await loadDetail(!shouldPreload)
    await nextTick()
    warehousePersistReady.value = true
  }
  finally {
    if (shouldPreload)
      loading.value = false
    initialLoading.value = false
  }
})
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6">
      <div>
        <div class="text-overline text-primary mb-1">
          {{ $t('pages.dropShippingPackageCreate.hero.eyebrow') }}
        </div>
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ isEdit ? $t('pages.dropShippingPackageCreate.hero.editTitle') : $t('pages.dropShippingPackageCreate.hero.createTitle') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          {{ $t('pages.dropShippingPackageCreate.hero.subtitle') }}
        </p>
      </div>
      <VBtn
        variant="tonal"
        prepend-icon="tabler-arrow-left"
        @click="goList"
      >
        {{ $t('common.actions.backToList') }}
      </VBtn>
    </div>

    <FormPageLoadingOverlay
      :loading="pageBlocking"
      :message="pageOverlayMessage"
    >
      <VForm ref="formRef">
        <VRow>
          <VCol
            cols="12"
            lg="8"
          >
            <PrintLabelSectionCard
              :title="$t('pages.dropShippingPackageCreate.sections.base')"
              :subtitle="$t('pages.dropShippingPackageCreate.sections.baseSubtitle')"
              class="mb-4"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.warehouseId"
                    :items="warehouseOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingPackageCreate.fields.warehouse')"
                    :rules="[v => !!v || $t('pages.dropShippingPackageCreate.messages.warehouseRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.expressId"
                    :items="expressOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingPackageCreate.fields.express')"
                    :rules="[v => !!v || $t('pages.dropShippingPackageCreate.messages.expressRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    v-model="form.boxNum"
                    type="number"
                    :label="$t('pages.dropShippingPackageCreate.fields.boxes')"
                    :rules="[v => Number(v) > 0 || $t('pages.dropShippingPackageCreate.messages.boxesRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.trackingNo"
                    :label="$t('pages.dropShippingPackageCreate.fields.reference')"
                    :rules="[
                      v => !!String(v || '').trim() || $t('pages.dropShippingPackageCreate.messages.referenceRequired'),
                      v => /^[A-Za-z0-9_]+$/.test(String(v || '').trim()) || $t('pages.dropShippingPackageCreate.messages.referenceRule'),
                    ]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDateTimePicker
                    v-model="form.timeRange"
                    :label="$t('pages.dropShippingPackageCreate.fields.eta')"
                    :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                    :disabled="pageBlocking"
                  />
                </VCol>
              </VRow>

              <Transition name="wh-addr">
                <VSheet
                  v-if="currentWarehouseInfo && (currentWarehouseInfo.address || currentWarehouseInfo.telephone || currentWarehouseInfo.country)"
                  rounded="lg"
                  border
                  class="warehouse-addr-box mt-4 pa-4"
                >
                  <div class="d-flex align-center gap-2 mb-2">
                    <VIcon
                      icon="tabler-building-warehouse"
                      size="15"
                      color="primary"
                    />
                    <span class="text-caption font-weight-semibold text-uppercase tracking-widest text-primary">{{ $t('pages.dropShippingPackageCreate.sections.warehouseAddress') }}</span>
                  </div>
                  <VRow dense>
                    <VCol
                      v-if="currentWarehouseInfo.sendName"
                      cols="12"
                      class="text-body-2"
                    >
                      <VIcon
                        icon="tabler-user"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      {{ currentWarehouseInfo.sendName }}
                    </VCol>
                    <VCol
                      v-if="currentWarehouseInfo.address"
                      cols="12"
                      class="text-body-2"
                    >
                      <VIcon
                        icon="tabler-map-pin"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      {{ currentWarehouseInfo.address }}
                    </VCol>
                    <VCol
                      v-if="currentWarehouseInfo.city || currentWarehouseInfo.state || currentWarehouseInfo.code || currentWarehouseInfo.country"
                      cols="12"
                      class="text-body-2 text-medium-emphasis"
                    >
                      <VIcon
                        icon="tabler-world"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      {{ [currentWarehouseInfo.city, currentWarehouseInfo.state, currentWarehouseInfo.code, currentWarehouseInfo.country].filter(Boolean).join(' · ') }}
                    </VCol>
                    <VCol
                      v-if="currentWarehouseInfo.telephone"
                      cols="12"
                      class="text-body-2"
                    >
                      <VIcon
                        icon="tabler-phone"
                        size="14"
                        class="me-1 text-medium-emphasis"
                      />
                      {{ currentWarehouseInfo.telephone }}
                    </VCol>
                  </VRow>
                </VSheet>
              </Transition>
            </PrintLabelSectionCard>
            <PrintLabelSectionCard
              :title="$t('pages.dropShippingPackageCreate.sections.sender')"
              :subtitle="$t('pages.dropShippingPackageCreate.sections.senderSubtitle')"
              class="mb-4"
            >
              <template #append>
                <VBtn
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="tabler-refresh"
                  class="text-none"
                  :disabled="pageBlocking"
                  @click="loadPackAddress"
                >
                  {{ $t('pages.dropShippingPackageCreate.actions.reloadAddress') }}
                </VBtn>
              </template>

              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppAutocomplete
                    v-model="senderInfo.country"
                    :items="senderCountryOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingPackageCreate.fields.country')"
                    :rules="[v => !!v || $t('pages.dropShippingPackageCreate.messages.countryRequired')]"
                    :disabled="pageBlocking"
                    clearable
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    v-model="senderInfo.sendName"
                    :label="$t('pages.dropShippingPackageCreate.fields.sender')"
                    :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingPackageCreate.messages.senderRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    v-model="senderInfo.phone"
                    :label="$t('pages.dropShippingPackageCreate.fields.phone')"
                    :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingPackageCreate.messages.phoneRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    v-model="senderInfo.address"
                    :label="$t('pages.dropShippingPackageCreate.fields.address')"
                    :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingPackageCreate.messages.addressRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingPackageCreate.sections.products')"
              :subtitle="$t('pages.dropShippingPackageCreate.sections.productsSubtitle')"
              class="mb-4"
            >
              <template #append>
                <VBtn
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="tabler-plus"
                  :disabled="pageBlocking"
                  @click="addProduct"
                >
                  {{ $t('pages.dropShippingPackageCreate.actions.addProduct') }}
                </VBtn>
              </template>
              <VTable
                density="comfortable"
                class="package-product-table"
              >
                <thead>
                  <tr>
                    <th class="text-left">
                      {{ $t('pages.dropShippingPackageCreate.fields.sku') }}
                    </th>
                    <th class="text-right package-product-table__cell-qty">
                      {{ $t('pages.dropShippingPackageCreate.fields.qty') }}
                    </th>
                    <th class="package-product-table__cell-action" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in form.products"
                    :key="idx"
                  >
                    <td class="package-product-table__cell-sku py-2">
                      <AppAutocomplete
                        v-model="row.id"
                        :items="skuOptions"
                        item-title="title"
                        item-value="value"
                        :placeholder="$t('pages.dropShippingPackageCreate.skuPlaceholder')"
                        density="compact"
                        hide-details
                        :custom-filter="skuSearchFilter"
                        auto-select-first
                        :loading="productLoading"
                        :disabled="pageBlocking"
                        @update:model-value="syncSkuMeta(row)"
                      />
                      <div
                        v-if="row.cnName"
                        class="text-caption text-medium-emphasis ms-1 mt-1"
                      >
                        {{ row.cnName }}
                      </div>
                    </td>
                    <td class="package-product-table__cell-qty">
                      <AppTextField
                        v-model="row.qty"
                        type="number"
                        density="compact"
                        hide-details
                        :disabled="pageBlocking"
                      />
                    </td>
                    <td class="text-center package-product-table__cell-action">
                      <IconBtn
                        color="error"
                        :disabled="pageBlocking || form.products.length <= 1"
                        @click="removeProduct(idx)"
                      >
                        <VIcon icon="tabler-trash" />
                      </IconBtn>
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <div class="text-caption text-medium-emphasis mt-2">
                {{ $t('pages.dropShippingPackageCreate.productCount', { count: form.products.length }) }}
              </div>
            </PrintLabelSectionCard>
          </VCol>

          <VCol
            cols="12"
            lg="4"
          >
            <div class="create-sidebar">
              <VCard
                class="rounded-lg border"
                elevation="0"
                color="surface"
              >
                <VCardItem class="px-5 pt-5 pb-3">
                  <VCardTitle class="text-subtitle-1 font-weight-semibold d-flex align-center gap-2">
                    <VIcon
                      icon="tabler-box"
                      size="20"
                      color="primary"
                    />
                    {{ $t('pages.dropShippingPackageCreate.sections.summary') }}
                  </VCardTitle>
                </VCardItem>
                <VDivider class="mx-5 mb-4" />
                <VCardText class="px-5 pb-4 pt-0">
                  <div class="d-flex flex-column gap-4">
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingPackageCreate.fields.warehouse') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ currentWarehouseName || '—' }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingPackageCreate.fields.express') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ expressOptions.find(o => o.value === form.expressId)?.title || '—' }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingPackageCreate.fields.boxes') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ form.boxNum || '—' }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingPackageCreate.fields.products') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ $t('pages.dropShippingPackageCreate.summaryItems', { count: form.products.filter(r => r.id || r.enSku).length }) }}</span>
                    </div>
                  </div>
                </VCardText>
                
                <VDivider class="mx-5" />
                <VCardText class="px-5 py-4 d-flex flex-column gap-3">
                  <VBtn
                    block
                    color="primary"
                    prepend-icon="tabler-device-floppy"
                    class="text-none rounded-lg"
                    size="large"
                    :loading="submitting"
                    :disabled="pageBlocking"
                    @click="submitForm"
                  >
                    {{ isEdit ? $t('pages.dropShippingPackageCreate.actions.saveEdit') : $t('pages.dropShippingPackageCreate.actions.submit') }}
                  </VBtn>
                  <VBtn
                    block
                    variant="text"
                    :disabled="pageBlocking"
                    @click="goList"
                  >
                    {{ $t('pages.dropShippingPackageCreate.actions.cancel') }}
                  </VBtn>
                </VCardText>
              </VCard>
            </div>
          </VCol>
        </VRow>
      </VForm>
    </FormPageLoadingOverlay>
  </VContainer>
</template>

<style scoped>
.package-product-table {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.75rem;
  overflow: hidden;
}

.package-product-table :deep(thead th) {
  font-weight: 600;
  background: rgba(var(--v-theme-on-surface), 0.04);
  white-space: nowrap;
}

.package-product-table :deep(tbody td) {
  vertical-align: middle;
  padding-block: 0.625rem !important;
}

.package-product-table__cell-qty {
  width: 8rem;
  text-align: right;
}

.package-product-table__cell-action {
  width: 4rem;
  text-align: center;
}

.package-product-table :deep(.v-field--disabled),
.package-product-table :deep(.v-field[readonly]) {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

@media (min-width: 1280px) {
  .create-sidebar {
    position: sticky;
    top: 5rem;
  }
}

.warehouse-addr-box {
  background: rgba(var(--v-theme-primary), 0.03);
  border-color: rgba(var(--v-theme-primary), 0.2) !important;
}

.tracking-widest {
  letter-spacing: 0.06em;
}

.wh-addr-enter-active,
.wh-addr-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.wh-addr-enter-from,
.wh-addr-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
