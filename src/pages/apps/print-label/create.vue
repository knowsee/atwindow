<script setup>
import PrintLabelProductsSection from '@/views/apps/print-label/PrintLabelProductsSection.vue'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'
import { usePrintLabelCreate } from '@/views/apps/print-label/usePrintLabelCreate'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const currentRoute = useRoute()
const { t } = useI18n({ useScope: 'global' })

const isCopy = computed(() => !!currentRoute.query.copyFrom)

const {
  channels,
  channelLogoSrc,
  brokenLogoQids,
  onChannelLogoError,
  primaryQuoteTitle,
  primaryQuoteAmount,
  addrPageCount,
  compareMode,
  selectedQid,
  danwei,
  cankaohao,
  sender,
  receiver,
  pkg,
  products,
  senderCountryList,
  receiverCountryList,
  addrDialog,
  addrDialogTarget,
  addrList,
  addrTotal,
  addrCurrentPage,
  addrPageSize,
  addrSearchName,
  addrLoading,
  senderAddressLocked,
  receiverAddressLocked,
  addrFormDialog,
  addrFormTarget,
  addrFormIsEdit,
  addrFormEditingId,
  addrForm,
  addrFormSubmitting,
  addrFormCountriesLoading,
  addrFormCountryItems,
  openAddrFormDialog,
  closeAddrFormDialog,
  submitAddrFormDialog,
  rateLoading,
  rateBest,
  rateCompareList,
  routeOptions,
  selectedRouteKey,
  submitting,
  orderLoading,
  copyLoading,
  snack,
  unitLabel,
  selectedCurrency,
  selectedValueRequired,
  selectedNeedRouteSelect,
  selectedCnNameRequired,
  senderCountryLock,
  receiverCountryLock,
  anySelectedNeedBeianAddr,
  selectedChannelAlert,
  hasRateResult,
  selectedRoute,
  isChannelSelected,
  onChannelCardClick,
  doRate,
  openAddrDialog,
  closeAddrDialog,
  loadAddrList,
  searchAddr,
  selectAddr,
  addProduct,
  addDefaultProduct,
  removeProduct,
  orderFromCompare,
  doSubmit,
} = usePrintLabelCreate()

function channelByQid(qid) {
  return channels.find(c => String(c.qid) === String(qid)) || null
}

/** 比价行 Logo URL：优先接口解析出的 logo，再回退本地渠道表 */
function compareRowLogoSrc(item) {
  const path = item?.logo || channelByQid(item?.qid)?.logo || ''
  
  return path ? channelLogoSrc(path) : ''
}

function formatMoney(n) {
  const x = Number(n)
  if (Number.isNaN(x))
    return '—'
  
  return x.toFixed(2)
}

function countryLabel(list, val) {
  const hit = list.find(c => c.value === val)

  return hit?.label || val || '—'
}

function resetAddrSearch() {
  addrSearchName.value = ''
  searchAddr()
}

function goList() {
  router.push({ name: 'apps-print-label-orders' })
}

/** 参考号过滤：不在 composable 里 watch v-model，否则会打断中文 IME；在组合结束/失焦时再清理非法字符 */
const pageBlocking = computed(() => orderLoading.value || copyLoading.value)

function sanitizeCankaohaoField() {
  const raw = String(cankaohao.value ?? '')
  const s = raw.replace(/\W/g, '')
  if (s !== raw)
    cankaohao.value = s
}

function onCankaohaoCompositionEnd() {
  sanitizeCankaohaoField()
}

function onCankaohaoBlur() {
  nextTick(() => {
    sanitizeCankaohaoField()
  })
}

function isValidCankaohao(v) {
  const s = String(v || '').trim()
  
  return !!s && /^\w+$/.test(s)
}

async function onSubmit() {
  // 本地校验参考号
  if (!isValidCankaohao(cankaohao.value)) {
    // 如果为空或包含非法字符，阻止提交并提示
    if (!String(cankaohao.value || '').trim())
      return snack.value = { show: true, text: t('pages.printLabelCreate.messages.referenceRequired'), color: 'warning' }

    return snack.value = { show: true, text: t('pages.printLabelCreate.messages.referenceInvalidSubmit'), color: 'error' }
  }

  // 通过校验则调用原有提交逻辑
  return doSubmit()
}
</script>

<template>
  <VContainer
    fluid
    class="print-label-create pa-0"
  >
    <div class="print-label-create__inner pb-12">
      <div class="print-label-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <h1 class="text-h4 font-weight-medium text-high-emphasis">
            {{ isCopy ? $t('pages.printLabelCreate.hero.titleCopy') : $t('pages.printLabelCreate.hero.title') }}
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
            {{ isCopy ? $t('pages.printLabelCreate.hero.subtitleCopy') : $t('pages.printLabelCreate.hero.subtitle') }}
          </p>
        </div>
        <VBtn
          variant="tonal"
          prepend-icon="tabler-arrow-left"
          @click="goList"
        >
          {{ $t('common.actions.backToList') }}
        </VBtn>
      </div>

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2800"
      >
        {{ snack.text }}
      </VSnackbar>

      <VOverlay
        :model-value="pageBlocking"
        class="align-center justify-center"
        persistent
      >
        <VCard
          class="pa-6"
          width="200"
        >
          <div class="d-flex align-center gap-3">
            <VProgressCircular
              indeterminate
              color="primary"
              size="28"
            />
            <span class="text-body-1">{{ $t('pages.printLabelCreate.overlay.ordering') }}</span>
          </div>
        </VCard>
      </VOverlay>

      <!-- 全局提示 -->
      <VAlert
        type="info"
        variant="tonal"
        density="compact"
        icon="tabler-shield-check"
        class="mb-4"
      >
        {{ $t('pages.printLabelCreate.globalNotice.insurance') }}
      </VAlert>

      <!-- 渠道 -->
      <PrintLabelSectionCard
        :title="$t('pages.printLabelCreate.channel.title')"
        :subtitle="$t('pages.printLabelCreate.channel.subtitle')"
      >
        <template #append>
          <div class="d-flex align-center gap-2 flex-shrink-0">
            <span class="text-caption text-medium-emphasis">{{ $t('pages.printLabelCreate.channel.compareMode') }}</span>
            <VSwitch
              v-model="compareMode"
              hide-details
              density="compact"
              color="primary"
              inset
            />
          </div>
        </template>

        <VAlert
          v-if="compareMode"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ $t('pages.printLabelCreate.channel.compareModeAlert') }}
        </VAlert>
        <div class="channel-grid">
          <VCard
            v-for="ch in channels"
            :key="ch.qid"
            class="channel-card cursor-pointer h-100 rounded-lg"
            :class="[
              isChannelSelected(ch) ? 'channel-card--active' : '',
            ]"
            variant="outlined"
            elevation="0"
            @click="onChannelCardClick(ch)"
          >
            <VCardText class="channel-card__body text-center pa-4 pa-sm-5">
              <div
                v-if="channelLogoSrc(ch.logo) && !brokenLogoQids[String(ch.qid)]"
                class="channel-card__logo"
              >
                <img
                  class="channel-card__img"
                  :src="channelLogoSrc(ch.logo)"
                  :alt="ch.name"
                  loading="lazy"
                  decoding="async"
                  @error="onChannelLogoError(ch.qid)"
                >
              </div>
              <div
                v-else
                class="channel-card__logo channel-card__logo--placeholder d-flex align-center justify-center"
              >
                <VIcon
                  icon="tabler-truck"
                  size="36"
                  color="primary"
                />
              </div>
              <div class="text-body-2 font-weight-medium mt-2 text-high-emphasis text-truncate px-1">
                {{ ch.name }}
              </div>
              <VIcon
                v-if="isChannelSelected(ch)"
                class="channel-card__check"
                icon="tabler-check"
                size="18"
                color="white"
              />
            </VCardText>
          </VCard>
        </div>
      </PrintLabelSectionCard>

      <!-- 渠道提醒 -->
      <PrintLabelSectionCard
        v-if="selectedChannelAlert?.content"
        :title="$t('pages.printLabelCreate.channel.alertTitle')"
      >
        <VAlert
          :type="selectedChannelAlert.type === 'warning' ? 'warning' : selectedChannelAlert.type === 'error' ? 'error' : 'info'"
          variant="tonal"
          border="start"
          class="print-label-alert"
        >
          <div class="font-weight-medium mb-2">
            {{ selectedChannelAlert.title || $t('pages.printLabelCreate.channel.defaultAlertTitle') }}
          </div>
          <div class="text-body-2 whitespace-pre-wrap">
            {{ selectedChannelAlert.content }}
          </div>
        </VAlert>
      </PrintLabelSectionCard>

      <!-- 基础信息 -->
      <PrintLabelSectionCard
        :title="$t('pages.printLabelCreate.basic.title')"
        :subtitle="$t('pages.printLabelCreate.basic.subtitle')"
      >
        <div class="print-label-basic d-flex flex-column flex-md-row gap-4 gap-md-6">
          <div class="print-label-basic__ref flex-grow-1 min-w-0">
            <AppTextField
              v-model="cankaohao"
              :label="$t('pages.printLabelCreate.basic.referenceLabel')"
              :placeholder="$t('pages.printLabelCreate.basic.referencePlaceholder')"
              :hint="$t('pages.printLabelCreate.basic.referenceHint')"
              persistent-hint
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              @compositionend="onCankaohaoCompositionEnd"
              @blur="onCankaohaoBlur"
            />
          </div>
          <div class="print-label-basic__unit flex-shrink-0">
            <!-- 与 AppTextField 内 VLabel 同款；不用 VCol，避免栅格 gutter 与卡片标题左缘错开 -->
            <VLabel
              class="mb-1 text-body-2 text-wrap print-label-basic__unit-label"
              :text="$t('pages.printLabelCreate.basic.unitLabel')"
            />
            <div
              class="unit-segment"
              role="radiogroup"
              :aria-label="$t('pages.printLabelCreate.basic.unitAria')"
            >
              <button
                type="button"
                role="radio"
                class="unit-segment__btn"
                :class="{ 'unit-segment__btn--active': danwei === 0 }"
                :aria-checked="danwei === 0"
                @click="danwei = 0"
              >
                {{ $t('pages.printLabelCreate.basic.metricUnit') }}
              </button>
              <button
                type="button"
                role="radio"
                class="unit-segment__btn"
                :class="{ 'unit-segment__btn--active': danwei === 1 }"
                :aria-checked="danwei === 1"
                @click="danwei = 1"
              >
                {{ $t('pages.printLabelCreate.basic.imperialUnit') }}
              </button>
            </div>
          </div>
        </div>
      </PrintLabelSectionCard>

      <!-- 发件人 -->
      <PrintLabelSectionCard :title="$t('pages.printLabelCreate.address.senderTitle')">
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-address-book"
              @click="openAddrDialog('sender')"
            >
              {{ $t('common.actions.selectFromAddressBook') }}
            </VBtn>
            <VBtn
              v-if="!anySelectedNeedBeianAddr"
              variant="tonal"
              size="small"
              prepend-icon="tabler-plus"
              @click="openAddrFormDialog('sender', false)"
            >
              {{ $t('common.actions.addAddress') }}
            </VBtn>
            <VBtn
              v-if="senderAddressLocked && !anySelectedNeedBeianAddr"
              variant="tonal"
              size="small"
              prepend-icon="tabler-pencil"
              @click="openAddrFormDialog('sender', true)"
            >
              {{ $t('common.actions.edit') }}
            </VBtn>
          </div>
        </template>

        <VAlert
          v-if="anySelectedNeedBeianAddr"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ $t('pages.printLabelCreate.address.senderBeianOnly') }}
        </VAlert>

        <VAlert
          v-if="!senderAddressLocked"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-0"
        >
          {{ $t('pages.printLabelCreate.address.senderEmpty') }}
        </VAlert>
        <VSheet
          v-else
          border
          rounded="lg"
          class="pa-4 bg-surface"
        >
          <div
            v-if="senderCountryLock"
            class="text-caption text-warning mb-2"
          >
            {{ $t('pages.printLabelCreate.address.senderCountryLock', { country: senderCountryLock }) }}
          </div>
          <div class="text-body-2 print-label-addr-readonly d-flex flex-column gap-2">
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.name') }}</span>{{ sender.name || '—' }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.address1') }}</span>{{ sender.address || '—' }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.address2') }}</span>{{ sender.address2 || '—' }}</div>
            <div v-if="sender.streetno">
              <span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.street') }}</span>{{ sender.streetno }}
            </div>
            <div class="d-flex flex-wrap gap-4">
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.city') }}</span>{{ sender.city || '—' }}</span>
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.province') }}</span>{{ sender.province || '—' }}</span>
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.postCode') }}</span>{{ sender.postCode || '—' }}</span>
            </div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.country') }}</span>{{ countryLabel(senderCountryList, sender.country) }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.telephone') }}</span>{{ sender.telephone || '—' }}</div>
            <div v-if="sender.company">
              <span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.company') }}</span>{{ sender.company }}
            </div>
          </div>
        </VSheet>
      </PrintLabelSectionCard>

      <!-- 收件人 -->
      <PrintLabelSectionCard :title="$t('pages.printLabelCreate.address.receiverTitle')">
        <template #append>
          <div class="d-flex flex-wrap gap-2 justify-end">
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-address-book"
              @click="openAddrDialog('receiver')"
            >
              {{ $t('common.actions.selectFromAddressBook') }}
            </VBtn>
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-plus"
              @click="openAddrFormDialog('receiver', false)"
            >
              {{ $t('common.actions.addAddress') }}
            </VBtn>
            <VBtn
              v-if="receiverAddressLocked"
              variant="tonal"
              size="small"
              prepend-icon="tabler-pencil"
              @click="openAddrFormDialog('receiver', true)"
            >
              {{ $t('common.actions.edit') }}
            </VBtn>
          </div>
        </template>

        <VAlert
          v-if="!receiverAddressLocked"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-0"
        >
          {{ $t('pages.printLabelCreate.address.receiverEmpty') }}
        </VAlert>
        <VSheet
          v-else
          border
          rounded="lg"
          class="pa-4 bg-surface"
        >
          <div
            v-if="receiverCountryLock"
            class="text-caption text-warning mb-2"
          >
            {{ $t('pages.printLabelCreate.address.receiverCountryLock', { country: receiverCountryLock }) }}
          </div>
          <div class="text-body-2 print-label-addr-readonly d-flex flex-column gap-2">
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.name') }}</span>{{ receiver.name || '—' }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.address1') }}</span>{{ receiver.address || '—' }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.address2') }}</span>{{ receiver.address2 || '—' }}</div>
            <div v-if="receiver.streetno">
              <span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.street') }}</span>{{ receiver.streetno }}
            </div>
            <div class="d-flex flex-wrap gap-4">
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.city') }}</span>{{ receiver.city || '—' }}</span>
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.province') }}</span>{{ receiver.province || '—' }}</span>
              <span><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.postCode') }}</span>{{ receiver.postCode || '—' }}</span>
            </div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.country') }}</span>{{ countryLabel(receiverCountryList, receiver.country) }}</div>
            <div><span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.telephone') }}</span>{{ receiver.telephone || '—' }}</div>
            <div v-if="receiver.company">
              <span class="text-medium-emphasis">{{ $t('pages.printLabelCreate.address.fields.company') }}</span>{{ receiver.company }}
            </div>
          </div>
        </VSheet>
      </PrintLabelSectionCard>

      <!-- 包裹 -->
      <PrintLabelSectionCard
        :title="$t('pages.printLabelCreate.package.title')"
        :subtitle="$t('pages.printLabelCreate.package.subtitle')"
      >
        <VRow>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="pkg.weight"
              :label="$t('pages.printLabelCreate.package.weight', { unit: unitLabel.w })"
              type="number"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="pkg.length"
              :label="$t('pages.printLabelCreate.package.length', { unit: unitLabel.l })"
              type="number"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="pkg.width"
              :label="$t('pages.printLabelCreate.package.width', { unit: unitLabel.l })"
              type="number"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="pkg.height"
              :label="$t('pages.printLabelCreate.package.height', { unit: unitLabel.l })"
              type="number"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <!-- 货品 -->
      <PrintLabelProductsSection
        :products="products"
        :unit-label="unitLabel"
        :selected-currency="selectedCurrency"
        :selected-cn-name-required="selectedCnNameRequired"
        :selected-value-required="selectedValueRequired"
        @add="addProduct"
        @add-default="addDefaultProduct"
        @remove="removeProduct"
      />

      <!-- 报价 -->
      <PrintLabelSectionCard
        id="rate-section"
        :title="$t('pages.printLabelCreate.rate.title')"
        :subtitle="$t('pages.printLabelCreate.rate.subtitle')"
      >
        <template #append>
          <VBtn
            color="primary"
            size="default"
            :loading="rateLoading"
            prepend-icon="tabler-calculator"
            @click="doRate"
          >
            {{ $t('common.actions.calculateRate') }}
          </VBtn>
        </template>

        <div
          v-if="!rateLoading && !hasRateResult"
          class="text-center text-medium-emphasis py-10"
        >
          <VIcon
            icon="tabler-currency-dollar"
            size="48"
            class="mb-2 opacity-50"
          />
          <div v-if="compareMode">
            {{ $t('pages.printLabelCreate.rate.emptyCompare') }}
          </div>
          <div v-else>
            {{ $t('pages.printLabelCreate.rate.emptySingle') }}
          </div>
        </div>
        <div
          v-else-if="rateLoading"
          class="text-center py-10"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            class="mb-2"
          />
          <div>{{ $t('pages.printLabelCreate.rate.loading') }}</div>
        </div>

        <!-- 单渠道结果 -->
        <template v-else-if="!compareMode && rateBest">
          <VCard
            variant="tonal"
            color="success"
            class="mb-4"
          >
            <VCardText>
              <div class="d-flex flex-wrap align-center justify-space-between gap-4">
                <div class="text-h6">
                  {{ primaryQuoteTitle }}
                </div>
                <div
                  v-if="!selectedNeedRouteSelect && primaryQuoteAmount != null"
                  class="text-h4 font-weight-bold text-success"
                >
                  {{ primaryQuoteAmount }}
                  <span class="text-body-2 text-medium-emphasis ms-1">{{ selectedCurrency }}</span>
                </div>
                <div
                  v-else-if="!selectedNeedRouteSelect && primaryQuoteAmount == null"
                  class="text-body-2 text-medium-emphasis"
                >
                  {{ $t('pages.printLabelCreate.rate.quoteReturned') }}
                </div>
              </div>
            </VCardText>
          </VCard>
          <div v-if="selectedNeedRouteSelect">
            <div class="text-body-2 font-weight-medium mb-2">
              {{ $t('pages.printLabelCreate.rate.chooseRoute') }}
            </div>
            <VAlert
              v-if="!routeOptions.length"
              type="warning"
              variant="tonal"
              density="compact"
            >
              {{ $t('pages.printLabelCreate.rate.noRoutes') }}
            </VAlert>
            <div
              v-else
              class="d-flex flex-column gap-2"
              role="radiogroup"
            >
              <VCard
                v-for="rt in routeOptions"
                :key="rt.key"
                variant="outlined"
                class="cursor-pointer route-option"
                :class="selectedRouteKey === rt.key ? 'route-option--selected' : ''"
                role="radio"
                :aria-checked="selectedRouteKey === rt.key"
                @click="selectedRouteKey = rt.key"
              >
                <VCardText class="d-flex align-center gap-3 py-3 px-4">
                  <span
                    class="route-radio flex-shrink-0"
                    :class="selectedRouteKey === rt.key ? 'route-radio--active' : ''"
                  />
                  <div class="flex-grow-1 min-w-0">
                    <div class="text-body-2 font-weight-semibold text-high-emphasis">
                      {{ rt.rateName || $t('pages.printLabelCreate.rate.unnamedRoute') }}
                    </div>
                    <div
                      v-if="rt.entryport"
                      class="text-caption text-medium-emphasis"
                    >
                      {{ rt.entryport }}
                    </div>
                  </div>
                  <div class="text-success font-weight-bold text-body-1 flex-shrink-0">
                    {{ rt.totalFee }} {{ selectedCurrency }}
                  </div>
                </VCardText>
              </VCard>
            </div>
          </div>
        </template>

        <!-- 比价列表 -->
        <template v-else-if="compareMode && rateCompareList.length">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
            <div class="text-body-2 font-weight-medium">
              {{ $t('pages.printLabelCreate.rate.compareSummary', { count: rateCompareList.length }) }}
            </div>
            <VChip
              color="primary"
              size="small"
              variant="tonal"
            >
              {{ $t('pages.printLabelCreate.rate.resultChip') }}
            </VChip>
          </div>
          <VCard
            v-for="item in rateCompareList"
            :key="item.qid"
            class="mb-3 compare-quote-card"
            :variant="item.rank === 1 ? 'tonal' : 'outlined'"
            :color="item.rank === 1 ? 'success' : undefined"
          >
            <VCardItem class="pb-2">
              <template #prepend>
                <div class="d-flex align-center gap-3 flex-shrink-0 me-1">
                  <div
                    v-if="compareRowLogoSrc(item) && !brokenLogoQids[String(item.qid)]"
                    class="compare-row-logo"
                  >
                    <img
                      class="compare-row-logo__img"
                      :src="compareRowLogoSrc(item)"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      @error="onChannelLogoError(item.qid)"
                    >
                  </div>
                  <VAvatar
                    v-else
                    rounded
                    size="36"
                    color="primary"
                    variant="tonal"
                  >
                    <VIcon
                      icon="tabler-truck"
                      size="22"
                    />
                  </VAvatar>
                </div>
              </template>
              <VCardTitle class="text-body-1">
                {{ item.channelName }}
              </VCardTitle>
              <VCardSubtitle class="text-caption">
                {{ item.failed ? $t('pages.printLabelCreate.rate.noQuote') : (item.isList ? $t('pages.printLabelCreate.rate.routeCount', { count: item.routes?.length || 0 }) : $t('pages.printLabelCreate.rate.standardQuote')) }}
              </VCardSubtitle>
              <template #append>
                <VChip
                  v-if="item.rank === 1"
                  color="success"
                  size="small"
                >
                  {{ $t('pages.printLabelCreate.rate.bestDeal') }}
                </VChip>
              </template>
            </VCardItem>
            <VCardText class="pt-2">
              <template v-if="item.failed">
                <VAlert
                  type="warning"
                  variant="tonal"
                  density="compact"
                  class="text-body-2 mb-0"
                >
                  {{ item.failMessage }}
                </VAlert>
              </template>
              <template v-else-if="!item.isList">
                <div class="compare-quote-row">
                  <div class="min-w-0">
                    <div class="font-weight-medium">
                      {{ item.singleRateName || $t('pages.printLabelCreate.rate.standardRoute') }}
                    </div>
                    <div
                      v-if="item.singleNotes"
                      class="text-caption text-medium-emphasis"
                    >
                      {{ item.singleNotes }}
                    </div>
                  </div>
                  <div class="compare-quote-row__actions">
                    <span class="text-success text-h6 font-weight-bold">{{ formatMoney(item.singleFee) }} {{ item.currency }}</span>
                    <VBtn
                      color="primary"
                      size="small"
                      @click="orderFromCompare(item, null)"
                    >
                      {{ $t('common.actions.order') }}
                    </VBtn>
                  </div>
                </div>
              </template>
              <template v-else>
                <div
                  v-for="route in item.routes"
                  :key="route.key"
                  class="compare-quote-row"
                >
                  <div class="min-w-0">
                    <div class="font-weight-medium">
                      {{ route.rateName }}
                    </div>
                    <div
                      v-if="route.notes"
                      class="text-caption text-medium-emphasis"
                    >
                      {{ route.notes }}
                    </div>
                  </div>
                  <div class="compare-quote-row__actions">
                    <span class="text-success font-weight-bold">{{ formatMoney(route.totalFee) }} {{ item.currency }}</span>
                    <VBtn
                      color="primary"
                      size="small"
                      @click="orderFromCompare(item, route)"
                    >
                      {{ $t('common.actions.order') }}
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardText>
          </VCard>
        </template>
      </PrintLabelSectionCard>

      <!-- 底部操作 -->
      <VCard
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            size="default"
            :loading="submitting"
            :disabled="rateLoading"
            prepend-icon="tabler-send"
            @click="onSubmit"
          >
            {{ isCopy ? $t('pages.printLabelCreate.submit.nowCopy') : $t('pages.printLabelCreate.submit.now') }}
          </VBtn>
        </VCardText>
      </VCard>

      <AddressBookPickerDialog
        v-model="addrDialog"
        v-model:search-name="addrSearchName"
        v-model:current-page="addrCurrentPage"
        content-class="print-label-addr-dialog-wrap"
        :title="addrDialogTarget === 'sender' ? $t('pages.printLabelCreate.dialogs.senderAddressTitle') : $t('pages.printLabelCreate.dialogs.receiverAddressTitle')"
        :subtitle="$t('pages.printLabelCreate.dialogs.addressBookSubtitle')"
        :country-lock="addrDialogTarget === 'sender' ? (senderCountryLock || '') : (receiverCountryLock || '')"
        :addr-type="addrDialogTarget === 'sender' ? 1 : 2"
        :items="addrList"
        :total="addrTotal"
        :loading="addrLoading"
        :page-size="addrPageSize"
        :page-count="addrPageCount"
        @close="closeAddrDialog"
        @search="searchAddr"
        @reset-search="resetAddrSearch"
        @select="selectAddr"
        @load-page="loadAddrList"
      />

      <AddressFormDialog
        v-model="addrFormDialog"
        v-model:form="addrForm"
        :addr-type="addrFormTarget === 'sender' ? 1 : 2"
        :is-edit="addrFormIsEdit"
        :editing-id="addrFormEditingId"
        :country-lock="addrFormTarget === 'sender' ? (senderCountryLock || '') : (receiverCountryLock || '')"
        :country-items="addrFormCountryItems"
        :countries-loading="addrFormCountriesLoading"
        :submitting="addrFormSubmitting"
        @submit="submitAddrFormDialog"
      />
    </div>
  </VContainer>
</template>

<style scoped>
/* 渠道卡片：断点增加列数（避免 auto-fill 在条目少于列数时留下空轨） */
.channel-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 600px) {
  .channel-grid {
    gap: 0.875rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .channel-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .channel-grid {
    gap: 1rem;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .channel-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .channel-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}

@media (min-width: 1920px) {
  .channel-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

.channel-card {
  position: relative;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.channel-card--active {
  border-color: rgb(var(--v-theme-primary)) !important;
  background: rgba(var(--v-theme-primary), 0.04);
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
.channel-card__check {
  position: absolute;
  top: 8px;
  right: 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  padding: 2px;
}
.whitespace-pre-wrap {
  white-space: pre-wrap;
}

.print-label-create__inner {
  inline-size: 100%;
  max-inline-size: 100%;
  padding-inline: 0.75rem;
}

@media (min-width: 600px) {
  .print-label-create__inner {
    padding-inline: 1rem;
  }
}

@media (min-width: 1264px) {
  .print-label-create__inner {
    padding-inline: 1.25rem;
  }
}

.print-label-alert {
  border-radius: 0.375rem;
}

/* 基础信息：flex 行距；宽屏下单位列最小宽度接近原 md=5 栅格比例 */
.print-label-basic {
  row-gap: 0.5rem;
}

@media (min-width: 960px) {
  .print-label-basic__unit {
    flex: 0 1 min(100%, 22rem);
    min-inline-size: min(100%, 18rem);
  }
}

/* 与 AppTextField 中 VLabel 的 line-height 一致，双列表头基线对齐 */
.print-label-basic__unit-label {
  line-height: 15px;
}

/* 单位切换：单轨道「滑块」分段，避免 VBtnToggle 双边框堆叠 */
.unit-segment {
  display: flex;
  inline-size: 100%;
  max-inline-size: 20rem;
  padding: 3px;
  gap: 2px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.unit-segment__btn {
  flex: 1 1 0;
  min-inline-size: 0;
  border: none;
  border-radius: 8px;
  padding-block: 0.5rem;
  padding-inline: 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: rgba(var(--v-theme-on-surface), 0.62);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.unit-segment__btn:hover:not(.unit-segment__btn--active) {
  color: rgba(var(--v-theme-on-surface), 0.85);
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.unit-segment__btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.unit-segment__btn--active {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 1px 2px rgba(var(--v-shadow-key-umbra-color), 0.06),
    0 1px 3px rgba(var(--v-shadow-key-penumbra-color), 0.08);
}

@media (min-width: 960px) {
  .unit-segment {
    max-inline-size: none;
  }
}

:global(.print-label-addr-dialog-wrap) {
  border-radius: 12px;
  overflow: hidden;
}

.compare-quote-card {
  overflow: hidden;
}

.compare-quote-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-block: 0.5rem;
}

.compare-quote-row:not(:last-child) {
  border-block-end: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}

.compare-quote-row__actions {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

.route-option {
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.route-option:hover:not(.route-option--selected) {
  border-color: rgba(var(--v-theme-primary), 0.45) !important;
  background: rgba(var(--v-theme-primary), 0.02);
}

.route-option--selected {
  border-color: rgb(var(--v-theme-primary)) !important;
  background: rgba(var(--v-theme-primary), 0.06);
}

/* CSS-drawn radio indicator — avoids VRadio/VRadioGroup internal layout side-effects */
.route-radio {
  display: inline-block;
  flex-shrink: 0;
  inline-size: 18px;
  block-size: 18px;
  border-radius: 50%;
  border: 2px solid rgba(var(--v-border-color), var(--v-high-emphasis-opacity));
  position: relative;
  transition: border-color 0.18s ease;
}

.route-radio--active {
  border-color: rgb(var(--v-theme-primary));
}

.route-radio--active::after {
  content: '';
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  transform: translate(-50%, -50%);
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-primary));
}

/* 渠道 Logo：原生 img + object-fit，避免 VImg 在固定高度下宽高为 0 */
.channel-card__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 48px;
  inline-size: 100%;
  max-inline-size: min(100%, 120px);
  margin-inline: auto;
}

.channel-card__img {
  display: block;
  max-block-size: 48px;
  max-inline-size: 120px;
  inline-size: auto;
  block-size: auto;
  object-fit: contain;
  object-position: center;
}

.channel-card__logo--placeholder {
  block-size: 48px;
}

.compare-row-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 36px;
  inline-size: 80px;
}

.compare-row-logo__img {
  display: block;
  max-block-size: 36px;
  max-inline-size: 80px;
  inline-size: auto;
  block-size: auto;
  object-fit: contain;
  object-position: center;
}

@media (max-width: 599px) {
  .compare-quote-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .compare-quote-row__actions {
    inline-size: 100%;
    justify-content: space-between;
  }
}
</style>
