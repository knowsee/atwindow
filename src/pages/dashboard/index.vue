<script setup>
import { $api } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
import { resolveYundanStatus } from '@/views/apps/print-label/useYundanList'
import { getBarChartConfig, getDonutChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import { useTheme } from 'vuetify'
import AiWarehouseAnalysis from './components/AiWarehouseAnalysis.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const vuetifyTheme = useTheme()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const snack = ref({ show: false, text: '', color: 'info' })
const overviewLoading = ref(false)
const warehouseLoading = ref(false)
const overview = ref(null)
const warehouseData = ref(null)
const warehouseOptions = ref([])
const warehouseId = ref(null)
const persistReady = ref(false)
const noticeLoading = ref(false)
const noticeDialogVisible = ref(false)
const notices = ref([])
const noticeIndex = ref(0)

const NOTICE_READ_LATEST_ID_KEY = 'dashboard_notice_read_latest_id'

const sevenDayOrderSource = ref('dropship')
const activeNotices = computed(() => notices.value)
const currentNotice = computed(() => activeNotices.value[noticeIndex.value] || null)
const canPrevNotice = computed(() => noticeIndex.value > 0)
const canNextNotice = computed(() => noticeIndex.value < activeNotices.value.length - 1)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function getSavedReadNoticeId() {
  if (typeof window === 'undefined')
    return 0

  const raw = window.localStorage.getItem(NOTICE_READ_LATEST_ID_KEY)

  return Number(raw) || 0
}

function saveReadNoticeId(id) {
  if (typeof window === 'undefined')
    return

  window.localStorage.setItem(NOTICE_READ_LATEST_ID_KEY, String(Number(id) || 0))
}

function closeNoticeDialog() {
  noticeDialogVisible.value = false
}

function prevNotice() {
  if (canPrevNotice.value)
    noticeIndex.value -= 1
}

function nextNotice() {
  if (canNextNotice.value)
    noticeIndex.value += 1
}

function markNoticeReadAndHide() {
  const latestId = Number(activeNotices.value[0]?.id) || 0
  if (latestId)
    saveReadNoticeId(latestId)
  noticeDialogVisible.value = false
}

function normalizeNotices(rows) {
  const nowTs = Math.floor(Date.now() / 1000)

  return (Array.isArray(rows) ? rows : [])
    .filter(item => item && Number(item.status) === 1)
    .filter(item => {
      const start = Number(item.start_time) || 0
      const end = Number(item.end_time) || 0

      return !(start && nowTs < start) && !(end && nowTs > end)
    })
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
}

function formatMoney(v) {
  if (v == null || v === '')
    return '—'

  const n = Number(v)

  return Number.isFinite(n) ? n.toFixed(2) : String(v)
}

function formatTsText(row) {
  return row?.createtime_text || row?.receivetime || '—'
}

function trackUrl17(trackingNo) {
  const v = String(trackingNo || '').trim()
  if (!v)
    return ''

  return `https://t.17track.net/zh-cn#nums=${encodeURIComponent(v)}`
}

function formatDsCreatetime(row) {
  return row?.createtime_text || row?.createtime || '—'
}

function formatDsFahuotime(row) {
  return row?.fahuotime_text || row?.fahuotime || '—'
}

function goDropShippingPackageList(row) {
  const q = {}
  if (row?.status != null && row.status !== '')
    q.status = String(row.status)
  const tn = row?.tracking_no != null ? String(row.tracking_no).trim() : ''
  if (tn)
    q['tracking_no'] = tn
  if (warehouseId.value)
    q.warehouse_id = warehouseId.value

  router.push({
    name: 'apps-drop-shipping-package-list',
    query: q,
  })
}

const DROP_SHIP_SEVEN_BUCKETS = [
  { key: 'pending_confirm', labelKey: 'pendingConfirm' },
  { key: 'processing', labelKey: 'processing' },
  { key: 'pending_pay', labelKey: 'pendingPay' },
  { key: 'paid', labelKey: 'confirmed' },
  { key: 'problem', labelKey: 'problem' },
]

function sumSegmentValues(rows) {
  return rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
}

function pickSevenDayOrderTotal(stats, segments) {
  if (!stats || typeof stats !== 'object')
    return sumSegmentValues(segments)
  if (stats.seven_day_total != null)
    return Number(stats.seven_day_total) || 0
  if (stats.total != null)
    return Number(stats.total) || 0

  return sumSegmentValues(segments)
}

function labelWaybillStatusKey(k) {
  const n = Number(k)

  return Number.isFinite(n) ? resolveYundanStatus(n).text : String(k)
}

function parseWaybillSevenSegments(stats) {
  if (stats && typeof stats === 'object') {
    const raw = stats.by_status ?? stats.status_counts ?? stats.count_by_status

    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw)) {
        return raw
          .map(row => ({
            label: labelWaybillStatusKey(row.status ?? row.status_id ?? row.s),
            value: Number(row.count ?? row.cnt ?? row.num) || 0,
          }))
          .filter(r => r.value > 0)
      }

      const keys = Object.keys(raw).sort((a, b) => {
        const na = Number(a)
        const nb = Number(b)

        if (Number.isFinite(na) && Number.isFinite(nb))
          return na - nb

        return String(a).localeCompare(String(b))
      })

      return keys
        .map(k => ({
          label: labelWaybillStatusKey(k),
          value: Number(raw[k]) || 0,
        }))
        .filter(r => r.value > 0)
    }
  }

  return []
}

function parseDropshipSevenSegments(stats) {
  if (!stats || typeof stats !== 'object')
    return []

  const bucket = stats.by_status && typeof stats.by_status === 'object' && !Array.isArray(stats.by_status)
    ? stats.by_status
    : stats

  return DROP_SHIP_SEVEN_BUCKETS
    .map(def => ({
      label: t(`pages.dashboard.sevenDay.status.${def.labelKey}`),
      value: Number(bucket[def.key] ?? stats[def.key]) || 0,
    }))
    .filter(r => r.value > 0)
}

const dropshipStatusKeys = {
  1: 'pendingConfirm',
  2: 'confirmed',
  3: 'pendingPay',
  4: 'pendingShip',
  5: 'pendingShip',
  6: 'shipped',
  14: 'problemShort',
}

function resolveDropshipStatusLabel(status) {
  const key = dropshipStatusKeys[Number(status)]

  return key ? t(`pages.dashboard.sevenDay.status.${key}`) : t('pages.dashboard.warehouse.statusFallback', { status })
}

const sevenDayParsed = computed(() => {
  const o = overview.value
  if (!o) {
    return {
      waybill: [],
      dropship: [],
      totalWaybill: 0,
      totalDropship: 0,
    }
  }

  const wStats = o.waybill_stats
  const dStats = o.dropship_stats
  const waybillSegs = parseWaybillSevenSegments(wStats)
  const dropshipSegs = parseDropshipSevenSegments(dStats)

  const totalWaybill = pickSevenDayOrderTotal(wStats, waybillSegs)
  const totalDropship = pickSevenDayOrderTotal(dStats, dropshipSegs)

  return {
    waybill: waybillSegs,
    dropship: dropshipSegs,
    totalWaybill,
    totalDropship,
  }
})

const globalKpis = computed(() => {
  const pkg = overview.value?.packages
  const fin = overview.value?.finance
  const inv = overview.value?.inventory
  
  const totalSevenDay = sevenDayParsed.value.totalWaybill + sevenDayParsed.value.totalDropship

  return [
    {
      title: t('pages.dashboard.kpis.packages.title'),
      subtitle: t('pages.dashboard.kpis.packages.subtitle'),
      value: pkg?.total != null ? String(pkg.total) : '—',
      hint: pkg ? t('pages.dashboard.kpis.packages.hint', { pending: pkg.pending ?? 0, arrived: pkg.arrived ?? 0 }) : '',
      icon: 'tabler-package',
      color: 'primary',
    },
    {
      title: t('pages.dashboard.kpis.inventory.title'),
      subtitle: t('pages.dashboard.kpis.inventory.subtitle'),
      value: inv?.volume_m3 != null ? String(inv.volume_m3) : '—',
      hint: inv?.volume_cm3 != null ? t('pages.dashboard.kpis.inventory.hint', { cm3: inv.volume_cm3 }) : '',
      icon: 'tabler-box-margin',
      color: 'info',
    },
    {
      title: t('pages.dashboard.kpis.balance.title'),
      subtitle: 'USD',
      value: fin?.balance != null ? formatMoney(fin.balance) : '—',
      hint: fin ? t('pages.dashboard.kpis.balance.hint', { inflow: formatMoney(fin.month_inflow), outflow: formatMoney(fin.month_outflow) }) : '',
      icon: 'tabler-wallet',
      color: 'success',
    },
    {
      title: t('pages.dashboard.kpis.sevenDay.title'),
      subtitle: t('pages.dashboard.kpis.sevenDay.subtitle'),
      value: String(totalSevenDay),
      hint: overview.value ? t('pages.dashboard.kpis.sevenDay.hint') : '',
      icon: 'tabler-calendar-event',
      color: 'warning',
    },
  ]
})



const sevenDayActiveSegments = computed(() => {
  return sevenDayOrderSource.value === 'waybill'
    ? sevenDayParsed.value.waybill
    : sevenDayParsed.value.dropship
})

const sevenDayActiveTotal = computed(() => {
  return sevenDayOrderSource.value === 'waybill'
    ? sevenDayParsed.value.totalWaybill
    : sevenDayParsed.value.totalDropship
})

const sevenDayShowDonut = computed(() => {
  return sevenDayActiveTotal.value > 0 && sevenDayActiveSegments.value.length > 0
})

const sevenDayEmptyHint = computed(() => {
  return sevenDayOrderSource.value === 'waybill'
    ? t('pages.dashboard.sevenDay.emptyWaybill')
    : t('pages.dashboard.sevenDay.emptyDropship')
})

const sevenDayAnalysisPeriodText = computed(() => {
  const p = overview.value?.meta?.analysis_period
  if (p == null)
    return ''
  if (typeof p === 'string')
    return p
  if (typeof p === 'object') {
    if (p.label)
      return String(p.label)
    if (p.start != null && p.end != null)
      return t('pages.dashboard.sevenDay.period', { start: p.start, end: p.end })
  }

  return ''
})

let _sevenDayDonutSeriesCache = []
const sevenDayDonutSeries = computed(() => {
  const segs = sevenDayActiveSegments.value
  if (!segs.length && _sevenDayDonutSeriesCache.length) return _sevenDayDonutSeriesCache
  _sevenDayDonutSeriesCache = segs.map(s => s.value)
  return _sevenDayDonutSeriesCache
})

let _sevenDayDonutOptionsCache = null
const sevenDayDonutOptions = computed(() => {
  const segs = sevenDayActiveSegments.value
  if (!segs.length && _sevenDayDonutOptionsCache) return _sevenDayDonutOptionsCache

  const base = getDonutChartConfig(vuetifyTheme.current.value)
  const themeColors = vuetifyTheme.current.value.colors
  const labels = segs.map(s => s.label)
  const palette = [themeColors.warning, themeColors.success, themeColors.error, themeColors.info, themeColors.primary, themeColors.secondary]
  const colors = segs.map((_, i) => palette[i % palette.length])

  _sevenDayDonutOptionsCache = {
    ...base,
    chart: {
      type: 'donut',
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    labels,
    colors,
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            name: { fontSize: '0.875rem' },
            value: {
              fontSize: '1.125rem',
              formatter: val => `${val}`,
            },
            total: {
              show: true,
              label: t('pages.dashboard.sevenDay.donutTotal'),
              fontSize: '0.75rem',
              formatter: () => String(sevenDayActiveTotal.value || '—'),
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    legend: {
      ...base.legend,
      position: 'bottom',
    },
    responsive: [
      {
        breakpoint: 480,
        options: { chart: { height: 260 } },
      },
    ],
  }
  return _sevenDayDonutOptionsCache
})

let _topSkuSeriesCache = []
const topSkuSeries = computed(() => {
  const rows = warehouseData.value?.top_skus || []
  if (!rows.length && _topSkuSeriesCache.length) return _topSkuSeriesCache
  _topSkuSeriesCache = [{
    name: t('pages.dashboard.warehouse.topSkuSeries'),
    data: rows.map(r => Number(r.qty) || 0),
  }]
  return _topSkuSeriesCache
})

let _topSkuOptionsCache = null
const topSkuChartOptions = computed(() => {
  const rows = warehouseData.value?.top_skus || []
  if (!rows.length && _topSkuOptionsCache) return _topSkuOptionsCache
  
  const cfg = getBarChartConfig(vuetifyTheme.current.value)
  const primary = vuetifyTheme.current.value.colors.primary

  _topSkuOptionsCache = {
    ...cfg,
    chart: {
      ...cfg.chart,
      type: 'bar',
    },
    colors: [primary],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '72%',
        distributed: false,
      },
    },
    xaxis: {
      ...cfg.xaxis,
      categories: rows.length ? rows.map(r => String(r.sku || '—')) : ['—'],
    },
    yaxis: {
      ...cfg.yaxis,
      labels: {
        maxWidth: 160,
        style: { fontSize: '0.75rem' },
      },
    },
  }
  return _topSkuOptionsCache
})

const topSkuChartHeight = computed(() => {
  const n = warehouseData.value?.top_skus?.length || 0

  return Math.max(280, n * 40)
})

const warehouseKpis = computed(() => {
  const d = warehouseData.value?.dropship_orders
  const inv = warehouseData.value?.inventory

  return [
    {
      title: t('pages.dashboard.kpis.dropship.title'),
      value: d?.total != null ? String(d.total) : '—',
      sub: d ? t('pages.dashboard.kpis.dropship.today', { count: d.today ?? 0 }) : '',
      icon: 'tabler-truck-delivery',
      color: 'primary',
    },
    {
      title: t('pages.dashboard.kpis.sku.title'),
      value: inv?.sku_count != null ? String(inv.sku_count) : '—',
      sub: inv ? t('pages.dashboard.kpis.sku.stockQty', { count: inv.total_qty ?? '—' }) : '',
      icon: 'tabler-box',
      color: 'info',
    },
    {
      title: t('pages.dashboard.kpis.lowStock.title'),
      value: inv?.low_stock?.length != null ? String(inv.low_stock.length) : '0',
      sub: t('pages.dashboard.kpis.lowStock.subtitle'),
      icon: 'tabler-alert-triangle',
      color: 'warning',
    },
  ]
})

const financeKpis = computed(() => {
  const fin = overview.value?.finance

  return [
    {
      label: t('pages.dashboard.kpis.balance.title'),
      hint: t('pages.dashboard.finance.availableUsd'),
      value: formatMoney(fin?.balance),
      icon: 'tabler-wallet',
      color: 'primary',
    },
    {
      label: t('pages.dashboard.finance.monthInflow'),
      hint: t('pages.dashboard.finance.monthInflowHint'),
      value: formatMoney(fin?.month_inflow),
      icon: 'tabler-trending-up',
      color: 'success',
    },
    {
      label: t('pages.dashboard.finance.monthOutflow'),
      hint: t('pages.dashboard.finance.monthOutflowHint'),
      value: formatMoney(fin?.month_outflow),
      icon: 'tabler-trending-down',
      color: 'error',
    },
  ]
})

async function loadOverview() {
  overviewLoading.value = true
  try {
    const res = await $api('/ordernew/dashboardOverview', { method: 'GET' })
    if (Number(res?.code) === 1 && res?.data)
      overview.value = res.data
    else
      toast(res?.msg || t('pages.dashboard.messages.overviewFailed'), 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dashboard.messages.overviewFailed'), 'error')
  }
  finally {
    overviewLoading.value = false
  }
}

async function loadNotices() {
  noticeLoading.value = true
  try {
    const res = await $api('/ordernew/notice', { method: 'GET' })
    if (Number(res?.code) !== 1 || !Array.isArray(res?.data)) {
      notices.value = []

      return
    }

    const rows = normalizeNotices(res.data)

    notices.value = rows
    noticeIndex.value = 0

    if (!rows.length)
      return

    const latestId = Number(rows[0]?.id) || 0
    if (latestId && latestId === getSavedReadNoticeId()) {
      noticeDialogVisible.value = false

      return
    }

    noticeDialogVisible.value = true
  }
  catch {
    notices.value = []
  }
  finally {
    noticeLoading.value = false
  }
}

async function loadWarehouseDashboard() {
  if (warehouseId.value == null || warehouseId.value === '')
    return

  warehouseLoading.value = true
  try {
    const res = await $api('/ordernew/dashboardWarehouse', {
      method: 'GET',
      query: { 'warehouse_id': Number(warehouseId.value) },
    })

    if (Number(res?.code) === 1 && res?.data)
      warehouseData.value = res.data
    else
      toast(res?.msg || t('pages.dashboard.messages.warehouseFailed'), 'error')
  }
  catch (e) {
    warehouseData.value = null
    toast(e?.data?.msg || e?.message || t('pages.dashboard.messages.warehouseFailed'), 'error')
  }
  finally {
    warehouseLoading.value = false
  }
}

async function refreshAll() {
  await loadOverview()
  await loadWarehouseDashboard()
  toast(t('pages.dashboard.messages.refreshed'), 'success')
}

async function initWarehouses() {
  const remote = await loadWarehouseOptions(undefined, 3)

  warehouseOptions.value = remote
  warehouseId.value = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
  await nextTick()
  persistReady.value = true
  await loadWarehouseDashboard()
}

watch(warehouseId, v => {
  if (!persistReady.value)
    return
  setPreferredWarehouseId(v)
  if (v != null && v !== '')
    loadWarehouseDashboard()
})

onMounted(async () => {
  await loadOverview()
  await initWarehouses()
  await loadNotices()
})
</script>

<template>
  <VContainer
    fluid
    class="px-2 py-4 pa-sm-6 app-dashboard"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VDialog
      v-model="noticeDialogVisible"
      max-width="760"
      persistent
      :close-on-content-click="false"
      :close-on-back="false"
    >
      <VCard border>
        <VCardItem>
          <template #prepend>
            <VIcon
              icon="tabler-speakerphone"
              color="warning"
            />
          </template>
          <VCardTitle>{{ currentNotice?.title || $t('pages.dashboard.notice.defaultTitle') }}</VCardTitle>
          <template #append>
            <div class="d-flex align-center gap-1">
              <IconBtn
                :disabled="!canPrevNotice"
                @click="prevNotice"
              >
                <VIcon icon="tabler-chevron-left" />
              </IconBtn>
              <IconBtn
                :disabled="!canNextNotice"
                @click="nextNotice"
              >
                <VIcon icon="tabler-chevron-right" />
              </IconBtn>
            </div>
          </template>
        </VCardItem>
        <VCardText class="mt-10">
          <VWindow
            v-model="noticeIndex"
            class="notice-window"
            :touch="false"
          >
            <VWindowItem
              v-for="(item, idx) in activeNotices"
              :key="item.id"
              :value="idx"
            >
              <div
                class="notice-content text-body-2"
                v-html="item.content || ''"
              />
            </VWindowItem>
          </VWindow>

          <div
            v-if="noticeLoading"
            class="text-body-2 text-medium-emphasis mt-10"
          >
            {{ $t('pages.dashboard.notice.loading') }}
          </div>
          <div
            v-else-if="currentNotice"
            class="text-caption text-medium-emphasis mt-10"
          >
            {{ noticeIndex + 1 }} / {{ activeNotices.length }}
          </div>
        </VCardText>
        <VCardActions class="px-6 pb-5 pt-1 justify-end">
          <VBtn
            variant="text"
            @click="closeNoticeDialog"
          >
            {{ $t('pages.dashboard.notice.close') }}
          </VBtn>
          <VBtn
            color="primary"
            variant="flat"
            @click="markNoticeReadAndHide"
          >
            {{ $t('pages.dashboard.notice.readAndHide') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VRow class="align-center mb-6">
      <VCol
        cols="12"
        md="6"
      >
        <div class="text-overline text-primary mb-1">
          {{ $t('pages.dashboard.hero.overline') }}
        </div>
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ $t('pages.dashboard.hero.title') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
          {{ $t('pages.dashboard.hero.subtitle') }}
        </p>
      </VCol>
      <VCol
        cols="12"
        md="6"
        class="d-flex flex-wrap align-center justify-md-end gap-3"
      >
        <VBtn
          variant="tonal"
          color="primary"
          prepend-icon="tabler-refresh"
          :loading="overviewLoading || warehouseLoading"
          @click="refreshAll"
        >
          {{ $t('pages.dashboard.hero.refresh') }}
        </VBtn>
      </VCol>
    </VRow>
    <VRow class="match-height mb-6">
      <VCol
        v-for="kpi in globalKpis"
        :key="kpi.title"
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard
          :loading="overviewLoading"
          class="h-100"
          border
        >
          <VCardText>
            <div class="d-flex align-start justify-space-between gap-2">
              <div class="min-w-0">
                <div class="text-caption text-medium-emphasis text-uppercase">
                  {{ kpi.subtitle }}
                </div>
                <div class="text-h4 font-weight-semibold mt-1 tabular-nums">
                  {{ kpi.value }}
                </div>
                <div class="text-body-2 font-weight-medium mt-1">
                  {{ kpi.title }}
                </div>
                <div
                  v-if="kpi.hint"
                  class="text-caption text-medium-emphasis mt-2 text-wrap"
                >
                  {{ kpi.hint }}
                </div>
              </div>
              <VAvatar
                :color="kpi.color"
                variant="tonal"
                rounded
                size="48"
                class="flex-shrink-0"
              >
                <VIcon
                  :icon="kpi.icon"
                  size="26"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>





    <VSlideGroup
      v-if="warehouseOptions.length"
      v-model="warehouseId"
      class="mb-6"
      show-arrows
      mandatory
    >
      <VSlideGroupItem
        v-for="w in warehouseOptions"
        :key="String(w.value)"
        :value="w.value"
        v-slot="{ isSelected, toggle }"
      >
        <VChip
          :color="isSelected ? 'primary' : 'default'"
          :variant="isSelected ? 'elevated' : 'tonal'"
          class="mx-2 my-2 text-body-1 font-weight-medium px-5"
          size="large"
          @click="toggle"
        >
          {{ w.title }}
        </VChip>
      </VSlideGroupItem>
    </VSlideGroup>

    <template v-if="warehouseId">
      <AiWarehouseAnalysis :warehouse-id="warehouseId" />



      <VRow class="match-height mb-6">
        <VCol
          v-for="wk in warehouseKpis"
          :key="wk.title"
          cols="12"
          md="4"
        >
          <VCard
            :loading="warehouseLoading"
            border
            class="h-100"
          >
            <VCardText>
              <div class="d-flex align-center gap-3">
                <VAvatar
                  :color="wk.color"
                  variant="tonal"
                  rounded
                  size="44"
                >
                  <VIcon
                    :icon="wk.icon"
                    size="24"
                  />
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis">
                    {{ wk.title }}
                  </div>
                  <div class="text-h5 font-weight-semibold tabular-nums">
                    {{ wk.value }}
                  </div>
                  <div
                    v-if="wk.sub"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ wk.sub }}
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow class="match-height mb-6">
        <VCol
          cols="12"
          md="7"
        >
          <VCard
            :loading="warehouseLoading"
            border
            class="h-100"
          >
            <VCardItem>
              <VCardTitle class="text-h6">
                {{ $t('pages.dashboard.sections.topSku') }}
              </VCardTitle>
              <VCardSubtitle>{{ $t('pages.dashboard.warehouse.topSkuSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div
                v-if="warehouseData?.top_skus?.length"
                class="pb-1"
              >
                <VueApexCharts
                  :key="`top-skus-${warehouseData?.top_skus?.length || 0}-${topSkuSeries[0]?.data?.join(',') || 'empty'}`"
                  type="bar"
                  :height="topSkuChartHeight"
                  :options="topSkuChartOptions"
                  :series="topSkuSeries"
                />
              </div>
              <div
                v-else
                class="text-body-2 text-medium-emphasis py-12 text-center"
              >
                {{ $t('pages.dashboard.warehouse.topSkuEmpty') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          md="5"
        >
          <VCard
            :loading="warehouseLoading"
            border
            class="h-100"
          >
            <VCardItem>
              <VCardTitle class="text-h6">
                {{ $t('pages.dashboard.sections.lowStock') }}
              </VCardTitle>
              <VCardSubtitle>{{ $t('pages.dashboard.warehouse.lowStockSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div
                v-if="warehouseData?.inventory?.low_stock?.length"
                class="d-flex flex-column gap-2"
              >
                <VSheet
                  v-for="row in warehouseData.inventory.low_stock"
                  :key="`low-${row.id}-${row.en_sku}`"
                  border
                  rounded="lg"
                  class="pa-3"
                  color="surface"
                >
                  <div class="d-flex align-start gap-3">
                    <VAvatar
                      color="warning"
                      variant="tonal"
                      rounded
                      size="40"
                      class="flex-shrink-0"
                    >
                      <VIcon
                        icon="tabler-alert-triangle"
                        size="22"
                      />
                    </VAvatar>
                    <div class="min-w-0 flex-grow-1">
                      <div class="text-body-2 font-weight-medium text-high-emphasis text-truncate">
                        {{ row.en_sku || '—' }}
                      </div>
                      <div class="text-caption text-medium-emphasis text-wrap mt-1">
                        {{ row.cn_name || '—' }}
                      </div>
                    </div>
                    <div class="text-end flex-shrink-0">
                      <div class="text-body-2 tabular-nums">
                        <span class="text-error font-weight-semibold">{{ row.sku_num }}</span>
                        <span class="text-medium-emphasis">{{ $t('pages.dashboard.warehouse.warning') }}</span>
                        <span class="text-medium-emphasis">{{ row.warn_num }}</span>
                      </div>
                    </div>
                  </div>
                </VSheet>
              </div>
              <div
                v-else
                class="text-body-2 text-medium-emphasis py-8 text-center"
              >
                {{ $t('pages.dashboard.warehouse.lowStockEmpty') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow class="mb-6">
        <VCol cols="12">
          <VCard
            :loading="warehouseLoading"
            border
          >
            <VCardItem>
              <VCardTitle class="text-h6">
                {{ $t('pages.dashboard.sections.dropshipOrders') }}
              </VCardTitle>
              <VCardSubtitle>{{ $t('pages.dashboard.warehouse.dropshipSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div
                v-if="warehouseData?.dropship_orders?.by_status && Object.keys(warehouseData.dropship_orders.by_status).length"
                class="d-flex flex-wrap gap-2 mb-4"
              >
                <VChip
                  v-for="(cnt, st) in warehouseData.dropship_orders.by_status"
                  :key="String(st)"
                  size="small"
                  variant="tonal"
                  color="primary"
                >
                  {{ resolveDropshipStatusLabel(st) }}: {{ cnt }}
                </VChip>
              </div>
              <VTable
                v-if="warehouseData?.dropship_orders?.recent?.length"
                density="comfortable"
                hover
                class="text-body-2 app-dashboard__table"
              >
                <thead>
                  <tr>
                    <th>{{ $t('pages.dashboard.dropshipRecent.headers.reference') }}</th>
                    <th>{{ $t('pages.dashboard.dropshipRecent.headers.trackingNo') }}</th>
                    <th>{{ $t('pages.dashboard.dropshipRecent.headers.fee') }}</th>
                    <th>{{ $t('pages.dashboard.dropshipRecent.headers.shipTime') }}</th>
                    <th>{{ $t('pages.dashboard.dropshipRecent.headers.createTime') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in warehouseData.dropship_orders.recent"
                    :key="`ds-${row.id}`"
                  >
                    <td class="font-weight-medium">
                      {{ row.cankaohao || '—' }}
                    </td>
                    <td>
                      <a
                        v-if="row.ht_tracking_no"
                        :href="trackUrl17(row.ht_tracking_no)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary text-decoration-none"
                        @click.stop
                      >
                        {{ row.ht_tracking_no }}
                      </a>
                      <span
                        v-else
                        class="text-medium-emphasis"
                      >—</span>
                    </td>
                    <td class="tabular-nums">
                      {{ formatMoney(row.total_fee) }}
                    </td>
                    <td class="text-medium-emphasis">
                      {{ formatDsFahuotime(row) }}
                    </td>
                    <td class="text-medium-emphasis">
                      {{ formatDsCreatetime(row) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <div
                v-else
                class="text-body-2 text-medium-emphasis py-4 text-center"
              >
                {{ $t('pages.dashboard.dropshipRecent.empty') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow class="mb-6">
        <VCol cols="12">
          <VCard
            :loading="warehouseLoading"
            border
            class="h-100"
          >
            <VCardItem>
              <VCardTitle class="text-h6">
                {{ $t('pages.dashboard.sections.recentInbound') }}
              </VCardTitle>
              <VCardSubtitle>{{ $t('pages.dashboard.recentInbound.subtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText class="pt-0">
              <VTable
                v-if="warehouseData?.packages?.recent?.length"
                density="comfortable"
                hover
                class="text-body-2 app-dashboard__table"
              >
                <thead>
                  <tr>
                    <th>{{ $t('pages.dashboard.recentInbound.headers.trackingNo') }}</th>
                    <th>{{ $t('pages.dashboard.recentInbound.headers.status') || '状态' }}</th>
                    <th>SKU</th>
                    <th>{{ $t('pages.dashboard.recentInbound.headers.time') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in warehouseData.packages.recent"
                    :key="`p-${row.order_sn || row.tracking_no}`"
                    class="app-dashboard__recent-package-row"
                    role="button"
                    tabindex="0"
                    @click="goDropShippingPackageList(row)"
                    @keydown.enter.prevent="goDropShippingPackageList(row)"
                  >
                    <td class="font-weight-medium text-primary">
                      {{ row.tracking_no || '—' }}
                    </td>
                    <td>
                      <VChip
                        :color="row.status === 2 ? 'success' : 'warning'"
                        size="small"
                        variant="tonal"
                      >
                        {{ row.status_text || '—' }}
                      </VChip>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1 py-1">
                        <VChip
                          v-for="(item, idx) in row.sku_list"
                          :key="idx"
                          size="x-small"
                          color="secondary"
                          variant="tonal"
                        >
                          {{ item.sku }} * {{ item.sku_num }}
                        </VChip>
                      </div>
                    </td>
                    <td class="text-medium-emphasis">
                      {{ formatTsText(row) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <div
                v-else
                class="text-body-2 text-medium-emphasis py-6 text-center"
              >
                {{ $t('pages.dashboard.recentInbound.empty') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>

    <VRow v-else class="mb-6">
      <VCol cols="12">
        <VAlert
          type="info"
          variant="tonal"
          border="start"
          prominent
        >
          {{ $t('pages.dashboard.warehouse.noWarehouse') }}
        </VAlert>
      </VCol>
    </VRow>

    <VRow class="mb-6 mt-0">
      <VCol cols="12" class="py-0">
        <VDivider />
      </VCol>
    </VRow>
    
    <VRow class="match-height mb-6">
      <VCol
        cols="12"
        lg="5"
      >
        <VCard
          :loading="overviewLoading"
          class="h-100"
          border
        >
          <div class="pt-4 px-4 pb-2">
            <VCardTitle class="text-h6 pa-0">
              {{ $t('pages.dashboard.sections.sevenDay') }}
            </VCardTitle>
            <VCardSubtitle class="text-wrap pa-0 pt-1">
              <span v-if="sevenDayAnalysisPeriodText">{{ sevenDayAnalysisPeriodText }}</span>
              <span v-else>{{ $t('pages.dashboard.sevenDay.fallbackSubtitle') }}</span>
            </VCardSubtitle>
          </div>
          <VTabs
            v-model="sevenDayOrderSource"
            color="primary"
            density="comfortable"
            class="app-dashboard__seven-day-tabs px-4"
          >
            <VTab
              value="dropship"
              class="text-none text-body-1"
            >
              {{ $t('pages.dashboard.sevenDay.dropshipTab') }}
            </VTab>
            <VTab
              value="waybill"
              class="text-none text-body-1"
            >
              {{ $t('pages.dashboard.sevenDay.waybillTab') }}
            </VTab>
          </VTabs>
          <VCardText>
            <div
              v-if="sevenDayShowDonut"
              class="d-flex justify-center"
            >
              <VueApexCharts
                :key="`seven-day-${sevenDayActiveTotal}-${sevenDayDonutSeries.join(',')}`"
                type="donut"
                height="300"
                :options="sevenDayDonutOptions"
                :series="sevenDayDonutSeries"
              />
            </div>
            <div
              v-else
              class="text-body-2 text-medium-emphasis py-12 text-center"
            >
              {{ sevenDayEmptyHint }}
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="7"
      >
        <VCard
          :loading="overviewLoading"
          class="h-100"
          border
        >
          <VCardItem>
            <VCardTitle class="text-h6">
              {{ $t('pages.dashboard.sections.finance') }}
            </VCardTitle>
            <VCardSubtitle>{{ $t('pages.dashboard.finance.subtitle') }}</VCardSubtitle>
          </VCardItem>
          <VCardText>
            <VRow
              class="app-dashboard__finance-kpis"
              dense
            >
              <VCol
                v-for="item in financeKpis"
                :key="item.label"
                cols="12"
                sm="4"
              >
                <VSheet
                  border
                  rounded="lg"
                  class="pa-4 h-100"
                  color="surface"
                >
                  <div class="d-flex align-center gap-4">
                    <VAvatar
                      :color="item.color"
                      variant="tonal"
                      rounded
                      size="48"
                    >
                      <VIcon
                        :icon="item.icon"
                        size="24"
                      />
                    </VAvatar>
                    <div class="min-w-0 flex-grow-1">
                      <h5 class="text-h5 font-weight-semibold tabular-nums mb-1">
                        {{ item.value }}
                      </h5>
                      <div class="text-body-2 text-high-emphasis">
                        {{ item.label }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ item.hint }}
                      </div>
                    </div>
                  </div>
                </VSheet>
              </VCol>
            </VRow>

            <VDivider class="my-4" />

            <div class="text-subtitle-2 font-weight-medium text-medium-emphasis mb-3">
              {{ $t('pages.dashboard.sections.recentLogs') }}
            </div>
            <VList
              v-if="overview?.finance?.recent_logs?.length"
              class="bg-transparent pa-0"
              density="compact"
            >
              <VListItem
                v-for="log in overview.finance.recent_logs.slice(0, 6)"
                :key="`fl-${log.id}`"
                rounded="lg"
                class="px-2 mb-1"
              >
                <template #prepend>
                  <VAvatar
                    color="secondary"
                    variant="tonal"
                    size="36"
                  >
                    <VIcon
                      icon="tabler-receipt"
                      size="20"
                    />
                  </VAvatar>
                </template>
                <VListItemTitle class="text-body-2 font-weight-medium">
                  {{ log.order_sn || log.remark || '—' }}
                </VListItemTitle>
                <VListItemSubtitle>
                  {{ log.createtime_text || '—' }}
                </VListItemSubtitle>
                <template #append>
                  <div class="text-end">
                    <div
                      class="text-body-2 font-weight-semibold"
                      :class="Number(log.change_money) < 0 ? 'text-error' : 'text-success'"
                    >
                      {{ Number(log.change_money) >= 0 ? '+' : '' }}{{ formatMoney(log.change_money) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ $t('pages.dashboard.finance.balance', { amount: formatMoney(log.last_money) }) }}
                    </div>
                  </div>
                </template>
              </VListItem>
            </VList>
            <div
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              {{ $t('pages.dashboard.finance.emptyLogs') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<style lang="scss" scoped>

.app-dashboard__seven-day-tabs {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin-block-end: 0;

  :deep(.v-tab) {
    min-inline-size: unset;
    letter-spacing: normal;
    text-transform: none;
  }

  :deep(.v-slide-group__content) {
    gap: 0.25rem;
  }
}

.app-dashboard__finance-kpis :deep(.v-col) {
  display: flex;
}

.app-dashboard__finance-kpis :deep(.v-sheet) {
  flex: 1 1 auto;
  inline-size: 100%;
}

.app-dashboard__table :deep(th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.app-dashboard__recent-package-row {
  cursor: pointer;
}

.app-dashboard__recent-package-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.notice-content :deep(img) {
  block-size: auto;
  display: block;
  max-inline-size: 100%;
}
</style>

<style lang="scss">
@use "@core/scss/template/libs/apex-chart.scss";
</style>
