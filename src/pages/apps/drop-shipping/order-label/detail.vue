<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api } from '@/utils/api'
import { loadCartonOptions, loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

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

const warehouseOptions = ref([])
const countryOptions = ref([])

const orderInfo = ref({})
const addrInfo = ref({})
const productInfo = ref({})

const orderTypeItems = computed(() => [
  { title: t('pages.dropShippingOrderLabelCreate.options.relabel'), value: 0 },
  { title: t('pages.dropShippingOrderLabelCreate.options.noRelabel'), value: 1 },
])

const cartonTypeItems = ref([{ title: t('common.options.notRequired'), value: 0 }])

const signatureItems = computed(() => [
  { title: t('common.options.notRequired'), value: 0 },
  { title: t('pages.dropShippingOrderLabelCreate.options.required'), value: 1 },
])

const transportItems = computed(() => [
  { title: t('pages.dropShippingOrderLabelCreate.options.pickup'), value: 200 },
  { title: 'UPS', value: 50 },
])

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-order-label-list' })
}

function goCopy() {
  router.push({ name: 'apps-drop-shipping-order-label-create', query: { id: orderId.value, mode: 'copy' } })
}

function resolveLabel(list, value) {
  if (value == null || value === '')
    return '—'

  const items = Array.isArray(list) ? list : list.value

  return items.find(o => Number(o.value) === Number(value))?.title || String(value)
}

function resolveWarehouse(id) {
  if (!id)
    return '—'

  return warehouseOptions.value.find(w => Number(w.value) === Number(id))?.title || String(id)
}

function resolveCountry(code) {
  if (!code)
    return '—'

  return countryOptions.value.find(c => c.value === code)?.title || code
}

function statusColor(statusName) {
  const s = String(statusName || '')
  if (s.includes('\u95ee\u9898'))
    return 'error'
  if (s.includes('\u5df2\u53d1') || s.includes('\u5df2\u9000'))
    return 'success'
  if (s.includes('\u5f85\u53d1') || s.includes('\u5f85\u4ed8'))
    return 'warning'
  if (s.includes('\u5df2\u786e'))
    return 'info'

  return 'secondary'
}

async function loadDetail() {
  if (!orderId.value) {
    toast(t('pages.dropShippingOrderLabelDetail.messages.missingId'), 'error')
    loading.value = false

    return
  }
  try {
    const [wh, carton, res] = await Promise.all([
      loadWarehouseOptions(t),
      loadCartonOptions(t),
      $api('/orderv2/detail', { method: 'POST', body: { id: orderId.value } }),
    ])

    warehouseOptions.value = wh
    cartonTypeItems.value = carton

    if (Number(res?.code) === 1 && res?.data) {
      orderInfo.value = res.data.order_info || {}
      addrInfo.value = res.data.receive_addr || {}

      const pi = Array.isArray(res.data.product_info) ? res.data.product_info[0] : null

      productInfo.value = pi || {}

      const { loadCountryOptions } = await import('@/views/apps/drop-shipping/useDropShippingShared')
      const co = await loadCountryOptions()

      countryOptions.value = co
    }
    else {
      toast(res?.msg || t('pages.dropShippingOrderLabelDetail.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingOrderLabelDetail.messages.loadGenericFailed'), 'error')
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
      :message="$t('pages.dropShippingOrderLabelDetail.loading')"
    >
      <!-- Page header -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-5">
        <div>
          <div class="text-overline text-primary mb-1">
            {{ $t('pages.dropShippingOrderLabelCreate.eyebrow') }}
          </div>
          <h1 class="text-h4 font-weight-bold text-high-emphasis">
            {{ $t('pages.dropShippingOrderLabelDetail.title') }}
          </h1>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            class="text-none"
            @click="goList"
          >
            {{ $t('pages.dropShippingOrderDetail.actions.backToList') }}
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="tabler-copy"
            class="text-none"
            @click="goCopy"
          >
            {{ $t('pages.dropShippingOrderDetail.actions.copyOrder') }}
          </VBtn>
        </div>
      </div>

      <!-- Hero card -->
      <VCard
        class="mb-5 rounded-xl"
        elevation="0"
        border
      >
        <VCardText class="pa-6">
          <div class="d-flex flex-column flex-sm-row justify-space-between align-start gap-3 mb-4">
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase tracking-widest mb-1">
                {{ $t('pages.dropShippingOrderDetail.labels.orderSn') }}
              </div>
              <span class="text-h4 font-weight-black text-high-emphasis ds-mono">
                {{ orderInfo.order_sn || '—' }}
              </span>
            </div>
            <div class="mt-0">
              <VChip
                :color="statusColor(orderInfo.status_name)"
                size="large"
                variant="elevated"
                class="font-weight-bold px-4"
              >
                {{ orderInfo.status_name || '—' }}
              </VChip>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-x-6 gap-y-1 text-body-2 text-medium-emphasis">
            <span>
              <VIcon
                icon="tabler-building-warehouse"
                size="14"
                class="me-1"
              />{{ $t('pages.dropShippingOrderLabelDetail.labels.warehouseInline') }}
              <strong class="text-high-emphasis ms-1">{{ resolveWarehouse(orderInfo.warehouse_id) }}</strong>
            </span>
            <span v-if="orderInfo.createtime">
              <VIcon
                icon="tabler-clock"
                size="14"
                class="me-1"
              />{{ orderInfo.createtime }}
            </span>
            <span v-if="orderInfo.remark">
              <VIcon
                icon="tabler-notes"
                size="14"
                class="me-1"
              />{{ orderInfo.remark }}
            </span>
          </div>
        </VCardText>
      </VCard>

      <VRow>
        <!-- Main content -->
        <VCol
          cols="12"
          lg="8"
        >
          <!-- Recipient -->
          <VCard
            class="mb-4 rounded-xl"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-map-pin"
                size="20"
                color="primary"
              />
              {{ $t('pages.dropShippingOrderLabelDetail.labels.recipientTitle') }}
            </VCardTitle>
            <div class="text-caption text-medium-emphasis px-5 pb-3">
              {{ $t('pages.dropShippingOrderCreate.sections.recipient.subtitle') }}
            </div>
            <VDivider />
            <VCardText class="px-6 py-5">
              <div class="address-box rounded pa-4">
                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                    size="36"
                  >
                    <VIcon
                      icon="tabler-map-pin"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <div class="text-subtitle-2 font-weight-bold d-flex align-center gap-2">
                      {{ addrInfo.name || '—' }}
                      <VChip
                        v-if="addrInfo.name"
                        size="x-small"
                        color="primary"
                        variant="flat"
                      >
                        Recipient
                      </VChip>
                    </div>
                    <div
                      v-if="addrInfo.telephone"
                      class="text-caption text-medium-emphasis mt-0 d-flex align-center gap-1"
                    >
                      <VIcon
                        icon="tabler-phone"
                        size="13"
                      />{{ addrInfo.telephone }}
                    </div>
                  </div>
                </div>
                <div class="text-body-2 d-flex align-start gap-1 mb-1">
                  <VIcon
                    icon="tabler-map-pin"
                    size="15"
                    class="mt-1 text-medium-emphasis flex-shrink-0"
                  />
                  <span>
                    {{ addrInfo.address || '—' }}
                    <template v-if="addrInfo.address2">, {{ addrInfo.address2 }}</template>
                  </span>
                </div>
                <div class="text-body-2 d-flex align-center gap-1 mb-1">
                  <VIcon
                    icon="tabler-world"
                    size="15"
                    class="text-medium-emphasis flex-shrink-0"
                  />
                  <span class="text-medium-emphasis">
                    {{ [addrInfo.city, addrInfo.province, addrInfo.postCode || addrInfo.postcode, resolveCountry(addrInfo.country) || addrInfo.country].filter(v => v && v !== '—').join(' · ') || '—' }}
                  </span>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Logistics -->
          <VCard
            class="mb-4 rounded-xl"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-truck"
                size="20"
                color="secondary"
              />
              {{ $t('pages.dropShippingOrderLabelCreate.sections.shipping.title') }}
            </VCardTitle>
            <div class="text-caption text-medium-emphasis px-5 pb-3">
              {{ $t('pages.dropShippingOrderLabelDetail.labels.shippingSubtitle') }}
            </div>
            <VDivider />
            <VCardText class="px-6 py-5">
              <VRow dense>
                <VCol
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.shipping.transport') }}</span>
                  <span class="detail-value">{{ resolveLabel(transportItems, orderInfo.transport_type) }}</span>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.shipping.warehouse') }}</span>
                  <span class="detail-value">{{ resolveWarehouse(orderInfo.warehouse_id) }}</span>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.valueAdd.orderType') }}</span>
                  <span class="detail-value">{{ resolveLabel(orderTypeItems, orderInfo.order_type) }}</span>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.valueAdd.carton') }}</span>
                  <span class="detail-value">{{ resolveLabel(cartonTypeItems, orderInfo.material_type) }}</span>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelDetail.labels.signature') }}</span>
                  <span class="detail-value">{{ resolveLabel(signatureItems, orderInfo.signature_type) }}</span>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Product & Label -->
          <VCard
            class="mb-4 rounded-xl"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-package"
                size="20"
                color="warning"
              />
              {{ $t('pages.dropShippingOrderLabelCreate.sections.product.title') }}
            </VCardTitle>
            <div class="text-caption text-medium-emphasis px-5 pb-3">
              {{ $t('pages.dropShippingOrderLabelCreate.sections.product.subtitle') }}
            </div>
            <VDivider />
            <VCardText class="px-6 py-5">
              <VRow dense>
                <VCol
                  cols="12"
                  sm="4"
                  class="detail-field"
                >
                  <span class="detail-label">SKU</span>
                  <span class="detail-value">{{ productInfo.en_sku || '—' }}</span>
                </VCol>
                <VCol
                  cols="6"
                  sm="4"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.product.qty') }}</span>
                  <span class="detail-value">{{ productInfo.goods_num ?? '—' }}</span>
                </VCol>
                <VCol
                  cols="6"
                  sm="4"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.product.labelCode') }}</span>
                  <span class="detail-value">{{ productInfo.bq_code || '—' }}</span>
                </VCol>
                <VCol
                  v-if="productInfo.pdf || productInfo.ht_pdf"
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelDetail.labels.labelFile') }}</span>
                  <a
                    :href="productInfo.pdf || productInfo.ht_pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-value text-primary d-inline-flex align-center gap-1"
                  >
                    <VIcon
                      icon="tabler-external-link"
                      size="14"
                    />{{ $t('pages.dropShippingOrderLabelDetail.actions.viewAttachment') }}
                  </a>
                </VCol>
                <VCol
                  v-if="productInfo.pdf_xb"
                  cols="12"
                  sm="6"
                  class="detail-field"
                >
                  <span class="detail-label">{{ $t('pages.dropShippingOrderLabelDetail.labels.boxLabel') }}</span>
                  <a
                    :href="productInfo.pdf_xb"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-value text-primary d-inline-flex align-center gap-1"
                  >
                    <VIcon
                      icon="tabler-external-link"
                      size="14"
                    />{{ $t('pages.dropShippingOrderLabelDetail.actions.viewBoxLabel') }}
                  </a>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Sidebar -->
        <VCol
          cols="12"
          lg="4"
        >
          <div class="detail-sidebar">
            <VCard
              class="rounded-xl"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-2 text-subtitle-1 font-weight-bold">
                {{ $t('pages.dropShippingOrderLabelDetail.labels.summaryTitle') }}
              </VCardTitle>
              <VDivider />
              <VCardText class="px-5 py-4">
                <div class="summary-item">
                  <span class="summary-label">{{ $t('pages.dropShippingOrderCreate.sections.summary.warehouse') }}</span>
                  <span class="summary-value">{{ resolveWarehouse(orderInfo.warehouse_id) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.shipping.transport') }}</span>
                  <span class="summary-value">{{ resolveLabel(transportItems, orderInfo.transport_type) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.valueAdd.orderType') }}</span>
                  <span class="summary-value">{{ resolveLabel(orderTypeItems, orderInfo.order_type) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">SKU</span>
                  <span class="summary-value font-weight-medium text-primary">{{ productInfo.en_sku || '—' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ $t('pages.dropShippingOrderLabelCreate.sections.summary.qty') }}</span>
                  <span class="summary-value font-weight-semibold text-primary">{{ productInfo.goods_num ?? '—' }}</span>
                </div>
              </VCardText>
              <VDivider />
              <VCardText class="px-5 py-4 d-flex flex-column gap-2">
                <VBtn
                  block
                  variant="tonal"
                  prepend-icon="tabler-arrow-left"
                  class="text-none"
                  @click="goList"
                >
                  {{ $t('pages.dropShippingOrderDetail.actions.backToList') }}
                </VBtn>
                <VBtn
                  block
                  color="primary"
                  prepend-icon="tabler-copy"
                  class="text-none"
                  @click="goCopy"
                >
                  {{ $t('pages.dropShippingOrderLabelDetail.actions.copyThis') }}
                </VBtn>
              </VCardText>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </FormPageLoadingOverlay>
  </VContainer>
</template>

<style scoped>
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

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding-block: 0.5rem;
  border-bottom: 1px dashed rgba(var(--v-border-color), 0.4);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-label {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: nowrap;
  flex-shrink: 0;
}

.summary-value {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.87);
  text-align: right;
}

@media (min-width: 1280px) {
  .detail-sidebar {
    position: sticky;
    top: 5rem;
  }
}
</style>
