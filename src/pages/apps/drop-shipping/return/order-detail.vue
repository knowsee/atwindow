<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api } from '@/utils/api'
import { loadCountryOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const snack = ref({ show: false, text: '', color: 'info' })
const { t } = useI18n({ useScope: 'global' })

const orderId = computed(() => Number(route.query.id || 0) || null)

const countryOptions = ref([])
const detail = ref({})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-return-order-list' })
}

function goCopy() {
  router.push({ name: 'apps-drop-shipping-return-order-create', query: { id: orderId.value, mode: 'copy' } })
}

function resolveCountry(code) {
  if (!code)
    return '—'

  return countryOptions.value.find(c => c.value === code)?.title || code
}

function statusColor(statusValue) {
  const s = Number(statusValue || 0)
  if (s === 1) return 'warning'
  if (s === 2) return 'info'
  if (s === 3) return 'error'
  if (s === 4 || s === 6) return 'success'
  if (s === 14) return 'error'
  if (s === 15) return 'secondary'
  
  return 'secondary'
}

function formatMoney(val) {
  const n = Number(val)
  
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
}

function resolveErpSource(type) {
  const erpMap = {
    1: 'pages.dropShippingOrderDetail.erp.system',
    2: 'pages.dropShippingOrderDetail.erp.mabang',
    3: 'pages.dropShippingOrderDetail.erp.lingxing',
    4: 'pages.dropShippingOrderDetail.erp.tiktok',
    5: 'pages.dropShippingOrderDetail.erp.temu',
  }

  return t(erpMap[Number(type)] || 'pages.dropShippingOrderDetail.erp.thirdParty')
}

const totalQty = computed(() => {
  if (!detail.value.line_items) return 0
  
  return detail.value.line_items.reduce((acc, r) => acc + Number(r.line_qty || 0), 0)
})

async function copyText(text, label) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(String(text))
    toast(t('pages.dropShippingOrderDetail.copy.success', { label }), 'success')
  } catch {
    toast(t('pages.dropShippingOrderDetail.copy.failed', { label }), 'error')
  }
}

async function loadDetail() {
  if (!orderId.value) {
    toast(t('pages.dropShippingReturnOrderDetail.messages.missingId'), 'error')
    loading.value = false

    return
  }
  try {
    const [co, res] = await Promise.all([
      loadCountryOptions(),
      $api('/ordernew/orderDfDetail', { method: 'GET', query: { id: orderId.value, ['biz_type']: 'th' } }),
    ])

    countryOptions.value = co

    if (Number(res?.code) === 1 && res?.data) {
      detail.value = res.data || {}
    }
    else {
      toast(res?.msg || t('pages.dropShippingReturnOrderDetail.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingReturnOrderDetail.messages.loadGenericFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadDetail)
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

    <FormPageLoadingOverlay
      :loading="loading"
      :message="$t('pages.dropShippingReturnOrderDetail.loading')"
    >
      <div class="print-label-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <div class="text-caption text-primary mb-1">
            {{ $t('pages.dropShippingReturnOrderCreate.eyebrow') }}
          </div>
          <h1 class="text-h4 font-weight-bold text-high-emphasis d-flex align-center gap-2">
            {{ $t('pages.dropShippingReturnOrderDetail.title') }}
            <VChip
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ $t('pages.dropShippingOrderDetail.readonly') }}
            </VChip>
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
            {{ $t('pages.dropShippingOrderDetail.subtitle') }}
          </p>
        </div>
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            {{ $t('pages.dropShippingOrderDetail.actions.backToList') }}
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="tabler-copy"
            @click="goCopy"
          >
            {{ $t('pages.dropShippingReturnOrderDetail.actions.copyOrder') }}
          </VBtn>
        </div>
      </div>

      <VRow>
        <VCol
          cols="12"
          md="8"
        >
          <VCard
            class="mb-4"
            elevation="0"
            border
          >
            <VCardText class="pa-5">
              <div class="d-flex flex-column flex-sm-row justify-space-between align-start">
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase tracking-widest mb-1">
                    {{ $t('pages.dropShippingOrderDetail.labels.orderSn') }}
                  </div>
                  <div class="d-flex align-center flex-wrap gap-2 mb-2">
                    <span class="text-h4 font-weight-black text-high-emphasis ds-mono">
                      {{ detail.order_sn || '—' }}
                    </span>
                    <VIcon
                      v-if="detail.order_sn"
                      icon="tabler-copy"
                      class="cursor-pointer text-medium-emphasis"
                      size="18"
                      @click="copyText(detail.order_sn, $t('pages.dropShippingOrderDetail.copy.orderSn'))"
                    />
                  </div>
                </div>
                <div class="mt-4 mt-sm-0 text-sm-right">
                  <VChip
                    :color="statusColor(detail.status)"
                    size="large"
                    class="font-weight-bold text-subtitle-1 px-4 mb-2"
                    variant="elevated"
                  >
                    {{ detail.status_text || '—' }}
                  </VChip>
                </div>
              </div>

              <VDivider class="my-5" />

              <VRow dense>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingOrderDetail.labels.referenceNo') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ detail.cankaohao || '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingOrderDetail.labels.temuOrderNo') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ detail.erp_type == 5 ? detail.ht_orderno : '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingOrderDetail.labels.warehouse') }}
                  </div>
                  <div class="text-body-1 font-weight-medium d-flex align-center gap-1">
                    {{ detail.warehouse || detail.warehouse_id || '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingOrderDetail.labels.trackingNo') }}
                  </div>
                  <div class="text-body-1 font-weight-bold text-primary d-flex align-center gap-1">
                    <span v-if="detail.ht_tracking_no">{{ detail.ht_tracking_no }}</span>
                    <span
                      v-else
                      class="text-medium-emphasis font-weight-medium"
                    >—</span>
                    <VIcon
                      v-if="detail.ht_tracking_no"
                      icon="tabler-copy"
                      size="16"
                      class="cursor-pointer"
                      @click="copyText(detail.ht_tracking_no, $t('pages.dropShippingOrderDetail.copy.trackingNo'))"
                    />
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
          <VCard
            class="mb-4"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-map-2"
                size="20"
                color="primary"
              />
              {{ $t('pages.dropShippingOrderDetail.labels.logisticsTitle') }}
            </VCardTitle>
            <VCardText class="px-5 pb-5 pt-0">
              <div class="d-flex flex-column flex-md-row gap-4 align-md-stretch">
                <div class="flex-grow-1 address-box rounded pa-4">
                  <div class="d-flex align-center mb-4">
                    <VAvatar
                      color="secondary"
                      variant="tonal"
                      rounded
                      size="40"
                      class="me-3"
                    >
                      <VIcon
                        icon="tabler-truck"
                        size="24"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                        {{ $t('pages.dropShippingOrderDetail.labels.logistics') }}
                      </div>
                    </div>
                  </div>
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis">
                      {{ $t('pages.dropShippingOrderDetail.labels.route') }}
                    </div>
                    <div class="text-body-1 font-weight-bold text-high-emphasis">
                      {{ detail.transport_type_name || '—' }}
                    </div>
                  </div>
                  <div class="d-flex flex-wrap gap-x-6 gap-y-3">
                    <div>
                      <div class="text-caption text-medium-emphasis">
                        {{ $t('pages.dropShippingOrderDetail.labels.totalQty') }}
                      </div>
                      <div class="text-body-2 font-weight-medium">
                        {{ $t('pages.dropShippingOrderCreate.sections.summary.validProductsCount', { count: detail.total_num || 0 }) }}
                      </div>
                    </div>
                    <div>
                      <div class="text-caption text-medium-emphasis">
                        {{ $t('pages.dropShippingOrderDetail.labels.totalWeight') }}
                      </div>
                      <div class="text-body-2 font-weight-medium">
                        {{ detail.total_weight || 0 }} lb
                      </div>
                    </div>
                    <div>
                      <div class="text-caption text-medium-emphasis">
                        {{ $t('pages.dropShippingOrderDetail.labels.declaredWeight') }}
                      </div>
                      <div class="text-body-2 font-weight-medium">
                        {{ detail.sb_total_weight || 0 }} lb
                      </div>
                    </div>
                  </div>
                </div>

                <div class="d-flex align-center justify-center py-2 py-md-0">
                  <div class="arrow-divider rounded-circle d-flex align-center justify-center pa-2">
                    <VIcon
                      icon="tabler-arrow-right"
                      size="24"
                      color="disabled"
                      class="d-none d-md-block"
                    />
                    <VIcon
                      icon="tabler-arrow-down"
                      size="24"
                      color="disabled"
                      class="d-md-none"
                    />
                  </div>
                </div>

                <div class="flex-grow-1 address-box rounded pa-4 bg-var-theme-background">
                  <div class="d-flex align-center mb-4">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      rounded
                      size="40"
                      class="me-3"
                    >
                      <VIcon
                        icon="tabler-user"
                        size="24"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                        {{ $t('pages.dropShippingOrderDetail.labels.recipient') }}
                      </div>
                    </div>
                  </div>
                  <div class="text-body-1 font-weight-bold mb-1">
                    {{ detail.receive?.name || detail.receive_name || '—' }}
                    <span
                      v-if="detail.receive?.company || detail.receive_company"
                      class="text-caption text-medium-emphasis ms-2"
                    >({{ detail.receive?.company || detail.receive_company }})</span>
                  </div>
                  <div class="text-body-2 text-medium-emphasis mb-2 d-flex align-center gap-1">
                    <VIcon
                      icon="tabler-phone"
                      size="16"
                    />
                    {{ detail.receive?.telephone || detail.receive_telephone || '—' }}
                    <VIcon
                      v-if="detail.receive?.email || detail.receive_email"
                      icon="tabler-mail"
                      size="16"
                      class="ms-3"
                    />
                    {{ detail.receive?.email || detail.receive_email || '' }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1 mb-1">
                    <VIcon
                      icon="tabler-map-pin"
                      size="16"
                      class="mt-1 flex-shrink-0"
                    />
                    <span>
                      {{ detail.receive?.address || detail.receive_address || '—' }}
                      <template v-if="detail.receive?.address2">, {{ detail.receive.address2 }}</template>
                    </span>
                  </div>
                  <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1">
                    <VIcon
                      icon="tabler-world"
                      size="16"
                      class="mt-1 flex-shrink-0"
                    />
                    <span>
                      {{ [detail.receive?.city || detail.receive_city, detail.receive?.province || detail.receive_province, detail.receive?.postcode || detail.receive_postcode, detail.receive?.country || resolveCountry(detail.receive_country_code) || detail.receive_country_code].filter(v => v && v !== '—').join(' · ') || '—' }}
                    </span>
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>

          <VCard
            class="mb-4"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-package"
                  size="20"
                  color="warning"
                />
                {{ $t('pages.dropShippingOrderDetail.labels.itemsTitle') }}
              </div>
              <VChip
                size="small"
                color="warning"
                variant="tonal"
              >
                {{ $t('pages.dropShippingOrderDetail.labels.itemsSummary', { types: (detail.line_items || []).length, qty: totalQty }) }}
              </VChip>
            </VCardTitle>
            <VDivider />
            <VTable class="text-no-wrap invoice-table">
              <thead class="bg-var-theme-background">
                <tr>
                  <th class="font-weight-medium text-uppercase text-caption">
                    SKU
                  </th>
                  <th class="font-weight-medium text-uppercase text-caption">
                    {{ $t('pages.dropShippingOrderDetail.labels.cnName') }}
                  </th>
                  <th class="font-weight-medium text-uppercase text-caption text-right">
                    {{ $t('pages.dropShippingOrderDetail.labels.qty') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in detail.line_items || []"
                  :key="idx"
                >
                  <td>
                    <div class="font-weight-semibold text-high-emphasis">
                      {{ row.en_sku || '—' }}
                    </div>
                    <div
                      v-if="!row.matched"
                      class="text-caption text-error d-flex align-center gap-1 mt-1"
                    >
                      <VIcon
                        icon="tabler-alert-triangle"
                        size="12"
                      /> {{ $t('pages.dropShippingOrderDetail.labels.unmatchedProduct') }}
                    </div>
                  </td>
                  <td>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ row.product?.cn_name || '—' }}
                      <span
                        v-if="row.product?.en_name"
                        class="text-caption d-block text-disabled"
                      >{{ row.product.en_name }}</span>
                    </div>
                  </td>
                  <td class="text-right">
                    <VChip
                      size="small"
                      variant="flat"
                      color="primary"
                      class="px-3"
                    >
                      {{ row.line_qty ?? '—' }}
                    </VChip>
                  </td>
                </tr>
                <tr v-if="!(detail.line_items || []).length">
                  <td
                    colspan="3"
                    class="text-center text-medium-emphasis py-6"
                  >
                    {{ $t('pages.dropShippingOrderDetail.labels.emptyItems') }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="(detail.line_items || []).length">
                <tr>
                  <td
                    colspan="2"
                    class="text-right text-body-2 text-medium-emphasis font-weight-medium"
                  >
                    {{ $t('pages.dropShippingOrderDetail.labels.totalQtyLabel') }}
                  </td>
                  <td class="text-right font-weight-bold text-primary text-h6">
                    {{ totalQty }}
                  </td>
                </tr>
              </tfoot>
            </VTable>
          </VCard>

          <VCard
            v-if="detail.remark"
            class="mb-4"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-notes"
                size="20"
                color="info"
              />
              {{ $t('pages.dropShippingOrderDetail.labels.remark') }}
            </VCardTitle>
            <VDivider />
            <VCardText class="px-6 py-5">
              <p
                class="text-body-1 text-high-emphasis mb-0"
                style="white-space: pre-wrap;"
              >
                {{ detail.remark }}
              </p>
            </VCardText>
          </VCard>

          <VCard
            v-if="detail.question_reason"
            class="mb-4 bg-error-lighten-5"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2 text-error">
              <VIcon
                icon="tabler-alert-triangle"
                size="20"
              />
              {{ $t('pages.dropShippingOrderDetail.labels.questionReason') }}
            </VCardTitle>
            <VDivider />
            <VCardText class="px-6 py-5">
              <p
                class="text-body-1 text-error mb-0"
                style="white-space: pre-wrap;"
              >
                {{ detail.question_reason }}
              </p>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          md="4"
        >
          <div class="detail-sidebar">
            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VAvatar
                  color="success"
                  variant="tonal"
                  size="32"
                  rounded="circle"
                >
                  <VIcon
                    icon="tabler-currency-dollar"
                    size="18"
                  />
                </VAvatar>
                {{ $t('pages.dropShippingOrderDetail.labels.feesTitle') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-2">
                <div
                  v-if="detail.fees"
                  class="receipt-box px-4 py-4 rounded bg-surface"
                >
                  <div class="receipt-item">
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.shippingFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.shipping_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.paisong_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.deliveryFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.paisong_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.handle_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.handleFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.handle_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.material_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.materialFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.material_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.xhcz_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.packingFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.xhcz_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.zitick_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.pickupFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.zitick_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.pp_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.brandFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.pp_fee) }}</span>
                  </div>
                  <div
                    v-if="detail.fees.cpb_fee > 0"
                    class="receipt-item"
                  >
                    <span class="receipt-label">{{ $t('pages.dropShippingOrderDetail.labels.productLabelFee') }}</span>
                    <span class="receipt-value">{{ formatMoney(detail.fees.cpb_fee) }}</span>
                  </div>
                  
                  <div class="receipt-divider my-4" />
                  
                  <div class="d-flex justify-space-between align-center mt-2">
                    <span class="text-subtitle-1 font-weight-bold text-high-emphasis">{{ $t('pages.dropShippingOrderDetail.labels.totalFee') }}</span>
                    <span class="text-h6 font-weight-black text-success">{{ formatMoney(detail.fees.total_fee) }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="text-center text-medium-emphasis py-4"
                >
                  {{ $t('pages.dropShippingOrderDetail.labels.emptyFees') }}
                </div>
              </VCardText>
            </VCard>

            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-clock"
                  size="20"
                  color="primary"
                />
                {{ $t('pages.dropShippingOrderDetail.labels.timelineTitle') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-2">
                <VTimeline
                  density="compact"
                  align="start"
                  truncate-line="both"
                  class="timeline-custom"
                >
                  <VTimelineItem
                    v-if="detail.createtime_text"
                    dot-color="primary"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.created') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.createtime_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.paytime_text"
                    dot-color="success"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.paid') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.paytime_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.confirmtime_text"
                    dot-color="info"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.confirmed') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.confirmtime_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.printtime_text && detail.status === 6"
                    dot-color="secondary"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.printed') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.printtime_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.bf_time_text && detail.status === 6"
                    dot-color="error"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.resent') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.bf_time_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.fahuotime_text && detail.status === 6"
                    dot-color="success"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.shipped') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.fahuotime_text }}</span>
                    </div>
                  </VTimelineItem>
                  <VTimelineItem
                    v-if="detail.questiontime_text"
                    dot-color="error"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.dropShippingOrderDetail.timeline.problem') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ detail.questiontime_text }}</span>
                    </div>
                  </VTimelineItem>
                </VTimeline>
                <div
                  v-if="detail.erp_type"
                  class="mt-4 pt-4 border-t d-flex justify-space-between align-center"
                >
                  <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderDetail.labels.erpSource') }}</span>
                  <span class="text-body-2 font-weight-medium">
                    <VChip
                      size="x-small"
                      variant="tonal"
                      color="info"
                    >
                      {{ resolveErpSource(detail.erp_type) }}
                    </VChip>
                  </span>
                </div>
              </VCardText>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </FormPageLoadingOverlay>
  </VContainer>
</template>

<style scoped>
.print-label-create__hero {
  inline-size: 100%;
  max-inline-size: 100%;
}

.bg-var-theme-background {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.arrow-divider {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.timeline-custom :deep(.v-timeline-item__body) {
  padding-block-start: 0 !important;
}

.ds-mono {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}

.tracking-widest {
  letter-spacing: 0.06em;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-block: 0.4rem;
}

.detail-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.45);
}

.detail-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.detail-product-table :deep(thead th) {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 0.875rem 1rem;
  white-space: nowrap;
}

.detail-product-table :deep(tbody td) {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.45);
}

.detail-product-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.detail-product-table :deep(tfoot td) {
  background: rgba(var(--v-theme-on-surface), 0.02);
  padding: 0.75rem 1rem;
  border-top: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.receipt-box {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 2px 8px -2px rgba(var(--v-theme-on-surface), 0.05);
}

.receipt-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding-block: 0.35rem;
}

.receipt-label {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: nowrap;
  flex-shrink: 0;
}

.receipt-value {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.87);
  font-weight: 500;
  text-align: right;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}

.receipt-divider {
  border-top: 1px dashed rgba(var(--v-border-color), 0.6);
  position: relative;
}

@media (min-width: 1280px) {
  .detail-sidebar {
    position: sticky;
    top: 5rem;
  }
}
</style>
