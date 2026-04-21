<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api, $apiJson } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
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

/** 创建页：等待仓库/国家/SKU；编辑页与 loadDetail 叠加 */
const initialLoading = ref(true)
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

const mode = computed(() => String(route.query.mode || 'create'))
const isDetail = computed(() => mode.value === 'detail')
const isEdit = computed(() => mode.value === 'edit')
const editingId = computed(() => Number(route.query.id || 0) || null)

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
    return '正在加载订单详情...'

  if (initialLoading.value)
    return '正在加载仓库、国家与 SKU...'

  return '正在加载...'
})

const orderTypeItems = [
  { title: '贴标换标', value: 0 },
  { title: '不换标', value: 1 },
]

const cartonTypeItems = [
  { title: '不需要', value: 0 },
  { title: '纸箱 - (15×15×24 in) = 4$', value: 12 },
  { title: '纸箱 - (16×18×12 in) = 4$', value: 19 },
  { title: '纸箱 - (16×12×6 in) = 1.5$', value: 27 },
  { title: '纸箱 - (22×18×12 in) = 5$', value: 20 },
  { title: '纸箱 - (24×18×12 in) = 5$', value: 21 },
  { title: '气泡袋 - (28×22 cm) = 0.6$', value: 22 },
  { title: '气泡袋 - (23×13 cm) = 0.5$', value: 23 },
  { title: '快递袋 - (61×61 cm) = 0.6$', value: 24 },
  { title: '快递袋 - (34×26 cm) = 0.5$', value: 25 },
  { title: '快递袋 - (23×16 cm) = 0.4$', value: 26 },
]

const signatureItems = [
  { title: '不需要', value: 0 },
  { title: '需要', value: 1 },
]

const transportItems = [
  { title: '自提（自己提供面单选此项）', value: 200 },
  { title: 'UPS', value: 50 },
]

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

/** 自提(200)：须上传用户自备面单 */
const isPickupTransport = computed(() => Number(valueAdd.value.transportType) === 200)

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

async function loadSkuOptions() {
  const res = await $api('/package/getSku', { method: 'POST', body: {} })
  if (Number(res?.code) !== 1 || !Array.isArray(res?.data))
    return []

  return res.data.map(item => ({
    title: `${item.en_sku || ''}_${item.cn_name || ''}`,
    value: item.en_sku,
  })).filter(item => item.value)
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
  toast('已填入收件地址', 'success')
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

  if (editingId.value)
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
      toast(res?.msg || '加载订单失败', 'error')

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
    toast(e?.data?.msg || e?.message || '加载订单失败', 'error')
  }
  finally {
    loading.value = false
  }
}

async function submitForm() {
  if (isDetail.value)
    return

  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  if (!Number(orderMeta.value.warehouseId)) {
    toast('请选择仓库', 'warning')

    return
  }

  if (!product.value.enSku.trim() || !product.value.bqCode.trim() || product.value.goodsNum == null || Number(product.value.goodsNum) <= 0) {
    toast('请完整填写 SKU、数量与标签编码', 'warning')

    return
  }

  if (!Number(valueAdd.value.transportType)) {
    toast('请选择运输方式', 'warning')

    return
  }

  const transportType = Number(valueAdd.value.transportType)
  const isPickup = transportType === 200

  if (!product.value.boxFileUrl.trim()) {
    toast('请上传箱标文件', 'warning')

    return
  }

  if (isPickup && !product.value.labelFileUrl.trim()) {
    toast('自提运输须上传面单（标签文件）', 'warning')

    return
  }

  submitting.value = true
  try {
    const body = buildSubmitBody()
    const endpoint = isEdit.value ? '/orderv2/edit' : '/orderv2/addOrderLabel'
    const res = await $apiJson(endpoint, { method: 'POST', body })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '提交成功', 'success')
      setTimeout(goList, 800)
    }
    else {
      toast(res?.msg || '提交失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '提交失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => orderMeta.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  try {
    warehouseOptions.value = await loadWarehouseOptions()
    countryOptions.value = await loadCountryOptionsLabel()
    skuOptions.value = await loadSkuOptions()
    await loadDetail()
    if (!editingId.value) {
      orderMeta.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, {
        preferFirstWhenNoCache: true,
      })
    }
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
          一件代发 · 换标
        </div>
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ isDetail ? '换标订单详情' : isEdit ? '编辑换标订单' : '创建换标订单' }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2 text-wrap">
          填写收件地址、仓库与货品信息；标签与箱标请上传后再提交。
        </p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <VBtn
          variant="tonal"
          prepend-icon="tabler-arrow-left"
          class="text-none"
          @click="goList"
        >
          返回列表
        </VBtn>
      </div>
    </div>

    <FormPageLoadingOverlay
      :loading="pageBlocking"
      :message="pageOverlayMessage"
    >
      <VForm
        ref="formRef"
        :disabled="pageBlocking || isDetail"
      >
        <PrintLabelSectionCard
          title="收件地址"
          subtitle="与面单一致的英文地址信息"
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
                v-model="receiver.name"
                label="姓名"
                :rules="[v => !!String(v || '').trim() || '请输入姓名']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="receiver.telephone"
                label="电话"
                :rules="[v => !!String(v || '').trim() || '请输入电话']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppSelect
                v-model="receiver.country"
                :items="countryOptions"
                item-title="title"
                item-value="value"
                label="国家"
                :rules="[v => !!v || '请选择国家']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="receiver.province"
                label="省/州"
                :rules="[v => !!String(v || '').trim() || '请输入省/州']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="receiver.city"
                label="城市"
                :rules="[v => !!String(v || '').trim() || '请输入城市']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="receiver.postCode"
                label="邮编"
                :rules="[v => !!String(v || '').trim() || '请输入邮编']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="8"
            >
              <AppTextField
                v-model="receiver.address"
                label="地址1"
                :rules="[v => !!String(v || '').trim() || '请输入地址']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="receiver.address2"
                label="地址2"
                hint="选填"
                persistent-hint
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="运输与仓库"
          subtitle="订单类型与仓库"
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
                label="运输方式"
                :rules="[v => v != null && Number(v) > 0 || '请选择运输方式']"
                :disabled="isDetail || pageBlocking"
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
                label="发货仓库"
                :rules="[v => v != null && v !== '' || '请选择仓库']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="货品与标签"
          subtitle="SKU、数量、标签编码及文件"
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
                label="SKU"
                clearable
                :rules="[v => !!String(v || '').trim() || '请选择或输入 SKU']"
                :disabled="isDetail || pageBlocking"
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
                label="数量"
                min="1"
                :rules="[v => v != null && Number(v) > 0 || '请输入数量']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="product.bqCode"
                label="标签编码"
                :rules="[v => !!String(v || '').trim() || '请输入标签编码']"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <div class="text-caption text-medium-emphasis mb-2">
                上传标签（面单）
                <span
                  v-if="isPickupTransport"
                  class="text-error"
                >（自提必填）</span>
                <span
                  v-else
                  class="text-medium-emphasis"
                >（选填）</span>
              </div>
              <OrderFileUploadCard
                v-model="product.labelFileUrl"
                :disabled="isDetail || pageBlocking"
                @uploaded="toast('标签文件已上传', 'success')"
                @error="msg => toast(msg || '上传失败', 'error')"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <div class="text-caption text-medium-emphasis mb-2">
                上传箱标
              </div>
              <OrderFileUploadCard
                v-model="product.boxFileUrl"
                :disabled="isDetail || pageBlocking"
                @uploaded="toast('箱标文件已上传', 'success')"
                @error="msg => toast(msg || '上传失败', 'error')"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>

        <PrintLabelSectionCard
          title="增值服务"
          subtitle="包材、签名与运输方式"
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
                label="订单类型"
                :disabled="isDetail || pageBlocking"
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
                label="包材"
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="orderMeta.remark"
                label="备注"
                hint="选填"
                persistent-hint
                :disabled="isDetail || pageBlocking"
                density="comfortable"
              />
            </VCol>
          </VRow>
        </PrintLabelSectionCard>
      </VForm>

      <VCard
        class="mt-2 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            variant="tonal"
            class="text-none"
            :disabled="pageBlocking"
            @click="goList"
          >
            取消
          </VBtn>
          <VBtn
            v-if="!isDetail"
            color="primary"
            prepend-icon="tabler-send"
            class="text-none"
            :loading="submitting"
            :disabled="pageBlocking"
            @click="submitForm"
          >
            {{ isEdit ? '保存修改' : '提交订单' }}
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
