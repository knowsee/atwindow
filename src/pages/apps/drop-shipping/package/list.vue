<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { DS_STATUS_ITEMS, normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)
const selectedIds = ref([])
const printingId = ref(null)
const snack = ref({ show: false, text: '', color: 'info' })

/** 与仪表盘等入口的 query：status、tracking_no（或 trackingNo）对齐 */
function parseRouteQueryToFilters(q) {
  const base = {
    status: 1,
    sku: '',
    trackingNo: '',
    timeRange: '',
  }

  if (q.status !== undefined && q.status !== null && String(q.status).trim() !== '') {
    const n = Number(q.status)
    if (Number.isFinite(n))
      base.status = n
  }

  const tr = q.tracking_no ?? q.trackingNo
  if (tr != null && String(tr).trim())
    base.trackingNo = String(tr).trim()

  return base
}

const filters = ref(parseRouteQueryToFilters(route.query))

const headers = [
  { title: '创建时间', key: 'createtime', width: '150', minWidth: '150' },
  { title: '仓库', key: 'warehouse_name', width: '140', minWidth: '120' },
  { title: '运单号', key: 'tracking_no', width: '200', minWidth: '160', maxWidth: '260' },
  { title: 'SKU', key: 'sku', width: '220', minWidth: '160', maxWidth: '320' },
  { title: '申报件数', key: 'sku_num', width: '100', minWidth: '88', maxWidth: '160' },
  { title: '实收件数', key: 'real_sku_num', width: '100', minWidth: '88', maxWidth: '160' },
  { title: '状态', key: 'statusStr', width: '120', minWidth: '110' },
  { title: '操作', key: 'actions', sortable: false, minWidth: '260', width: '280', align: 'end', fixed: 'end' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

/** 后端常用 &lt;br&gt; 拼接多值；不用 v-html，改为换行 + pre-line 展示 */
function normalizeCellBreaks(val) {
  if (val == null)
    return ''
  const s = String(val).replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n')

  return s.trim()
}

function cellDisplay(val) {
  const s = normalizeCellBreaks(val)

  return s || '—'
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
  }

  if (filters.value.status !== '' && filters.value.status != null)
    body.status = Number(filters.value.status)
  if (filters.value.sku.trim())
    body.sku = filters.value.sku.trim()
  if (filters.value.trackingNo.trim())
    body['tracking_no'] = filters.value.trackingNo.trim()

  const range = normalizeRangeText(filters.value.timeRange)
  if (range && range.includes(' - ')) {
    const [start, end] = range.split(' - ')
    if (start)
      body.starttime = start.trim()
    if (end)
      body.endtime = end.trim()
  }

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/package/all', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      rows.value = Array.isArray(res.data.data) ? res.data.data : []
      total.value = Number(res.data.count) || 0
      
      return
    }

    rows.value = []
    total.value = 0
    toast(res?.msg || '加载入库列表失败', 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    loading.value = false
  }
}

function searchList() {
  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function onQuickStatusChange(v) {
  filters.value.status = v

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    status: 1,
    sku: '',
    trackingNo: '',
    timeRange: '',
  }
  if (Object.keys(route.query).length)
    router.replace({ name: route.name, query: {} })
  searchList()
}

async function deleteOne(id) {
  if (!id)
    return

  try {
    const res = await $api('/package/del', {
      method: 'POST',
      body: { id },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '删除成功', 'success')
      loadList()
    }
    else {
      toast(res?.msg || '删除失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '删除失败', 'error')
  }
}

async function batchDelete() {
  if (!selectedIds.value.length) {
    toast('请先勾选要删除的数据', 'warning')
    
    return
  }

  try {
    const res = await $api('/package/delBatch', {
      method: 'POST',
      body: { str: selectedIds.value.join(',') },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '批量删除成功', 'success')
      selectedIds.value = []
      loadList()
    }
    else {
      toast(res?.msg || '批量删除失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '批量删除失败', 'error')
  }
}

async function requestPrintBoxLabel(idList) {
  const str = idList.map(id => String(id)).filter(Boolean).join(',')
  if (!str)
    return false

  const res = await $api('/package/dayinPl', {
    method: 'POST',
    body: { str },
  })

  if (Number(res?.code) === 1) {
    const url = res?.data?.pdf_url

    toast(res?.msg || '打印任务已生成', 'success')
    if (url)
      window.open(resolveBackendFileUrl(url), '_blank', 'noopener')

    return true
  }

  toast(res?.msg || '打印失败', 'error')

  return false
}

async function printBoxLabel(id) {
  if (!id)
    return

  printingId.value = id
  try {
    await requestPrintBoxLabel([id])
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '打印失败', 'error')
  }
  finally {
    printingId.value = null
  }
}

async function batchPrint() {
  if (!selectedIds.value.length) {
    toast('请先勾选要打印的数据', 'warning')

    return
  }
  try {
    await requestPrintBoxLabel(selectedIds.value)
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '批量打印失败', 'error')
  }
}

function goCreate() {
  router.push({ name: 'apps-drop-shipping-package-create' })
}

function goBatch() {
  router.push({ name: 'apps-drop-shipping-package-batch' })
}

watch([page, itemsPerPage], loadList, { immediate: true })

watch(
  () => [route.query.status, route.query.tracking_no, route.query.trackingNo],
  () => {
    filters.value = parseRouteQueryToFilters(route.query)
    page.value = 1
    loadList()
  },
)
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

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">入库列表</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">支持筛选、批量打印箱唛与批量删除；状态在查询按钮下方快捷切换。</span>
        </template>
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              @click="goCreate"
            >
              创建入库单
            </VBtn>
            <VBtn
              color="primary"
              size="small"
              variant="tonal"
              prepend-icon="tabler-upload"
              @click="goBatch"
            >
              批量创建
            </VBtn>
          </div>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <AppQueryPanel
          :loading="loading"
          actions-position="bottom"
          class="mb-4"
          :quick-filter-items="DS_STATUS_ITEMS"
          :quick-filter="filters.status"
          @search="searchList"
          @reset="resetFilters"
          @update:quick-filter="onQuickStatusChange"
        >
          <VRow dense>
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.sku"
                label="SKU"
                placeholder="输入SKU"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="filters.trackingNo"
                label="运单号"
                placeholder="输入运单号"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="3"
            >
              <AppDateTimePicker
                v-model="filters.timeRange"
                label="创建时间"
                hide-details
                density="compact"
                :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VAlert
          v-if="selectedIds.length"
          color="primary"
          variant="tonal"
          class="mb-4"
        >
          <div class="d-flex align-center justify-space-between flex-wrap gap-3">
            <span class="text-body-2">已勾选 {{ selectedIds.length }} 条数据</span>
            <div class="d-flex align-center gap-2 flex-wrap">
              <VBtn
                color="primary"
                variant="flat"
                size="small"
                prepend-icon="tabler-printer"
                @click="batchPrint"
              >
                批量打印
              </VBtn>
              <VBtn
                color="error"
                variant="tonal"
                size="small"
                prepend-icon="tabler-trash"
                @click="batchDelete"
              >
                批量删除
              </VBtn>
            </div>
          </div>
        </VAlert>

        <VDataTableServer
          v-model="selectedIds"
          :headers="headers"
          :items="rows"
          :loading="loading"
          :items-length="total"
          item-value="id"
          show-select
          density="comfortable"
          hover
          class="text-body-2 package-list-table"
        >
          <template #item.createtime="{ item }">
            <span class="package-cell package-cell--nowrap">{{ item.createtime || '—' }}</span>
          </template>
          <template #item.warehouse_name="{ item }">
            <span class="package-cell package-cell--multiline">{{ cellDisplay(item.warehouse_name) }}</span>
          </template>
          <template #item.tracking_no="{ item }">
            <span class="package-cell package-cell--tracking">{{ cellDisplay(item.tracking_no) }}</span>
          </template>
          <template #item.sku="{ item }">
            <span class="package-cell package-cell--multiline">{{ cellDisplay(item.sku) }}</span>
          </template>
          <template #item.sku_num="{ item }">
            <span class="package-cell package-cell--nums">{{ cellDisplay(item.sku_num) }}</span>
          </template>
          <template #item.real_sku_num="{ item }">
            <span class="package-cell package-cell--nums">{{ cellDisplay(item.real_sku_num) }}</span>
          </template>
          <template #item.statusStr="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="String(item.statusStr || '').includes('异常') ? 'error' : 'primary'"
            >
              {{ item.statusStr || '-' }}
            </VChip>
          </template>

          <template #item.actions="{ item }">
            <div class="package-list-actions d-flex align-center justify-end flex-wrap gap-1">
              <VTooltip
                location="top"
                text="查看详情"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    variant="tonal"
                    color="primary"
                    class="text-none px-2"
                    min-width="0"
                    prepend-icon="tabler-eye"
                    @click="router.push({ name: 'apps-drop-shipping-package-create', query: { id: item.id, mode: 'detail' } })"
                  >
                    查看
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                text="打印箱唛 PDF"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    variant="tonal"
                    color="secondary"
                    class="text-none px-2"
                    min-width="0"
                    prepend-icon="tabler-printer"
                    :loading="printingId === item.id"
                    @click="printBoxLabel(item.id)"
                  >
                    箱唛
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                text="删除本条"
              >
                <template #activator="{ props: tipProps }">
                  <VBtn
                    v-bind="tipProps"
                    size="small"
                    variant="tonal"
                    color="error"
                    class="text-none px-2"
                    min-width="0"
                    prepend-icon="tabler-trash"
                    @click="deleteOne(item.id)"
                  >
                    删除
                  </VBtn>
                </template>
              </VTooltip>
            </div>
          </template>

          <template #bottom>
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
              <span class="text-body-2 text-medium-emphasis">共 {{ total }} 条</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[20, 50, 100]"
                  style="inline-size: 96px;"
                  density="compact"
                  hide-details
                  @update:model-value="itemsPerPage = Number($event)"
                />
                <VPagination
                  v-model="page"
                  :length="pageLength"
                  :total-visible="7"
                />
              </div>
            </div>
          </template>
        </VDataTableServer>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<style scoped>
.package-list-table {
  --package-cell-line-height: 1.45;
}

.package-list-table :deep(.v-data-table__th),
.package-list-table :deep(.v-data-table__td) {
  vertical-align: top;
}

.package-cell {
  display: inline-block;
  max-inline-size: 100%;
  line-height: var(--package-cell-line-height);
}

.package-cell--nowrap {
  white-space: nowrap;
}

.package-cell--multiline {
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.package-cell--tracking {
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-all;
  font-variant-numeric: tabular-nums;
}

.package-cell--nums {
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}
</style>
