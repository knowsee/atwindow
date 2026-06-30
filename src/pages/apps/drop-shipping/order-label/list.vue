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
const { t } = useI18n({ useScope: 'global' })

const summary = ref({
  totalFee: null,
  skuNum: null,
})

const filters = ref({
  createRange: '',
  remarkAdmin: '',
  remark: '',
})

const headers = computed(() => [
  { title: t('pages.dropShippingOrderLabelList.headers.orderNo'), key: 'order_sn', minWidth: '200' },
  { title: t('pages.dropShippingOrderLabelList.headers.warehouse'), key: 'warehouse', minWidth: '130' },
  { title: t('pages.dropShippingOrderLabelList.headers.name'), key: 'name', minWidth: '140' },
  { title: t('pages.dropShippingOrderLabelList.headers.sku'), key: 'sku', minWidth: '120' },
  { title: t('pages.dropShippingOrderLabelList.headers.qty'), key: 'sku_num', minWidth: '80', align: 'end' },
  { title: t('pages.dropShippingOrderLabelList.headers.fee'), key: 'total_fee', minWidth: '88', align: 'end' },
  { title: t('pages.dropShippingOrderLabelList.headers.trackingNo'), key: 'ht_tracking_no', minWidth: '140' },
  { title: t('pages.dropShippingOrderLabelList.headers.status'), key: 'status', minWidth: '88', align: 'center' },
  { title: t('pages.dropShippingOrderLabelList.headers.remark'), key: 'remark', minWidth: '160' },
  { title: t('pages.dropShippingOrderLabelList.headers.adminRemark'), key: 'remark_admin', minWidth: '160' },
  { title: t('pages.dropShippingOrderLabelList.headers.createdAt'), key: 'createtime', minWidth: '158' },
  { title: t('pages.dropShippingOrderLabelList.headers.actions'), key: 'actions', sortable: false, width: '180', align: 'end', fixed: 'end' },
])

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

function getStatusLabel(status) {
  switch (Number(status)) {
  case 1:
    return t('pages.dropShippingOrderLabelList.status.notRelabeled')
  case 2:
    return t('pages.dropShippingOrderLabelList.status.relabeled')
  case 3:
    return t('pages.dropShippingOrderLabelList.status.cancelled')
  case 4:
    return t('pages.dropShippingOrderLabelList.status.pendingPayment')
  default:
    return '—'
  }
}

function getStatusColor(status) {
  switch (Number(status)) {
  case 1:
    return 'warning'
  case 2:
    return 'success'
  case 3:
    return 'default'
  case 4:
    return 'error'
  default:
    return 'default'
  }
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
      toast(res?.msg || t('pages.dropShippingOrderLabelList.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0

    summary.value = { totalFee: null, skuNum: null }
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderLabelList.messages.networkFailed'), 'error')
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
    toast(t('pages.dropShippingOrderLabelList.messages.noFile'), 'warning')

    return
  }
  window.open(url, '_blank', 'noopener')
}

watch([page, itemsPerPage], loadList, { immediate: true })
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
        <span class="text-h5 font-weight-medium">{{ $t('pages.dropShippingOrderLabelList.title') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2 justify-end">
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            class="text-none"
            :to="{ name: 'apps-drop-shipping-order-label-create' }"
          >
            {{ $t('pages.dropShippingOrderLabelList.actions.create') }}
          </VBtn>
        </div>
      </template>
    </VCardItem>
    <VDivider />
    <VCardText>
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
          {{ $t('pages.dropShippingOrderLabelList.summary.skuQty', { count: summary.skuNum }) }}
        </VChip>
        <VChip
          v-if="summary.totalFee != null"
          size="small"
          variant="tonal"
          color="secondary"
        >
          {{ $t('pages.dropShippingOrderLabelList.summary.totalFee', { fee: formatMoney(summary.totalFee) }) }}
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
              :label="$t('pages.dropShippingOrderLabelList.filters.createdAt')"
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
              :label="$t('pages.dropShippingOrderLabelList.filters.adminRemark')"
              :placeholder="$t('pages.dropShippingOrderLabelList.filters.adminRemarkPlaceholder')"
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
              :label="$t('pages.dropShippingOrderLabelList.filters.remark')"
              :placeholder="$t('pages.dropShippingOrderLabelList.filters.remarkPlaceholder')"
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
        <template #item.ht_tracking_no="{ item }">
          <div
            v-if="item.ht_tracking_no"
            class="tracking-no-lines"
          >
            <div
              v-for="(no, i) in String(item.ht_tracking_no).split(';').filter(Boolean)"
              :key="i"
            >
              {{ no }}
            </div>
          </div>
          <span v-else>—</span>
        </template>

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
            :color="getStatusColor(item.status)"
            :class="{ 'font-weight-black': Number(item.status) === 4 }"
          >
            {{ getStatusLabel(item.status) }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-end gap-1">
            <VTooltip :text="$t('pages.dropShippingOrderLabelList.tooltips.detail')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="primary"
                  @click="router.push({ name: 'apps-drop-shipping-order-label-detail', query: { id: item.id } })"
                >
                  <VIcon
                    icon="tabler-eye"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VTooltip :text="$t('pages.dropShippingOrderLabelList.tooltips.edit')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="secondary"
                  @click="router.push({ name: 'apps-drop-shipping-order-label-create', query: { id: item.id, mode: 'edit' } })"
                >
                  <VIcon
                    icon="tabler-pencil"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VTooltip :text="$t('pages.dropShippingOrderLabelList.tooltips.copy')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="secondary"
                  @click="router.push({ name: 'apps-drop-shipping-order-label-create', query: { id: item.id, mode: 'copy' } })"
                >
                  <VIcon
                    icon="tabler-copy"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
            <VMenu>
              <template #activator="{ props: menuProps }">
                <IconBtn
                  v-bind="menuProps"
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
                  :title="$t('pages.dropShippingOrderLabelList.actions.openMainLabel')"
                  prepend-icon="tabler-file-type-pdf"
                  :disabled="!item.pdf"
                  @click="item.pdf && openFile(item.pdf)"
                />
                <VListItem
                  :title="$t('pages.dropShippingOrderLabelList.actions.openBoxLabel')"
                  prepend-icon="tabler-package"
                  :disabled="!item.pdf_xb"
                  @click="item.pdf_xb && openFile(item.pdf_xb)"
                />
              </VList>
            </VMenu>
          </div>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
            <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderLabelList.pagination.total', { total }) }}</span>
            <div class="d-flex align-center gap-3">
              <AppSelect
                :model-value="itemsPerPage"
                :items="[10, 20, 50, 100]"
                style="inline-size: 100px;"
                density="compact"
                hide-details
                @update:model-value="itemsPerPage = Number($event)"
              />
              <VPagination
                v-model="page"
                :length="pageLength"
                :total-visible="5"
                size="small"
                active-color="primary"
              />
            </div>
          </div>
        </template>
      </VDataTableServer>
    </VCardText>
  </VCard>
</template>

<style scoped>
.ds-order-label-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-order-label-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

/* Keep action icons on one line with consistent spacing. */
.ds-order-label-list__actions {
  gap: 2px;
}

.ds-order-label-list__action-btn {
  margin-inline: 0;
}
</style>
