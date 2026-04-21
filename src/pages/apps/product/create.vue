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
    return '编辑产品'
  if (mode.value === 'detail')
    return '产品详情'
  
  return '新建产品'
})

const pageSubtitle = computed(() => {
  if (mode.value === 'detail')
    return '查看产品基础资料、规格参数、图片及子 SKU'
  if (mode.value === 'edit')
    return '更新产品信息后保存生效'
  
  return '填写产品信息后保存创建'
})

const categoryItems = computed(() => categories.value.map(item => ({
  title: item.cn_en_name || item.name || `分类#${item.id}`,
  value: Number(item.id),
})))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
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
    toast('缺少产品 ID，无法加载详情', 'warning')
    
    return
  }

  loading.value = true
  try {
    const res = await $api('/product/detail', {
      method: 'POST',
      body: { id },
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || '加载产品详情失败', 'error')
      
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
    toast(error?.data?.msg || error?.message || '加载产品详情失败', 'error')
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
    throw new Error(res?.msg || '图片上传失败')
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
      if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.type)) {
        toast('仅支持 jpg/png/gif/webp 图片', 'warning')
        continue
      }
      if (file.size / 1024 / 1024 > 5) {
        toast('图片大小不能超过 5MB', 'warning')
        continue
      }
      const uploaded = await uploadOneImage(file)

      images.value.push(...uploaded)
    }
  }
  catch (error) {
    toast(error?.message || '图片上传失败', 'error')
  }
  finally {
    uploading.value = false
    if (fileInputRef.value)
      fileInputRef.value.value = ''
  }
}

function validateForm() {
  if (!form.en_sku || /[\u4e00-\u9fa5]/.test(form.en_sku))
    return 'SKU 必填且不能包含中文'
  if (!form.cn_name)
    return '请填写产品中文名'
  if (!form.en_name)
    return '请填写产品英文名'
  if (!form.en_brand)
    return '请填写英文品牌'
  if (!form.weight || !form.length || !form.width || !form.height)
    return '请完善重量和长宽高'
  if (!images.value.length)
    return '请至少上传一张产品图片'
  
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
      toast(res?.msg || '保存成功', 'success')
      setTimeout(() => goList(), 600)
    }
    else {
      toast(res?.msg || '保存失败', 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '保存失败', 'error')
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
          返回列表
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
            <span class="text-body-1">加载中...</span>
          </div>
        </VCard>
      </VOverlay>

      <PrintLabelSectionCard
        title="基础信息"
        subtitle="维护产品名称、品牌与 SKU。"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_sku"
              label="产品 SKU"
              placeholder="请输入SKU（英文/数字）"
              :disabled="isEditLike"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.barcode"
              label="条形码"
              placeholder="请输入条形码"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.cn_name"
              label="产品中文名"
              placeholder="请输入中文名"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_name"
              label="产品英文名"
              placeholder="请输入英文名"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.cn_brand"
              label="中文品牌"
              placeholder="请输入中文品牌"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.en_brand"
              label="英文品牌"
              placeholder="请输入英文品牌"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="规格参数"
        subtitle="重量、尺寸和商品基础属性。"
      >
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="form.weight"
              type="number"
              label="重量"
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
              label="长度"
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
              label="宽度"
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
              label="高度"
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
              label="计量单位"
              :items="[{ title: '公制(kg/cm)', value: 1 }, { title: '英制(lb/in)', value: 2 }]"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.cat_id"
              label="产品分类"
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
              label="是否带电池"
              :items="[{ title: '不含电池', value: 0 }, { title: '含电池', value: 1 }]"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="form.status"
              label="产品状态"
              :items="[{ title: '启用', value: 1 }, { title: '禁用', value: 0 }]"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="商品属性"
        subtitle="用于报关与定价信息。"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.haiguan_code"
              label="海关编码"
              placeholder="请输入 HS 编码"
              :disabled="isDetail"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="form.original_places"
              label="原产地"
              placeholder="例如：中国"
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
              label="申报价值"
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
              label="销售价1"
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
              label="销售价2"
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
              label="销售价3"
              :disabled="isDetail"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="图片与子 SKU"
        subtitle="建议上传清晰主图，子 SKU 用于变体管理。"
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
                  点击上传
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  JPG/PNG/WebP, 5MB以内
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
                {{ img.is_main ? '主图' : '图片' }}
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
                :label="`子SKU ${idx + 1}`"
                placeholder="请输入子SKU"
                :disabled="isDetail || !!(isEditLike && item.subSkuId)"
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
              添加子 SKU
            </VBtn>
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="描述信息"
        subtitle="补充中英文说明。"
      >
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextarea
              v-model="form.desc"
              label="中文描述"
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
              label="英文描述"
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
            返回
          </VBtn>
          <VBtn
            v-if="!isDetail"
            color="primary"
            :loading="submitting"
            prepend-icon="tabler-device-floppy"
            @click="saveProduct"
          >
            保存产品
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
