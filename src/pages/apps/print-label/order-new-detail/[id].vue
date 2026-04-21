<script setup>
/* eslint-disable camelcase -- 接口 query/data 字段名需与后端保持一致 */
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    layout: 'default',
    action: 'read',
    subject: 'AclDemo',
  },
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorText = ref('')
const detail = ref(null)
const snack = ref({ show: false, text: '', color: 'success' })

function formatTs(ts) {
  if (ts == null || ts === '')
    return '—'
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0)
    return '—'

  return new Date(n * 1000).toLocaleString('zh-CN', { hour12: false })
}

function statusText(status) {
  const m = {
    0: '待处理',
    1: '请求中',
    2: '成功',
    3: '失败',
    4: '已取消',
  }

  return m[Number(status)] ?? (status == null || status === '' ? '—' : `状态 ${status}`)
}

function statusColor(status) {
  const n = Number(status)
  if (n === 2)
    return 'success'
  if (n === 3)
    return 'error'
  if (n === 4)
    return 'secondary'
  if (n === 1)
    return 'info'

  return 'warning'
}

function cancelStatusText(v) {
  const m = {
    0: '未取消',
    1: '取消中',
    3: '取消完成',
  }

  return m[Number(v)] ?? (v == null || v === '' ? '—' : String(v))
}

function formatMoney(v, currency) {
  if (v == null || v === '')
    return '—'
  const n = Number(v)
  const s = Number.isFinite(n) ? n.toFixed(2) : String(v)

  return currency ? `${s} ${currency}` : s
}

function moneyLine(v, currency) {
  const s = formatMoney(v, currency)
  if (s === '—')
    return s

  return s
}

function joinAddress(snapshot) {
  if (!snapshot)
    return '—'
  const p = [snapshot.address1, snapshot.address2, snapshot.street].map(v => String(v || '').trim()).filter(Boolean)

  return p.join(' ') || '—'
}

function toLabelUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s)
    return ''
  if (/^https?:\/\//i.test(s))
    return s

  return resolveBackendFileUrl(s)
}

function buildQuery() {
  const orderId = Number(route.params.id)
  const orderSn = String(route.query.orderSn || '').trim()
  const trackingNumber = String(route.query.tracking_number || '').trim()

  if (Number.isFinite(orderId) && orderId > 0)
    return { order_id: orderId }
  if (orderSn)
    return { order_sn: orderSn }
  if (trackingNumber)
    return { tracking_number: trackingNumber }

  return null
}

async function loadDetail() {
  loading.value = true
  errorText.value = ''
  try {
    const query = buildQuery()
    if (!query) {
      errorText.value = '缺少订单标识'

      return
    }

    const res = await $api('/Ordernewapi/shippingDetail', {
      method: 'GET',
      query,
    })

    if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res?.data) {
      detail.value = {
        ...res.data,
        label_url: toLabelUrl(res.data.label_url),
      }

      return
    }
    detail.value = null
    errorText.value = res?.message || res?.msg || '加载详情失败'
  }
  catch (e) {
    detail.value = null
    errorText.value = e?.data?.message || e?.data?.msg || e?.message || '网络请求失败'
  }
  finally {
    loading.value = false
  }
}

function backToList() {
  router.push({ name: 'apps-print-label-shipping-list' })
}

function openLabel() {
  const url = detail.value?.label_url
  if (!url)
    return
  window.open(url, '_blank', 'noopener')
}

async function copyToClipboard(text, label = '内容') {
  if (!text)
    return
  try {
    await navigator.clipboard.writeText(String(text))
    snack.value = { show: true, text: `${label}已复制`, color: 'success' }
  }
  catch {
    snack.value = { show: true, text: `${label}复制失败`, color: 'error' }
  }
}

onMounted(loadDetail)
</script>

<template>
  <VContainer
    fluid
    class="print-label-create pa-0"
  >
    <div class="print-label-create__inner pb-12">
      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2200"
      >
        {{ snack.text }}
      </VSnackbar>

      <div class="print-label-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <h1 class="text-h4 font-weight-medium text-high-emphasis">
            订单详情（只读）
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
            仅展示订单详情，不提供编辑或变更操作。
          </p>
        </div>
        <div class="d-flex gap-2">
          <VBtn
            size="small"
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="backToList"
          >
            返回列表
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-printer"
            :disabled="!detail?.label_url"
            @click="openLabel"
          >
            查看/打印面单
          </VBtn>
        </div>
      </div>

      <VAlert
        v-if="errorText"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ errorText }}
      </VAlert>

      <VProgressLinear
        v-if="loading"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <template v-if="detail && !loading">
        <VRow dense>
          <VCol
            cols="12"
            md="4"
          >
            <VCard class="summary-card">
              <VCardText>
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-subtitle-1 font-weight-medium">
                      {{ detail.order_sn || '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      订单ID：{{ detail.id ?? '—' }}
                    </div>
                  </div>
                  <div>
                    <VChip
                      size="small"
                      variant="tonal"
                      :color="statusColor(detail.status)"
                    >
                      {{ statusText(detail.status) }}
                    </VChip>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="text-caption text-medium-emphasis">
                    创建时间
                  </div>
                  <div class="text-body-2">
                    {{ formatTs(detail.createtime) }}
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            md="8"
          >
            <PrintLabelSectionCard
              title="订单基础信息"
              subtitle="核心状态、单号与关键时间。"
            >
              <VAlert
                v-if="Number(detail.cancel_status) === 1"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-4"
              >
                当前订单处于取消中，请稍后刷新查看最终状态。
              </VAlert>

              <VRow dense>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="detail.cankaohao || '—'"
                    label="参考号"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <div class="d-flex align-end gap-2">
                    <AppTextField
                      :model-value="detail.tracking_number || '—'"
                      label="跟踪号"
                      readonly
                    />
                    <VBtn
                      size="small"
                      variant="text"
                      prepend-icon="tabler-copy"
                      :disabled="!detail.tracking_number"
                      @click="copyToClipboard(detail.tracking_number, '跟踪号')"
                    >
                      复制
                    </VBtn>
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="formatTs(detail.updatetime)"
                    label="更新时间"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="Number(detail.is_deducted) === 1 ? '已扣费' : '未扣费'"
                    label="扣费状态"
                    readonly
                  />
                </VCol>
                <VCol
                  v-if="detail.fail_reason"
                  cols="12"
                >
                  <AppTextField
                    :model-value="detail.fail_reason"
                    label="失败原因"
                    readonly
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard title="发件人信息">
              <VRow dense>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="detail.sender_snapshot?.name || '—'"
                    label="姓名"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="detail.sender_snapshot?.telephone || '—'"
                    label="电话"
                    readonly
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    :model-value="joinAddress(detail.sender_snapshot)"
                    label="详细地址"
                    readonly
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard title="收件人信息">
              <VRow dense>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="detail.recipient_snapshot?.name || '—'"
                    label="姓名"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    :model-value="detail.recipient_snapshot?.telephone || '—'"
                    label="电话"
                    readonly
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    :model-value="joinAddress(detail.recipient_snapshot)"
                    label="详细地址"
                    readonly
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard title="费用信息">
              <VRow dense>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    :model-value="detail.currency || '—'"
                    label="币种"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    :model-value="moneyLine(detail.customer_fee, detail.currency)"
                    label="客户运费"
                    readonly
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <AppTextField
                    :model-value="moneyLine(detail.upstream_fee, detail.currency)"
                    label="上游运费"
                    readonly
                  />
                </VCol>
              </VRow>
            </PrintLabelSectionCard>

            <PrintLabelSectionCard
              title="技术信息（折叠）"
              subtitle="仅用于排查（默认折叠）"
            >
              <VExpansionPanels variant="accordion">
                <VExpansionPanel>
                  <VExpansionPanelTitle>查看技术字段</VExpansionPanelTitle>
                  <VExpansionPanelText>
                    <VRow dense>
                      <VCol
                        cols="12"
                        md="4"
                      >
                        <AppTextField
                          :model-value="detail.provider ?? '—'"
                          label="渠道ID(provider)"
                          readonly
                        />
                      </VCol>
                      <VCol
                        cols="12"
                        md="4"
                      >
                        <AppTextField
                          :model-value="detail.batch_id ?? '—'"
                          label="批次ID(batch_id)"
                          readonly
                        />
                      </VCol>
                      <VCol
                        cols="12"
                        md="4"
                      >
                        <AppTextField
                          :model-value="detail.userid ?? '—'"
                          label="用户ID(userid)"
                          readonly
                        />
                      </VCol>
                      <VCol
                        cols="12"
                        md="6"
                      >
                        <AppTextField
                          :model-value="detail.upstream_order_sn || '—'"
                          label="上游订单号"
                          readonly
                        />
                      </VCol>
                      <VCol
                        cols="12"
                        md="6"
                      >
                        <AppTextField
                          :model-value="detail.channel_code || '—'"
                          label="渠道编码"
                          readonly
                        />
                      </VCol>
                    </VRow>
                  </VExpansionPanelText>
                </VExpansionPanel>
              </VExpansionPanels>
            </PrintLabelSectionCard>
          </VCol>
        </VRow>
      </template>
    </div>
  </VContainer>
</template>

<style scoped>
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

.summary-card {
  padding: 12px;
}
</style>
