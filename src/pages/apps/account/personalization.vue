<script setup>
import { $api, $apiJson } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const submitting = ref(false)
const isValid = ref(true)
const snack = ref({ show: false, text: '', color: 'info' })
const { t } = useI18n({ useScope: 'global' })

const form = ref({
  isEnabled: 0,
  primaryLogisticsId: null,
  secondaryLogisticsId: 0,
  fallbackLogisticsId: 0,
})

const logisticsList = [
  { id: 27, name: 'USPS' },
  { id: 50, name: 'UPS' },
  { id: 52, name: 'FedEx 2Day' },
  { id: 53, name: 'SPEEDX' },
  { id: 56, name: 'Amazon' },
  { id: 213, name: 'NEXTDAY' },
  { id: 214, name: 'USPS-Y' },
]

const logisticsItems = logisticsList.map(i => ({ title: i.name, value: i.id }))
const optionalLogisticsItems = computed(() => [{ title: t('pages.accountPersonalization.optionalDisabled'), value: 0 }, ...logisticsItems])

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await $api('/ordernew/getOrderRule', { method: 'GET' })
    if (Number(res?.code) === 1 && res.data) {
      form.value = {
        isEnabled: Number(res.data.is_enabled ?? 0),
        primaryLogisticsId: res.data.primary_logistics_id || null,
        secondaryLogisticsId: Number(res.data.secondary_logistics_id ?? 0),
        fallbackLogisticsId: Number(res.data.fallback_logistics_id ?? 0),
      }
    }
    else {
      toast(res?.msg || t('pages.accountPersonalization.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountPersonalization.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function validatePrimary(value) {
  if (!value || Number(value) === 0)
    return t('pages.accountPersonalization.messages.primaryRequired')

  return true
}

async function saveConfig() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  submitting.value = true
  try {
    const payload = {
      'is_enabled': Number(form.value.isEnabled),
      'primary_logistics_id': Number(form.value.primaryLogisticsId),
      'secondary_logistics_id': Number(form.value.secondaryLogisticsId || 0),
      'fallback_logistics_id': Number(form.value.fallbackLogisticsId || 0),
    }

    const res = await $apiJson('/ordernew/saveOrderRule', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1)
      toast(res?.msg || t('pages.accountPersonalization.messages.saveSuccess'), 'success')
    else
      toast(res?.msg || t('pages.accountPersonalization.messages.saveFailed'), 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountPersonalization.messages.networkFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}

// AI Subscription State
const subStatus = ref(null)
const subLogs = ref([])
const subLogsLoading = ref(false)
const subLogsTotal = ref(0)
const subLogsPage = ref(1)
const subLogsLimit = 5

const isSubscribing = ref(false)
const subConfirmDialog = ref({
  show: false,
  targetTier: null,
  isUpgrade: false,
  message: '',
  title: ''
})

async function loadSubStatus() {
  try {
    const res = await $api('/ordernewapi/aiSubscribeStatus', { method: 'GET' })
    if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res.data) {
      subStatus.value = res.data
    }
  } catch (e) {
    console.error('Failed to load subscription status', e)
  }
}

async function loadSubLogs(page = 1) {
  subLogsLoading.value = true
  try {
    const res = await $api('/ordernewapi/aiSubscribeLogs', {
      method: 'GET',
      query: { page, limit: subLogsLimit }
    })
    if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res.data) {
      subLogs.value = res.data.data || []
      subLogsTotal.value = Number(res.data.total) || 0
      subLogsPage.value = Number(res.data.current_page) || 1
    }
  } catch (e) {
    console.error('Failed to load subscription logs', e)
  } finally {
    subLogsLoading.value = false
  }
}

function requestChangeTier(tier) {
  if (!subStatus.value) return
  
  const current = Number(subStatus.value.current_tier || 1)
  const target = Number(tier)
  
  if (current === target && Number(subStatus.value.next_tier || current) === target) return
  
  const isUpgrade = current === 1 && (target === 2 || target === 3)
  const nextMon = getNextMondayText()
  const currentCycleEnd = subStatus.value.billing_cycle_end || subStatus.value.next_billing_date || '—'
  
  const targetName = t(`pages.accountPersonalization.aiSubscription.tierName.${target}`)
  const targetPriceVal = t(`pages.accountPersonalization.aiSubscription.priceVal.${target}`)
  
  let confirmMsg = ''
  if (isUpgrade) {
    confirmMsg = t('pages.accountPersonalization.aiSubscription.actions.confirmUpgrade', {
      tierName: targetName,
      price: targetPriceVal,
      date: nextMon
    })
  } else {
    confirmMsg = t('pages.accountPersonalization.aiSubscription.actions.confirmChange', {
      tierName: targetName,
      date: currentCycleEnd
    })
  }
  
  subConfirmDialog.value = {
    show: true,
    targetTier: target,
    isUpgrade,
    title: t('pages.accountPersonalization.aiSubscription.actions.confirmTitle'),
    message: confirmMsg
  }
}

async function confirmSubscriptionChange() {
  const tier = subConfirmDialog.value.targetTier
  if (!tier) return
  
  subConfirmDialog.value.show = false
  isSubscribing.value = true
  try {
    const res = await $apiJson('/ordernewapi/aiSubscribe', {
      method: 'POST',
      body: { tier: Number(tier) }
    })
    
    if (Number(res?.code) === 1 || Number(res?.code) === 200) {
      toast(res?.message || t('pages.accountPersonalization.messages.saveSuccess'), 'success')
      await loadSubStatus()
      await loadSubLogs(1)
    } else {
      toast(res?.message || t('pages.accountPersonalization.messages.saveFailed'), 'error')
    }
  } catch (e) {
    toast(e?.data?.message || e?.message || t('pages.accountPersonalization.messages.networkFailed'), 'error')
  } finally {
    isSubscribing.value = false
  }
}

function getNextMondayText() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() + (day === 0 ? 1 : 8 - day)
  const nextMon = new Date(d.setDate(diff))
  const yyyy = nextMon.getFullYear()
  const mm = String(nextMon.getMonth() + 1).padStart(2, '0')
  const dd = String(nextMon.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

onMounted(async () => {
  await loadConfig()
  await loadSubStatus()
  await loadSubLogs(1)
})
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 account-config-page"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>
    <VCard class="rounded-lg position-relative">
      <VOverlay
        :model-value="loading"
        contained
        persistent
        class="align-center justify-center"
      >
        <div class="d-flex align-center gap-3 px-4 py-3 bg-surface rounded">
          <VProgressCircular
            indeterminate
            color="primary"
            size="24"
          />
          <span class="text-body-2">{{ $t('pages.accountPersonalization.loading') }}</span>
        </div>
      </VOverlay>
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">{{ $t('pages.accountPersonalization.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.accountPersonalization.subtitle') }}</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <VAlert
          type="info"
          variant="tonal"
          class="mb-4"
        >
          {{ $t('pages.accountPersonalization.alert') }}
        </VAlert>

        <VSheet
          border
          rounded="lg"
          class="pa-4 mb-5"
        >
          <div class="d-flex align-center flex-wrap gap-2 gap-sm-3">
            <VChip
              color="primary"
              label
              variant="tonal"
            >
              {{ $t('pages.accountPersonalization.steps.primary') }}
            </VChip>
            <VIcon icon="tabler-arrow-right" />
            <VChip
              color="warning"
              label
              variant="tonal"
            >
              {{ $t('pages.accountPersonalization.steps.secondary') }}
            </VChip>
            <VIcon icon="tabler-arrow-right" />
            <VChip
              color="success"
              label
              variant="tonal"
            >
              {{ $t('pages.accountPersonalization.steps.fallback') }}
            </VChip>
          </div>
        </VSheet>

        <VForm
          ref="formRef"
          v-model="isValid"
        >
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <VSwitch
                v-model="form.isEnabled"
                :true-value="1"
                :false-value="0"
                color="primary"
                :label="$t('pages.accountPersonalization.fields.switch')"
                inset
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
              class="d-flex align-center justify-md-end"
            >
              <VChip
                :color="Number(form.isEnabled) === 1 ? 'success' : 'secondary'"
                variant="tonal"
                label
              >
                {{ Number(form.isEnabled) === 1 ? $t('pages.accountPersonalization.status.enabled') : $t('pages.accountPersonalization.status.disabled') }}
              </VChip>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.primaryLogisticsId"
                :label="$t('pages.accountPersonalization.fields.primary')"
                :items="logisticsItems"
                item-title="title"
                item-value="value"
                :placeholder="$t('pages.accountPersonalization.placeholders.primary')"
                :rules="[validatePrimary]"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                {{ $t('pages.accountPersonalization.hints.primary') }}
              </div>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.secondaryLogisticsId"
                :label="$t('pages.accountPersonalization.fields.secondary')"
                :items="optionalLogisticsItems"
                item-title="title"
                item-value="value"
                :placeholder="$t('pages.accountPersonalization.placeholders.secondary')"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                {{ $t('pages.accountPersonalization.hints.secondary') }}
              </div>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.fallbackLogisticsId"
                :label="$t('pages.accountPersonalization.fields.fallback')"
                :items="optionalLogisticsItems"
                item-title="title"
                item-value="value"
                :placeholder="$t('pages.accountPersonalization.placeholders.fallback')"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                {{ $t('pages.accountPersonalization.hints.fallback') }}
              </div>
            </VCol>

            <VCol cols="12">
              <div class="d-flex justify-end mt-2">
                <VBtn
                  color="primary"
                  :loading="submitting"
                  :disabled="loading"
                  @click="saveConfig"
                >
                  {{ $t('pages.accountPersonalization.actions.save') }}
                </VBtn>
              </div>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>

    <!-- AI Subscription Card -->
    <VCard class="rounded-lg position-relative mt-6">
      <VOverlay
        :model-value="isSubscribing"
        contained
        persistent
        class="align-center justify-center"
      >
        <div class="d-flex align-center gap-3 px-4 py-3 bg-surface rounded animate-pulse">
          <VProgressCircular
            indeterminate
            color="primary"
            size="24"
          />
          <span class="text-body-2">{{ $t('pages.accountPersonalization.loading') }}</span>
        </div>
      </VOverlay>
      
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">{{ $t('pages.accountPersonalization.aiSubscription.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.accountPersonalization.aiSubscription.subtitle') }}</span>
        </template>
      </VCardItem>
      <VDivider />
      
      <VCardText class="pa-4 pa-sm-6">
        <!-- Status Display -->
        <VRow v-if="subStatus" class="mb-6">
          <VCol cols="12" md="6">
            <VCard border flat class="pa-4 h-100 bg-var-theme-background">
              <div class="text-subtitle-2 text-medium-emphasis mb-1">
                {{ $t('pages.accountPersonalization.aiSubscription.currentTier') }}
              </div>
              <div class="d-flex align-center gap-2">
                <span class="text-h6 font-weight-bold text-primary">
                  {{ $t(`pages.accountPersonalization.aiSubscription.tierName.${subStatus.current_tier || 1}`) }}
                </span>
                <VChip color="primary" variant="tonal" size="small">
                  {{ $t(`pages.accountPersonalization.aiSubscription.price.${subStatus.current_tier || 1}`) }}
                </VChip>
              </div>
              <div v-if="subStatus.next_billing_date && Number(subStatus.current_tier) > 1" class="text-caption text-medium-emphasis mt-2">
                {{ $t('pages.accountPersonalization.aiSubscription.nextBillingDate', { date: subStatus.next_billing_date }) }}
              </div>
            </VCard>
          </VCol>
          
          <VCol cols="12" md="6" v-if="subStatus.next_tier && Number(subStatus.next_tier) !== Number(subStatus.current_tier)">
            <VCard border flat class="pa-4 h-100 bg-light-warning">
              <div class="text-subtitle-2 text-warning mb-1 font-weight-medium d-flex align-center gap-1">
                <VIcon icon="tabler-clock" size="18" />
                {{ $t('pages.accountPersonalization.aiSubscription.nextTier') }}
              </div>
              <div class="d-flex align-center gap-2">
                <span class="text-h6 font-weight-bold text-warning">
                  {{ $t(`pages.accountPersonalization.aiSubscription.tierName.${subStatus.next_tier}`) }}
                </span>
                <VChip color="warning" variant="tonal" size="small">
                  {{ $t(`pages.accountPersonalization.aiSubscription.price.${subStatus.next_tier}`) }}
                </VChip>
              </div>
              <div v-if="subStatus.active_from" class="text-caption text-medium-emphasis mt-2">
                {{ $t('pages.accountPersonalization.aiSubscription.effectiveFrom', { date: subStatus.active_from }) }}
              </div>
            </VCard>
          </VCol>
        </VRow>
        
        <!-- Pricing Tiers Grid -->
        <VRow class="mb-8">
          <VCol
            v-for="tier in [1, 2, 3]"
            :key="tier"
            cols="12"
            md="4"
          >
            <VCard
              border
              class="pricing-card h-100 d-flex flex-column"
              :class="{
                'pricing-card--active': subStatus && Number(subStatus.current_tier || 1) === tier,
                'pricing-card--pending': subStatus && Number(subStatus.next_tier || 1) === tier && Number(subStatus.current_tier || 1) !== tier
              }"
            >
              <VCardItem class="text-center pt-6 pb-2">
                <VIcon
                  :icon="tier === 1 ? 'tabler-gift' : (tier === 2 ? 'tabler-sparkles' : 'tabler-crown')"
                  size="36"
                  class="mb-3 text-primary"
                />
                <VCardTitle class="text-h6 font-weight-bold">
                  {{ $t(`pages.accountPersonalization.aiSubscription.tierName.${tier}`) }}
                </VCardTitle>
                <div class="text-h5 font-weight-black text-primary mt-2">
                  {{ $t(`pages.accountPersonalization.aiSubscription.price.${tier}`) }}
                </div>
              </VCardItem>
              
              <VCardText class="text-center flex-grow-1 px-4 py-3 text-body-2 text-medium-emphasis">
                {{ $t(`pages.accountPersonalization.aiSubscription.tierDesc.${tier}`) }}
              </VCardText>
              
              <VDivider />
              
              <div class="pa-4 text-center">
                <!-- Current Plan -->
                <VBtn
                  v-if="subStatus && Number(subStatus.current_tier || 1) === tier"
                  color="success"
                  variant="flat"
                  block
                  disabled
                >
                  <VIcon icon="tabler-check" class="me-1" />
                  {{ $t('pages.accountPersonalization.aiSubscription.actions.current') }}
                </VBtn>
                
                <!-- Booked Plan -->
                <VBtn
                  v-else-if="subStatus && Number(subStatus.next_tier || 1) === tier"
                  color="warning"
                  variant="flat"
                  block
                  disabled
                >
                  <VIcon icon="tabler-clock" class="me-1" />
                  {{ $t('pages.accountPersonalization.aiSubscription.actions.pending') }}
                </VBtn>
                
                <!-- Subscribe Btn -->
                <VBtn
                  v-else
                  color="primary"
                  variant="elevated"
                  block
                  @click="requestChangeTier(tier)"
                >
                  {{ $t('pages.accountPersonalization.aiSubscription.actions.subscribe') }}
                </VBtn>
              </div>
            </VCard>
          </VCol>
        </VRow>
        
        <!-- Billing Logs Table -->
        <div class="logs-section mt-8">
          <div class="text-h6 font-weight-bold mb-4 d-flex align-center gap-2">
            <VIcon icon="tabler-file-text" color="primary" />
            {{ $t('pages.accountPersonalization.aiSubscription.logs.title') }}
          </div>
          
          <VTable
            v-if="subLogs.length"
            density="comfortable"
            class="logs-table border rounded-lg overflow-hidden text-body-2"
          >
            <thead>
              <tr>
                <th>{{ $t('pages.accountPersonalization.aiSubscription.logs.headers.time') }}</th>
                <th>{{ $t('pages.accountPersonalization.aiSubscription.logs.headers.amount') }}</th>
                <th>{{ $t('pages.accountPersonalization.aiSubscription.logs.headers.balance') }}</th>
                <th>{{ $t('pages.accountPersonalization.aiSubscription.logs.headers.remark') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in subLogs" :key="log.id">
                <td class="text-no-wrap text-medium-emphasis">
                  {{ formatDate(log.createtime) }}
                </td>
                <td class="font-weight-medium" :class="Number(log.change_money) < 0 ? 'text-error' : 'text-success'">
                  {{ Number(log.change_money) < 0 ? '-' : '+' }}${{ Math.abs(Number(log.change_money)).toFixed(2) }}
                </td>
                <td class="text-medium-emphasis">
                  ${{ Number(log.last_money).toFixed(2) }}
                </td>
                <td class="text-wrap">
                  {{ log.remark || '—' }}
                </td>
              </tr>
            </tbody>
          </VTable>
          
          <div
            v-else-if="subLogsLoading"
            class="d-flex justify-center py-6"
          >
            <VProgressCircular indeterminate color="primary" />
          </div>
          
          <div
            v-else
            class="text-center py-6 text-body-2 text-medium-emphasis border rounded-lg"
          >
            {{ $t('pages.accountPersonalization.aiSubscription.logs.empty') }}
          </div>
          
          <!-- Pagination -->
          <div v-if="subLogsTotal > subLogsLimit" class="d-flex justify-end mt-4">
            <VPagination
              v-model="subLogsPage"
              :length="Math.ceil(subLogsTotal / subLogsLimit)"
              total-visible="5"
              size="small"
              @update:model-value="loadSubLogs"
            />
          </div>
        </div>
      </VCardText>
    </VCard>
  </VContainer>

  <!-- Subscription Confirmation Dialog -->
  <VDialog
    v-model="subConfirmDialog.show"
    max-width="500"
  >
    <VCard class="rounded-lg">
      <VCardItem class="pb-2">
        <VCardTitle class="text-h6 font-weight-bold d-flex align-center gap-2">
          <VIcon icon="tabler-alert-circle" color="warning" />
          {{ subConfirmDialog.title }}
        </VCardTitle>
      </VCardItem>
      <VCardText class="pb-4">
        <div class="text-body-1 style-message-text" style="white-space: pre-line;">
          {{ subConfirmDialog.message }}
        </div>
      </VCardText>
      <VCardActions class="px-6 pb-6 pt-0 d-flex justify-end gap-2">
        <VBtn
          color="secondary"
          variant="tonal"
          @click="subConfirmDialog.show = false"
        >
          取消
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          @click="confirmSubscriptionChange"
        >
          确认变更
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.account-config-page {
  padding-block-end: 5.25rem;
}

.account-config-page__back {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.account-config-page__back:hover {
  text-decoration: underline;
}

.account-config-footer-bar {
  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 20;
  padding: 0.625rem 0.875rem;
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(8px);
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.account-config-footer-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  max-inline-size: 1280px;
  margin-inline: auto;
}

.pricing-card {
  transition: all 0.22s ease-in-out;
  border-width: 1px !important;
}

.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08) !important;
}

.pricing-card--active {
  border: 2px solid rgb(var(--v-theme-success)) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-success), 0.15) !important;
}

.pricing-card--pending {
  border: 2px dashed rgb(var(--v-theme-warning)) !important;
}

.bg-light-warning {
  background-color: rgba(var(--v-theme-warning), 0.08) !important;
}

.style-message-text {
  line-height: 1.6;
}

@media (max-width: 599px) {
  .account-config-footer-bar__inner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
