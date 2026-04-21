<script setup>
import { $api, $apiJson } from '@/utils/api'
import { getPreferredWarehouseId, resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadCountryOptions, loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
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

/** 创建页：等待仓库/国家/SKU 等首屏接口 */
const initialLoading = ref(true)
const submitting = ref(false)
const estimating = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })
const formRef = ref()

const mode = computed(() => String(route.query.mode || 'create'))
const isDetail = computed(() => mode.value === 'detail')
const isCopy = computed(() => mode.value === 'copy')
const sourceId = computed(() => Number(route.query.id || 0) || null)
const editingId = computed(() => (mode.value === 'edit' ? sourceId.value : null))

const warehouseOptions = ref([])
const warehousePersistReady = ref(false)
const countryOptions = ref([])
const skuOptions = ref([])
const addrDialog = ref(false)
const addrLoading = ref(false)
const addrRows = ref([])
const addrTotal = ref(0)
const addrPage = ref(1)
const addrPageSize = ref(10)
const addrSearchName = ref('')

const pageBlocking = computed(() => loading.value || initialLoading.value)

const pageOverlayMessage = computed(() => {
  if (loading.value)
    return '正在读取订单详情...'

  if (initialLoading.value)
    return '正在加载仓库、国家与货品数据...'

  return '正在加载...'
})

const pageTitle = computed(() => {
  if (isDetail.value && sourceId.value) {
    const refText = String(form.value.cankaohao || '').trim()

    return `正在查看 【${refText || '—'}】`
  }
  if (editingId.value)
    return '编辑订单'
  if (isCopy.value)
    return '复制订单'

  return '创建订单'
})

const pageSubtitle = computed(() => {
  if (isDetail.value)
    return '以下为只读信息，不可修改。'

  return '填写收件信息、线路与货品明细后提交订单。'
})

const transportOptions = [
  { title: '自动渠道选择（试运行）', value: 99999 },
  { title: '自提', value: 200 },
  { title: 'USPS（T5）', value: 27 },
  { title: 'SPEEDX', value: 53 },
  { title: 'Amazon', value: 56 },
  { title: 'UPS Ground（限重1-150磅，2-6个工作日签收）', value: 50 },
  { title: 'Fedex（限重1-150磅，2-6个工作日签收）', value: 59 },
  { title: 'Gofo', value: 210 },
  { title: 'UNI（重量≤13.5kg，最小尺寸:10*15cm，单边不得超过50cm，三边之和不得超过120cm）', value: 211 },
  { title: 'NEXTDAY（限重50磅）', value: 213 },
  { title: 'USPS-Y（限重5磅）', value: 214 },
]

const cartonOptions = [
  { title: '不需要', value: 0 },
  { title: '纸箱 - (15(in) * 15(in) * 24(in)) = 4$', value: 12 },
  { title: '纸箱 - (16(in) * 18(in) * 12(in)) = 4$', value: 19 },
  { title: '纸箱 - (16(in) * 12(in) * 6(in)) = 1.5$', value: 27 },
  { title: '纸箱 - (22(in) * 18(in) * 12(in)) = 5$', value: 20 },
  { title: '纸箱 - (24(in) * 18(in) * 12(in)) = 5$', value: 21 },
  { title: '气泡袋 - (28(cm) * 22(cm)) = 0.6$', value: 22 },
  { title: '气泡袋 - (23(cm) * 13(cm)) = 0.5$', value: 23 },
  { title: '快递袋 - (61(cm) * 61(cm)) = 0.6$', value: 24 },
  { title: '快递袋 - (34(cm) * 26(cm)) = 0.5$', value: 25 },
  { title: '快递袋 - (23(cm) * 16(cm)) = 0.4$', value: 26 },
]

const form = ref({
  cankaohao: '',
  warehouseId: null,
  transportType: 99999,
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
  router.push({ name: 'apps-drop-shipping-order-list' })
}

function addProduct() {
  form.value.products.push({ id: '', enSku: '', cnName: '', goodsNum: 1 })
}

function removeProduct(index) {
  if (form.value.products.length <= 1)
    return
  form.value.products.splice(index, 1)
}

async function loadSkuOptions() {
  const res = await $api('/package/getSku', { method: 'POST', body: {} })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.en_sku || ''} ${item.cn_name ? `(${item.cn_name})` : ''}`.trim(),
    value: item.en_sku,
    enSku: item.en_sku || '',
    cnName: item.cn_name || '',
  })).filter(item => item.value)
}

function skuSearchFilter(_, queryText, item) {
  const query = String(queryText || '').trim().toLowerCase()
  if (!query)
    return true

  const raw = item?.raw || {}
  const target = `${raw.enSku || ''} ${raw.cnName || ''} ${raw.title || ''}`.toLowerCase()

  return target.includes(query)
}

function syncSkuMeta(row) {
  const hit = skuOptions.value.find(item => String(item.value) === String(row.id))
  if (!hit)
    return

  row.enSku = hit.enSku
  row.cnName = hit.cnName
}

function openAddrDialog() {
  addrDialog.value = true
  addrPage.value = 1
  loadAddrPage()
}

async function loadAddrPage() {
  addrLoading.value = true
  try {
    const body = {
      type: 2,
      'current_page': addrPage.value,
      'per_page_num': addrPageSize.value,
    }

    if (addrSearchName.value.trim())
      body.name = addrSearchName.value.trim()

    const res = await $api('/order/queryAddr', { method: 'POST', body })

    if (Number(res?.code) === 1 && res?.data) {
      addrRows.value = Array.isArray(res.data.data) ? res.data.data : []
      addrTotal.value = Number(res.data.count) || 0
    }
    else {
      addrRows.value = []
      addrTotal.value = 0
      toast(res?.msg || '加载地址失败', 'error')
    }
  }
  catch (e) {
    addrRows.value = []
    addrTotal.value = 0
    toast(e?.data?.msg || e?.message || '加载地址失败', 'error')
  }
  finally {
    addrLoading.value = false
  }
}

function searchAddrDialog() {
  addrPage.value = 1
  loadAddrPage()
}

function selectAddressRow(row) {
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
  toast('已填入收件地址', 'success')
}

function buildPayload() {
  return {
    cankaohao: form.value.cankaohao.trim(),
    'warehouse_id': Number(form.value.warehouseId),
    'transport_type': Number(form.value.transportType),
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
      'goods_value': 0,
    })).filter(row => row['en_sku'] && row['goods_num'] > 0),
  }
}

async function loadDetail(withLoading = true) {
  if (!sourceId.value)
    return

  if (withLoading)
    loading.value = true
  try {
    const res = await $api('/order/detail', {
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
        cartonType: Number(orderInfo.carton_type || 1),
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
    }
    else {
      toast(res?.msg || '加载订单详情失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '加载订单详情失败', 'error')
  }
  finally {
    if (withLoading)
      loading.value = false
  }
}

async function estimateCost() {
  const payload = buildPayload()
  if (!payload.product_info.length) {
    toast('请先填写货品明细', 'warning')
    
    return
  }

  estimating.value = true
  try {
    const res = await $api('/order/addGuSuan', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1)
      toast(`预估费用：${res?.data?.money || 0}`, 'success')
    else
      toast(res?.msg || '估算失败', 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '估算失败', 'error')
  }
  finally {
    estimating.value = false
  }
}

async function submitForm() {
  const { valid } = await formRef.value.validate()
  if (!valid || isDetail.value)
    return

  const payload = buildPayload()
  if (!payload.product_info.length) {
    toast('请至少填写一条有效货品明细', 'warning')
    
    return
  }

  submitting.value = true
  try {
    const endpoint = editingId.value ? '/order/edit' : '/order/add'
    const body = editingId.value ? { ...payload, id: editingId.value } : payload

    const res = await $apiJson(endpoint, {
      method: 'POST',
      body,
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
  const shouldPreload = !!sourceId.value
  if (shouldPreload)
    loading.value = true

  try {
    if (!sourceId.value) {
      const cachedWarehouseId = getPreferredWarehouseId()
      if (cachedWarehouseId != null)
        form.value.warehouseId = cachedWarehouseId
    }

    warehouseOptions.value = await loadWarehouseOptions()
    countryOptions.value = await loadCountryOptions()
    skuOptions.value = await loadSkuOptions()
    await loadDetail(!shouldPreload)
    if (!sourceId.value)
      form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
    if (isCopy.value)
      form.value.cankaohao = ''
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
          title="收件人信息"
          subtitle="用于生成面单"
          class="mb-4"
        >
          <template #append>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-address-book"
              class="text-none"
              :disabled="isDetail || pageBlocking"
              @click="openAddrDialog"
            >
              选择地址
            </VBtn>
          </template>
          <VRow>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.name"
                label="收件人"
                :rules="[v => !!String(v || '').trim() || '请输入收件人']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.telephone"
                label="联系电话"
                :rules="[v => !!String(v || '').trim() || '请输入联系电话']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppSelect
                v-model="form.receiver.country"
                :items="countryOptions"
                item-title="title"
                item-value="value"
                label="国家"
                :rules="[v => !!v || '请选择国家']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.province"
                label="省/州"
                :rules="[v => !!String(v || '').trim() || '请输入省/州']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.city"
                label="城市"
                :rules="[v => !!String(v || '').trim() || '请输入城市']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.postcode"
                label="邮编"
                :rules="[v => !!String(v || '').trim() || '请输入邮编']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="8"
            >
              <AppTextField
                v-model="form.receiver.address"
                label="地址1"
                :rules="[v => !!String(v || '').trim() || '请输入地址']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.receiver.address2"
                label="地址2"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="物流信息"
          subtitle="线路、仓库与包装"
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
                label="线路"
                :rules="[v => !!v || '请选择线路']"
                :disabled="isDetail || pageBlocking"
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
                label="仓库"
                :rules="[v => !!v || '请选择仓库']"
                :disabled="isDetail || pageBlocking"
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
                label="包装材料"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              v-if="isSelfPickup"
              cols="12"
              md="4"
            >
              <div class="text-caption text-medium-emphasis mb-2">
                上传附件（主文件）
              </div>
              <OrderFileUploadCard
                v-model="form.fnskuFileXb"
                :disabled="isDetail || pageBlocking"
                @uploaded="toast('附件上传成功', 'success')"
                @error="msg => toast(msg || '附件上传失败', 'error')"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="订单信息"
          subtitle="参考单号、备注与货品信息"
          class="mb-4"
        >
          <VRow>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.cankaohao"
                label="参考单号"
                :rules="[v => !!String(v || '').trim() || '请输入参考单号']"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="form.remark"
                label="备注"
                :disabled="isDetail || pageBlocking"
              />
            </VCol>
          </VRow>
          <template #append>
            <VBtn
              color="primary"
              size="small"
              variant="tonal"
              prepend-icon="tabler-plus"
              :disabled="isDetail || pageBlocking"
              @click="addProduct"
            >
              添加货品
            </VBtn>
          </template>
          <div class="text-subtitle-1 font-weight-medium mt-2 mb-2">
            货品信息
          </div>
          <VTable
            density="comfortable"
            class="mt-2 package-product-table"
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
                  />
                </td>
                <td class="package-product-table__cell-text">
                  <AppTextField
                    v-model="row.cnName"
                    density="compact"
                    hide-details
                    readonly
                  />
                </td>
                <td class="package-product-table__cell-qty">
                  <AppTextField
                    v-model="row.goodsNum"
                    type="number"
                    density="compact"
                    hide-details
                    :disabled="isDetail || pageBlocking"
                  />
                </td>
                <td class="text-center package-product-table__cell-action">
                  <IconBtn
                    color="error"
                    :disabled="isDetail || form.products.length <= 1"
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
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            prepend-icon="tabler-send"
            :loading="submitting"
            :disabled="isDetail || pageBlocking"
            @click="submitForm"
          >
            提交订单
          </VBtn>
        </VCardText>
      </VCard>
    </FormPageLoadingOverlay>

    <VDialog
      v-model="addrDialog"
      max-width="900"
      scrollable
    >
      <VCard>
        <VCardTitle class="text-h6">
          选择收件地址
        </VCardTitle>
        <VDivider />
        <VCardText>
          <div class="d-flex flex-wrap gap-2 mb-4">
            <AppTextField
              v-model="addrSearchName"
              label="按姓名筛选"
              density="compact"
              hide-details
              style="min-inline-size: 200px;"
              @keyup.enter="searchAddrDialog"
            />
            <VBtn
              variant="tonal"
              size="small"
              class="text-none"
              @click="searchAddrDialog"
            >
              查询
            </VBtn>
          </div>
          <VDataTable
            :headers="[
              { title: '姓名', key: 'name' },
              { title: '地址', key: 'address' },
              { title: '邮编', key: 'postcode', width: '120' },
              { title: '操作', key: 'actions', sortable: false, width: '100', align: 'center' },
            ]"
            :items="addrRows"
            :loading="addrLoading"
            density="comfortable"
            class="text-body-2"
          >
            <template #item.address="{ item }">
              <span
                class="text-truncate d-inline-block"
                style="max-inline-size: 360px;"
                :title="item.address"
              >{{ item.address || '—' }}</span>
            </template>
            <template #item.actions="{ item }">
              <VBtn
                size="small"
                variant="tonal"
                color="primary"
                class="text-none"
                @click="selectAddressRow(item)"
              >
                选择
              </VBtn>
            </template>
            <template #bottom>
              <div class="d-flex align-center justify-end gap-2 pa-3">
                <VPagination
                  v-model="addrPage"
                  :length="Math.max(1, Math.ceil(addrTotal / addrPageSize))"
                  :total-visible="7"
                  size="small"
                  @update:model-value="loadAddrPage"
                />
              </div>
            </template>
          </VDataTable>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="addrDialog = false"
          >
            关闭
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
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
</style>
