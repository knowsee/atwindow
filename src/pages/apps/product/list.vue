<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { downloadXlsx, EXPORT_PAGE_SIZE, makeExportBasename } from '@/utils/exportXlsx'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(true)
const batchPrinting = ref(false)
const tableRows = ref([])
const selectedRows = ref([])
const categories = ref([])
const router = useRouter()

const pagination = reactive({
  page: 1,
  perPage: 10,
  total: 0,
})

const filters = reactive({
  'en_sku': '',
  'cn_name': '',
  'cat_id': null,
})

const snack = ref({
  show: false,
  text: '',
  color: 'info',
})

const deletingId = ref(0)
const previewVisible = ref(false)
const previewImage = ref('')
const exporting = ref(false)

const headers = [
  { title: 'SKU', key: 'en_sku', width: 160 },
  { title: '产品名', key: 'cn_name', minWidth: 220 },
  { title: '英文品牌', key: 'en_brand', width: 130 },
  { title: '重量(KG)', key: 'weight', width: 110 },
  { title: '长*宽*高(CM)', key: 'lwh', width: 170, align: 'center' },
  { title: '原产地', key: 'original_places', width: 130 },
  { title: '产品分类', key: 'cat_name', width: 130 },
  { title: '总库存', key: 'number', width: 100, align: 'end' },
  { title: '图片', key: 'img_url', width: 100, align: 'center' },
  { title: '状态', key: 'status', width: 100, align: 'center' },
  { title: '操作', key: 'actions', width: 80, align: 'center', sortable: false },
]

const categoryItems = computed(() => [
  { title: '全部分类', value: null },
  ...categories.value.map(item => ({
    title: String(item.cn_en_name || ''),
    value: Number(item.id),
  })).filter(item => item.title && Number.isFinite(item.value)),
])

const pageCount = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.perPage)))
const tableLoading = computed(() => loading.value || batchPrinting.value)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function normalizeTableRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(item => ({
    ...item,
    id: Number(item.id),
    lwh: `${item.length || 0}*${item.width || 0}*${item.height || 0}`,
    statusEnabled: item.status === '正常' || Number(item.status) === 1,
  }))
}

async function fetchCategoryList() {
  const parseCategoryRows = payload => {
    if (Array.isArray(payload))
      return payload
    if (Array.isArray(payload?.data))
      return payload.data
    if (Array.isArray(payload?.list))
      return payload.list
    
    return []
  }

  try {
    const res = await $api('/product/category', { method: 'POST', body: {} })
    if (Number(res?.code) === 1) {
      categories.value = parseCategoryRows(res?.data)
      
      return
    }
  }
  catch {
    // ignore and fallback to GET below
  }

  // Some environments expose category as GET endpoint.
  try {
    const res = await $api('/product/category', { method: 'GET' })
    if (Number(res?.code) === 1)
      categories.value = parseCategoryRows(res?.data)
    else
      toast(res?.msg || '加载产品分类失败', 'warning')
  }
  catch {
    toast('加载产品分类失败', 'warning')
  }
}

function buildListBody(pageNum, perPageNum) {
  return {
    'current_page': pageNum,
    'per_page_num': perPageNum,
    'en_sku': filters['en_sku'] || '',
    'cn_name': filters['cn_name'] || '',
    'cat_id': filters['cat_id'] || '',
  }
}

async function fetchProductList() {
  loading.value = true
  try {
    const res = await $api('/product/all', {
      method: 'POST',
      body: buildListBody(pagination.page, pagination.perPage),
    })

    if (Number(res?.code) === 1) {
      tableRows.value = normalizeTableRows(res?.data?.data)
      pagination.total = Number(res?.data?.count || 0)
      
      return
    }

    toast(res?.msg || '加载产品列表失败', 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '加载产品列表失败', 'error')
  }
  finally {
    loading.value = false
  }
}

async function exportToExcel() {
  if (exporting.value)
    return

  exporting.value = true
  try {
    const res = await $api('/product/all', {
      method: 'POST',
      body: buildListBody(1, EXPORT_PAGE_SIZE),
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      toast(res?.msg || '获取导出数据失败', 'error')

      return
    }

    const raw = Array.isArray(res.data.data) ? res.data.data : []
    if (!raw.length) {
      toast('当前条件下无数据可导出', 'warning')

      return
    }

    const rows = raw.map(item => ({
      'en_sku': item.en_sku ?? '',
      'cn_name': item.cn_name ?? '',
      'en_brand': item.en_brand ?? '',
      'weight': item.weight ?? '',
      'lwh': `${item.length || 0}*${item.width || 0}*${item.height || 0}`,
      'original_places': item.original_places ?? '',
      'cat_name': item.cat_name ?? '',
      'number': item.number ?? '',
      'img_url': item.img_url ?? '',
      'status': item.status ?? '',
    }))

    await downloadXlsx({
      filename: makeExportBasename('产品列表'),
      sheetName: '产品列表',
      columns: [
        { key: 'en_sku', title: 'SKU' },
        { key: 'cn_name', title: '产品名' },
        { key: 'en_brand', title: '英文品牌' },
        { key: 'weight', title: '重量(KG)' },
        { key: 'lwh', title: '长*宽*高(CM)' },
        { key: 'original_places', title: '原产地' },
        { key: 'cat_name', title: '产品分类' },
        { key: 'number', title: '总库存' },
        { key: 'img_url', title: '图片链接' },
        { key: 'status', title: '状态' },
      ],
      rows,
    })
    toast(`已导出 ${rows.length} 条（单次最多 ${EXPORT_PAGE_SIZE} 条）`, 'success')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '导出失败', 'error')
  }
  finally {
    exporting.value = false
  }
}

function searchList() {
  pagination.page = 1
  fetchProductList()
}

function resetSearch() {
  filters['en_sku'] = ''
  filters['cn_name'] = ''
  filters['cat_id'] = null
  pagination.page = 1
  fetchProductList()
}

async function toggleStatus(row) {
  const path = row.statusEnabled ? '/product/able' : '/product/disable'
  try {
    const res = await $api(path, { method: 'POST', body: { id: row.id } })
    if (Number(res?.code) !== 1)
      throw new Error(res?.msg || '状态切换失败')
    toast(res?.msg || '状态更新成功', 'success')
  }
  catch (error) {
    row.statusEnabled = !row.statusEnabled
    toast(error?.message || '状态切换失败', 'error')
  }
}

async function deleteOne(id) {
  if (deletingId.value)
    return
  deletingId.value = id
  try {
    const res = await $api('/product/del', {
      method: 'POST',
      body: { id },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '删除成功', 'success')
      fetchProductList()
    }
    else {
      toast(res?.msg || '删除失败', 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '删除失败', 'error')
  }
  finally {
    deletingId.value = 0
  }
}

function openProductForm(mode, id) {
  const query = mode === 'create' ? {} : { type: mode, id: String(id) }

  router.push({ path: '/apps/product/create', query })
}

function openProductBatchPage() {
  router.push('/apps/product/batch')
}

async function printOne(id) {
  try {
    const res = await $api('/product/proDayin', { method: 'POST', body: { id } })
    if (Number(res?.code) === 1 && res?.data?.pdf_url)
      window.open(resolveBackendFileUrl(res.data.pdf_url), '_blank', 'noopener')
    else
      toast(res?.msg || '打印失败', 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '打印失败', 'error')
  }
}

async function batchPrint() {
  if (batchPrinting.value)
    return

  const ids = selectedRows.value
    .map(item => {
      if (typeof item === 'object' && item !== null)
        return Number(item.id)
      
      return Number(item)
    })
    .filter(Boolean)

  if (!ids.length) {
    toast('请先选择要批量打印的数据', 'warning')
    
    return
  }

  batchPrinting.value = true

  try {
    const res = await $api('/product/proBatchDayin', {
      method: 'POST',
      body: { str: `${ids.join(',')},` },
    })

    if (Number(res?.code) === 1 && res?.data?.pdf_url)
      window.open(resolveBackendFileUrl(res.data.pdf_url), '_blank', 'noopener')
    else
      toast(res?.msg || '批量打印失败', 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '批量打印失败', 'error')
  }
  finally {
    batchPrinting.value = false
  }
}

function openPreview(url) {
  if (!url)
    return
  previewImage.value = String(url)
  previewVisible.value = true
}

watch(() => [pagination.page, pagination.perPage], fetchProductList)

onMounted(async () => {
  await fetchCategoryList()
  await fetchProductList()
})
</script>

<template>
  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2600"
  >
    {{ snack.text }}
  </VSnackbar>

  <VCard class="rounded-lg">
    <VCardItem class="pb-3">
      <template #title>
        <span class="text-h5 font-weight-medium">产品列表</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2">
          <VBtn
            variant="tonal"
            size="small"
            prepend-icon="tabler-copy-plus"
            @click="openProductBatchPage"
          >
            批量新增
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            @click="openProductForm('create')"
          >
            新建产品
          </VBtn>
        </div>
      </template>
    </VCardItem>
    <VDivider />
    <VCardText class="pa-4 pa-sm-6">
      <AppQueryPanel
        class="mb-4"
        :loading="loading"
        actions-position="bottom"
        @search="searchList"
        @reset="resetSearch"
      >
        <template #export>
          <VBtn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="tabler-file-export"
            :loading="exporting"
            :disabled="loading"
            @click="exportToExcel"
          >
            导出 Excel
          </VBtn>
        </template>
        <VRow dense>
          <VCol
            cols="12"
            sm="6"
            lg="4"
          >
            <AppTextField
              v-model="filters.en_sku"
              label="SKU"
              density="compact"
              hide-details
              placeholder="输入 SKU"
              @keyup.enter="searchList"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            lg="4"
          >
            <AppTextField
              v-model="filters.cn_name"
              label="产品名"
              density="compact"
              hide-details
              placeholder="输入产品名"
              @keyup.enter="searchList"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            lg="4"
          >
            <AppSelect
              v-model="filters.cat_id"
              :items="categoryItems"
              item-title="title"
              item-value="value"
              label="产品分类"
              density="compact"
              hide-details
              clearable
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <VDataTable
        v-model="selectedRows"
        :headers="headers"
        :items="tableRows"
        :loading="tableLoading"
        show-select
        item-value="id"
      >
        <template #top>
          <div class="d-flex justify-end px-4 pt-3">
            <VBtn
              v-if="selectedRows.length > 0"
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-printer"
              :loading="batchPrinting"
              :disabled="batchPrinting"
              @click="batchPrint"
            >
              批量打印 ({{ selectedRows.length }})
            </VBtn>
          </div>
        </template>

        <template #item.img_url="{ item }">
          <VAvatar
            v-if="item.img_url"
            size="42"
            rounded="lg"
            class="cursor-pointer"
            @click="openPreview(item.img_url)"
          >
            <VImg
              :src="item.img_url"
              cover
            />
          </VAvatar>
          <span
            v-else
            class="text-disabled"
          >无图</span>
        </template>

        <template #item.status="{ item }">
          <VSwitch
            v-model="item.statusEnabled"
            color="primary"
            hide-details
            density="compact"
            @update:model-value="toggleStatus(item)"
          />
        </template>

        <template #item.actions="{ item }">
          <VMenu>
            <template #activator="{ props }">
              <IconBtn v-bind="props">
                <VIcon icon="tabler-dots-vertical" />
              </IconBtn>
            </template>
            <VList density="compact">
              <VListItem
                title="编辑"
                prepend-icon="tabler-edit"
                @click="openProductForm('edit', item.id)"
              />
              <VListItem
                title="查看"
                prepend-icon="tabler-eye"
                @click="openProductForm('detail', item.id)"
              />
              <VListItem
                title="打印"
                prepend-icon="tabler-printer"
                @click="printOne(item.id)"
              />
              <VListItem
                title="删除"
                prepend-icon="tabler-trash"
                base-color="error"
                @click="() => window.confirm('删除后不可恢复，确定继续吗？') && deleteOne(item.id)"
              />
            </VList>
          </VMenu>
        </template>

        <template #bottom>
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
            <div class="text-body-2 text-medium-emphasis">
              共 {{ pagination.total }} 条
            </div>
            <div class="d-flex align-center gap-3">
              <AppSelect
                v-model="pagination.perPage"
                :items="[10, 20, 50, 100, 200, 300, 500, 1000]"
                density="compact"
                style="min-inline-size: 120px"
              />
              <VPagination
                v-model="pagination.page"
                :length="pageCount"
                rounded
              />
            </div>
          </div>
        </template>
      </VDataTable>
    </VCardText>
  </VCard>

  <VDialog
    v-model="previewVisible"
    max-width="900"
  >
    <VCard class="rounded-lg">
      <VCardItem class="pb-2">
        <template #title>
          <span class="text-subtitle-1 font-weight-medium">图片预览</span>
        </template>
        <template #append>
          <IconBtn @click="previewVisible = false">
            <VIcon icon="tabler-x" />
          </IconBtn>
        </template>
      </VCardItem>
      <VCardText class="pt-2">
        <VImg
          :src="previewImage"
          max-height="70vh"
          contain
          class="bg-grey-100 rounded"
        />
      </VCardText>
    </VCard>
  </VDialog>
</template>

