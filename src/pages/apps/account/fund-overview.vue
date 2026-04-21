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

const typeOptions = [
  { title: '全部', value: null },
  { title: '收入', value: '1' },
  { title: '支出', value: '2' },
]

const rechargeCurrencyOptions = [
  { title: '人民币', value: 1 },
  { title: '美元', value: 2 },
]

const rechargeEurCurrencyOptions = [
  { title: '人民币', value: 1 },
  { title: '欧元', value: 3 },
]

const autoAmountOptions = [500, 1000, 3000, 5000]

const tableHeadersBase = [
  { title: '创建时间', key: 'createtime', width: 148 },
  { title: '订单号', key: 'order_sn', width: 200 },
  { title: '运单号', key: 'ht_tracking_no', width: 200 },
  { title: '交易类型', key: 'pay_type', width: 140 },
  { title: '收支', key: 'type_name', width: 100, align: 'center' },
  { title: '交易金额(USD)', key: 'change_money', width: 128, align: 'end' },
  { title: '交易金额(EUR)', key: 'change_money_eur', width: 112, align: 'end' },
  { title: '备注', key: 'remark', minWidth: 260 },
]

const totalPage = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.limit)))

const autoDisplayAmount = computed(() => {
  const raw = rechargeForms.auto.selectedAmount || Number(rechargeForms.auto.customAmount || 0)
  
  return Number(raw || 0)
})

function buildTimeRangeParam(rangeValue) {
  if (Array.isArray(rangeValue) && rangeValue.length === 2)
    return rangeValue.join('至')

  if (typeof rangeValue === 'string') {
    const text = rangeValue.trim()
    if (!text)
      return ''
    if (text.includes(' to '))
      return text.split(' to ').map(item => item.trim()).filter(Boolean).join('至')
    
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

/** 账户无 EUR 余额且本页无 EUR 流水时不展示 EUR 列，避免整列「—」占宽 */
const showEurColumn = computed(() => {
  if (Math.abs(parseMoney(summary.eur)) > 1e-6)
    return true

  return financeRows.value.some(r => Math.abs(parseMoney(r.change_money_eur)) > 1e-6)
})

const tableHeaders = computed(() => {
  if (showEurColumn.value)
    return tableHeadersBase

  return tableHeadersBase.filter(h => h.key !== 'change_money_eur')
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

    toast('已复制到剪贴板', 'success')
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
      toast(copied ? '已复制到剪贴板' : '复制失败，请手动复制', copied ? 'success' : 'error')
    }
    catch {
      toast('当前环境不支持自动复制', 'error')
    }
  }
}

function normalizeRows(data) {
  const rows = Array.isArray(data?.data) ? data.data : []
  
  return rows.map(item => ({
    ...item,
    change_money: String(item.change_money ?? '0'),
    change_money_eur: String(item.change_money_eur ?? '0'),
  }))
}

async function fetchFinanceList() {
  loading.value = true
  try {
    const payload = {
      current_page: pagination.page,
      per_page_num: pagination.limit,
      type: filters.type || '',
      order_sn: filters.keyword || '',
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
      summary.eur = String(res?.data?.balance_eur ?? '0.00')
      summary.deposit = String(res?.data?.yajin ?? '0.00')
    }
    else {
      toast(res?.msg || '加载资金列表失败', 'error')
    }
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '加载资金列表失败', 'error')
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
  throw new Error(res?.msg || '获取汇率失败')
}

async function refreshRateForTab(tabName) {
  const isEur = tabName === 'eur'
  try {
    await fetchRate(isEur)
  }
  catch (error) {
    toast(error?.message || '汇率更新失败', 'warning')
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
      toast('请填写完整充值信息', 'warning')
      
      return
    }
  }
  else if (!autoDisplayAmount.value) {
    toast('请选择或输入充值金额', 'warning')
    
    return
  }

  submitting.value = true
  try {
    let path = '/user/operatePay'
    let body = {}

    if (tabName === 'rmb') {
      body = {
        pay_type1: form.payType,
        need_chongzhi_money1: form.amount,
        pay_num1: form.orderNo,
        need_money_usd1: form.result,
        huilv1: form.rate,
      }
    }
    else if (tabName === 'usd') {
      path = '/user/operatePayUsd'
      body = {
        pay_type2: form.payType,
        need_chongzhi_money2: form.amount,
        pay_num2: form.orderNo,
        need_money_usd2: form.result,
        huilv2: form.rate,
      }
    }
    else if (tabName === 'eur') {
      path = '/user/operatePayEur'
      body = {
        pay_type22: form.payType,
        need_chongzhi_money22: form.amount,
        pay_num22: form.orderNo,
        need_money_usd22: form.result,
        huilv22: form.rate,
      }
    }
    else {
      path = '/user/onlinePay'
      body = {
        zd_payType: form.method,
        zd_need_chongzhi_money: autoDisplayAmount.value,
        zd_change_money: autoDisplayAmount.value,
        zd_need_money_usd: form.result,
        zd_huilv: form.rate,
      }
    }

    const res = await $api(path, {
      method: 'POST',
      body,
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || '提交充值失败', 'error')
      
      return
    }

    if (tabName === 'auto') {
      if (Number(form.method) === 1 && res?.data?.url) {
        window.open(res.data.url, '_blank', 'noopener')
        toast('已打开支付页面，请完成支付', 'success')
      }
      else {
        await loadWxPayInfo(res?.data)
        wxDialogVisible.value = true
        startWxPolling()
      }
      rechargeVisible.value = false
      
      return
    }

    toast(res?.msg || '充值申请提交成功', 'success')
    form.amount = ''
    form.result = ''
    form.orderNo = ''
    rechargeVisible.value = false
    fetchFinanceList()
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '提交充值失败', 'error')
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
    throw new Error(res?.msg || '微信支付二维码获取失败')
  }

  const data = res?.data || {}
  const wxRawUrl = String(data.url || '')

  wxPayInfo.username = String(data.username || onlinePayData?.username || '')
  wxPayInfo.ownPayNum = String(data.own_pay_num || onlinePayData?.own_pay_num || '')
  wxPayInfo.amount = String(data.change_money || onlinePayData?.change_money || autoDisplayAmount.value)
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
        body: { own_pay_num: wxPayInfo.ownPayNum },
      })

      if (Number(res?.code) === 1) {
        toast('微信支付成功，余额已更新', 'success')
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
    toast('请选择导出条件（类型或时间范围）', 'warning')
    
    return
  }

  try {
    const res = await $api('/user/excelFinance', {
      method: 'POST',
      body: {
        create_time: createTime,
        type: filters.type || '',
      },
    })

    if (Number(res?.code) === 1)
      toast('导出任务已提交', 'success')
    else
      toast(res?.msg || '导出失败', 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '导出失败', 'error')
  }
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
        <span class="text-h5 font-weight-medium">财务管理</span>
      </template>
    </VCardItem>
    <VDivider />
    <VCardText class="pa-4 pa-sm-6">
      <VRow class="mb-2">
        <VCol
          cols="12"
          md="4"
        >
          <VSheet
            rounded="lg"
            border
            class="pa-4 h-100"
          >
            <div class="text-caption text-medium-emphasis mb-1">
              账户余额
            </div>
            <div class="d-flex align-center justify-space-between gap-3">
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
                @click="openRecharge"
              >
                充值
              </VBtn>
            </div>
          </VSheet>
        </VCol>
        <VCol
          cols="12"
          md="4"
        >
          <VSheet
            rounded="lg"
            border
            class="pa-4 h-100"
          >
            <div class="text-caption text-medium-emphasis mb-1">
              出标押金 (USD)
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
            导出账单明细
          </VBtn>
        </template>
        <VRow dense>
          <VCol
            cols="12"
            sm="6"
            lg="3"
          >
            <AppSelect
              v-model="filters.type"
              :items="typeOptions"
              label="类型"
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
            lg="3"
          >
            <AppTextField
              v-model="filters.keyword"
              label="订单号 / 运单号"
              density="compact"
              hide-details
              placeholder="请输入关键词"
              @keyup.enter="searchFinance"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            lg="3"
          >
            <AppTextField
              v-model="filters.remark"
              label="备注关键词"
              density="compact"
              hide-details
              placeholder="请输入备注"
              @keyup.enter="searchFinance"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            lg="3"
          >
            <AppDateTimePicker
              v-model="filters.timeRange"
              label="交易时间"
              density="compact"
              hide-details
              placeholder="选择时间范围"
              :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <VDataTable
        :headers="tableHeaders"
        :items="financeRows"
        :loading="loading"
        density="compact"
        hover
        class="text-body-2 fund-flow-table"
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
          <div class="d-flex align-center gap-1 min-w-0">
            <span class="text-truncate">{{ item.order_sn || '—' }}</span>
            <IconBtn
              v-if="item.order_sn"
              size="small"
              variant="text"
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
          <div class="d-flex align-center gap-1 min-w-0">
            <span class="text-truncate">{{ item.ht_tracking_no || '—' }}</span>
            <IconBtn
              v-if="item.ht_tracking_no"
              size="small"
              variant="text"
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
        <template #item.type_name="{ item }">
          <VChip
            :color="item.type_name === '收入' ? 'success' : 'error'"
            size="small"
            label
          >
            {{ item.type_name || '-' }}
          </VChip>
        </template>
        <template #item.change_money="{ item }">
          <div class="text-end">
            <span
              class="tabular-nums"
              :class="parseMoney(item.change_money) >= 0 ? 'text-success' : 'text-error'"
            >
              {{ item.change_money }}
            </span>
          </div>
        </template>
        <template #item.change_money_eur="{ item }">
          <div class="text-end">
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
                class="fund-remark text-body-2 d-inline-block"
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
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
            <div class="text-body-2 text-medium-emphasis">
              共 {{ pagination.total }} 条
            </div>
            <div class="d-flex align-center gap-3">
              <AppSelect
                v-model="pagination.limit"
                :items="[10, 20, 50, 100]"
                density="compact"
                style="min-inline-size: 110px"
              />
              <VPagination
                v-model="pagination.page"
                :length="totalPage"
                rounded
              />
            </div>
          </div>
        </template>
      </VDataTable>
    </VCardText>
  </VCard>

  <VDialog
    v-model="rechargeVisible"
    max-width="980"
    scrollable
  >
    <VCard class="rounded-lg">
      <VCardItem class="px-6 pt-5 pb-3">
        <template #title>
          <span class="text-h6 font-weight-medium">账户充值</span>
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
        >
          <VTab value="rmb">
            人工充值(¥)
          </VTab>
          <VTab value="usd">
            人工充值($)
          </VTab>
          <VTab value="eur">
            人工充值(€)
          </VTab>
          <VTab value="auto">
            自动充值
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
                    转账账户：浙商银行
                  </div>
                  <div class="text-body-2">
                    户名：潘威文 (PAN WEIWEN)
                  </div>
                  <div class="text-body-2 mt-2">
                    账号：6223095840810042306
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
                    label="充值币种"
                    :items="rechargeCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.amount"
                    type="number"
                    label="充值金额"
                    :suffix="rechargeForms.rmb.payType === 1 ? 'CNY' : 'USD'"
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.result"
                    label="实际到账"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.rmb.orderNo"
                    label="转账凭据"
                    placeholder="请输入银行转账订单号"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('rmb')"
                  >
                    提交充值申请
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
                    <VExpansionPanelTitle>Zelle 账户</VExpansionPanelTitle>
                    <VExpansionPanelText>请联系客服获取账户</VExpansionPanelText>
                  </VExpansionPanel>
                  <VExpansionPanel value="airwallex">
                    <VExpansionPanelTitle>Airwallex 账户</VExpansionPanelTitle>
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
                    label="充值币种"
                    :items="rechargeCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.amount"
                    type="number"
                    label="充值金额"
                    :suffix="rechargeForms.usd.payType === 1 ? 'CNY' : 'USD'"
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.result"
                    label="实际到账"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.usd.orderNo"
                    label="转账凭据"
                    placeholder="请输入银行转账订单号"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('usd')"
                  >
                    提交充值申请
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
                    label="充值币种"
                    :items="rechargeEurCurrencyOptions"
                    item-title="title"
                    item-value="value"
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.amount"
                    type="number"
                    label="充值金额"
                    :suffix="rechargeForms.eur.payType === 1 ? 'CNY' : 'EUR'"
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.result"
                    label="实际到账"
                    readonly
                  />
                  <AppTextField
                    v-model="rechargeForms.eur.orderNo"
                    label="转账凭据"
                    placeholder="请输入银行转账订单号"
                  />
                  <VBtn
                    color="primary"
                    :loading="submitting"
                    @click="submitRecharge('eur')"
                  >
                    提交充值申请
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
              5000 元内自动充值，即充即到，方便快捷。
            </VAlert>
            <VForm class="d-flex flex-column gap-4">
              <VRadioGroup
                v-model="rechargeForms.auto.method"
                inline
                label="支付方式"
              >
                <VRadio
                  :value="1"
                  label="支付宝"
                />
                <VRadio
                  :value="2"
                  label="微信"
                />
              </VRadioGroup>

              <div>
                <div class="text-body-2 mb-2">
                  充值金额
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <VChip
                    v-for="amount in autoAmountOptions"
                    :key="amount"
                    label
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
                label="其他金额"
                suffix="CNY"
                placeholder="请输入金额"
              />
              <AppTextField
                v-model="rechargeForms.auto.result"
                readonly
                label="美金到账"
              />
              <div class="text-body-1">
                应付金额：
                <span class="text-primary font-weight-bold text-h6">
                  {{ autoDisplayAmount }} 元
                </span>
              </div>
              <VBtn
                color="primary"
                :loading="submitting"
                @click="submitRecharge('auto')"
              >
                扫码支付
              </VBtn>
            </VForm>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog
    v-model="wxDialogVisible"
    max-width="640"
  >
    <VCard class="rounded-lg">
      <VCardItem class="px-6 pt-5 pb-3">
        <template #title>
          <span class="text-h6 font-weight-medium">微信支付</span>
        </template>
        <template #append>
          <IconBtn @click="closeWxDialog">
            <VIcon icon="tabler-x" />
          </IconBtn>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-6 text-center">
        <VIcon
          icon="tabler-circle-check"
          color="success"
          size="42"
          class="mb-2"
        />
        <div class="text-h6 font-weight-medium mb-2">
          提交成功，等待支付...
        </div>
        <div class="text-body-2 text-medium-emphasis mb-4">
          请确认金额并及时微信扫码支付订单
        </div>

        <VSheet
          rounded="lg"
          border
          class="pa-4 mb-4 mx-auto fund-wx-qrcode"
        >
          <template v-if="wxPayInfo.qrCodeUrl">
            <VImg
              :src="wxPayInfo.qrCodeUrl"
              alt="微信支付二维码"
              max-width="180"
              class="mx-auto"
            />
          </template>
          <template v-else>
            <div class="text-body-2 text-medium-emphasis">
              未返回二维码图片，请联系客服处理支付。
            </div>
          </template>
        </VSheet>

        <div class="text-body-2 text-start mx-auto fund-wx-meta">
          <div>账号：{{ wxPayInfo.username || '-' }}</div>
          <div class="mt-2">
            单号：{{ wxPayInfo.ownPayNum || '-' }}
          </div>
          <div class="mt-2">
            金额：{{ wxPayInfo.amount || '-' }} 元
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

.fund-time {
  line-height: 1.25;
}

/* 单行省略 + 悬停看全文，避免多行 clamp 与 tooltip 叠层在部分浏览器出现色块感 */
.fund-remark {
  max-inline-size: min(520px, 46vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
  vertical-align: top;
}

.fund-copy-btn {
  opacity: 0.55;
}

.fund-copy-btn:hover {
  opacity: 1;
}

.fund-wx-qrcode {
  max-inline-size: 240px;
}

.fund-wx-meta {
  max-inline-size: 320px;
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
