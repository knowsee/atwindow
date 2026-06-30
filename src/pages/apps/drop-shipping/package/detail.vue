<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api } from '@/utils/api'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const loading = ref(true)
const snack = ref({ show: false, text: '', color: 'info' })

const packageId = computed(() => Number(route.query.id || 0) || null)

const warehouseOptions = ref([])

const pkgInfo = ref({})
const senderInfo = ref({})
const productList = ref([])

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-package-list' })
}

function resolveWarehouseInfo(id) {
  if (!id)
    return null

  return warehouseOptions.value.find(w => Number(w.value) === Number(id)) || null
}

function normalizeSender(raw) {
  const row = raw || {}

  return {
    name: row.name || '',
    phone: row.telephone || row.phone || row.mobile || '',
    country: row.country || '',
    address: row.address || '',
  }
}

const totalQty = computed(() =>
  productList.value.reduce((acc, r) => acc + Number(r.skunum || 0), 0),
)

const currentWarehouseInfo = computed(() => resolveWarehouseInfo(pkgInfo.value.warehouse_id))

async function loadDetail() {
  if (!packageId.value) {
    toast(t('pages.dropShippingPackageDetail.messages.missingId'), 'error')
    loading.value = false

    return
  }
  try {
    const [wh, res] = await Promise.all([
      loadWarehouseOptions(undefined, 3),
      $api('/ordernew/packageDetail', { method: 'POST', body: { id: packageId.value } }),
    ])

    warehouseOptions.value = wh

    if (Number(res?.code) === 1 && res?.data) {
      const data = res.data

      pkgInfo.value = data.package || {}
      senderInfo.value = normalizeSender(data.send_data || {})
      productList.value = Array.isArray(data.products) ? data.products : []
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageDetail.messages.loadInboundFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageDetail.messages.loadFailed'), 'error')
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
      :message="$t('pages.dropShippingPackageCreate.overlay.detail')"
    >
      <!-- Page header -->
      <div class="print-label-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <div class="text-caption text-primary mb-1">
            {{ $t('pages.dropShippingPackageDetail.hero.eyebrow') }}
          </div>
          <h1 class="text-h4 font-weight-bold text-high-emphasis d-flex align-center gap-2">
            {{ $t('pages.dropShippingPackageDetail.hero.title') }}
            <VChip
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ $t('pages.dropShippingPackageDetail.hero.readonly') }}
            </VChip>
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
            {{ $t('pages.dropShippingPackageDetail.hero.subtitle') }}
          </p>
        </div>
        <div class="d-flex gap-2">
          <VBtn
            v-if="pkgInfo.pdf_url"
            color="primary"
            variant="tonal"
            prepend-icon="tabler-file-type-pdf"
            :href="pkgInfo.pdf_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('pages.dropShippingPackageDetail.actions.pdf') }}
          </VBtn>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            {{ $t('common.actions.backToList') }}
          </VBtn>
        </div>
      </div>

      <VRow>
        <!-- Main content -->
        <VCol
          cols="12"
          md="8"
        >
          <!-- Card 1: Core information -->
          <VCard
            class="mb-4"
            elevation="0"
            border
          >
            <VCardText class="pa-5">
              <div class="d-flex flex-column flex-sm-row justify-space-between align-start">
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase tracking-widest mb-1">
                    {{ $t('pages.dropShippingPackageDetail.sections.tracking') }}
                  </div>
                  <span class="text-h4 font-weight-black text-high-emphasis ds-mono">
                    {{ pkgInfo.tracking_no || pkgInfo.order_sn || '—' }}
                  </span>
                </div>
                <div class="mt-4 mt-sm-0 text-sm-right">
                  <VChip
                    v-if="pkgInfo.status_text || pkgInfo.status"
                    color="primary"
                    size="large"
                    class="font-weight-bold text-subtitle-1 px-4 mb-2"
                    variant="elevated"
                  >
                    {{ pkgInfo.status_text || pkgInfo.status }}
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
                    {{ $t('pages.dropShippingPackageDetail.sections.warehouse') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ pkgInfo.warehouse_name || '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingPackageDetail.sections.createdAt') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ pkgInfo.createtime || '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingPackageDetail.sections.inboundDate') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ pkgInfo.receivetime || '—' }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.dropShippingPackageDetail.sections.remark') }}
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    {{ pkgInfo.remark || '—' }}
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Card 2: Logistics and address information -->
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
              {{ $t('pages.dropShippingPackageDetail.sections.logisticsAddress') }}
            </VCardTitle>
            <VCardText class="px-5 pb-5 pt-0">
              <div class="d-flex flex-column flex-md-row gap-4 align-md-stretch">
                <!-- Left: logistics information -->
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
                        {{ $t('pages.dropShippingPackageDetail.sections.logistics') }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="pkgInfo.yjdc_time?.start || pkgInfo.yjdc_time?.end"
                    class="mb-3"
                  >
                    <div class="text-caption text-medium-emphasis">
                      {{ $t('pages.dropShippingPackageDetail.sections.eta') }}
                    </div>
                    <div class="text-body-1 font-weight-bold text-high-emphasis">
                      {{ pkgInfo.yjdc_time?.start || '—' }}
                      <span class="text-medium-emphasis mx-1">{{ $t('pages.dropShippingPackageDetail.table.to') }}</span>
                      {{ pkgInfo.yjdc_time?.end || '—' }}
                    </div>
                  </div>
                  <div
                    v-else
                    class="text-body-2 text-medium-emphasis"
                  >
                    {{ $t('pages.dropShippingPackageDetail.empty.logisticsTime') }}
                  </div>
                </div>

                <!-- Center arrow -->
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

                <!-- Right: warehouse receiving address -->
                <div
                  v-if="currentWarehouseInfo"
                  class="flex-grow-1 address-box rounded pa-4 bg-var-theme-background"
                >
                  <div class="d-flex align-center mb-4">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      rounded
                      size="40"
                      class="me-3"
                    >
                      <VIcon
                        icon="tabler-building-warehouse"
                        size="24"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                        {{ $t('pages.dropShippingPackageDetail.sections.warehouseAddress') }}
                      </div>
                    </div>
                  </div>
                  <div class="text-body-1 font-weight-bold mb-1">
                    {{ pkgInfo.warehouse_name || '—' }}
                  </div>
                  <div
                    v-if="currentWarehouseInfo.address"
                    class="text-body-2 text-medium-emphasis mb-2 d-flex align-start gap-1"
                  >
                    <VIcon
                      icon="tabler-map-pin"
                      size="16"
                      class="mt-1 flex-shrink-0"
                    />
                    <span>{{ currentWarehouseInfo.address }}</span>
                  </div>
                  <div
                    v-if="currentWarehouseInfo.city || currentWarehouseInfo.state || currentWarehouseInfo.code || currentWarehouseInfo.country"
                    class="text-body-2 text-medium-emphasis d-flex align-start gap-1 mb-1"
                  >
                    <VIcon
                      icon="tabler-world"
                      size="16"
                      class="mt-1 flex-shrink-0"
                    />
                    <span>{{ [currentWarehouseInfo.city, currentWarehouseInfo.state, currentWarehouseInfo.code, currentWarehouseInfo.country].filter(Boolean).join(' · ') }}</span>
                  </div>
                  <div
                    v-if="currentWarehouseInfo.telephone"
                    class="text-body-2 text-medium-emphasis d-flex align-center gap-1"
                  >
                    <VIcon
                      icon="tabler-phone"
                      size="16"
                    />
                    {{ currentWarehouseInfo.telephone }}
                  </div>
                </div>
                <div
                  v-else
                  class="flex-grow-1 address-box rounded pa-4 bg-var-theme-background d-flex align-center justify-center"
                >
                  <span class="text-medium-emphasis text-body-2">{{ $t('pages.dropShippingPackageDetail.empty.warehouseAddress') }}</span>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Card 3: Sender information -->
          <VCard
            class="mb-4"
            elevation="0"
            border
          >
            <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
              <VIcon
                icon="tabler-user"
                size="20"
                color="secondary"
              />
              {{ $t('pages.dropShippingPackageDetail.sections.sender') }}
            </VCardTitle>
            <VCardText class="px-5 pb-5 pt-0">
              <div class="address-box rounded pa-4">
                <div class="d-flex align-center mb-4">
                  <VAvatar
                    color="secondary"
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
                    <div class="text-subtitle-2 font-weight-bold text-high-emphasis d-flex align-center gap-2">
                      {{ senderInfo.sendName || senderInfo.name || '—' }}
                      <VChip
                        v-if="senderInfo.sendName || senderInfo.name"
                        size="x-small"
                        color="secondary"
                        variant="flat"
                      >
                        Sender
                      </VChip>
                    </div>
                    <div
                      v-if="senderInfo.phone"
                      class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-1"
                    >
                      <VIcon
                        icon="tabler-phone"
                        size="13"
                      />{{ senderInfo.phone }}
                    </div>
                  </div>
                </div>
                <div class="text-body-2 text-medium-emphasis mb-2 d-flex align-start gap-1">
                  <VIcon
                    icon="tabler-map-pin"
                    size="16"
                    class="mt-1 flex-shrink-0"
                  />
                  <span>{{ senderInfo.address || '—' }}</span>
                </div>
                <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1">
                  <VIcon
                    icon="tabler-world"
                    size="16"
                    class="mt-1 flex-shrink-0"
                  />
                  <span>{{ senderInfo.country || '—' }}</span>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Card 4: Product details -->
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
                {{ $t('pages.dropShippingPackageDetail.sections.products') }}
              </div>
              <VChip
                size="small"
                color="warning"
                variant="tonal"
              >
                {{ $t('pages.dropShippingPackageDetail.chips.productSummary', { kinds: productList.length, qty: totalQty }) }}
              </VChip>
            </VCardTitle>
            <VDivider />
            <VTable class="text-no-wrap invoice-table">
              <thead class="bg-var-theme-background">
                <tr>
                  <th class="font-weight-medium text-uppercase text-caption">
                    SKU
                  </th>
                  <th class="font-weight-medium text-uppercase text-caption text-right">
                    {{ $t('pages.dropShippingPackageDetail.table.declaredQty') }}
                  </th>
                  <th class="font-weight-medium text-uppercase text-caption text-right">
                    {{ $t('pages.dropShippingPackageDetail.table.actualQty') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in productList"
                  :key="idx"
                >
                  <td>
                    <div class="font-weight-semibold text-high-emphasis ds-mono">
                      {{ row.sku || '—' }}
                    </div>
                  </td>
                  <td class="text-right">
                    <VChip
                      size="small"
                      variant="flat"
                      color="primary"
                      class="px-3"
                    >
                      {{ row.skunum ?? '—' }}
                    </VChip>
                  </td>
                  <td class="text-right">
                    <VChip
                      size="small"
                      variant="flat"
                      :color="row.real_sku_num !== row.skunum ? 'warning' : 'success'"
                      class="px-3"
                    >
                      {{ row.real_sku_num ?? '—' }}
                    </VChip>
                  </td>
                </tr>
                <tr v-if="!productList.length">
                  <td
                    colspan="3"
                    class="text-center text-medium-emphasis py-6"
                  >
                    {{ $t('pages.dropShippingPackageDetail.empty.products') }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="productList.length">
                <tr>
                  <td
                    colspan="2"
                    class="text-right text-body-2 text-medium-emphasis font-weight-medium"
                  >
                    {{ $t('pages.dropShippingPackageDetail.table.totalQty') }}
                  </td>
                  <td class="text-right font-weight-bold text-primary text-h6">
                    {{ totalQty }}
                  </td>
                </tr>
              </tfoot>
            </VTable>
          </VCard>
        </VCol>

        <!-- Sidebar -->
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
                    icon="tabler-clipboard-list"
                    size="18"
                  />
                </VAvatar>
                {{ $t('pages.dropShippingPackageDetail.sections.summary') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-2">
                <div class="receipt-box px-4 py-4 rounded bg-surface">
                  <div class="receipt-item">
                    <span class="receipt-label">{{ $t('pages.dropShippingPackageDetail.sections.warehouse') }}</span>
                    <span class="receipt-value">{{ pkgInfo.warehouse_name || '—' }}</span>
                  </div>
                  <div class="receipt-item">
                    <span class="receipt-label">{{ $t('pages.dropShippingPackageDetail.sections.createdAt') }}</span>
                    <span class="receipt-value">{{ pkgInfo.createtime || '—' }}</span>
                  </div>
                  <div class="receipt-item">
                    <span class="receipt-label">{{ $t('pages.dropShippingPackageDetail.sections.inboundDate') }}</span>
                    <span class="receipt-value">{{ pkgInfo.receivetime || '—' }}</span>
                  </div>

                  <div class="receipt-divider my-4" />

                  <div class="receipt-item">
                    <span class="receipt-label">{{ $t('pages.dropShippingPackageDetail.sections.products') }}</span>
                    <span class="receipt-value text-primary font-weight-semibold">{{ $t('pages.dropShippingPackageDetail.chips.kindCount', { count: productList.length }) }}</span>
                  </div>
                  <div class="d-flex justify-space-between align-center mt-2">
                    <span class="text-subtitle-1 font-weight-bold text-high-emphasis">{{ $t('pages.dropShippingPackageDetail.table.totalQty') }}</span>
                    <span class="text-h6 font-weight-black text-success">{{ $t('pages.dropShippingPackageDetail.chips.pieceCount', { count: totalQty }) }}</span>
                  </div>
                </div>
              </VCardText>
              <VDivider />
              <VCardText class="px-5 py-4 d-flex flex-column gap-3">
                <VBtn
                  v-if="pkgInfo.pdf_url"
                  block
                  color="primary"
                  variant="elevated"
                  prepend-icon="tabler-file-type-pdf"
                  :href="pkgInfo.pdf_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-none"
                >
                  {{ $t('pages.dropShippingPackageDetail.actions.downloadPdf') }}
                </VBtn>
                <VBtn
                  block
                  variant="tonal"
                  prepend-icon="tabler-arrow-left"
                  class="text-none"
                  @click="goList"
                >
                  {{ $t('common.actions.backToList') }}
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

.ds-mono {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}

.tracking-widest {
  letter-spacing: 0.06em;
}

.address-box {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.2s ease-in-out;
}

.address-box:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.invoice-table :deep(thead th) {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 0.875rem 1rem;
  white-space: nowrap;
}

.invoice-table :deep(tbody td) {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.45);
}

.invoice-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.invoice-table :deep(tfoot td) {
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
