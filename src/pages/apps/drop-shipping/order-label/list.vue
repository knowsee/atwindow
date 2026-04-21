<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(10)
const snack = ref({ show: false, text: '', color: 'info' })

const summary = ref({
  totalFee: null,
  skuNum: null,
})

const filters = ref({
  createRange: '',
  remarkAdmin: '',
  remark: '',
})

const headers = [
  { title: '订单号', key: 'order_sn', minWidth: '200' },
  { title: '仓库', key: 'warehouse', minWidth: '130' },
  { title: '名称', key: 'name', minWidth: '140' },
  { title: 'SKU', key: 'sku', minWidth: '120' },
  { title: '件数', key: 'sku_num', minWidth: '80', align: 'end' },
  { title: '费用', key: 'total_fee', minWidth: '88', align: 'end' },
  { title: '状态', key: 'status', minWidth: '88', align: 'center' },
  { title: '备注', key: 'remark', minWidth: '160' },
  { title: '后台备注', key: 'remark_admin', minWidth: '160' },
  { title: '创建时间', key: 'createtime', minWidth: '158' },
  { title: '操作', key: 'actions', sortable: false, width: '152', align: 'end', fixed: 'end' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function formatMoney(v) {
  if (v == null || v === '')
    return '—'
  const n = Number(v)

  return Number.isFinite(n) ? n.toFixed(2) : String(v)
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
  }

  const cr = normalizeRangeText(filters.value.createRange)
  if (cr)
    body.createtime = cr
  if (filters.value.remarkAdmin.trim())
    body['remark_admin'] = filters.value.remarkAdmin.trim()
  if (filters.value.remark.trim())
    body.remark = filters.value.remark.trim()

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/orderv2/orderLabelList', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      const d = res.data

      rows.value = Array.isArray(d.data) ? d.data : []
      total.value = Number(d.count) || 0
      summary.value = {
        totalFee: d['total_fee'] != null ? Number(d['total_fee']) : null,
        skuNum: d['sku_num'] != null ? Number(d['sku_num']) : null,
      }
    }
    else {
      rows.value = []
      total.value = 0
      summary.value = { totalFee: null, skuNum: null }
      toast(res?.msg || '加载换标列表失败', 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0

    summary.value = { totalFee: null, skuNum: null }
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

function resetFilters() {
  filters.value = {
    createRange: '',
    remarkAdmin: '',
    remark: '',
  }
  searchList()
}

function openFile(path) {
  const url = resolveBackendFileUrl(path)
  if (!url) {
    toast('无文件', 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

watch([page, itemsPerPage], loadList, { immediate: true })
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
          <span class="text-h5 font-weight-medium">订单列表（旧）</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">换标订单（orderv2/orderLabelList）</span>
        </template>
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-truck"
              class="text-none"
              :to="{ name: 'apps-print-label-shipping-list' }"
            >
              新订单列表
            </VBtn>
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              class="text-none"
              :to="{ name: 'apps-drop-shipping-order-label-create' }"
            >
              创建订单
            </VBtn>
          </div>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <div
          v-if="summary.skuNum != null || summary.totalFee != null"
          class="d-flex flex-wrap gap-3 mb-4"
        >
          <VChip
            v-if="summary.skuNum != null"
            size="small"
            variant="tonal"
            color="primary"
          >
            当前筛选 SKU 件数合计：{{ summary.skuNum }}
          </VChip>
          <VChip
            v-if="summary.totalFee != null"
            size="small"
            variant="tonal"
            color="secondary"
          >
            当前筛选费用合计：{{ formatMoney(summary.totalFee) }}
          </VChip>
        </div>

        <AppQueryPanel
          class="mb-4"
          :loading="loading"
          actions-position="bottom"
          @search="searchList"
          @reset="resetFilters"
        >
          <VRow dense>
            <VCol
              cols="12"
              md="4"
            >
              <AppDateTimePicker
                v-model="filters.createRange"
                label="创建时间"
                hide-details
                density="compact"
                :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="filters.remarkAdmin"
                label="后台备注"
                placeholder="后台备注关键词"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="filters.remark"
                label="备注"
                placeholder="备注关键词"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="id"
          class="text-body-2 ds-order-label-list__table"
        >
          <template #item.remark="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 220px;"
              :title="item.remark || ''"
            >{{ item.remark || '—' }}</span>
          </template>

          <template #item.remark_admin="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-inline-size: 220px;"
              :title="item.remark_admin || ''"
            >{{ item.remark_admin || '—' }}</span>
          </template>

          <template #item.total_fee="{ item }">
            <span class="tabular-nums">{{ formatMoney(item.total_fee) }}</span>
          </template>

          <template #item.status="{ item }">
            <VChip
              size="small"
              variant="tonal"
              color="primary"
            >
              {{ item.status ?? '—' }}
            </VChip>
          </template>

          <template #item.actions="{ item }">
            <div class="ds-order-label-list__actions d-inline-flex align-center justify-end flex-nowrap">
              <VTooltip
                location="top"
                text="详情"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="tonal"
                    color="secondary"
                    class="ds-order-label-list__action-btn"
                    aria-label="详情"
                    @click="router.push({ name: 'apps-drop-shipping-order-label-create', query: { id: item.id, mode: 'detail' } })"
                  >
                    <VIcon
                      icon="tabler-eye"
                      size="20"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                text="编辑"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="tonal"
                    color="primary"
                    class="ds-order-label-list__action-btn"
                    aria-label="编辑"
                    @click="router.push({ name: 'apps-drop-shipping-order-label-create', query: { id: item.id, mode: 'edit' } })"
                  >
                    <VIcon
                      icon="tabler-pencil"
                      size="20"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                :text="item.pdf ? '打开主标文件' : '无主标文件'"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="tonal"
                    color="info"
                    class="ds-order-label-list__action-btn"
                    aria-label="主标"
                    :disabled="!item.pdf"
                    @click="item.pdf && openFile(item.pdf)"
                  >
                    <VIcon
                      icon="tabler-file-type-pdf"
                      size="20"
                    />
                  </VBtn>
                </template>
              </VTooltip>
              <VTooltip
                location="top"
                :text="item.pdf_xb ? '打开箱唛文件' : '无箱唛文件'"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="tonal"
                    color="info"
                    class="ds-order-label-list__action-btn"
                    aria-label="箱唛"
                    :disabled="!item.pdf_xb"
                    @click="item.pdf_xb && openFile(item.pdf_xb)"
                  >
                    <VIcon
                      icon="tabler-package"
                      size="20"
                    />
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
                  :items="[10, 20, 50, 100]"
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
.ds-order-label-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-order-label-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

/* 操作列：单行图标 + 统一间距，避免换行成「田」字格 */
.ds-order-label-list__actions {
  gap: 2px;
}

.ds-order-label-list__action-btn {
  margin-inline: 0;
}
</style>
