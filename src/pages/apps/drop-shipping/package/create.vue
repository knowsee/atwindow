<script setup>
import { $api, $apiJson } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions, normalizeRangeText, resolvePackageYjdcTimeRange } from '@/views/apps/drop-shipping/useDropShippingShared'
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
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

/** 创建页：等待仓库/国家/默认地址/SKU 等首屏接口 */
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
})

const expressOptions = ref([
  { title: '快递', value: 1 },
  { title: '卡车', value: 2 },
  { title: '海运', value: 3 },
  { title: '空运', value: 4 },
])

const skuOptions = ref([])

const mode = computed(() => String(route.query.mode || 'create'))
const isEdit = computed(() => mode.value === 'edit')
const isDetail = computed(() => mode.value === 'detail')
const editingId = computed(() => Number(route.query.id || 0) || null)

const pageBlocking = computed(() => loading.value || initialLoading.value)

const pageOverlayMessage = computed(() => {
  if (loading.value)
    return '正在加载入库单详情...'

  if (initialLoading.value)
    return '正在加载仓库、地址与货品数据...'

  return '正在加载...'
})

const pageTitle = computed(() => {
  if (isDetail.value)
    return '正在查看详情'
  if (isEdit.value)
    return '编辑入库单'

  return '创建入库单'
})

const pageSubtitle = computed(() => {
  if (isDetail.value)
    return '以下为只读信息，不可修改。'

  return '填写仓库、物流与货品明细后提交入库申请。'
})

const form = ref({
  warehouseId: null,
  expressId: null,
  boxNum: 1,
  trackingNo: '',
  timeRange: '',
  products: [{ id: '', enSku: '', cnName: '', qty: 1 }],
})

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

/** 接口 `express_id` 常为 0 时，用 `box_type` 文案（如「快递」）映射运输方式 */
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

async function loadSkuOptions() {
  productLoading.value = true
  try {
    const res = await $api('/package/getSku', { method: 'POST' })
    if (Number(res?.code) === 1 && Array.isArray(res?.data)) {
      skuOptions.value = res.data.map(item => ({
        title: `${item.en_sku || ''} ${item.cn_name ? `(${item.cn_name})` : ''}`.trim(),
        value: item.en_sku || '',
        enSku: item.en_sku || '',
        cnName: item.cn_name || '',
      }))
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || 'SKU加载失败', 'error')
  }
  finally {
    productLoading.value = false
  }
}

function normalizeSenderInfo(raw) {
  const row = raw || {}
  const country = row.country || row.send_country || row.sender_country || row.country_code || ''
  const name = row.name || row.sender_name || row.contact || row.linkman || ''
  const phone = row.phone || row.mobile || row.telephone || row.tel || ''

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
    : [country, row.address].filter(Boolean).join(' ').trim()

  return { country, name, phone, address }
}

async function loadSenderCountryOptions() {
  try {
    const res = await $api('/order/queryCountry', { method: 'POST' })
    if (Number(res?.code) === 1 && Array.isArray(res?.data)) {
      senderCountryOptions.value = res.data.map(item => ({
        title: `${item.short_name || ''} - ${item.en_name || ''} - ${item.cn_name || ''}`.trim(),
        value: item.cn_name,
      })).filter(item => item.value)
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '国家加载失败', 'error')
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
    }
    else {
      toast(res?.msg || '加载详情失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '加载详情失败', 'error')
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
    || '快递'

  const packageSku = form.value.products
    .map(item => ({
      'en_sku': String(item.enSku || item.id || '').trim(),
      'sku_num': String(Math.max(0, Math.floor(Number(item.qty || 0)))),
    }))
    .filter(row => row['en_sku'] && Number(row['sku_num']) > 0)

  return {
    'send-people-name': senderInfo.value.name.trim(),
    'send-people-id': '',
    'send-people-country': senderInfo.value.country || '',
    'send-people-address': senderInfo.value.address.trim(),
    'send-people-telephone': senderInfo.value.phone.trim(),
    'warehouse_id': String(form.value.warehouseId ?? ''),
    'box_type': boxTypeTitle,
    'pdf_type': '1',
    type: '',
    id: isEdit.value && editingId.value && !isDetail.value ? String(editingId.value) : '',
    'tracking_no': form.value.trackingNo.trim(),
    'package_sku': packageSku,
    yjdcstime: toYmdPart(start),
    yjdcetime: toYmdPart(end),
  }
}

async function submitForm() {
  const { valid } = await formRef.value.validate()
  if (!valid || isDetail.value)
    return

  const payload = buildPayload()
  if (!payload['package_sku'].length) {
    toast('请至少填写一条有效货品明细', 'warning')

    return
  }

  submitting.value = true
  try {
    const res = await $apiJson('/package/ruku', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '保存成功', 'success')
      setTimeout(goList, 500)
    }
    else {
      toast(res?.msg || '保存失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '保存失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => form.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  const shouldPreload = !!editingId.value && (isEdit.value || isDetail.value)
  if (shouldPreload)
    loading.value = true

  try {
    warehouseOptions.value = await loadWarehouseOptions()
    await loadSenderCountryOptions()
    if (!editingId.value)
      form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
    if (!isEdit.value && !isDetail.value)
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

    <FormPageLoadingOverlay
      :loading="pageBlocking"
      :message="pageOverlayMessage"
    >
      <VForm ref="formRef">
        <PrintLabelSectionCard
          title="基础信息"
          subtitle="入库单头信息"
          class="mb-4"
        >
          <template #append>
            <div
              v-if="senderLoading && !pageBlocking"
              class="d-flex align-center text-medium-emphasis text-caption"
            >
              <VProgressCircular
                indeterminate
                size="14"
                width="2"
                class="me-1"
              />
              正在加载基础数据...
            </div>
          </template>
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
                label="入库仓库"
                :rules="[v => !!v || '请选择仓库']"
                :disabled="isDetail || pageBlocking"
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
                label="运输方式"
                :rules="[v => !!v || '请选择运输方式']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.boxNum"
                type="number"
                label="箱数"
                :rules="[v => Number(v) > 0 || '请输入有效箱数']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.trackingNo"
                label="运单号"
                :rules="[v => !!String(v || '').trim() || '请输入运单号']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppDateTimePicker
                v-model="form.timeRange"
                label="预计到仓时间"
                :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppSelect
                v-model="senderInfo.country"
                :items="senderCountryOptions"
                item-title="title"
                item-value="value"
                label="发货国家"
                :rules="[v => !!v || '请选择发货国家']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="senderInfo.name"
                label="发货联系人"
                :rules="[v => !!String(v || '').trim() || '请输入发货联系人']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="senderInfo.phone"
                label="发货电话"
                :rules="[v => !!String(v || '').trim() || '请输入发货电话']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="8"
            >
              <AppTextField
                v-model="senderInfo.address"
                label="发货地址"
                :rules="[v => !!String(v || '').trim() || '请输入发货地址']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="货品信息"
          subtitle="至少保留一条货品明细"
        >
          <template #append>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-plus"
              :disabled="isDetail || pageBlocking"
              @click="addProduct"
            >
              添加货品
            </VBtn>
          </template>
          <VTable
            density="comfortable"
            class="package-product-table"
          >
            <thead>
              <tr>
                <th class="text-left">
                  SKU
                </th>
                <th class="text-left">
                  英文名称
                </th>
                <th class="text-left">
                  中文名称
                </th>
                <th class="text-left">
                  数量
                </th>
                <th class="text-center">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in form.products"
                :key="idx"
              >
                <td class="package-product-table__cell-sku">
                  <AppAutocomplete
                    v-model="row.id"
                    :items="skuOptions"
                    item-title="title"
                    item-value="value"
                    placeholder="请选择 SKU（支持搜索）"
                    density="compact"
                    hide-details
                    :custom-filter="skuSearchFilter"
                    auto-select-first
                    :loading="productLoading"
                    :disabled="isDetail || pageBlocking"
                    @update:model-value="syncSkuMeta(row)"
                  />
                </td>
                <td class="package-product-table__cell-text">
                  <AppTextField
                    v-model="row.enSku"
                    density="compact"
                    hide-details
                    readonly
                    :disabled="isDetail || pageBlocking"
                  />
                </td>
                <td class="package-product-table__cell-text">
                  <AppTextField
                    v-model="row.cnName"
                    density="compact"
                    hide-details
                    readonly
                    :disabled="isDetail || pageBlocking"
                  />
                </td>
                <td class="package-product-table__cell-qty">
                  <AppTextField
                    v-model="row.qty"
                    type="number"
                    density="compact"
                    hide-details
                    :disabled="isDetail || pageBlocking"
                  />
                </td>
                <td class="text-center package-product-table__cell-action">
                  <IconBtn
                    color="error"
                    :disabled="isDetail || pageBlocking || form.products.length <= 1"
                    @click="removeProduct(idx)"
                  >
                    <VIcon icon="tabler-trash" />
                  </IconBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
          <div class="text-caption text-medium-emphasis mt-2">
            共 {{ form.products.length }} 条货品，至少保留 1 条。
          </div>
        </PrintLabelSectionCard>
      </VForm>

      <VCard
        v-if="!isDetail"
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            prepend-icon="tabler-device-floppy"
            :loading="submitting"
            :disabled="pageBlocking"
            @click="submitForm"
          >
            提交入库单
          </VBtn>
        </VCardText>
      </VCard>
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

.package-product-table__cell-sku {
  min-width: 22rem;
}

.package-product-table__cell-text {
  min-width: 14rem;
}

.package-product-table__cell-qty {
  min-width: 9rem;
}

.package-product-table__cell-action {
  min-width: 4.75rem;
}

.package-product-table :deep(.v-field--disabled),
.package-product-table :deep(.v-field[readonly]) {
  background: rgba(var(--v-theme-on-surface), 0.03);
}
</style>
