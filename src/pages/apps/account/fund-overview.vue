<script setup>
import { $api } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(false)
const rechargeVisible = ref(false)
const submitting = ref(false)
const activeRechargeTab = ref('rmb')
const activeUsdBankPanel = ref(['boa'])
const wxDialogVisible = ref(false)
const wxPollingTimer = ref(null)
const { t } = useI18n({ useScope: 'global' })
const TIME_RANGE_SEPARATOR = '\u81f3'
const INCOME_TYPE = '\u6536\u5165'
const EXPENSE_TYPE = '\u652f\u51fa'

const filters = reactive({
  type: null,
  keyword: '',
  remark: '',
  timeRange: [],
})

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
})

const financeRows = ref([])

const summary = reactive({
  usd: '0.00',
  eur: '0.00',
  deposit: '0.00',
})

const rateCache = reactive({
  usdRate: 7.2,
  usdQuickRate: 7.2,
  eurRate: 7.9,
})

const rechargeForms = reactive({
  rmb: { payType: 1, amount: '', result: '', orderNo: '', rate: 0 },
  usd: { payType: 2, amount: '', result: '', orderNo: '', rate: 0 },
  eur: { payType: 3, amount: '', result: '', orderNo: '', rate: 0 },
  auto: { method: 1, selectedAmount: 500, customAmount: '', result: '', rate: 0 },
})

const wxPayInfo = reactive({
  username: '',
  ownPayNum: '',
  amount: '',
  qrCodeUrl: '',
})

const snack = ref({
  show: false,
  text: '',
  color: 'info',
})

const typeOptions = computed(() => [
  { title: t('pages.accountFundOverview.types.all'), value: null },
  { title: t('pages.accountFundOverview.types.income'), value: '1' },
  { title: t('pages.accountFundOverview.types.expense'), value: '2' },
])

const rechargeCurrencyOptions = computed(() => [
  { title: t('pages.accountFundOverview.currencies.rmb'), value: 1 },
  { title: t('pages.accountFundOverview.currencies.usd'), value: 2 },
])

const rechargeEurCurrencyOptions = computed(() => [
  { title: t('pages.accountFundOverview.currencies.rmb'), value: 1 },
  { title: t('pages.accountFundOverview.currencies.eur'), value: 3 },
])

const autoAmountOptions = [500, 1000, 3000, 5000]

const tableHeadersBase = computed(() => [
  { title: t('pages.accountFundOverview.headers.createTime'), key: 'createtime', width: 126 },
  { title: t('pages.accountFundOverview.headers.orderNo'), key: 'order_sn', width: 220 },
  { title: t('pages.accountFundOverview.headers.trackingNo'), key: 'ht_tracking_no', width: 160 },
  { title: t('pages.accountFundOverview.headers.tradeType'), key: 'pay_type', width: 152 },
  { title: t('pages.accountFundOverview.headers.incomeExpense'), key: 'type_name', width: 122, align: 'center' },
  { title: t('pages.accountFundOverview.headers.amountUsd'), key: 'change_money', width: 168, align: 'end' },
  { title: t('pages.accountFundOverview.headers.amountEur'), key: 'change_money_eur', width: 112, align: 'end' },
  { title: t('pages.accountFundOverview.headers.remark'), key: 'remark', minWidth: 320 },
])

const totalPage = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.limit)))

const autoDisplayAmount = computed(() => {
  const raw = rechargeForms.auto.selectedAmount || Number(rechargeForms.auto.customAmount || 0)
  
  return Number(raw || 0)
})

function buildTimeRangeParam(rangeValue) {
  if (Array.isArray(rangeValue) && rangeValue.length === 2)
    return rangeValue.join(TIME_RANGE_SEPARATOR)

  if (typeof rangeValue === 'string') {
    const text = rangeValue.trim()
    if (!text)
      return ''
    if (text.includes(' to '))
      return text.split(' to ').map(item => item.trim()).filter(Boolean).join(TIME_RANGE_SEPARATOR)
    
    return text
  }

  return ''
}

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function parseMoney(val) {
  const n = Number(String(val ?? '').replace(/,/g, ''))

  return Number.isFinite(n) ? n : 0
}

const showEurColumn = computed(() => {
  if (Math.abs(parseMoney(summary.eur)) > 1e-6)
    return true

  return financeRows.value.some(r => Math.abs(parseMoney(r.change_money_eur)) > 1e-6)
})

const tableHeaders = computed(() => {
  if (showEurColumn.value)
    return tableHeadersBase.value

  return tableHeadersBase.value.filter(h => h.key !== 'change_money_eur')
})

function formatCreatetimeLines(raw) {
  const s = String(raw || '').trim()
  if (!s)
    return null

  const idx = s.indexOf(' ')
  if (idx > 0 && /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, idx)))
    return { date: s.slice(0, idx), time: s.slice(idx + 1).trim() }

  return { date: s, time: '' }
}

function getCreatetimeParts(item) {
  return formatCreatetimeLines(item?.createtime)
}

async function copyText(text) {
  const value = String(text || '').trim()
  if (!value)
    return

  try {
    if (navigator?.clipboard?.writeText)
      await navigator.clipboard.writeText(value)
    else
      throw new Error('clipboard-unavailable')

    toast(t('pages.accountFundOverview.messages.copied'), 'success')
  }
  catch {
    try {
      const input = document.createElement('input')

      input.setAttribute('readonly', 'readonly')
      input.setAttribute('value', value)
      document.body.appendChild(input)
      input.select()

      const copied = document.execCommand('copy')

      document.body.removeChild(input)
      toast(copied ? t('pages.accountFundOverview.messages.copied') : t('pages.accountFundOverview.messages.copyFailed'), copied ? 'success' : 'error')
    }
    catch {
      toast(t('pages.accountFundOverview.messages.copyUnsupported'), 'error')
    }
  }
}

function normalizeRows(data) {
  const rows = Array.isArray(data?.data) ? data.data : []
  
  return rows.map(item => ({
    ...item,
    ['change_money']: String(item['change_money'] ?? '0'),
    ['change_money_eur']: String(item['change_money_eur'] ?? '0'),
  }))
}

async function fetchFinanceList() {
  loading.value = true
  try {
    const payload = {
      ['current_page']: pagination.page,
      ['per_page_num']: pagination.limit,
      type: filters.type || '',
      ['order_sn']: filters.keyword || '',
      remark: filters.remark || '',
      time: buildTimeRangeParam(filters.timeRange),
    }

    const res = await $api('/user/paylog', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1) {
      financeRows.value = normalizeRows(res?.data)
      pagination.total = Number(res?.data?.count || 0)
      summary.usd = String(res?.data?.balance ?? '0.00')
      summary.eur = String(res?.data?.['balance_eur'] ?? '0.00')
      summary.deposit = String(res?.data?.yajin ?? '0.00')
    }
    else {
      toast(res?.msg || t('pages.accountFundOverview.messages.loadFailed'), 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.accountFundOverview.messages.loadFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function fetchRate(isEur = false) {
  const path = isEur ? '/user/rateUsd2' : '/user/rateUsd'
  const res = await $api(path, { method: 'POST' })
  if (Number(res?.code) === 1) {
    rateCache.usdRate = Number(res?.data?.rate || rateCache.usdRate)
    rateCache.usdQuickRate = Number(res?.data?.rate1 || rateCache.usdQuickRate)
    rateCache.eurRate = Number(res?.data?.rate || rateCache.eurRate)
    
    return res?.data || {}
  }
  throw new Error(res?.msg || t('pages.accountFundOverview.messages.rateFailed'))
}

async function refreshRateForTab(tabName) {
  const isEur = tabName === 'eur'
  try {
    await fetchRate(isEur)
  }
  catch (error) {
    toast(error?.message || t('pages.accountFundOverview.messages.rateUpdateFailed'), 'warning')
  }
}

function recalcResult(tabName) {
  const form = rechargeForms[tabName]
  if (!form)
    return

  if (tabName === 'auto') {
    const amount = autoDisplayAmount.value
    if (!amount) {
      form.result = ''
      
      return
    }
    const rate = Number(rateCache.usdQuickRate || rateCache.usdRate || 7.2)

    form.rate = rate
    form.result = `$${(amount / rate).toFixed(2)}`
    
    return
  }

  const amount = Number(form.amount || 0)
  if (!amount) {
    form.result = ''
    
    return
  }

  const isEur = tabName === 'eur'
  const currencySymbol = isEur ? '€' : '$'
  const rate = Number(isEur ? rateCache.eurRate : rateCache.usdRate)

  form.rate = rate

  if (Number(form.payType) === 1)
    form.result = `${currencySymbol}${(amount / rate).toFixed(2)}`
  else
    form.result = `${currencySymbol}${amount.toFixed(2)}`
}

async function recalcWithLatestRate(tabName) {
  await refreshRateForTab(tabName)
  recalcResult(tabName)
}

function openRecharge() {
  rechargeVisible.value = true
  recalcWithLatestRate(activeRechargeTab.value)
}

function closeRecharge() {
  rechargeVisible.value = false
  activeRechargeTab.value = 'rmb'
  activeUsdBankPanel.value = ['boa']
}

function resetFilters() {
  filters.type = null
  filters.keyword = ''
  filters.remark = ''
  filters.timeRange = []
  pagination.page = 1
  fetchFinanceList()
}

function searchFinance() {
  pagination.page = 1
  fetchFinanceList()
}

function onAutoSelectAmount(amount) {
  rechargeForms.auto.selectedAmount = amount
  rechargeForms.auto.customAmount = ''
  recalcWithLatestRate('auto')
}

function onAutoCustomAmountInput() {
  rechargeForms.auto.selectedAmount = 0
  recalcWithLatestRate('auto')
}

async function submitRecharge(tabName) {
  const form = rechargeForms[tabName]
  if (!form)
    return

  if (tabName !== 'auto') {
    if (!form.amount || !form.orderNo) {
      toast(t('pages.accountFundOverview.messages.incompleteRecharge'), 'warning')
      
      return
    }
  }
  else if (!autoDisplayAmount.value) {
    toast(t('pages.accountFundOverview.messages.amountRequired'), 'warning')
    
    return
  }

  submitting.value = true
  try {
    let path = '/user/operatePay'
    let body = {}

    if (tabName === 'rmb') {
      body = {
        ['pay_type1']: form.payType,
        ['need_chongzhi_money1']: form.amount,
        ['pay_num1']: form.orderNo,
        ['need_money_usd1']: form.result,
        huilv1: form.rate,
      }
    }
    else if (tabName === 'usd') {
      path = '/user/operatePayUsd'
      body = {
        ['pay_type2']: form.payType,
        ['need_chongzhi_money2']: form.amount,
        ['pay_num2']: form.orderNo,
        ['need_money_usd2']: form.result,
        huilv2: form.rate,
      }
    }
    else if (tabName === 'eur') {
      path = '/user/operatePayEur'
      body = {
        ['pay_type22']: form.payType,
        ['need_chongzhi_money22']: form.amount,
        ['pay_num22']: form.orderNo,
        ['need_money_usd22']: form.result,
        huilv22: form.rate,
      }
    }
    else {
      path = '/user/onlinePay'
      body = {
        ['zd_payType']: form.method,
        ['zd_need_chongzhi_money']: autoDisplayAmount.value,
        ['zd_change_money']: autoDisplayAmount.value,
        ['zd_need_money_usd']: form.result,
        ['zd_huilv']: form.rate,
      }
    }

    const res = await $api(path, {
      method: 'POST',
      body,
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || t('pages.accountFundOverview.messages.submitFailed'), 'error')
      
      return
    }

    if (tabName === 'auto') {
      if (Number(form.method) === 1 && res?.data?.url) {
        window.open(res.data.url, '_blank', 'noopener')
        toast(t('pages.accountFundOverview.messages.payPageOpened'), 'success')
      }
      else {
        await loadWxPayInfo(res?.data)
        wxDialogVisible.value = true
        startWxPolling()
      }
      rechargeVisible.value = false
      
      return
    }

    toast(res?.msg || t('pages.accountFundOverview.messages.submitSuccess'), 'success')
    form.amount = ''
    form.result = ''
    form.orderNo = ''
    rechargeVisible.value = false
    fetchFinanceList()
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.accountFundOverview.messages.submitFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

function stopWxPolling() {
  if (!wxPollingTimer.value)
    return
  clearInterval(wxPollingTimer.value)
  wxPollingTimer.value = null
}

function buildQrCodeImageUrl(rawText) {
  const val = String(rawText || '').trim()
  if (!val)
    return ''
  
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(val)}`
}

async function loadWxPayInfo(onlinePayData) {
  const res = await $api('/user/wxDo', {
    method: 'POST',
    body: {},
  })

  if (Number(res?.code) !== 1) {
    throw new Error(res?.msg || t('pages.accountFundOverview.messages.wxQrFailed'))
  }

  const data = res?.data || {}
  const wxRawUrl = String(data.url || '')

  wxPayInfo.username = String(data.username || onlinePayData?.username || '')
  wxPayInfo.ownPayNum = String(data['own_pay_num'] || onlinePayData?.['own_pay_num'] || '')
  wxPayInfo.amount = String(data['change_money'] || onlinePayData?.['change_money'] || autoDisplayAmount.value)
  wxPayInfo.qrCodeUrl = buildQrCodeImageUrl(wxRawUrl)
}

function startWxPolling() {
  stopWxPolling()
  if (!wxPayInfo.ownPayNum)
    return

  wxPollingTimer.value = setInterval(async () => {
    try {
      const res = await $api('/user/wxCheck', {
        method: 'POST',
        body: { ['own_pay_num']: wxPayInfo.ownPayNum },
      })

      if (Number(res?.code) === 1) {
        toast(t('pages.accountFundOverview.messages.wxPaid'), 'success')
        wxDialogVisible.value = false
        stopWxPolling()
        fetchFinanceList()
      }
    }
    catch {
      // keep polling silently
    }
  }, 1500)
}

function closeWxDialog() {
  wxDialogVisible.value = false
  stopWxPolling()
}

async function exportFinance() {
  const createTime = buildTimeRangeParam(filters.timeRange)
  if (!filters.type && !createTime) {
    toast(t('pages.accountFundOverview.messages.exportConditionRequired'), 'warning')
    
    return
  }

  try {
    const res = await $api('/user/excelFinance', {
      method: 'POST',
      body: {
        ['create_time']: createTime,
        type: filters.type || '',
      },
    })

    if (Number(res?.code) === 1)
      toast(t('pages.accountFundOverview.messages.exportSubmitted'), 'success')
    else
      toast(res?.msg || t('pages.accountFundOverview.messages.exportFailed'), 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.accountFundOverview.messages.exportFailed'), 'error')
  }
}

function resolveFlowTypeName(typeName) {
  if (typeName === INCOME_TYPE)
    return t('pages.accountFundOverview.types.income')
  if (typeName === EXPENSE_TYPE)
    return t('pages.accountFundOverview.types.expense')

  return typeName || '-'
}

watch(() => [pagination.page, pagination.limit], fetchFinanceList)
watch(activeRechargeTab, tab => recalcWithLatestRate(tab))
watch(() => rechargeForms.rmb.amount, () => recalcResult('rmb'))
watch(() => rechargeForms.rmb.payType, () => recalcWithLatestRate('rmb'))
watch(() => rechargeForms.usd.amount, () => recalcResult('usd'))
watch(() => rechargeForms.usd.payType, () => recalcWithLatestRate('usd'))
watch(() => rechargeForms.eur.amount, () => recalcResult('eur'))
watch(() => rechargeForms.eur.payType, () => recalcWithLatestRate('eur'))
watch(() => rechargeForms.auto.customAmount, onAutoCustomAmountInput)

onMounted(async () => {
  await fetchFinanceList()
  await refreshRateForTab('rmb')
  recalcResult('auto')
})

onBeforeUnmount(() => stopWxPolling())
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
        <span class="text-h5 font-weight-medium">{{ $t('pages.accountFundOverview.title') }}</span>
      </template>
    </VCardItem>
    <VDivider />
    <VCardText class="pa-4 pa-sm-6">
      <VRow class="mb-4">
        <VCol
          cols="12"
          md="6"
        >
          <VSheet
            rounded="lg"
            border
            class="pa-4 h-100"
          >
            <div class="text-caption text-medium-emphasis mb-1">
              {{ $t('pages.accountFundOverview.accountBalance') }}
            </div>
            <div class="d-flex align-center justify-space-between flex-wrap gap-3">
              <div>
                <div class="text-h5 font-weight-bold">
                  $ {{ summary.usd }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  € {{ summary.eur }}
                </div>
              </div>
              <VBtn
                color="primary"
                size="small"
                class="flex-shrink-0"
                @click="openRecharge"
              >
                {{ $t('pages.accountFundOverview.actions.recharge') }}
              </VBtn>
            </div>
          </VSheet>
        </VCol>
        <VCol
          cols="12"
          md="6"
        >
          <VSheet
            rounded="lg"
            border
            class="pa-4 h-100"
          >
            <div class="text-caption text-medium-emphasis mb-1">
              {{ $t('pages.accountFundOverview.depositUsd') }}
            </div>
            <div class="text-h5 font-weight-bold">
              $ {{ summary.deposit }}
            </div>
          </VSheet>
        </VCol>
      </VRow>

      <AppQueryPanel
        class="mb-4"
        :loading="loading"
        actions-position="bottom"
        @search="searchFinance"
        @reset="resetFilters"
      >
        <template #export>
          <VBtn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="tabler-download"
            @click="exportFinance"
          >
            {{ $t('pages.accountFundOverview.actions.export') }}
          </VBtn>
        </template>
        <VRow dense>
          <VCol
            cols="12"
            sm="6"
            md="6"
            lg="3"
          >
            <AppSelect
              v-model="filters.type"
              :items="typeOptions"
              :label="$t('pages.accountFundOverview.filters.type')"
              item-title="title"
              item-value="value"
              density="compact"
              hide-details
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="6"
            lg="3"
          >
            <AppTextField
              v-model="filters.keyword"
              :label="$t('pages.accountFundOverview.filters.keyword')"
              density="compact"
              hide-details
              :placeholder="$t('pages.accountFundOverview.placeholders.keyword')"
              @keyup.enter="searchFinance"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="6"
            lg="3"
          >
            <AppTextField
              v-model="filters.remark"
              :label="$t('pages.accountFundOverview.filters.remark')"
              density="compact"
              hide-details
              :placeholder="$t('pages.accountFundOverview.placeholders.remark')"
              @keyup.enter="searchFinance"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="6"
            lg="3"
          >
            <AppDateTimePicker
              v-model="filters.timeRange"
              :label="$t('pages.accountFundOverview.filters.time')"
              density="compact"
              hide-details
              :placeholder="$t('pages.accountFundOverview.placeholders.time')"
              :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <VDataTable
        :headers="tableHeaders"
        :items="financeRows"
        :loading="loading"
        :items-per-page="pagination.limit"
        hide-default-footer
        density="comfortable"
        hover
        class="text-body-2 fund-flow-table"
        :class="{ 'fund-flow-table--with-eur': showEurColumn }"
        item-value="id"
      >
        <template #item.createtime="{ item }">
          <div
            v-if="getCreatetimeParts(item)"
            class="fund-time text-no-wrap"
          >
            <div>{{ getCreatetimeParts(item).date }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ getCreatetimeParts(item).time }}
            </div>
          </div>
          <span
            v-else
            class="text-medium-emphasis"
          >—</span>
        </template>
        <template #item.order_sn="{ item }">
          <div class="fund-reference-cell d-flex align-center gap-1 min-w-0">
            <span
              class="fund-reference-text text-truncate"
              :title="item.order_sn || ''"
            >{{ item.order_sn || '—' }}</span>
            <IconBtn
              v-if="item.order_sn"
              size="small"
              variant="text"
              color="secondary"
              class="flex-shrink-0 fund-copy-btn"
              @click.stop="copyText(item.order_sn)"
            >
              <VIcon
                icon="tabler-copy"
                size="16"
              />
            </IconBtn>
          </div>
        </template>
        <template #item.ht_tracking_no="{ item }">
          <div class="fund-reference-cell d-flex align-center gap-1 min-w-0">
            <span
              class="fund-reference-text text-truncate"
              :title="item.ht_tracking_no || ''"
            >{{ item.ht_tracking_no || '—' }}</span>
            <IconBtn
              v-if="item.ht_tracking_no"
              size="small"
              variant="text"
              color="secondary"
              class="flex-shrink-0 fund-copy-btn"
              @click.stop="copyText(item.ht_tracking_no)"
            >
              <VIcon
                icon="tabler-copy"
                size="16"
              />
            </IconBtn>
          </div>
        </template>
        <template #item.pay_type="{ item }">
          <span
            class="fund-type-text d-inline-block text-truncate"
            :title="item['pay_type'] || ''"
          >{{ item['pay_type'] || '—' }}</span>
        </template>
        <template #item.type_name="{ item }">
          <VChip
            :color="item.type_name === INCOME_TYPE ? 'success' : 'error'"
            size="small"
            variant="tonal"
          >
            {{ resolveFlowTypeName(item.type_name) }}
          </VChip>
        </template>
        <template #item.change_money="{ item }">
          <div class="fund-money-cell text-end">
            <span
              class="tabular-nums"
              :class="parseMoney(item.change_money) >= 0 ? 'text-success' : 'text-error'"
            >
              {{ item.change_money }}
            </span>
          </div>
        </template>
        <template #item.change_money_eur="{ item }">
          <div class="fund-money-cell text-end">
            <span
              v-if="Math.abs(parseMoney(item.change_money_eur)) < 1e-9"
              class="text-medium-emphasis"
            >—</span>
            <span
              v-else
              class="tabular-nums"
              :class="parseMoney(item.change_money_eur) >= 0 ? 'text-success' : 'text-error'"
            >
              {{ item.change_money_eur }}
            </span>
          </div>
        </template>
        <template #item.remark="{ item }">
          <VTooltip
            v-if="String(item.remark || '').trim().length > 0"
            location="top"
            transition="fade-transition"
            content-class="fund-remark-tooltip-content"
          >
            <template #activator="{ props: tipProps }">
              <span
                v-bind="tipProps"
                class="fund-remark text-body-2 d-block"
              >
                {{ item.remark }}
              </span>
            </template>
            {{ item.remark }}
          </VTooltip>
          <span
            v-else
            class="text-medium-emphasis"
          >—</span>
        </template>
        <template #bottom>
          <VDivider />
          <div class="fund-pagination-bar d-flex align-center justify-space-between flex-wrap gap-3 px-4 px-sm-6 py-4">
            <div class="text-body-2 text-medium-emphasis">
              {{ $t('pages.dropShippingOrderList.pagination.total', { total: pagination.total }) }}
            </div>
            <div class="fund-pagination-controls d-flex align-center gap-3">
              <AppSelect
                v-model="pagination.limit"
                :items="[10, 20, 50, 100]"
                density="compact"
                hide-details
                style="min-inline-size: 100px"
              />
              <VPagination
                v-model="pagination.page"
                :length="totalPage"
                :total-visible="5"
                size="small"
                active-color="primary"
              />
            </div>
          </div>
        </template>
      </VDataTable>
    </VCardText>
  </VCard>

  <VDialog
    v-model="rechargeVisible"
    width="calc(100vw - 32px)"
    max-width="980"
    scrollable
  >
    <VCard class="rounded-lg">
      <VCardItem class="px-6 pt-5 pb-3">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.accountFundOverview.recharge.title') }}</span>
        </template>
        <template #append>
          <IconBtn @click="closeRecharge">
            <VIcon icon="tabler-x" />
          </IconBtn>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <VTabs
          v-model="activeRechargeTab"
          color="primary"
          show-arrows
        >
          <VTab value="rmb">
            {{ $t('pages.accountFundOverview.recharge.tabs.rmb') }}
          </VTab>
          <VTab value="usd">
            {{ $t('pages.accountFundOverview.recharge.tabs.usd') }}
          </VTab>
          <VTab value="eur">
            {{ $t('pages.accountFundOverview.recharge.tabs.eur') }}
          </VTab>
          <VTab value="auto">
            {{ $t('pages.accountFundOverview.recharge.tabs.auto') }}
          </VTab>
        </VTabs>

        <VWindow
          v-model="activeRechargeTab"
          class="mt-4"
        >
          <VWindowItem value="rmb">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VSheet
                  border
                  rounded="lg"
                  class="pa-4 h-100"
                >
                  <div class="text-subtitle-2 mb-3">
                    {{ $t('pages.accountFundOverview.recharge.bank.transferAccount') }}
                  </div>
                  <div class="text-body-2">
                    户名/Account Name：潘威文 (PAN WEIWEN)
                  </div>
                  <div class="text-body-2 mt-2">
                    {{ $t('pages.accountFundOverview.recharge.bank.accountNo') }}
                  </div>
                </VSheet>
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VForm class="d-flex flex-column gap-3">
                  <AppSelect
                    v-model="rechargeForms.rmb.payType"
                    :label="$t('pages.accountFundOverview.recharge.fields.currency')"
                    :items="rechargeCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.amount"
                    type="number"
                    :label="$t('pages.accountFundOverview.recharge.fields.amount')"
                    :suffix="rechargeForms.rmb.payType === 1 ? 'CNY' : 'USD'"
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.result"
                    :label="$t('pages.accountFundOverview.recharge.fields.arrival')"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.orderNo"
                    :label="$t('pages.accountFundOverview.recharge.fields.proof')"
                    :placeholder="$t('pages.accountFundOverview.placeholders.transferProof')"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('rmb')"
                  >
                    {{ $t('pages.accountFundOverview.actions.submitRecharge') }}
                  </VBtn>
                </VForm>
              </VCol>
            </VRow>
          </VWindowItem>

          <VWindowItem value="usd">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VExpansionPanels
                  v-model="activeUsdBankPanel"
                  multiple
                  variant="accordion"
                >
                  <VExpansionPanel value="boa">
                    <VExpansionPanelTitle>Bank of America</VExpansionPanelTitle>
                    <VExpansionPanelText>
                      Company: Atwindow LLC<br>
                      Account: 485015819047<br>
                      ABA Number: 026009593<br>
                      FEDWIRE: 323070380<br>
                      Swift: BOFAUS3N
                    </VExpansionPanelText>
                  </VExpansionPanel>
                  <VExpansionPanel value="zelle">
                    <VExpansionPanelTitle>{{ $t('pages.accountFundOverview.recharge.bank.zelle') }}</VExpansionPanelTitle>
                    <VExpansionPanelText>{{ $t('pages.accountFundOverview.recharge.bank.contactService') }}</VExpansionPanelText>
                  </VExpansionPanel>
                  <VExpansionPanel value="airwallex">
                    <VExpansionPanelTitle>{{ $t('pages.accountFundOverview.recharge.bank.airwallex') }}</VExpansionPanelTitle>
                    <VExpansionPanelText>
                      Account Name: Hong Kong Atwindow Company Limited<br>
                      Institution: Standard Chartered Bank (Hong Kong) Ltd<br>
                      Account No: 47413023017<br>
                      SWIFT/BIC: SCBLHKHH
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VForm class="d-flex flex-column gap-3">
                  <AppSelect
                    v-model="rechargeForms.usd.payType"
                    :label="$t('pages.accountFundOverview.recharge.fields.currency')"
                    :items="rechargeCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.amount"
                    type="number"
                    :label="$t('pages.accountFundOverview.recharge.fields.amount')"
                    :suffix="rechargeForms.usd.payType === 1 ? 'CNY' : 'USD'"
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.result"
                    :label="$t('pages.accountFundOverview.recharge.fields.arrival')"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.orderNo"
                    :label="$t('pages.accountFundOverview.recharge.fields.proof')"
                    :placeholder="$t('pages.accountFundOverview.placeholders.transferProof')"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('usd')"
                  >
                    {{ $t('pages.accountFundOverview.actions.submitRecharge') }}
                  </VBtn>
                </VForm>
              </VCol>
            </VRow>
          </VWindowItem>

          <VWindowItem value="eur">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VSheet
                  border
                  rounded="lg"
                  class="pa-4 h-100"
                >
                  <div class="text-subtitle-2 mb-3">
                    Airwallex (EUR)
                  </div>
                  <div class="text-body-2">
                    Institution Name: Banking Circle S.A.
                  </div>
                  <div class="text-body-2 mt-2">
                    SWIFT/BIC: SXPYDKKK
                  </div>
                  <div class="text-body-2 mt-2">
                    IBAN: DK0489000023666324
                  </div>
                </VSheet>
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VForm class="d-flex flex-column gap-3">
                  <AppSelect
                    v-model="rechargeForms.eur.payType"
                    :label="$t('pages.accountFundOverview.recharge.fields.currency')"
                    :items="rechargeEurCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.amount"
                    type="number"
                    :label="$t('pages.accountFundOverview.recharge.fields.amount')"
                    :suffix="rechargeForms.eur.payType === 1 ? 'CNY' : 'EUR'"
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.result"
                    :label="$t('pages.accountFundOverview.recharge.fields.arrival')"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.orderNo"
                    :label="$t('pages.accountFundOverview.recharge.fields.proof')"
                    :placeholder="$t('pages.accountFundOverview.placeholders.transferProof')"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('eur')"
                  >
                    {{ $t('pages.accountFundOverview.actions.submitRecharge') }}
                  </VBtn>
                </VForm>
              </VCol>
            </VRow>
          </VWindowItem>

          <VWindowItem value="auto">
            <VAlert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              {{ $t('pages.accountFundOverview.recharge.autoAlert') }}
            </VAlert>
            <VForm class="d-flex flex-column gap-4">
              <VRadioGroup
                v-model="rechargeForms.auto.method"
                inline
                :label="$t('pages.accountFundOverview.recharge.fields.paymentMethod')"
              >
                <VRadio
                  :value="1"
                  :label="$t('pages.accountFundOverview.recharge.payment.alipay')"
                />
                <VRadio
                  :value="2"
                  :label="$t('pages.accountFundOverview.recharge.payment.wechat')"
                />
              </VRadioGroup>

              <div>
                <div class="text-body-2 mb-2">
                  {{ $t('pages.accountFundOverview.recharge.fields.amount') }}
                </div>
                <div class="fund-amount-chips d-flex flex-wrap gap-2">
                  <VChip
                    v-for="amount in autoAmountOptions"
                    :key="amount"
                    label
                    class="fund-amount-chip justify-center"
                    :color="rechargeForms.auto.selectedAmount === amount ? 'primary' : 'default'"
                    :variant="rechargeForms.auto.selectedAmount === amount ? 'flat' : 'outlined'"
                    @click="onAutoSelectAmount(amount)"
                  >
                    ¥{{ amount }}
                  </VChip>
                </div>
              </div>

              <AppTextField
                v-model="rechargeForms.auto.customAmount"
                type="number"
                :label="$t('pages.accountFundOverview.recharge.fields.customAmount')"
                suffix="CNY"
                :placeholder="$t('pages.accountFundOverview.placeholders.amount')"
              />
              <AppTextField
                v-model="rechargeForms.auto.result"
                readonly
                :label="$t('pages.accountFundOverview.recharge.fields.usdArrival')"
              />
              <div class="text-body-1">
                {{ $t('pages.accountFundOverview.recharge.payableAmount') }}
                <span class="text-primary font-weight-bold text-h6">
                  {{ autoDisplayAmount }} {{ $t('pages.accountFundOverview.recharge.yuan') }}
                </span>
              </div>
              <VBtn
                color="primary"
                :loading="submitting"
                @click="submitRecharge('auto')"
              >
                {{ $t('pages.accountFundOverview.actions.scanPay') }}
              </VBtn>
            </VForm>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog
    v-model="wxDialogVisible"
    width="calc(100vw - 32px)"
    max-width="640"
  >
    <VCard class="rounded-lg">
      <VCardItem class="px-6 pt-5 pb-3">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.accountFundOverview.wxPay.title') }}</span>
        </template>
        <template #append>
          <IconBtn @click="closeWxDialog">
            <VIcon icon="tabler-x" />
          </IconBtn>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6 text-center">
        <VIcon
          icon="tabler-circle-check"
          color="success"
          size="42"
          class="mb-2"
        />
        <div class="text-h6 font-weight-medium mb-2">
          {{ $t('pages.accountFundOverview.wxPay.submitted') }}
        </div>
        <div class="text-body-2 text-medium-emphasis mb-4">
          {{ $t('pages.accountFundOverview.wxPay.instruction') }}
        </div>

        <VSheet
          rounded="lg"
          border
          class="pa-4 mb-4 mx-auto fund-wx-qrcode"
        >
          <template v-if="wxPayInfo.qrCodeUrl">
            <VImg
              :src="wxPayInfo.qrCodeUrl"
              :alt="$t('pages.accountFundOverview.wxPay.qrAlt')"
              max-width="180"
              class="mx-auto"
            />
          </template>
          <template v-else>
            <div class="text-body-2 text-medium-emphasis">
              {{ $t('pages.accountFundOverview.wxPay.noQr') }}
            </div>
          </template>
        </VSheet>

        <div class="text-body-2 text-start mx-auto fund-wx-meta">
          <div>{{ $t('pages.accountFundOverview.wxPay.account', { value: wxPayInfo.username || '-' }) }}</div>
          <div class="mt-2">
            {{ $t('pages.accountFundOverview.wxPay.orderNo', { value: wxPayInfo.ownPayNum || '-' }) }}
          </div>
          <div class="mt-2">
            {{ $t('pages.accountFundOverview.wxPay.amount', { value: wxPayInfo.amount || '-' }) }}
          </div>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.fund-flow-table :deep(th) {
  font-weight: 600;
  white-space: nowrap;
}

.fund-flow-table :deep(.v-table__wrapper) {
  overflow-x: auto;
}

.fund-flow-table :deep(table) {
  min-inline-size: 1180px;
}

.fund-flow-table :deep(td) {
  vertical-align: middle;
}

.fund-flow-table--with-eur :deep(table) {
  min-inline-size: 1290px;
}

.fund-time {
  color: rgba(var(--v-theme-on-surface), 0.76);
  line-height: 1.22;
}

.fund-reference-cell {
  max-inline-size: 100%;
}

.fund-reference-text,
.fund-type-text {
  color: rgba(var(--v-theme-on-surface), 0.76);
  max-inline-size: 100%;
}

.fund-type-text {
  inline-size: 100%;
}

.fund-money-cell {
  font-weight: 600;
  letter-spacing: 0;
}

.fund-remark {
  display: -webkit-box !important;
  max-inline-size: 100%;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.7);
  cursor: help;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: normal;
  vertical-align: top;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.fund-copy-btn {
  opacity: 0.55;
}

.fund-copy-btn:hover {
  opacity: 1;
}

.fund-pagination-controls {
  min-inline-size: 0;
}

.fund-pagination-bar {
  min-block-size: 72px;
}

.fund-amount-chip {
  min-inline-size: 86px;
}

.fund-wx-qrcode {
  max-inline-size: 240px;
}

.fund-wx-meta {
  max-inline-size: 320px;
}

@media (max-width: 600px) {
  .fund-flow-table :deep(table) {
    min-inline-size: 1080px;
  }

  .fund-pagination-bar {
    align-items: stretch !important;
    flex-direction: column;
  }

  .fund-pagination-controls {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .fund-pagination-controls :deep(.v-pagination) {
    inline-size: 100%;
    justify-content: center;
  }

  .fund-remark {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .fund-wx-meta {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
}
</style>

<style>
.fund-remark-tooltip-content {
  max-inline-size: min(440px, 92vw) !important;
  padding-block: 10px !important;
  padding-inline: 12px !important;
  border-radius: 8px !important;
  background-color: rgb(45, 45, 52) !important;
  color: rgba(255, 255, 255, 0.94) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2) !important;
  font-size: 0.875rem !important;
  line-height: 1.55 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
</style>
