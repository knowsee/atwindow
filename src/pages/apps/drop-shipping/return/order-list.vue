<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
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
const itemsPerPage = ref(20)
const snack = ref({ show: false, text: '', color: 'info' })
const { t } = useI18n({ useScope: 'global' })

const statusTextKeys = {
  1: 'pages.dropShippingOrderList.status.pendingConfirm',
  2: 'pages.dropShippingOrderList.status.confirmed',
  4: 'pages.dropShippingOrderList.status.pendingShipment',
  6: 'pages.dropShippingOrderList.status.overseasShipped',
  14: 'pages.dropShippingOrderList.status.problem',
}

const statusItems = computed(() => [
  { title: t('pages.dropShippingOrderList.status.all'), value: 100 },
  { title: t('pages.dropShippingOrderList.status.pendingConfirm'), value: 1 },
  { title: t('pages.dropShippingOrderList.status.confirmed'), value: 2 },
  { title: t('pages.dropShippingOrderList.status.pendingShipment'), value: 4 },
  { title: t('pages.dropShippingOrderList.status.overseasShipped'), value: 6 },
  { title: t('pages.dropShippingOrderList.status.problem'), value: 14 },
])

const filters = ref({
  status: 100,
  orderSn: '',
  cankaohao: '',
  skuName: '',
  createRange: '',
  sendRange: '',
})

const headers = computed(() => [
  { title: t('pages.dropShippingOrderList.headers.referenceNo'), key: 'cankaohao', minWidth: '200' },
  { title: t('pages.dropShippingOrderList.headers.trackingNo'), key: 'ht_tracking_no', minWidth: '180' },
  { title: t('pages.dropShippingOrderList.headers.recipient'), key: 'name', minWidth: '120' },
  { title: 'SKU', key: 'sku', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.status'), key: 'status_name', minWidth: '110', align: 'center' },
  { title: t('pages.dropShippingOrderList.filters.transport'), key: 'transport_type', minWidth: '120' },
  { title: t('pages.dropShippingOrderList.headers.fee'), key: 'total_fee', minWidth: '96', align: 'end' },
  { title: t('pages.dropShippingOrderList.filters.createdAt'), key: 'createtime', minWidth: '150' },
  { title: t('pages.dropShippingOrderList.headers.actions'), key: 'actions', sortable: false, width: '120', align: 'center', fixed: 'end' },
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

function getStatusText(row) {
  const raw = row?.status_name
  if (raw && String(raw).trim())
    return String(raw).trim()

  const statusKey = statusTextKeys[Number(row?.status)]

  return statusKey ? t(statusKey) : t('pages.dropShippingOrderList.status.unknown', { status: row?.status ?? '—' })
}

function trackUrl(trackingNo) {
  const v = String(trackingNo || '').trim()
  if (!v)
    return ''

  return `https://t.17track.net/zh-cn#nums=${encodeURIComponent(v)}`
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
    status: Number(filters.value.status) || 100,
  }

  if (filters.value.orderSn.trim())
    body['order_sn'] = filters.value.orderSn.trim()
  if (filters.value.cankaohao.trim())
    body.cankaohao = filters.value.cankaohao.trim()
  if (filters.value.skuName.trim())
    body.skuName = filters.value.skuName.trim()

  const cr = normalizeRangeText(filters.value.createRange)
  if (cr)
    body.createtime = cr
  const fr = normalizeRangeText(filters.value.sendRange)
  if (fr)
    body.fahuotime = fr

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/order/returnOrder', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      rows.value = Array.isArray(res.data.data) ? res.data.data : []
      total.value = Number(res.data.count) || 0
    }
    else {
      rows.value = []
      total.value = 0
      toast(res?.msg || t('pages.dropShippingReturnOrderList.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dropShippingReturnOrderList.messages.networkFailed'), 'error')
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
    status: 100,
    orderSn: '',
    cankaohao: '',
    skuName: '',
    createRange: '',
    sendRange: '',
  }
  searchList()
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
        <span class="text-h5 font-weight-medium">{{ $t('pages.dropShippingReturnOrderList.title') }}</span>
      </template>
      <template #subtitle>
        <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingReturnOrderList.subtitle') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2 justify-end">
          <VBtn
            color="primary"
            size="small"
            variant="tonal"
            prepend-icon="tabler-upload"
            :to="{ name: 'apps-drop-shipping-return-order-batch' }"
          >
            {{ $t('pages.dropShippingReturnOrderList.actions.batchCreate') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            :to="{ name: 'apps-drop-shipping-return-order-create' }"
          >
            {{ $t('pages.dropShippingReturnOrderList.actions.create') }}
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
        :quick-filter-items="statusItems"
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
              v-model="filters.orderSn"
              :label="$t('pages.dropShippingOrderList.filters.orderNo')"
              :placeholder="$t('pages.dropShippingOrderList.filters.orderNo')"
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
              v-model="filters.cankaohao"
              :label="$t('pages.dropShippingOrderList.headers.referenceNo')"
              :placeholder="$t('pages.dropShippingOrderList.headers.referenceNo')"
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
              v-model="filters.skuName"
              label="SKU"
              :placeholder="$t('pages.dropShippingReturnOrderList.filters.skuNamePlaceholder')"
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
              v-model="filters.createRange"
              :label="$t('pages.dropShippingOrderList.filters.createdAt')"
              hide-details
              density="compact"
              :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppDateTimePicker
              v-model="filters.sendRange"
              :label="$t('pages.dropShippingOrderList.filters.shippedAt')"
              hide-details
              density="compact"
              :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <VDataTableServer
        disable-sort
        :headers="headers"
        :items="rows"
        :items-length="total"
        :loading="loading"
        item-value="id"
        class="text-body-2 ds-return-order-list__table"
      >
        <template #item.cankaohao="{ item }">
          <span class="font-weight-medium">
            {{ item.cankaohao || '—' }}
            <span
              v-if="Number(item.is_qujian) === 1"
              class="text-error"
            >{{ $t('pages.dropShippingReturnOrderList.labels.remote') }}</span>
          </span>
        </template>

        <template #item.ht_tracking_no="{ item }">
          <a
            v-if="item.ht_tracking_no"
            :href="trackUrl(item.ht_tracking_no)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary text-decoration-none"
          >
            {{ item.ht_tracking_no }}
          </a>
          <span
            v-else
            class="text-medium-emphasis"
          >—</span>
        </template>

        <template #item.status_name="{ item }">
          <VChip
            size="small"
            variant="tonal"
            :color="getStatusText(item).includes('\u95ee\u9898') ? 'error' : 'primary'"
          >
            {{ getStatusText(item) }}
          </VChip>
        </template>

        <template #item.total_fee="{ item }">
          <span class="tabular-nums">{{ formatMoney(item.total_fee) }}</span>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VTooltip :text="$t('pages.dropShippingOrderList.tooltips.detail')">
              <template #activator="{ props }">
                <IconBtn
                  v-bind="props"
                  size="small"
                  color="primary"
                  @click="router.push({ name: 'apps-drop-shipping-return-order-detail', query: { id: item.id } })"
                >
                  <VIcon
                    icon="tabler-eye"
                    size="20"
                  />
                </IconBtn>
              </template>
            </VTooltip>
          </div>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
            <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}</span>
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
.ds-return-order-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.ds-return-order-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}
</style>
