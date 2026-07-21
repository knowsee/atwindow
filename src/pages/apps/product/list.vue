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
const { t } = useI18n({ useScope: 'global' })

const FILTERS_CACHE_KEY = 'product-list-filters'

function getDefaultFilters() {
  return {
    'en_sku': '',
    'cn_name': '',
    'cat_id': null,
  }
}

function loadCachedFilters() {
  try {
    const raw = sessionStorage.getItem(FILTERS_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)

      return { ...getDefaultFilters(), ...parsed }
    }
  }
  catch {}

  return null
}

function saveCachedFilters(f) {
  try {
    sessionStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(f))
  }
  catch {}
}

function clearCachedFilters() {
  try {
    sessionStorage.removeItem(FILTERS_CACHE_KEY)
  }
  catch {}
}

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
const PRODUCT_STATUS_NORMAL = '\u6b63\u5e38'

const headers = computed(() => [
  { title: t('pages.productList.headers.sku'), key: 'en_sku', width: 160 },
  { title: t('pages.productList.headers.name'), key: 'cn_name', minWidth: 220 },
  { title: t('pages.productList.headers.brand'), key: 'en_brand', width: 130 },
  { title: t('pages.productList.headers.weight'), key: 'weight', width: 110 },
  { title: t('pages.productList.headers.lwh'), key: 'lwh', width: 170, align: 'center' },
  { title: t('pages.productList.headers.origin'), key: 'original_places', width: 130 },
  { title: t('pages.productList.headers.category'), key: 'cat_name', width: 130 },
  { title: t('pages.productList.headers.image'), key: 'img_url', width: 100, align: 'center' },
  { title: t('pages.productList.headers.status'), key: 'status', width: 100, align: 'center' },
  { title: t('pages.productList.headers.actions'), key: 'actions', width: 140, align: 'end', sortable: false },
])

const categoryItems = computed(() => [
  { title: t('pages.productList.filters.allCategories'), value: null },
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
    statusEnabled: item.status === PRODUCT_STATUS_NORMAL || Number(item.status) === 1,
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
      toast(res?.msg || t('pages.productList.messages.categoryLoadFailed'), 'warning')
  }
  catch {
    toast(t('pages.productList.messages.categoryLoadFailed'), 'warning')
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

    toast(res?.msg || t('pages.productList.messages.listLoadFailed'), 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productList.messages.listLoadFailed'), 'error')
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
      toast(res?.msg || t('pages.productList.messages.exportFetchFailed'), 'error')

      return
    }

    const raw = Array.isArray(res.data.data) ? res.data.data : []
    if (!raw.length) {
      toast(t('pages.productList.messages.exportNoData'), 'warning')

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
      'img_url': item.img_url ?? '',
      'status': item.status ?? '',
    }))

    await downloadXlsx({
      filename: makeExportBasename(t('pages.productList.title')),
      sheetName: t('pages.productList.title'),
      columns: [
        { key: 'en_sku', title: t('pages.productList.headers.sku') },
        { key: 'cn_name', title: t('pages.productList.headers.name') },
        { key: 'en_brand', title: t('pages.productList.headers.brand') },
        { key: 'weight', title: t('pages.productList.headers.weight') },
        { key: 'lwh', title: t('pages.productList.headers.lwh') },
        { key: 'original_places', title: t('pages.productList.headers.origin') },
        { key: 'cat_name', title: t('pages.productList.headers.category') },
        { key: 'img_url', title: t('pages.productList.headers.imageUrl') },
        { key: 'status', title: t('pages.productList.headers.status') },
      ],
      rows,
    })
    toast(t('pages.productList.messages.exportSuccess', { count: rows.length, max: EXPORT_PAGE_SIZE }), 'success')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productList.messages.exportFailed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

function searchList() {
  saveCachedFilters({ ...filters })
  pagination.page = 1
  fetchProductList()
}

function resetSearch() {
  clearCachedFilters()
  Object.assign(filters, getDefaultFilters())
  pagination.page = 1
  fetchProductList()
}

async function toggleStatus(row) {
  const path = row.statusEnabled ? '/product/able' : '/product/disable'
  try {
    const res = await $api(path, { method: 'POST', body: { id: row.id } })
    if (Number(res?.code) !== 1)
      throw new Error(res?.msg || t('pages.productList.messages.statusToggleFailed'))
    toast(res?.msg || t('pages.productList.messages.statusUpdated'), 'success')
  }
  catch (error) {
    row.statusEnabled = !row.statusEnabled
    toast(error?.message || t('pages.productList.messages.statusToggleFailed'), 'error')
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
      toast(res?.msg || t('pages.productList.messages.deleteSuccess'), 'success')
      fetchProductList()
    }
    else {
      toast(res?.msg || t('pages.productList.messages.deleteFailed'), 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productList.messages.deleteFailed'), 'error')
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
      toast(res?.msg || t('pages.productList.messages.printFailed'), 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productList.messages.printFailed'), 'error')
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
    toast(t('pages.productList.messages.batchPrintEmpty'), 'warning')
    
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
      toast(res?.msg || t('pages.productList.messages.batchPrintFailed'), 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.productList.messages.batchPrintFailed'), 'error')
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
  const cached = loadCachedFilters()
  if (cached)
    Object.assign(filters, cached)
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
        <span class="text-h5 font-weight-medium">{{ $t('pages.productList.title') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2">
          <VBtn
            variant="tonal"
            size="small"
            prepend-icon="tabler-copy-plus"
            @click="openProductBatchPage"
          >
            {{ $t('pages.productList.batchCreate') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            @click="openProductForm('create')"
          >
            {{ $t('pages.productList.create') }}
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
            {{ $t('pages.productList.exportExcel') }}
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
              :label="$t('pages.productList.filters.sku')"
              density="compact"
              hide-details
              :placeholder="$t('pages.productList.filters.skuPlaceholder')"
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
              :label="$t('pages.productList.filters.name')"
              density="compact"
              hide-details
              :placeholder="$t('pages.productList.filters.namePlaceholder')"
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
              :label="$t('pages.productList.filters.category')"
              density="compact"
              hide-details
              clearable
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <VDataTable
        disable-sort
        v-model="selectedRows"
        :headers="headers"
        :items="tableRows"
        :loading="tableLoading"
        :items-per-page="-1"
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
              {{ $t('pages.productList.actions.batchPrint', { count: selectedRows.length }) }}
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
          >{{ $t('pages.productList.noImage') }}</span>
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
          <div class="d-flex align-center justify-end gap-1">
            <VTooltip :text="$t('pages.productList.actions.view')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="secondary"
                  @click="openProductForm('detail', item.id)"
                >
                  <VIcon
                    icon="tabler-eye"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VTooltip :text="$t('pages.productList.actions.edit')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="primary"
                  @click="openProductForm('edit', item.id)"
                >
                  <VIcon
                    icon="tabler-pencil"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VMenu>
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="secondary"
                >
                  <VIcon
                    icon="tabler-dots-vertical"
                    size="20"
                  />
                </IconBtn>
              </template>
              <VList density="compact">
                <VListItem
                  :title="$t('pages.productList.actions.print')"
                  prepend-icon="tabler-printer"
                  @click="printOne(item.id)"
                />
                <VListItem
                  :title="$t('pages.productList.actions.delete')"
                  prepend-icon="tabler-trash"
                  base-color="error"
                  @click="() => window.confirm($t('pages.productList.messages.deleteConfirm')) && deleteOne(item.id)"
                />
              </VList>
            </VMenu>
          </div>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
            <div class="text-body-2 text-medium-emphasis">
              {{ $t('pages.productList.total', { total: pagination.total }) }}
            </div>
            <div class="d-flex align-center gap-3">
              <AppSelect
                v-model="pagination.perPage"
                :items="[10, 20, 50, 100, 200, 500]"
                density="compact"
                hide-details
                style="inline-size: 100px"
              />
              <VPagination
                v-model="pagination.page"
                :length="pageCount"
                :total-visible="5"
                active-color="primary"
                size="small"
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
          <span class="text-subtitle-1 font-weight-medium">{{ $t('pages.productList.previewTitle') }}</span>
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

