<script setup>
import AddressBookPickerDialog from '@/components/address/AddressBookPickerDialog.vue'
import AddressFormDialog from '@/components/address/AddressFormDialog.vue'
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api, $apiJson } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadCartonOptions, loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const formRef = ref()
const loading = ref(false)
const { t } = useI18n({ useScope: 'global' })

/** Wait for first-screen warehouse/country/SKU requests; edit mode also loads details. */
const initialLoading = ref(true)
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

const mode = computed(() => String(route.query.mode || 'create'))
const isEdit = computed(() => mode.value === 'edit')
const isCopy = computed(() => mode.value === 'copy')
const editingId = computed(() => Number(route.query.id || 0) || null)

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
  name: '', address: '', address2: '', streetno: '', city: '', province: '',
  postcode: '', country: '', telephone: '', company: '', email: '',
})

const pageBlocking = computed(() => loading.value || initialLoading.value)

const pageOverlayMessage = computed(() => {
  if (loading.value)
    return t('pages.dropShippingOrderLabelCreate.loading.detail')

  if (initialLoading.value)
    return t('pages.dropShippingOrderLabelCreate.loading.initial')

  return t('pages.dropShippingOrderLabelCreate.loading.default')
})

const orderTypeItems = computed(() => [
  { title: t('pages.dropShippingOrderLabelCreate.options.relabel'), value: 0 },
  { title: t('pages.dropShippingOrderLabelCreate.options.noRelabel'), value: 1 },
])

const cartonTypeItems = ref([{ title: t('common.options.notRequired'), value: 0, price: 0 }])

const signatureItems = computed(() => [
  { title: t('common.options.notRequired'), value: 0 },
  { title: t('pages.dropShippingOrderLabelCreate.options.required'), value: 1 },
])

const transportItems = computed(() => [
  { title: t('pages.dropShippingOrderLabelCreate.options.pickup'), value: 200 },
  { title: 'UPS', value: 50 },
])

const receiveAddrId = ref(null)

const receiver = ref({
  country: '',
  name: '',
  province: '',
  city: '',
  address: '',
  address2: '',
  postCode: '',
  telephone: '',
})

const orderMeta = ref({
  orderType: 0,
  warehouseId: null,
  remark: '',
})

const product = ref({
  enSku: '',
  goodsNum: null,
  bqCode: '',
  labelFileUrl: '',
  boxFileUrl: '',
})

const valueAdd = ref({
  cartonType: 0,
  signatureType: 0,
  transportType: 200,
})

/** Pickup transport requires a user-provided label. */
const isPickupTransport = computed(() => Number(valueAdd.value.transportType) === 200)

const currentWarehouseName = computed(() =>
  warehouseOptions.value.find(w => Number(w.value) === Number(orderMeta.value.warehouseId))?.title || '—',
)

const currentTransportName = computed(() =>
  transportItems.value.find(item => Number(item.value) === Number(valueAdd.value.transportType))?.title || '—',
)

const currentCartonName = computed(() =>
  cartonTypeItems.value.find(c => Number(c.value) === Number(valueAdd.value.cartonType))?.title || t('common.options.notRequired'),
)

const currentCartonPrice = computed(() =>
  cartonTypeItems.value.find(c => Number(c.value) === Number(valueAdd.value.cartonType))?.price ?? 0,
)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-order-label-list' })
}

async function loadCountryOptionsLabel() {
  const res = await $api('/order/queryCountry', { method: 'POST' })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.short_name || ''} - ${item.en_name || ''} - ${item.cn_name || ''}`.trim(),
    value: item.cn_name,
  })).filter(item => item.value)
}

async function loadSkuOptions(wId = orderMeta.value.warehouseId) {
  const reqBody = {}
  if (wId) {
    reqBody['warehouse_id'] = wId
  }
  const res = await $api('/package/getSku', { method: 'POST', body: reqBody })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.en_sku || ''}_${item.cn_name || ''} (${t('pages.dropShippingOrderLabelCreate.sku.availableStock', { stock: item.available_stock || 0 })})`,
    value: item.en_sku,
  })).filter(item => item.value)
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
  addrFormData.value = {
    name: '', address: '', address2: '', streetno: '', city: '', province: '',
    postcode: '', country: '', telephone: '', company: '', email: '',
  }
  addrFormDialog.value = true
}

async function saveNewAddress() {
  addrFormSubmitting.value = true
  try {
    const res = await $api('/order/addAddr', {
      method: 'POST',
      body: { type: 2, ...addrFormData.value },
    })

    if (Number(res?.code) === 1) {
      toast(t('pages.dropShippingOrderCreate.messages.addressSaved'), 'success')
      addrFormDialog.value = false
      receiver.value.id = String(res?.data?.receive_addr_id || '')
      receiver.value.name = addrFormData.value.name || ''
      receiver.value.telephone = addrFormData.value.telephone || ''
      receiver.value.country = addrFormData.value.country || ''
      receiver.value.province = addrFormData.value.province || ''
      receiver.value.city = addrFormData.value.city || ''
      receiver.value.address = addrFormData.value.address || ''
      receiver.value.address2 = addrFormData.value.address2 || ''
      receiver.value.postCode = addrFormData.value.postcode || ''
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
  receiveAddrId.value = Number(row.id) || null
  receiver.value.name = row.name || ''
  receiver.value.country = row.country || ''
  receiver.value.province = row.province || ''
  receiver.value.city = row.city || ''
  receiver.value.address = row.address || ''
  receiver.value.address2 = row.address2 || ''
  receiver.value.postCode = row.postcode || ''
  receiver.value.telephone = row.telephone || ''
  addrDialog.value = false
  toast(t('pages.dropShippingOrderCreate.messages.addressSelected'), 'success')
}

function buildSubmitBody() {
  const body = {
    'rec-people-country': receiver.value.country,
    'rec-people-name': receiver.value.name.trim(),
    'rec-people-province': receiver.value.province.trim(),
    'rec-people-city': receiver.value.city.trim(),
    'rec-people-address': receiver.value.address.trim(),
    'rec-people-address2': receiver.value.address2.trim(),
    'rec-people-postCode': receiver.value.postCode.trim(),
    'rec-people-telephone': receiver.value.telephone.trim(),
    'receive_addr_id': receiveAddrId.value != null ? Number(receiveAddrId.value) : 0,
    'order_type': Number(orderMeta.value.orderType),
    'warehouse_id': Number(orderMeta.value.warehouseId),
    remark: orderMeta.value.remark.trim(),
    'carton_type': Number(valueAdd.value.cartonType),
    'signature_type': Number(valueAdd.value.signatureType),
    'transport_type': Number(valueAdd.value.transportType),
    'product_info': [
      {
        'en_sku': product.value.enSku.trim(),
        'goods_num': Number(product.value.goodsNum),
        'bq_code': product.value.bqCode.trim(),
        'fnsku_file_xb': product.value.labelFileUrl.trim(),
        'fnsku_file_xb_1': product.value.boxFileUrl.trim(),
      },
    ],
  }

  if (isEdit.value && editingId.value)
    body['id'] = editingId.value

  return body
}

async function loadDetail() {
  if (!editingId.value)
    return

  loading.value = true
  try {
    const res = await $api('/orderv2/detail', {
      method: 'POST',
      body: { id: editingId.value },
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      toast(res?.msg || t('pages.dropShippingOrderLabelCreate.messages.loadOrderFailed'), 'error')

      return
    }

    const data = res.data
    const info = data.order_info || {}
    const addr = data.receive_addr || {}
    const pi = Array.isArray(data.product_info) ? data.product_info[0] : null

    receiveAddrId.value = addr.id != null ? Number(addr.id) : null
    receiver.value = {
      country: addr.country || '',
      name: addr.name || '',
      province: addr.province || '',
      city: addr.city || '',
      address: addr.address || '',
      address2: addr.address2 || '',
      postCode: addr.postcode || '',
      telephone: addr.telephone || '',
    }

    orderMeta.value = {
      orderType: Number(info.order_type ?? 0),
      warehouseId: info.warehouse_id != null ? Number(info.warehouse_id) : null,
      remark: info.remark || '',
    }

    valueAdd.value = {
      cartonType: Number(info.material_type ?? 0),
      signatureType: Number(info.signature_type ?? 0),
      transportType: Number(info.transport_type ?? 200),
    }

    if (pi) {
      product.value = {
        enSku: pi.en_sku || '',
        goodsNum: pi.goods_num != null ? Number(pi.goods_num) : null,
        bqCode: pi.bq_code || '',
        labelFileUrl: pi.pdf || pi.ht_pdf || '',
        boxFileUrl: pi.pdf_xb || '',
      }
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderLabelCreate.messages.loadOrderFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function submitForm() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  if (!Number(orderMeta.value.warehouseId)) {
    toast(t('pages.dropShippingOrderLabelCreate.messages.selectWarehouse'), 'warning')

    return
  }

  if (!product.value.enSku.trim() || !product.value.bqCode.trim() || product.value.goodsNum == null || Number(product.value.goodsNum) <= 0) {
    toast(t('pages.dropShippingOrderLabelCreate.messages.completeProduct'), 'warning')

    return
  }

  if (!Number(valueAdd.value.transportType)) {
    toast(t('pages.dropShippingOrderLabelCreate.messages.selectTransport'), 'warning')

    return
  }

  const transportType = Number(valueAdd.value.transportType)
  const isPickup = transportType === 200

  if (!product.value.boxFileUrl.trim()) {
    toast(t('pages.dropShippingOrderLabelCreate.messages.uploadBoxRequired'), 'warning')

    return
  }

  if (isPickup && !product.value.labelFileUrl.trim()) {
    toast(t('pages.dropShippingOrderLabelCreate.messages.pickupLabelRequired'), 'warning')

    return
  }

  submitting.value = true
  try {
    const body = buildSubmitBody()
    const endpoint = isEdit.value ? '/orderv2/edit' : '/orderv2/addOrderLabel'
    const res = await $apiJson(endpoint, { method: 'POST', body })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingOrderLabelCreate.messages.submitSuccess'), 'success')
      setTimeout(goList, 800)
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderLabelCreate.messages.submitFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderLabelCreate.messages.submitFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => orderMeta.value.warehouseId, async v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
  skuOptions.value = await loadSkuOptions(v)
})

onMounted(async () => {
  try {
    warehouseOptions.value = await loadWarehouseOptions(t, 3)
    cartonTypeItems.value = await loadCartonOptions(t)
    countryOptions.value = await loadCountryOptionsLabel()
    await loadDetail()
    if (!editingId.value) {
      orderMeta.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, {
        preferFirstWhenNoCache: true,
      })
    }
    skuOptions.value = await loadSkuOptions(orderMeta.value.warehouseId)
    await nextTick()
    warehousePersistReady.value = true
  }
  finally {
    initialLoading.value = false
  }
})
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 label-order-create"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <div class="d-flex flex-column flex-md-row align-md-center justify-md-space-between gap-4 mb-6">
      <div>
        <div class="text-overline text-primary mb-1">
          {{ $t('pages.dropShippingOrderLabelCreate.eyebrow') }}
        </div>
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ isEdit ? $t('pages.dropShippingOrderLabelCreate.title.edit') : isCopy ? $t('pages.dropShippingOrderLabelCreate.title.copy') : $t('pages.dropShippingOrderLabelCreate.title.create') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2 text-wrap">
          {{ $t('pages.dropShippingOrderLabelCreate.subtitle') }}
        </p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <VBtn
          variant="tonal"
          prepend-icon="tabler-arrow-left"
          class="text-none"
          @click="goList"
        >
          {{ $t('pages.dropShippingOrderDetail.actions.backToList') }}
        </VBtn>
      </div>
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
                v-if="!receiveAddrId"
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
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.name') }}</span>{{ receiver.name || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.address1') }}</span>{{ receiver.address || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.address2') }}</span>{{ receiver.address2 || '—' }}</div>
                  <div class="d-flex flex-wrap gap-4">
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.city') }}</span>{{ receiver.city || '—' }}</span>
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.province') }}</span>{{ receiver.province || '—' }}</span>
                    <span><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.postcode') }}</span>{{ receiver.postCode || '—' }}</span>
                  </div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.country') }}</span>{{ countryOptions.find(c => String(c.value) === String(receiver.country))?.title || receiver.country || '—' }}</div>
                  <div><span class="text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.recipient.phone') }}</span>{{ receiver.telephone || '—' }}</div>
                </div>
              </VSheet>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingOrderLabelCreate.sections.shipping.title')"
              :subtitle="$t('pages.dropShippingOrderLabelCreate.sections.shipping.subtitle')"
              class="mb-4"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="valueAdd.transportType"
                    :items="transportItems"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.shipping.transport')"
                    :rules="[v => v != null && Number(v) > 0 || $t('pages.dropShippingOrderLabelCreate.rules.transportRequired')]"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="orderMeta.warehouseId"
                    :items="warehouseOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.shipping.warehouse')"
                    :rules="[v => v != null && v !== '' || $t('pages.dropShippingOrderLabelCreate.rules.warehouseRequired')]"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingOrderLabelCreate.sections.product.title')"
              :subtitle="$t('pages.dropShippingOrderLabelCreate.sections.product.subtitle')"
              class="mb-4"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppAutocomplete
                    v-model="product.enSku"
                    :items="skuOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.product.sku')"
                    clearable
                    :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingOrderLabelCreate.rules.skuRequired')]"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="2"
                >
                  <AppTextField
                    v-model.number="product.goodsNum"
                    type="number"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.product.qty')"
                    min="1"
                    :rules="[v => v != null && Number(v) > 0 || $t('pages.dropShippingOrderLabelCreate.rules.qtyRequired')]"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="product.bqCode"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.product.labelCode')"
                    :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingOrderLabelCreate.rules.labelCodeRequired')]"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ $t('pages.dropShippingOrderLabelCreate.sections.product.uploadLabel') }}
                    <span
                      v-if="isPickupTransport"
                      class="text-error"
                    >{{ $t('pages.dropShippingOrderLabelCreate.sections.product.pickupRequired') }}</span>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >{{ $t('pages.dropShippingOrderLabelCreate.sections.product.optional') }}</span>
                  </div>
                  <OrderFileUploadCard
                    v-model="product.labelFileUrl"
                    :disabled="pageBlocking"
                    @uploaded="toast($t('pages.dropShippingOrderLabelCreate.messages.labelUploaded'), 'success')"
                    @error="msg => toast(msg || $t('pages.dropShippingOrderLabelCreate.messages.uploadFailed'), 'error')"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ $t('pages.dropShippingOrderLabelCreate.sections.product.uploadBox') }}
                  </div>
                  <OrderFileUploadCard
                    v-model="product.boxFileUrl"
                    :disabled="pageBlocking"
                    @uploaded="toast($t('pages.dropShippingOrderLabelCreate.messages.boxUploaded'), 'success')"
                    @error="msg => toast(msg || $t('pages.dropShippingOrderLabelCreate.messages.uploadFailed'), 'error')"
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              :title="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.title')"
              :subtitle="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.subtitle')"
              class="mb-4"
            >
              <VRow>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="orderMeta.orderType"
                    :items="orderTypeItems"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.orderType')"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppSelect
                    v-model="valueAdd.cartonType"
                    :items="cartonTypeItems"
                    item-title="title"
                    item-value="value"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.carton')"
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    v-model="orderMeta.remark"
                    :label="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.remark')"
                    :hint="$t('pages.dropShippingOrderLabelCreate.sections.valueAdd.optionalHint')"
                    persistent-hint
                    :disabled="pageBlocking"
                    density="comfortable"
                  />
                </VCol>
              </VRow>
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
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderCreate.sections.summary.warehouse') }}</span>
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
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderLabelCreate.sections.summary.productSku') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ product.enSku || '—' }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderLabelCreate.sections.summary.qty') }}</span>
                      <span class="text-subtitle-2 font-weight-medium">{{ product.goodsNum || '—' }}</span>
                    </div>
                  </div>
                </VCardText>
                
                <VDivider class="mx-5" />
                <VCardText class="px-5 py-4 d-flex flex-column gap-3">
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
                    {{ isEdit ? $t('pages.dropShippingOrderLabelCreate.actions.submitEdit') : isCopy ? $t('pages.dropShippingOrderLabelCreate.actions.submitCopy') : $t('pages.dropShippingOrderLabelCreate.actions.submitCreate') }}
                  </VBtn>
                  <VBtn
                    block
                    variant="text"
                    :disabled="pageBlocking"
                    @click="goList"
                  >
                    {{ $t('pages.dropShippingOrderLabelCreate.actions.cancel') }}
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
@media (min-width: 1280px) {
  .create-sidebar {
    position: sticky;
    top: 5rem;
  }
}
</style>
