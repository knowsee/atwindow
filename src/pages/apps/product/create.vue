<script setup>
import { $api, $apiJson } from '@/utils/api'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const routeType = String(route.query.type || 'create')
const isEditInit = routeType === 'edit' || routeType === 'detail'

const loading = ref(isEditInit)
const submitting = ref(false)
const uploading = ref(false)
const fileInputRef = ref()

const categories = ref([])
const images = ref([])
const subSkuList = ref([])

const snack = ref({ show: false, text: '', color: 'info' })
const IMAGE_BASE_URL = 'https://backend.atwindow.com/'
const SKU_MAX_LENGTH = 20
const SKU_ALLOWED_PATTERN = /^[\w-]+$/

const form = reactive({
  id: null,
  en_sku: '',
  barcode: '',
  cn_name: '',
  en_name: '',
  cn_brand: '',
  en_brand: '',
  danwei: 1,
  weight: null,
  length: null,
  width: null,
  height: null,
  cat_id: null,
  is_with_battery: 0,
  status: 1,
  kucun_warn: null,
  haiguan_code: '',
  original_places: '',
  value: null,
  price1: null,
  price2: null,
  price3: null,
  desc: '',
  en_desc: '',
})

const mode = computed(() => {
  const type = String(route.query.type || 'create')
  if (['edit', 'detail'].includes(type))
    return type
  
  return 'create'
})

const isDetail = computed(() => mode.value === 'detail')
const isEditLike = computed(() => mode.value === 'edit' || mode.value === 'detail')

const pageTitle = computed(() => {
  if (mode.value === 'edit')
    return t('pages.productCreate.titles.edit')
  if (mode.value === 'detail')
    return t('pages.productCreate.titles.detail')
  
  return t('pages.productCreate.titles.create')
})

const pageSubtitle = computed(() => {
  if (mode.value === 'detail')
    return t('pages.productCreate.subtitles.detail')
  if (mode.value === 'edit')
    return t('pages.productCreate.subtitles.edit')
  
  return t('pages.productCreate.subtitles.create')
})

const categoryItems = computed(() => categories.value.map(item => ({
  title: item.cn_en_name || item.name || t('pages.productCreate.categoryFallback', { id: item.id }),
  value: Number(item.id),
})))

const unitOptions = computed(() => [
  { title: t('pages.productCreate.options.metric'), value: 1 },
  { title: t('pages.productCreate.options.imperial'), value: 2 },
])

const batteryOptions = computed(() => [
  { title: t('pages.productCreate.options.batteryNo'), value: 0 },
  { title: t('pages.productCreate.options.batteryYes'), value: 1 },
])

const statusOptions = computed(() => [
  { title: t('pages.productCreate.options.enabled'), value: 1 },
  { title: t('pages.productCreate.options.disabled'), value: 0 },
])

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function normalizeSkuValue(value) {
  return String(value || '')
    .replace(/[^\w-]/g, '')
    .slice(0, SKU_MAX_LENGTH)
}

function validateSkuValue(value, label = t('pages.productCreate.fields.sku')) {
  const raw = String(value || '').trim()
  if (!raw)
    return t('pages.productCreate.messages.skuRequired', { label })
  if (!SKU_ALLOWED_PATTERN.test(raw))
    return t('pages.productCreate.messages.skuInvalid', { label })
  if (raw.length > SKU_MAX_LENGTH)
    return t('pages.productCreate.messages.skuTooLong', { label, max: SKU_MAX_LENGTH })

  return ''
}

function resolveImageUrl(path) {
  const raw = String(path || '').trim()
  if (!raw)
    return ''
  if (/^https?:\/\//i.test(raw))
    return raw
  
  return `${IMAGE_BASE_URL}${raw.replace(/^\/+/, '')}`
}

function goList() {
  router.push('/apps/product/list')
}

async function loadCategories() {
  const parseRows = payload => (Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []))
  try {
    const res = await $api('/product/category', { method: 'POST', body: {} })
    if (Number(res?.code) === 1)
      categories.value = parseRows(res.data)
  }
  catch {
    // keep silent
  }
}

function normalizeImagesFromDetail(data) {
  if (Array.isArray(data?.images) && data.images.length) {
    return data.images.map((img, idx) => ({
      id: img.id,
      url: resolveImageUrl(img.image_url || img.url || img.full_url),
      full_url: resolveImageUrl(img.full_url || img.image_url || img.url),
      is_main: Number(img.is_main) === 1 ? 1 : 0,
      sort: Number(img.sort ?? idx),
    }))
  }

  if (data?.img_url) {
    return [{
      id: 0,
      url: resolveImageUrl(data.img_url),
      full_url: resolveImageUrl(data.img_url),
      is_main: 1,
      sort: 0,
    }]
  }

  return []
}

function normalizeSubSkuFromDetail(data) {
  if (!Array.isArray(data?.sku))
    return []
  
  return data.sku
    .filter(item => Number(item.is_main) === 0)
    .map(item => ({
      subSkuId: item.id || null,
      subSku: String(item.sku || ''),
    }))
}

async function loadDetail() {
  const id = Number(route.query.id || 0)
  if (!isEditLike.value)
    return

  if (!id) {
    loading.value = false
    toast(t('pages.productCreate.messages.missingId'), 'warning')
    
    return
  }

  loading.value = true
  try {
    const res = await $api('/product/detail', {
      method: 'POST',
      body: { id },
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || t('pages.productCreate.messages.loadDetailFailed'), 'error')
      
      return
    }

    const data = res.data || {}

    form.id = id
    form.en_sku = String(data.en_sku || '')
    form.barcode = String(data.barcode || '')
    form.cn_name = String(data.cn_name || '')
    form.en_name = String(data.en_name || '')
    form.cn_brand = String(data.cn_brand || '')
    form.en_brand = String(data.en_brand || '')
    form.danwei = Number(data.danwei || 1)
    form.weight = data.weight == null ? null : Number(data.weight)
    form.length = data.length == null ? null : Number(data.length)
    form.width = data.width == null ? null : Number(data.width)
    form.height = data.height == null ? null : Number(data.height)
    form.cat_id = data.cat_id == null ? null : Number(data.cat_id)
    form.is_with_battery = Number(data.is_with_battery || 0)
    form.status = Number(data.status ?? 1)
    form.kucun_warn = data.kucun_warn == null ? null : Number(data.kucun_warn)
    form.haiguan_code = String(data.haiguan_code || '')
    form.original_places = String(data.original_places || '')
    form.value = data.value == null ? null : Number(data.value)
    form.price1 = data.price1 == null ? null : Number(data.price1)
    form.price2 = data.price2 == null ? null : Number(data.price2)
    form.price3 = data.price3 == null ? null : Number(data.price3)
    form.desc = String(data.desc || '')
    form.en_desc = String(data.en_desc || '')

    images.value = normalizeImagesFromDetail(data)
    subSkuList.value = normalizeSubSkuFromDetail(data)
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productCreate.messages.loadDetailFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function addSubSku() {
  if (isDetail.value)
    return
  subSkuList.value.push({ subSkuId: null, subSku: '' })
}

function removeSubSku(index) {
  if (isDetail.value)
    return
  subSkuList.value.splice(index, 1)
}

function setMainImage(index) {
  if (isDetail.value)
    return
  images.value = images.value.map((item, i) => ({ ...item, is_main: i === index ? 1 : 0 }))
}

function removeImage(index) {
  if (isDetail.value)
    return
  const removed = images.value[index]

  images.value.splice(index, 1)
  if (removed?.is_main === 1 && images.value.length)
    images.value[0].is_main = 1
}

async function uploadOneImage(file) {
  const fd = new FormData()

  fd.append('file', file)

  const res = await $api('/product/uploadImage', {
    method: 'POST',
    body: fd,
  })

  if (Number(res?.code) !== 1)
    throw new Error(res?.msg || t('pages.productCreate.messages.uploadFailed'))
  const list = Array.isArray(res?.data?.images) ? res.data.images : []
  
  return list.map((img, idx) => ({
    id: undefined,
    url: resolveImageUrl(img.url || img.image_url || ''),
    full_url: resolveImageUrl(img.full_url || img.url || img.image_url || ''),
    is_main: images.value.length === 0 && idx === 0 ? 1 : 0,
    sort: images.value.length + idx,
  })).filter(item => item.url)
}

async function onPickFiles(event) {
  if (isDetail.value)
    return
  const files = Array.from(event?.target?.files || [])
  if (!files.length)
    return

  uploading.value = true
  try {
    for (const file of files) {
      if (!/^image\/(?:jpeg|jpg|png|gif|webp)$/.test(file.type)) {
        toast(t('pages.productCreate.messages.imageType'), 'warning')
        continue
      }
      if (file.size / 1024 / 1024 > 5) {
        toast(t('pages.productCreate.messages.imageSize'), 'warning')
        continue
      }
      const uploaded = await uploadOneImage(file)

      images.value.push(...uploaded)
    }
  }
  catch (error) {
    toast(error?.message || t('pages.productCreate.messages.uploadFailed'), 'error')
  }
  finally {
    uploading.value = false
    if (fileInputRef.value)
      fileInputRef.value.value = ''
  }
}

function validateForm() {
  const skuError = validateSkuValue(form.en_sku)
  if (skuError)
    return skuError
  if (!form.cn_name)
    return t('pages.productCreate.messages.cnNameRequired')
  if (!form.en_name)
    return t('pages.productCreate.messages.enNameRequired')
  if (!form.en_brand)
    return t('pages.productCreate.messages.enBrandRequired')
  const subSkuLabel = t('pages.productCreate.subSkuLabel', { index: '' }).trim()
  const invalidSubSku = subSkuList.value.find(item => String(item.subSku || '').trim() && validateSkuValue(item.subSku, subSkuLabel))
  if (invalidSubSku)
    return validateSkuValue(invalidSubSku.subSku, subSkuLabel)
  if (!form.weight || !form.length || !form.width || !form.height)
    return t('pages.productCreate.messages.sizeRequired')
  if (!images.value.length)
    return t('pages.productCreate.messages.imageRequired')
  
  return ''
}

function buildSubmitPayload() {
  const mainImage = images.value.find(item => Number(item.is_main) === 1) || images.value[0]
  const keepIds = images.value.filter(item => item.id !== undefined).map(item => item.id)

  const newImages = images.value
    .filter(item => item.id === undefined)
    .map((item, idx) => ({
      url: item.url,
      is_main: item.url === mainImage?.url && mainImage?.id === undefined ? 1 : 0,
      sort: idx,
    }))

  const payload = {
    ...form,
    en_sku: String(form.en_sku || '').trim(),
    subSkuList: subSkuList.value
      .map(item => ({ subSkuId: item.subSkuId || null, subSku: String(item.subSku || '').trim() }))
      .filter(item => item.subSku),
    keep_image_ids: keepIds,
    images: newImages,
  }

  if (!isEditLike.value)
    delete payload.id
  if (mainImage?.id !== undefined)
    payload.main_image_id = mainImage.id

  return payload
}

async function saveProduct() {
  if (isDetail.value)
    return
  const errorText = validateForm()
  if (errorText) {
    toast(errorText, 'warning')
    
    return
  }

  submitting.value = true
  try {
    const payload = buildSubmitPayload()

    const res = await $apiJson('/product/save', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.productCreate.messages.saveSuccess'), 'success')
      setTimeout(() => goList(), 600)
    }
    else {
      toast(res?.msg || t('pages.productCreate.messages.saveFailed'), 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productCreate.messages.saveFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadDetail()
})
</script>

<template>
  <VContainer
    fluid
    class="product-create"
  >
    <div class="pb-12">
      <div class="product-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <h1 class="text-h4 font-weight-medium text-high-emphasis">
            {{ pageTitle }}
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
            {{ pageSubtitle }}
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

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2600"
      >
        {{ snack.text }}
      </VSnackbar>

      <VOverlay
        :model-value="loading"
        class="align-center justify-center"
        persistent
      >
        <VCard class="pa-6">
          <div class="d-flex align-center gap-3">
            <VProgressCircular
              indeterminate
              color="primary"
              size="28"
            />
            <span class="text-body-1">{{ $t('pages.productCreate.overlay') }}</span>
          </div>
        </VCard>
      </VOverlay>

      <PrintLabelSectionCard
        :title="$t('pages.productCreate.sections.basic')"
        :subtitle="$t('pages.productCreate.sections.basicSubtitle')"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_sku"
              :label="$t('pages.productCreate.fields.sku')"
              :placeholder="$t('pages.productCreate.placeholders.sku')"
              :maxlength="SKU_MAX_LENGTH"
              :counter="SKU_MAX_LENGTH"
              :disabled="isEditLike"
              @update:model-value="form.en_sku = normalizeSkuValue($event)"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.barcode"
              :label="$t('pages.productCreate.fields.barcode')"
              :placeholder="$t('pages.productCreate.placeholders.barcode')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.cn_name"
              :label="$t('pages.productCreate.fields.cnName')"
              :placeholder="$t('pages.productCreate.placeholders.cnName')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_name"
              :label="$t('pages.productCreate.fields.enName')"
              :placeholder="$t('pages.productCreate.placeholders.enName')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.cn_brand"
              :label="$t('pages.productCreate.fields.cnBrand')"
              :placeholder="$t('pages.productCreate.placeholders.cnBrand')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_brand"
              :label="$t('pages.productCreate.fields.enBrand')"
              :placeholder="$t('pages.productCreate.placeholders.enBrand')"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.productCreate.sections.spec')"
        :subtitle="$t('pages.productCreate.sections.specSubtitle')"
      >
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.weight"
              type="number"
              :label="$t('pages.productCreate.fields.weight')"
              :suffix="form.danwei === 1 ? 'kg' : 'lb'"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.length"
              type="number"
              :label="$t('pages.productCreate.fields.length')"
              :suffix="form.danwei === 1 ? 'cm' : 'in'"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.width"
              type="number"
              :label="$t('pages.productCreate.fields.width')"
              :suffix="form.danwei === 1 ? 'cm' : 'in'"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.height"
              type="number"
              :label="$t('pages.productCreate.fields.height')"
              :suffix="form.danwei === 1 ? 'cm' : 'in'"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.danwei"
              :label="$t('pages.productCreate.fields.unit')"
              :items="unitOptions"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.cat_id"
              :label="$t('pages.productCreate.fields.category')"
              :items="categoryItems"
              item-title="title"
              item-value="value"
              clearable
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.is_with_battery"
              :label="$t('pages.productCreate.fields.battery')"
              :items="batteryOptions"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.status"
              :label="$t('pages.productCreate.fields.status')"
              :items="statusOptions"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.productCreate.sections.attributes')"
        :subtitle="$t('pages.productCreate.sections.attributesSubtitle')"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.haiguan_code"
              :label="$t('pages.productCreate.fields.hsCode')"
              :placeholder="$t('pages.productCreate.placeholders.hsCode')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.original_places"
              :label="$t('pages.productCreate.fields.origin')"
              :placeholder="$t('pages.productCreate.placeholders.origin')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.value"
              type="number"
              :label="$t('pages.productCreate.fields.declaredValue')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.price1"
              type="number"
              :label="$t('pages.productCreate.fields.price1')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.price2"
              type="number"
              :label="$t('pages.productCreate.fields.price2')"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.price3"
              type="number"
              :label="$t('pages.productCreate.fields.price3')"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.productCreate.sections.images')"
        :subtitle="$t('pages.productCreate.sections.imagesSubtitle')"
      >
        <div class="product-image-grid mb-4">
          <VSheet
            v-if="!isDetail"
            rounded="lg"
            border
            class="product-upload-box"
            @click="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              class="d-none"
              @change="onPickFiles"
            >
            <div class="product-upload-box__inner">
              <VProgressCircular
                v-if="uploading"
                indeterminate
                size="24"
                color="primary"
              />
              <template v-else>
                <VIcon
                  icon="tabler-cloud-upload"
                  size="24"
                  class="mb-2 text-primary"
                />
                <div class="text-body-2 font-weight-medium text-primary">
                  {{ $t('pages.productCreate.images.upload') }}
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  {{ $t('pages.productCreate.images.tips') }}
                </div>
              </template>
            </div>
          </VSheet>

          <VSheet
            v-for="(img, index) in images"
            :key="`${img.url}-${index}`"
            rounded="lg"
            border
            class="product-image-item"
          >
            <VImg
              :src="img.full_url || img.url"
              cover
              height="108"
            />
            <div class="product-image-item__meta">
              <VChip
                size="x-small"
                :color="img.is_main ? 'primary' : 'default'"
                label
              >
                {{ img.is_main ? $t('pages.productCreate.images.main') : $t('pages.productCreate.images.image') }}
              </VChip>
              <div class="d-flex align-center gap-1">
                <IconBtn
                  v-if="!isDetail && !img.is_main"
                  size="x-small"
                  @click.stop="setMainImage(index)"
                >
                  <VIcon
                    icon="tabler-star"
                    size="14"
                  />
                </IconBtn>
                <IconBtn
                  v-if="!isDetail"
                  size="x-small"
                  @click.stop="removeImage(index)"
                >
                  <VIcon
                    icon="tabler-trash"
                    size="14"
                  />
                </IconBtn>
              </div>
            </div>
          </VSheet>
        </div>

        <VRow>
          <VCol
            v-for="(item, idx) in subSkuList"
            :key="`sku-${idx}`"
            cols="12"
            md="6"
          >
            <div class="d-flex align-center gap-2">
              <AppTextField
                v-model="item.subSku"
                :label="$t('pages.productCreate.subSkuLabel', { index: idx + 1 })"
                :placeholder="$t('pages.productCreate.placeholders.subSku')"
                :maxlength="SKU_MAX_LENGTH"
                :counter="SKU_MAX_LENGTH"
                :disabled="isDetail || !!(isEditLike && item.subSkuId)"
                @update:model-value="item.subSku = normalizeSkuValue($event)"
              />
              <IconBtn
                v-if="!isDetail"
                @click="removeSubSku(idx)"
              >
                <VIcon icon="tabler-trash" />
              </IconBtn>
            </div>
          </VCol>
          <VCol
            v-if="!isDetail"
            cols="12"
          >
            <VBtn
              variant="tonal"
              prepend-icon="tabler-plus"
              @click="addSubSku"
            >
              {{ $t('pages.productCreate.actions.addSubSku') }}
            </VBtn>
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.productCreate.sections.description')"
        :subtitle="$t('pages.productCreate.sections.descriptionSubtitle')"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextarea
              v-model="form.desc"
              :label="$t('pages.productCreate.fields.cnDesc')"
              rows="4"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextarea
              v-model="form.en_desc"
              :label="$t('pages.productCreate.fields.enDesc')"
              rows="4"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <VCard
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            {{ $t('pages.productCreate.actions.back') }}
          </VBtn>
          <VBtn
            v-if="!isDetail"
            color="primary"
            :loading="submitting"
            prepend-icon="tabler-device-floppy"
            @click="saveProduct"
          >
            {{ $t('pages.productCreate.actions.save') }}
          </VBtn>
        </VCardText>
      </VCard>
    </div>
  </VContainer>
</template>

<style scoped>
.product-create {
  background: rgb(var(--v-theme-background));
}

.product-create__inner {
  max-inline-size: 1440px;
  margin-inline: auto;
  padding: 1.5rem;
}

.product-create__hero {
  margin-block-start: 0.25rem;
}

@media (min-width: 600px) {
  .product-create__inner {
    padding: 2rem;
  }
}

.product-image-item {
  overflow: hidden;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.product-image-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-surface), 1);
}

.product-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  align-items: start;
}

.product-upload-box {
  cursor: pointer;
  min-height: 144px;
  border-style: dashed;
  transition: all 0.2s ease;
}

.product-upload-box:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.product-upload-box__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 144px;
  padding: 0.75rem;
  text-align: center;
}

@media (max-width: 959px) {
  .product-create__inner {
    padding: 1rem;
  }
}
</style>
