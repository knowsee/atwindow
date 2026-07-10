<script setup>
import DOMPurify from 'dompurify'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { marked } from 'marked'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import { useAiAnalysis } from './useAiAnalysis'

const props = defineProps({
  warehouseId: {
    type: [Number, String],
    required: true,
  },
})

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])
import { useRouter } from 'vue-router'
import { $api, $apiJson } from '@/utils/api'

const { t, locale } = useI18n({ useScope: 'global' })
const theme = useTheme()
const router = useRouter()

const subStatus = ref(null)
const upgradeDialog = ref(false)
const selectedTier = ref(2)
const submitting = ref(false)
const confirmDialog = ref({
  show: false,
  message: ''
})

const subscribePlans = ref([])

async function loadSubscribePlans() {
  try {
    const res = await $api('/ordernewapi/aiSubscribePlans', { method: 'GET' })
    if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res.data?.plans) {
      subscribePlans.value = res.data.plans
    }
  } catch (e) {
    console.error('Failed to load subscription plans', e)
  }
}

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

function goToUpgrade() {
  router.push('/apps/account/personalization')
}

function triggerConfirm() {
  const tier = selectedTier.value
  const plan = subscribePlans.value.find(p => Number(p.tier) === tier)
  const priceVal = plan ? `$${plan.price}` : (tier === 2 ? '$19.90' : '$30.99')
  const date = getNextMondayText()
  
  confirmDialog.value = {
    show: true,
    message: `系统将即时自您的账户余额中扣除首期订阅费用 ${priceVal}。因数据初始化与同步需要，AI 智能分析权限将于 ${date}（下周一）起正式生效。\n\n是否确认开通此套餐？`
  }
}

async function executeSubscribe() {
  confirmDialog.value.show = false
  upgradeDialog.value = false
  submitting.value = true
  try {
    const res = await $apiJson('/ordernewapi/aiSubscribe', {
      method: 'POST',
      body: { tier: selectedTier.value }
    })
    
    if (Number(res?.code) === 1 || Number(res?.code) === 200) {
      window.location.reload()
    } else {
      alert(res?.message || '订阅失败，请重试')
    }
  } catch (e) {
    alert(e?.data?.message || e?.message || '网络请求错误，请重试')
  } finally {
    submitting.value = false
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

onMounted(() => {
  loadSubStatus()
  loadSubscribePlans()
})

const warehouseIdRef = computed(() => props.warehouseId)

const { 
  fetchAnalysis, 
  data: aiData, 
  loading, 
  loadingPhase, 
  errorMsg 
} = useAiAnalysis(
  warehouseIdRef, 
  locale, 
  () => t('pages.dashboard.aiAnalysis.noData'),
)

watch(() => [props.warehouseId, locale.value], () => {
  fetchAnalysis()?.catch(err => {
    console.warn('AI analysis fetch skipped or failed:', err.message)
  })
}, { immediate: true })

const parsedMarkdown = computed(() => {
  if (!aiData.value?.analysis?.markdown) return ''
  
  return DOMPurify.sanitize(marked.parse(aiData.value.analysis.markdown))
})

const currentThemeColors = computed(() => theme.current.value.colors)

const activeTab = ref('analysis')

const getDynamicChartOptions = (chartInfo, themeColors) => {
  if (!chartInfo) return {}
  
  const isPieOrDoughnut = chartInfo.chartType === 'pie' || chartInfo.chartType === 'doughnut';
  
  if (isPieOrDoughnut) {
    const data = chartInfo.labels.map((label, i) => ({
      name: label,
      value: chartInfo.datasets[0].data[i]
    }))
    
    return {
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom', type: 'scroll' },
      series: [
        {
          name: chartInfo.datasets[0].label,
          type: 'pie',
          radius: chartInfo.chartType === 'doughnut' ? ['40%', '70%'] : '70%',
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 16, fontWeight: 'bold' },
          },
          labelLine: { show: false },
          data,
        }
      ]
    }
  } else {
    const isLine = chartInfo.chartType === 'line'
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: isLine ? 'line' : 'shadow' } },
      legend: { top: 'bottom', type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: chartInfo.labels, boundaryGap: !isLine, axisLabel: { interval: 0, width: 80, overflow: 'truncate' } },
      yAxis: { type: 'value', splitLine: { show: false } },
      series: chartInfo.datasets.map((dataset, idx) => ({
        name: dataset.label,
        type: chartInfo.chartType,
        smooth: isLine,
        data: dataset.data,
        barWidth: chartInfo.chartType === 'bar' ? '50%' : undefined,
        itemStyle: chartInfo.chartType === 'bar' ? {
          borderRadius: [4, 4, 0, 0]
        } : undefined,
        areaStyle: isLine && idx === 0 ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: themeColors.info },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ],
          }
        } : undefined
      }))
    }
  }
}

const globalOverviewCharts = computed(() => {
  const charts = aiData.value?.analysis?.chartData?.globalOverview || []
  return charts.map(chart => ({
    title: chart.title,
    options: getDynamicChartOptions(chart, currentThemeColors.value)
  }))
})

const specializedCharts = computed(() => {
  const charts = aiData.value?.analysis?.chartData?.specializedCharts || []
  return charts.map(chart => ({
    title: chart.title,
    options: getDynamicChartOptions(chart, currentThemeColors.value)
  }))
})
</script>

<template>
  <div class="ai-warehouse-analysis">
    <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-4">
      <div class="d-flex align-center gap-2">
        <VIcon
          icon="tabler-sparkles"
          color="primary"
          size="32"
          class="sparkle-icon"
        />
        <h2 class="text-h5 font-weight-bold ai-title">
          {{ $t('pages.dashboard.aiAnalysis.title') }}
        </h2>
      </div>
    </div>

    <!-- AI Premium Upgrade Banner -->
    <VCard
      v-if="false && subStatus && Number(subStatus.current_tier || 1) === 1"
      flat
      border
      class="ai-upgrade-banner mb-6 position-relative overflow-hidden"
    >
      <div class="ai-upgrade-banner__glow"></div>
      <div class="pa-4 pa-sm-5 d-flex flex-wrap align-center justify-space-between gap-4 position-relative z-1">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" size="48" class="animate-bounce-subtle flex-shrink-0">
            <VIcon icon="tabler-sparkles" size="26" class="text-primary" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <span class="text-h6 font-weight-bold text-high-emphasis">解锁 ATWindow AI 深度分析报告</span>
              <VChip size="x-small" color="primary" variant="flat" class="font-weight-black">FREE</VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
              您当前正在使用免费版报告（不定期生成）。升级至标准版或专业版，即享每周/双周深度仓储动销洞察、智能备货及风险预警！
            </p>
          </div>
        </div>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="tabler-crown"
          class="px-5 font-weight-bold custom-upgrade-btn"
          @click="upgradeDialog = true"
        >
          升级分析
        </VBtn>
      </div>
    </VCard>

    <!-- Error State -->
    <VAlert
      v-if="errorMsg"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ errorMsg }}
    </VAlert>

    <VCard
      v-if="loading && (!aiData || loadingPhase === 'queued' || loadingPhase === 'thinking')"
      border
      class="mb-6 pa-3 pa-sm-6 d-flex justify-center align-center min-h-300"
    >
      <div class="d-flex flex-column align-center gap-3">
        <VProgressCircular
          indeterminate
          color="primary"
          size="48"
        />
        <div class="text-body-1 font-weight-bold text-medium-emphasis pulse-text mt-2 text-center">
          <template v-if="loadingPhase === 'queued'">
            正在为您分配 AI 算力，请排队稍候...
          </template>
          <template v-else-if="loadingPhase === 'thinking'">
            AI 正在深度分析 {{ aiData?.warehouse || '仓库' }} 的 {{ aiData?.sku_count || '多' }} 个商品数据，请稍候...
          </template>
          <template v-else>
            {{ $t('pages.dashboard.aiAnalysis.loading') }}
          </template>
        </div>
      </div>
    </VCard>

    <template v-else-if="aiData">

      <!-- Tabs Navigation -->
      <div class="mb-4">
        <VTabs v-model="activeTab" color="primary" class="ai-tabs">
          <VTab value="analysis" class="text-none">
            <VIcon icon="tabler-file-analytics" class="mr-2" size="20" />
            智能分析
          </VTab>
          <VTab value="charts" class="text-none" v-if="specializedCharts.length || loading">
            <VIcon icon="tabler-chart-pie" class="mr-2" size="20" />
            深度图表
          </VTab>
        </VTabs>
      </div>

      <VWindow v-model="activeTab" :touch="false" class="overflow-visible">
        <!-- Analysis Tab -->
        <VWindowItem value="analysis">
          <!-- Alerts Section -->
          <VRow
            v-if="aiData.analysis?.alerts?.length"
            class="mb-6 match-height"
          >
            <VCol
              v-for="(alert, idx) in aiData.analysis.alerts"
              :key="idx"
              cols="12"
              md="6"
            >
              <VAlert
                :type="alert.level === 'critical' ? 'error' : 'warning'"
                variant="tonal"
                border="start"
                class="alert-card h-100"
              >
                <template #title>
                  <span class="font-weight-bold">{{ alert.sku }}</span>
                </template>
                {{ alert.message }}
              </VAlert>
            </VCol>
          </VRow>
          
          <!-- Global Overview Charts -->
          <VRow v-if="globalOverviewCharts.length" class="mb-6 match-height">
            <VCol
              v-for="(chart, idx) in globalOverviewCharts"
              :key="idx"
              cols="12"
              md="6"
            >
              <VCard border class="h-100 chart-card">
                <VCardItem>
                  <VCardTitle class="text-subtitle-1 font-weight-bold">
                    {{ chart.title }}
                  </VCardTitle>
                </VCardItem>
                <VCardText>
                  <VChart class="chart" :option="chart.options" autoresize />
                </VCardText>
              </VCard>
            </VCol>
          </VRow>

          <!-- Markdown Report -->
          <VCard
            border
            class="markdown-report-card"
          >
            <VCardItem class="ai-report-header">
              <VCardTitle class="text-h6 font-weight-bold d-flex align-center justify-space-between text-wrap w-100">
                <div class="d-flex align-center gap-2">
                  <VIcon icon="tabler-sparkles" class="sparkle-icon text-primary animate-pulse" />
                  <span class="ai-title-text">{{ $t('pages.dashboard.aiAnalysis.reportTitle') }}</span>
                </div>
                <VChip
                  v-if="subStatus"
                  size="small"
                  :color="Number(subStatus.current_tier || 1) === 1 ? 'primary' : 'success'"
                  variant="flat"
                  class="font-weight-black text-caption"
                >
                  {{ Number(subStatus.current_tier || 1) === 1 ? 'FREE' : (Number(subStatus.current_tier) === 2 ? 'STANDARD' : 'PRO') }}
                </VChip>
              </VCardTitle>
              <VCardSubtitle class="text-wrap mt-1">
                {{ $t('pages.dashboard.aiAnalysis.reportSubtitle', { warehouse: aiData.warehouse, count: aiData.sku_count }) }}
              </VCardSubtitle>
            </VCardItem>
            <VDivider />
            <VCardText class="pa-3 pa-sm-6">
              <div
                class="markdown-body"
                v-html="parsedMarkdown"
              />
              
              <!-- AI Streaming Indicator -->
              <div
                v-if="loading && loadingPhase === 'streaming'"
                class="mt-4 d-flex align-center gap-2 text-primary text-caption font-weight-bold"
              >
                <span class="pulse-text">AI 正在飞速撰写报告中...</span>
              </div>
            </VCardText>
          </VCard>
        </VWindowItem>

        <!-- Charts Tab -->
        <VWindowItem value="charts">
          <VRow v-if="specializedCharts.length" class="mb-6 match-height">
            <VCol
              v-for="(chart, idx) in specializedCharts"
              :key="idx"
              cols="12"
              md="6"
            >
              <VCard border class="h-100 chart-card">
                <VCardItem>
                  <VCardTitle class="text-subtitle-1 font-weight-bold">
                    {{ chart.title }}
                  </VCardTitle>
                </VCardItem>
                <VCardText>
                  <VChart class="chart" :option="chart.options" autoresize />
                </VCardText>
              </VCard>
            </VCol>
          </VRow>
          
          <VCard v-else-if="loading" class="mb-6 pa-6 d-flex justify-center align-center min-h-300">
            <div class="d-flex flex-column align-center gap-3">
              <VProgressCircular indeterminate color="primary" size="40" />
              <div class="text-body-2 text-medium-emphasis pulse-text">正在绘制多维图表分析...</div>
            </div>
          </VCard>
          
          <VCard v-else class="mb-6 pa-6 d-flex justify-center align-center min-h-300">
            <div class="text-body-1 text-medium-emphasis">暂无可用图表数据</div>
          </VCard>
        </VWindowItem>
      </VWindow>
    </template>

    <!-- Upgrade Package Dialog -->
    <VDialog
      v-model="upgradeDialog"
      max-width="650"
    >
      <VCard class="rounded-lg position-relative overflow-hidden">
        <VOverlay
          :model-value="submitting"
          contained
          persistent
          class="align-center justify-center"
        >
          <div class="d-flex align-center gap-3 px-4 py-3 bg-surface rounded">
            <VProgressCircular indeterminate color="primary" size="24" />
            <span class="text-body-2">正在处理订阅...</span>
          </div>
        </VOverlay>

        <VCardItem class="pb-2 pt-6 px-6">
          <VCardTitle class="text-h5 font-weight-bold d-flex align-center gap-2">
            <VIcon icon="tabler-sparkles" color="primary" />
            升级 ATWindow AI 智能分析
          </VCardTitle>
          <VCardSubtitle class="text-body-2 mt-1">
            选择适合您的智能分析方案，解锁每周/双周深度全景报告与运营洞察
          </VCardSubtitle>
        </VCardItem>
        <VDivider />

        <VCardText class="pa-6">
          <VRow class="match-height">
            <!-- Dynamically render Tier 2 and Tier 3 -->
            <VCol
              v-for="plan in subscribePlans.filter(p => Number(p.tier) > 1)"
              :key="plan.tier"
              cols="12"
              sm="6"
            >
              <VCard
                border
                class="upgrade-choice-card h-100 d-flex flex-column cursor-pointer"
                :class="{ 'upgrade-choice-card--active': selectedTier === Number(plan.tier) }"
                @click="selectedTier = Number(plan.tier)"
              >
                <div class="pa-4 text-center">
                  <VIcon
                    :icon="Number(plan.tier) === 2 ? 'tabler-sparkles' : 'tabler-crown'"
                    size="36"
                    :color="Number(plan.tier) === 2 ? 'primary' : 'warning'"
                    class="mb-3"
                  />
                  <h4 class="text-h6 font-weight-bold">{{ plan.name }}</h4>
                  
                  <div class="d-flex align-center justify-center gap-2 mt-2">
                    <span class="text-h5 font-weight-black text-primary">${{ plan.price }}/月</span>
                    <span
                      v-if="plan.original_price && plan.original_price > plan.price"
                      class="text-body-2 text-disabled text-decoration-line-through"
                    >
                      ${{ plan.original_price }}
                    </span>
                  </div>
                  
                  <div class="text-body-2 text-medium-emphasis mt-2">
                    {{ Number(plan.tier) === 2 ? '半月一次深度仓储全景数据分析' : '每周一次深度仓储全景数据分析' }}
                  </div>
                </div>
              </VCard>
            </VCol>
            
            <!-- Fallback if API hasn't loaded yet -->
            <template v-if="!subscribePlans.length">
              <VCol cols="12" sm="6">
                <VCard
                  border
                  class="upgrade-choice-card h-100 d-flex flex-column cursor-pointer"
                  :class="{ 'upgrade-choice-card--active': selectedTier === 2 }"
                  @click="selectedTier = 2"
                >
                  <div class="pa-4 text-center">
                    <VIcon icon="tabler-sparkles" size="36" color="primary" class="mb-3" />
                    <h4 class="text-h6 font-weight-bold">标准版</h4>
                    <div class="text-h5 font-weight-black text-primary mt-2">$19.90/月</div>
                    <div class="text-body-2 text-medium-emphasis mt-2">
                      半月一次深度仓储全景数据分析
                    </div>
                  </div>
                </VCard>
              </VCol>
              <VCol cols="12" sm="6">
                <VCard
                  border
                  class="upgrade-choice-card h-100 d-flex flex-column cursor-pointer"
                  :class="{ 'upgrade-choice-card--active': selectedTier === 3 }"
                  @click="selectedTier = 3"
                >
                  <div class="pa-4 text-center">
                    <VIcon icon="tabler-crown" size="36" color="warning" class="mb-3" />
                    <h4 class="text-h6 font-weight-bold">专业版</h4>
                    <div class="text-h5 font-weight-black text-primary mt-2">$30.99/月</div>
                    <div class="text-body-2 text-medium-emphasis mt-2">
                      每周一次深度仓储全景数据分析
                    </div>
                  </div>
                </VCard>
              </VCol>
            </template>
          </VRow>
        </VCardText>
        
        <VCardActions class="px-6 pb-6 pt-0 d-flex justify-end gap-2">
          <VBtn
            color="secondary"
            variant="tonal"
            @click="upgradeDialog = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            :disabled="!selectedTier"
            @click="triggerConfirm"
          >
            立即订阅
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Secondary Confirmation Dialog -->
    <VDialog
      v-model="confirmDialog.show"
      max-width="500"
    >
      <VCard class="rounded-lg">
        <VCardItem class="pb-2">
          <VCardTitle class="text-h6 font-weight-bold d-flex align-center gap-2">
            <VIcon icon="tabler-alert-circle" color="warning" />
            确认付款开通
          </VCardTitle>
        </VCardItem>
        <VCardText class="pb-4">
          <div class="text-body-1 style-message-text" style="white-space: pre-line;">
            {{ confirmDialog.message }}
          </div>
        </VCardText>
        <VCardActions class="px-6 pb-6 pt-0 d-flex justify-end gap-2">
          <VBtn
            color="secondary"
            variant="tonal"
            @click="confirmDialog.show = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            @click="executeSubscribe"
          >
            确认付款
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped lang="scss">
.ai-warehouse-analysis {
  margin-top: 0;
  margin-bottom: 1.5rem;
}

@keyframes pulse-opacity {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

.pulse-text {
  animation: pulse-opacity 1.5s infinite ease-in-out;
}

.ai-title {
  background: linear-gradient(90deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-info)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sparkle-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.min-h-300 {
  min-height: 300px;
}

.chart-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-radius: 12px;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
  }
}

.chart {
  height: 250px;
  width: 100%;
}

.alert-card {
  border-left: 6px solid rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.markdown-report-card {
  overflow: hidden;
  border-radius: 12px;
}

.ai-report-header {
  background: linear-gradient(90deg, rgba(var(--v-theme-primary), 0.08) 0%, rgba(var(--v-theme-info), 0.04) 100%) !important;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.ai-title-text {
  font-weight: 700;
  letter-spacing: 0.5px;
}

.ai-upgrade-banner {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.05) 0%, rgba(var(--v-theme-info), 0.05) 100%) !important;
  border-color: rgba(var(--v-theme-primary), 0.15) !important;
  border-radius: 12px;
}

.ai-upgrade-banner__glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.12) 0%, rgba(var(--v-theme-primary), 0) 70%);
  filter: blur(30px);
  pointer-events: none;
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.animate-bounce-subtle {
  animation: bounce-subtle 3s infinite ease-in-out;
}

.custom-upgrade-btn {
  background: linear-gradient(90deg, rgb(var(--v-theme-primary)) 0%, #a158ff 100%) !important;
  box-shadow: 0 4px 14px rgba(var(--v-theme-primary), 0.3) !important;
  transition: all 0.22s ease-in-out;
  &:hover {
    transform: scale(1.03);
    box-shadow: 0 6px 20px rgba(var(--v-theme-primary), 0.4) !important;
  }
}

/* Custom Markdown Styles */
:deep(.markdown-body) {
  font-family: 'Inter', sans-serif;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.87);
  line-height: 1.6;

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 1);

    &:first-child {
      margin-top: 0;
    }
  }

  h1, h2 {
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    padding-bottom: 0.3em;
    &:first-child {
      margin-top: 0;
    }
  }

  p {
    margin-bottom: 1em;
  }

  ul, ol {
    margin-bottom: 1em;
    padding-left: 2em;
    
    li {
      margin-bottom: 0.25em;
    }
  }

  strong {
    font-weight: 600;
    color: rgba(var(--v-theme-primary), 1);
  }

  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid rgba(var(--v-theme-primary), 0.5);
    background: rgba(var(--v-theme-primary), 0.05);
    border-radius: 0 4px 4px 0;
  }

  table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
    
    th, td {
      border: 1px solid rgba(var(--v-theme-border-color), var(--v-theme-border-opacity));
      padding: 0.75em 1em;
      text-align: left;
    }
    
    th {
      background: rgba(var(--v-theme-surface-variant), 0.5);
      font-weight: 600;
    }
  }
}

.upgrade-choice-card {
  transition: all 0.22s ease-in-out;
  border-width: 1px !important;
}

.upgrade-choice-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
}

.upgrade-choice-card--active {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 4px 14px rgba(var(--v-theme-primary), 0.15) !important;
  background-color: rgba(var(--v-theme-primary), 0.02) !important;
}

.style-message-text {
  line-height: 1.6;
}
</style>
