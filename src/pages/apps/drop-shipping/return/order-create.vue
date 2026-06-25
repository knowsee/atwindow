<script setup>
import AddressBookPickerDialog from '@/components/address/AddressBookPickerDialog.vue'
import AddressFormDialog from '@/components/address/AddressFormDialog.vue'
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api, $apiJson } from '@/utils/api'
import { getPreferredWarehouseId, resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadCartonOptions, loadCountryOptions, loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
import { DROP_SHIPPING_CHANNELS as RAW_TRANSPORT_OPTIONS } from '@/views/apps/print-label/printLabelConfig'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const loading = ref(false)

/** Create page: wait for first-screen warehouse, country, and SKU APIs. */
const initialLoading = ref(true)
const submitting = ref(false)
const estimating = ref(false)
const estimatedFeeLabel = ref(null)
const snack = ref({ show: false, text: '', color: 'info' })
const formRef = ref()
const { t } = useI18n({ useScope: 'global' })

const QUALITY_GOOD = '\u826f\u54c1'
const QUALITY_BAD = '\u4e0d\u826f\u54c1'

const mode = computed(() => String(route.query.mode || 'create'))
const isCopy = computed(() => mode.value === 'copy')
const sourceId = computed(() => Number(route.query.id || 0) || null)
const editingId = computed(() => (mode.value === 'edit' ? sourceId.value : null))

const warehouseOptions = ref([])
const warehousePersistReady = ref(false)
const countryOptions = ref([])
const skuOptions = ref([])
const addrDialog = ref(false)
const addrLoading = ref(false)
const addrList = ref([])
const addrTotal = ref(0)
const addrCurrentPage = ref(1)
const addrPageSize = ref(10)
const addrPageCount = computed(() => Math.max(1, Math.ceil(addrTotal.value / addrPageSize.value)))
const addrSearchName = ref('')
const addrFormDialog = ref(false)
const addrFormSubmitting = ref(false)

const addrFormData = ref({
  name: '',
  telephone: '',
  country: '',
  province: '',
  city: '',
  postcode: '',
  address: '',
  address2: '',
})

const pageBlocking = computed(() => loading.value || initialLoading.value)

const pageTitle = computed(() => {
  if (editingId.value)
    return t('pages.dropShippingReturnOrderCreate.title.edit')

  return isCopy.value ? t('pages.dropShippingReturnOrderCreate.title.copy') : t('pages.dropShippingReturnOrderCreate.title.create')
})

const submitButtonText = computed(() => {
  if (isCopy.value)
    return t('pages.dropShippingOrderCreate.actions.submitCopy')

  return editingId.value ? t('pages.dropShippingOrderCreate.actions.submitEdit') : t('pages.dropShippingReturnOrderCreate.actions.submitCreate')
})

const pageOverlayMessage = computed(() => {
  if (loading.value)
    return t('pages.dropShippingReturnOrderCreate.loading.detail')

  if (initialLoading.value)
    return t('pages.dropShippingOrderCreate.loading.initial')

  return t('pages.dropShippingOrderCreate.loading.default')
})

const currentWarehouseName = computed(() => warehouseOptions.value.find(o => o.value === form.value.warehouseId)?.title || '—')
const currentTransportName = computed(() => transportOptions.value.find(o => o.value === form.value.transportType)?.title || '—')
const currentCartonName = computed(() => cartonOptions.value.find(o => o.value === form.value.cartonType)?.title || '—')
const currentCartonPrice = computed(() => cartonOptions.value.find(o => o.value === form.value.cartonType)?.price ?? 0)
const validProductCount = computed(() => form.value.products.filter(r => (r.id || r.enSku) && r.goodsNum > 0).length)

const transportTitleKeys = {
  99999: 'pages.dropShippingOrderCreate.transport.autoTrial',
  200: 'pages.dropShippingOrderCreate.transport.pickup',
  27: 'pages.dropShippingOrderCreate.transport.uspsT5',
}

const transportOptions = computed(() => RAW_TRANSPORT_OPTIONS.map(option => ({
  ...option,
  title: transportTitleKeys[Number(option.value)] ? t(transportTitleKeys[Number(option.value)]) : option.title,
})))

const qualityTypeOptions = computed(() => [
  { title: t('pages.dropShippingReturnOrderCreate.quality.good'), value: QUALITY_GOOD },
  { title: t('pages.dropShippingReturnOrderCreate.quality.bad'), value: QUALITY_BAD },
])

const cartonOptions = ref([{ title: t('common.options.notRequired'), value: 0, price: 0 }])

const form = ref({
  cankaohao: '',
  warehouseId: null,
  transportType: 27,
  qualityType: QUALITY_GOOD,
  cartonType: 0,
  remark: '',
  fnskuFileXb: '',
  receiver: {
    id: '',
    country: '',
    name: '',
    province: '',
    city: '',
    address: '',
    address2: '',
    postcode: '',
    telephone: '',
  },
  products: [{ id: '', enSku: '', cnName: '', goodsNum: 1 }],
})

const isSelfPickup = computed(() => Number(form.value.transportType) === 200)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-return-order-list' })
}

function addProduct() {
  form.value.products.push({ id: '', enSku: '', cnName: '', goodsNum: 1 })
}

function removeProduct(index) {
  if (form.value.products.length <= 1)
    return
  form.value.products.splice(index, 1)
}

async function loadSkuOptions(wId = form.value.warehouseId) {
  const reqBody = {}
  if (wId)
    reqBody['warehouse_id'] = wId

  if (form.value.qualityType)
    reqBody.type = form.value.qualityType

  const res = await $api('/package/getSkuThV2', { method: 'POST', body: reqBody })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.en_sku || ''} (${item.type || '-'} · ${item.warehouse_name || t('common.warehouseFallback', { id: '' })}) (${t('pages.dropShippingOrderCreate.sku.availableStock', { stock: item.sku_num || 0 })})`.trim(),
    value: item.en_sku,
    enSku: item.en_sku || '',
    cnName: [item.type, item.warehouse_name].filter(Boolean).join(' / '),
    warehouseId: item.warehouse_id || '',
    warehouseName: item.warehouse_name || '',
    qualityType: item.type || '',
    availableStock: item.sku_num || 0,
  })).filter(item => item.value)
}

function skuSearchFilter(_, queryText, item) {
  const query = String(queryText || '').trim().toLowerCase()
  if (!query)
    return true

  const raw = item?.raw || {}
  const target = `${raw.enSku || ''} ${raw.cnName || ''} ${raw.warehouseName || ''} ${raw.qualityType || ''} ${raw.title || ''}`.toLowerCase()

  return target.includes(query)
}

function syncSkuMeta(row) {
  const hit = skuOptions.value.find(item => String(item.value) === String(row.id))
  if (!hit)
    return

  row.enSku = hit.enSku
  row.cnName = hit.cnName
}

async function refreshSkuOptions() {
  skuOptions.value = await loadSkuOptions(form.value.warehouseId)
  form.value.products.forEach(syncSkuMeta)
}

function openAddrDialog() {
  addrDialog.value = true
  addrCurrentPage.value = 1
  loadAddrList()
}

function closeAddrDialog() {
  addrDialog.value = false
}

function openAddrFormDialog() {
  addrFormData.value = { name: '', telephone: '', country: '', province: '', city: '', postcode: '', address: '', address2: '' }
  addrFormDialog.value = true
}

async function saveNewAddress() {
  addrFormSubmitting.value = true
  try {
    const res = await $apiJson('/order/addAddr', {
      method: 'POST',
      body: { ...addrFormData.value, type: 2 },
    })

    if (Number(res?.code) === 1) {
      form.value.receiver.id = String(res?.data?.receive_addr_id || '')
      form.value.receiver.name = addrFormData.value.name || ''
      form.value.receiver.telephone = addrFormData.value.telephone || ''
      form.value.receiver.country = addrFormData.value.country || ''
      form.value.receiver.province = addrFormData.value.province || ''
      form.value.receiver.city = addrFormData.value.city || ''
      form.value.receiver.address = addrFormData.value.address || ''
      form.value.receiver.address2 = addrFormData.value.address2 || ''
      form.value.receiver.postcode = addrFormData.value.postcode || ''
      addrFormDialog.value = false
      toast(t('pages.dropShippingReturnOrderCreate.messages.addressSavedAndFilled'), 'success')
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderCreate.messages.saveFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderCreate.messages.saveFailed'), 'error')
  }
  finally {
    addrFormSubmitting.value = false
  }
}

async function loadAddrList() {
  addrLoading.value = true
  try {
    const body = {
      type: 2,
      'current_page': addrCurrentPage.value,
      'per_page_num': addrPageSize.value,
    }

    if (addrSearchName.value.trim())
      body.name = addrSearchName.value.trim()

    const res = await $api('/order/queryAddr', { method: 'POST', body })

    if (Number(res?.code) === 1 && res?.data) {
      addrList.value = Array.isArray(res.data.data) ? res.data.data : []
      addrTotal.value = Number(res.data.count) || 0
    }
    else {
      addrList.value = []
      addrTotal.value = 0
      toast(res?.msg || t('pages.dropShippingOrderCreate.messages.loadAddressFailed'), 'error')
    }
  }
  catch (e) {
    addrList.value = []
    addrTotal.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderCreate.messages.loadAddressFailed'), 'error')
  }
  finally {
    addrLoading.value = false
  }
}

function searchAddr() {
  addrCurrentPage.value = 1
  loadAddrList()
}

function resetAddrSearch() {
  addrSearchName.value = ''
  searchAddr()
}

function selectAddr(row) {
  form.value.receiver.id = String(row.id || '')
  form.value.receiver.name = row.name || ''
  form.value.receiver.country = row.country || ''
  form.value.receiver.province = row.province || ''
  form.value.receiver.city = row.city || ''
  form.value.receiver.address = row.address || ''
  form.value.receiver.address2 = row.address2 || ''
  form.value.receiver.postcode = row.postcode || ''
  form.value.receiver.telephone = row.telephone || ''
  addrDialog.value = false
  toast(t('pages.dropShippingOrderCreate.messages.addressSelected'), 'success')
}

function buildPayload() {
  return {
    cankaohao: form.value.cankaohao.trim(),
    'warehouse_id': Number(form.value.warehouseId),
    'transport_type': Number(form.value.transportType),
    type: form.value.qualityType,
    'carton_type': Number(form.value.cartonType),
    remark: form.value.remark.trim(),
    'fnsku_file_xb': isSelfPickup.value ? form.value.fnskuFileXb.trim() : '',
    'receive_addr_id': Number(form.value.receiver.id || 0),
    'rec-people-id': Number(form.value.receiver.id || 0),
    'rec_people_country': form.value.receiver.country,
    'rec_people_name': form.value.receiver.name.trim(),
    'rec_people_province': form.value.receiver.province.trim(),
    'rec_people_city': form.value.receiver.city.trim(),
    'rec_people_address': form.value.receiver.address.trim(),
    'rec_people_address2': form.value.receiver.address2.trim(),
    'rec_people_postCode': form.value.receiver.postcode.trim(),
    'rec_people_telephone': form.value.receiver.telephone.trim(),
    'product_info': form.value.products.map(row => ({
      'en_sku': String(row.enSku || row.id || '').trim(),
      'goods_num': Number(row.goodsNum),
    })).filter(row => row['en_sku'] && row['goods_num'] > 0),
  }
}

async function loadDetail(withLoading = true) {
  if (!sourceId.value)
    return

  if (withLoading)
    loading.value = true
  try {
    const res = await $api('/order/viewReturnOrder', {
      method: 'POST',
      body: { id: sourceId.value },
    })

    if (Number(res?.code) === 1 && res?.data) {
      const orderInfo = res.data.order_info || {}
      const addr = res.data.receive_addr || {}
      const products = Array.isArray(res.data.product_info) ? res.data.product_info : []

      form.value = {
        cankaohao: orderInfo.cankaohao || '',
        warehouseId: Number(orderInfo.warehouse_id || 0) || null,
        transportType: Number(orderInfo.transport_type || 0) || null,
        qualityType: orderInfo.type || QUALITY_GOOD,
        cartonType: Number(orderInfo.carton_type ?? orderInfo.material_type ?? 0),
        remark: orderInfo.remark || '',
        fnskuFileXb: orderInfo.fnsku_file_xb || orderInfo.ht_pdf || '',
        receiver: {
          id: String(addr.id || ''),
          country: addr.country || '',
          name: addr.name || '',
          province: addr.province || '',
          city: addr.city || '',
          address: addr.address || '',
          address2: addr.address2 || '',
          postcode: addr.postcode || '',
          telephone: addr.telephone || '',
        },
        products: products.length
          ? products.map(item => ({
            id: item.en_sku || item.id || '',
            enSku: item.en_sku || '',
            cnName: item.cn_name || '',
            goodsNum: Number(item.goods_num || 1),
          }))
          : [{ id: '', enSku: '', cnName: '', goodsNum: 1 }],
      }

      const loadedRef = String(orderInfo.cankaohao || '').trim()
      if (loadedRef && !/^\w+$/.test(loadedRef))
        toast(t('pages.dropShippingReturnOrderCreate.messages.invalidLoadedReference'), 'warning')
    }
    else {
      toast(res?.msg || t('pages.dropShippingReturnOrderCreate.messages.loadDetailFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingReturnOrderCreate.messages.loadDetailFailed'), 'error')
  }
  finally {
    if (withLoading)
      loading.value = false
  }
}

async function estimateCost() {
  if (!form.value.warehouseId) {
    toast(t('pages.dropShippingOrderCreate.messages.selectWarehouse'), 'warning')

    return
  }
  if (!form.value.receiver.id) {
    toast(t('pages.dropShippingOrderCreate.messages.selectAddress'), 'warning')

    return
  }
  if (!form.value.transportType) {
    toast(t('pages.dropShippingOrderCreate.messages.selectTransport'), 'warning')

    return
  }
  if (Number(form.value.transportType) === 99999 || Number(form.value.transportType) === 200) {
    toast(t('pages.dropShippingOrderCreate.messages.estimateUnsupported'), 'warning')

    return
  }

  const items = form.value.products
    .filter(p => (p.enSku || p.id) && p.goodsNum > 0)
    .map(p => ({
      sku: p.enSku || p.id,
      'sku_num': Number(p.goodsNum),
    }))

  if (!items.length) {
    toast(t('pages.dropShippingOrderCreate.messages.validProductsRequired'), 'warning')

    return
  }

  estimating.value = true
  try {
    const body = {
      'warehouse_id': Number(form.value.warehouseId),
      'recipient_address_id': Number(form.value.receiver.id),
      provider: Number(form.value.transportType),
      cankaohao: form.value.cankaohao.trim(),
      items,
    }

    const res = await $apiJson('/ordernewapi/shippingRateCompare', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1 && res?.data) {
      const bestFee = res.data.rates?.[0]?.totalFee ?? res.data.raw?.totalFee ?? 0

      estimatedFeeLabel.value = bestFee
      toast(t('pages.dropShippingOrderCreate.messages.estimatedFee', { fee: bestFee }), 'success')
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderCreate.messages.estimateFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderCreate.messages.estimateFailed'), 'error')
  }
  finally {
    estimating.value = false
  }
}

async function submitForm() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  // Secondary reference number validation.
  const rawRef = String(form.value.cankaohao || '').trim()
  if (!rawRef || !/^\w+$/.test(rawRef)) {
    toast(t('pages.dropShippingReturnOrderCreate.messages.invalidReferenceBlocked'), 'error')
    
    return
  }

  const payload = buildPayload()
  if (!payload.product_info.length) {
    toast(t('pages.dropShippingReturnOrderCreate.messages.atLeastOneProduct'), 'warning')

    return
  }

  submitting.value = true
  try {
    const endpoint = editingId.value ? '/order/editReturnOrder' : '/order/addReturn'
    const body = editingId.value ? { ...payload, id: editingId.value } : payload

    const res = await $apiJson(endpoint, {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingOrderCreate.messages.submitSuccess'), 'success')
      setTimeout(goList, 500)
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderCreate.messages.submitFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderCreate.messages.submitFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => form.value.warehouseId, async v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
  await refreshSkuOptions()
})

watch(() => form.value.qualityType, async () => {
  if (!warehousePersistReady.value)
    return

  await refreshSkuOptions()
})

watch(() => [form.value.warehouseId, form.value.transportType, form.value.receiver.id, form.value.products], () => {
  estimatedFeeLabel.value = null
}, { deep: true })

onMounted(async () => {
  const shouldPreload = !!sourceId.value
  if (shouldPreload)
    loading.value = true

  try {
    if (!sourceId.value) {
      const cachedWarehouseId = getPreferredWarehouseId()
      if (cachedWarehouseId != null)
        form.value.warehouseId = cachedWarehouseId
    }

    warehouseOptions.value = await loadWarehouseOptions(t)
    cartonOptions.value = await loadCartonOptions(t)
    countryOptions.value = await loadCountryOptions()
    await loadDetail(!shouldPreload)
    if (!sourceId.value)
      form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
    if (isCopy.value)
      form.value.cankaohao = ''
    await refreshSkuOptions()
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
          {{ $t('pages.dropShippingReturnOrderCreate.eyebrow') }}
        </div>
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ pageTitle }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          {{ $t('pages.dropShippingReturnOrderCreate.subtitle') }}
        </p>
      </div>
      <VBtn
        variant="tonal"
        prepend-icon="tabler-arrow-left"
        class="text-none"
        @click="goList"
      >
        {{ $t('pages.dropShippingOrderCreate.actions.backToList') }}
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
              :title="$t('pages.dropShippingOrderCreate.sections.recipient.title')"
              :subtitle="$t('pages.dropShippingOrderCreate.sections.recipient.subtitle')"
              class="mb-4"
            >
              <template #append>
                <div class="d-flex flex-wrap gap-2">
                  <VBtn
                    size="small"
                    variant="tonal"
                    prepend-icon="tabler-address-book"
                    class="text-none"
                    :disabled="pageBlocking"
                    @click="openAddrDialog"
                  >
                    {{ $t('pages.dropShippingOrderCreate.actions.chooseAddress') }}
                  </VBtn>
                  <VBtn
                    size="small"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    class="text-none"
                    :disabled="pageBlocking"
                    @click="openAddrFormDialog"
                  >
                    {{ $t('pages.dropShippingOrderCreate.actions.addAddress') }}
                  </VBtn>
                </div>
              </template>
              <VAlert
                v-if="!form.receiver.id"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                {{ $t('pages.dropShippingOrderCreate.sections.recipient.empty') }}
              </VAlert>
              <VSheet
                v-else
                border
                rounded="lg"
                class="pa-4 bg-surface"
              >
                <div
                  class="text-body-2 d-flex flex-column gap-2"
                  style="font-size: 0.875rem;"
                >
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.name') }}</span>{{ form.receiver.name || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.address1') }}</span>{{ form.receiver.address || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.address2') }}</span>{{ form.receiver.address2 || '—' }}</div>
                  <div class="d-flex flex-wrap gap-4">
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.city') }}</span>{{ form.receiver.city || '—' }}</span>
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.province') }}</span>{{ form.receiver.province || '—' }}</span>
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.postcode') }}</span>{{ form.receiver.postcode || '—' }}</span>
                  </div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.country') }}</span>{{ countryOptions.find(c => String(c.value) === String(form.receiver.country))?.title || form.receiver.country || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.phone') }}</span>{{ form.receiver.telephone || '—' }}</div>
                </div>
              </VSheet>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingOrderCreate.sections.logistics.title')"
              :subtitle="$t('pages.dropShippingOrderCreate.sections.logistics.subtitle')"
              class="mb-4"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.transportType"
                    :items="transportOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderCreate.sections.logistics.transport')"
                    :rules="[v => !!v || $t('pages.dropShippingOrderCreate.rules.transportRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.warehouseId"
                    :items="warehouseOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderCreate.sections.logistics.warehouse')"
                    :rules="[v => !!v || $t('pages.dropShippingOrderCreate.rules.warehouseRequired')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.cartonType"
                    :items="cartonOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderCreate.sections.logistics.carton')"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  v-if="isSelfPickup"
                  cols="12"
                >
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ $t('pages.dropShippingReturnOrderCreate.sections.logistics.pickupAttachment') }}
                  </div>
                  <OrderFileUploadCard
                    v-model="form.fnskuFileXb"
                    :disabled="pageBlocking"
                    @uploaded="toast($t('pages.dropShippingOrderCreate.messages.attachmentUploaded'), 'success')"
                    @error="msg => toast(msg || $t('pages.dropShippingOrderCreate.messages.attachmentUploadFailed'), 'error')"
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingReturnOrderCreate.sections.order.title')"
              :subtitle="$t('pages.dropShippingReturnOrderCreate.sections.order.subtitle')"
              class="mb-4"
            >
              <VRow class="mb-2">
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    v-model="form.cankaohao"
                    :label="$t('pages.dropShippingOrderCreate.sections.order.referenceNo')"
                    :rules="[
                      v => !!String(v || '').trim() || $t('pages.dropShippingOrderCreate.rules.referenceRequired'),
                      v => /^[A-Za-z0-9_]+$/.test(String(v || '').trim()) || $t('pages.dropShippingOrderCreate.rules.referenceInvalid'),
                    ]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="form.qualityType"
                    :items="qualityTypeOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingReturnOrderCreate.sections.order.quality')"
                    :rules="[v => !!v || $t('pages.dropShippingOrderLabelCreate.options.required')]"
                    :disabled="pageBlocking"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    v-model="form.remark"
                    :label="$t('pages.dropShippingOrderCreate.sections.order.remark')"
                    :disabled="pageBlocking"
                  />
                </VCol>
              </VRow>
              <template #append>
                <VBtn
                  color="primary"
                  size="small"
                  variant="tonal"
                  prepend-icon="tabler-plus"
                  class="text-none"
                  :disabled="pageBlocking"
                  @click="addProduct"
                >
                  {{ $t('pages.dropShippingOrderCreate.sections.order.addProduct') }}
                </VBtn>
              </template>
              <VTable
                density="comfortable"
                class="product-table"
              >
                <thead>
                  <tr>
                    <th class="text-left">
                      SKU
                    </th>
                    <th class="text-left">
                      {{ $t('pages.dropShippingReturnOrderCreate.sections.order.qualityWarehouse') }}
                    </th>
                    <th class="text-left">
                      {{ $t('pages.dropShippingOrderCreate.sections.order.qty') }}
                    </th>
                    <th class="text-center">
                      {{ $t('pages.dropShippingOrderCreate.sections.order.actions') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in form.products"
                    :key="idx"
                  >
                    <td class="product-table__cell-sku">
                      <AppAutocomplete
                        v-model="row.id"
                        :items="skuOptions"
                        item-title="title"
                        item-value="value"
                        :placeholder="$t('pages.dropShippingOrderCreate.sections.order.skuPlaceholder')"
                        density="compact"
                        hide-details
                        :custom-filter="skuSearchFilter"
                        auto-select-first
                        :disabled="pageBlocking"
                        @update:model-value="syncSkuMeta(row)"
                      />
                    </td>
                    <td class="product-table__cell-text">
                      <AppTextField
                        v-model="row.cnName"
                        density="compact"
                        hide-details
                        readonly
                      />
                    </td>
                    <td class="product-table__cell-qty">
                      <AppTextField
                        v-model="row.goodsNum"
                        type="number"
                        density="compact"
                        hide-details
                        :disabled="pageBlocking"
                      />
                    </td>
                    <td class="text-center product-table__cell-action">
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
                {{ $t('pages.dropShippingReturnOrderCreate.sections.order.productCount', { count: form.products.length }) }}
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
                      icon="tabler-file-invoice"
                      size="20"
                      color="primary"
                    />
                    {{ $t('pages.dropShippingOrderCreate.sections.summary.title') }}
                  </VCardTitle>
                </VCardItem>
                <VDivider class="mx-5 mb-4" />
                <VCardText class="px-5 pb-4 pt-0">
                  <div class="d-flex flex-column gap-4">
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingReturnOrderCreate.sections.summary.returnWarehouse') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ currentWarehouseName }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.summary.transport') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ currentTransportName }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.summary.carton') }}</span>
                      <div class="d-flex align-center gap-2">
                        <span class="text-subtitle-2 font-weight-medium">{{ currentCartonName }}</span>
                        <VChip
                          v-if="currentCartonPrice"
                          color="error"
                          size="x-small"
                          variant="flat"
                        >
                          +${{ currentCartonPrice }}
                        </VChip>
                      </div>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingReturnOrderCreate.sections.summary.validProducts') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ $t('pages.dropShippingReturnOrderCreate.sections.summary.validProductsCount', { count: validProductCount }) }}</span>
                    </div>
                  </div>
                </VCardText>
                
                <div
                  v-if="estimatedFeeLabel != null"
                  class="mx-5 mb-5 rounded-lg px-5 py-4 d-flex flex-column align-center"
                  style="background: rgba(var(--v-theme-success), 0.05); border: 1px solid rgba(var(--v-theme-success), 0.12);"
                >
                  <div class="text-caption text-success font-weight-medium mb-1">
                    {{ $t('pages.dropShippingReturnOrderCreate.sections.summary.estimatedFee') }}
                  </div>
                  <div class="text-h3 font-weight-bold text-success mb-1">
                    ${{ estimatedFeeLabel }}
                  </div>
                  <div
                    class="text-caption text-center"
                    style="color: rgba(var(--v-theme-success), 0.8);"
                  >
                    {{ $t('pages.dropShippingOrderCreate.sections.summary.estimateNote') }}
                  </div>
                </div>
                
                <VDivider class="mx-5" />
                <VCardText class="px-5 py-4 d-flex flex-column gap-3">
                  <VBtn
                    block
                    color="secondary"
                    variant="tonal"
                    prepend-icon="tabler-calculator"
                    class="text-none rounded-lg"
                    :loading="estimating"
                    :disabled="pageBlocking"
                    @click="estimateCost"
                  >
                    {{ $t('pages.dropShippingOrderCreate.actions.estimate') }}
                  </VBtn>
                  <VBtn
                    block
                    color="primary"
                    prepend-icon="tabler-send"
                    class="text-none rounded-lg"
                    size="large"
                    :loading="submitting"
                    :disabled="pageBlocking"
                    @click="submitForm"
                  >
                    {{ submitButtonText }}
                  </VBtn>
                </VCardText>
              </VCard>
            </div>
          </VCol>
        </VRow>
      </VForm>
    </FormPageLoadingOverlay>

    <AddressBookPickerDialog
      v-model="addrDialog"
      v-model:search-name="addrSearchName"
      v-model:current-page="addrCurrentPage"
      content-class="print-label-addr-dialog-wrap"
      :title="$t('pages.dropShippingOrderCreate.addressDialog.title')"
      :subtitle="$t('pages.dropShippingOrderCreate.addressDialog.subtitle')"
      :items="addrList"
      :total="addrTotal"
      :loading="addrLoading"
      :page-size="addrPageSize"
      :page-count="addrPageCount"
      @close="closeAddrDialog"
      @search="searchAddr"
      @reset-search="resetAddrSearch"
      @select="selectAddr"
      @load-page="loadAddrList"
    />

    <AddressFormDialog
      v-model="addrFormDialog"
      v-model:form="addrFormData"
      :addr-type="2"
      :country-items="countryOptions"
      :submitting="addrFormSubmitting"
      @submit="saveNewAddress"
    />
  </VContainer>
</template>

<style scoped>
.product-table {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.75rem;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.product-table :deep(thead th) {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
  padding: 0.875rem 1rem;
}

.product-table :deep(tbody td) {
  vertical-align: middle;
  padding-block: 0.625rem !important;
  border-bottom: 1px dashed rgba(var(--v-border-color), 0.6);
  padding-inline: 1rem;
}

.product-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.product-table__cell-sku {
  min-width: 18rem;
}

.product-table__cell-text {
  min-width: 10rem;
}

.product-table__cell-qty {
  min-width: 7rem;
}

.product-table__cell-action {
  min-width: 4.5rem;
}

@media (min-width: 1280px) {
  .create-sidebar {
    position: sticky;
    top: 5rem;
  }
}
</style>
