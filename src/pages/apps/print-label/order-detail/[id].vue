<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { resolveYundanStatus } from '@/views/apps/print-label/useYundanList'

definePage({
  meta: {
    layout: 'default',
    action: 'read',
    subject: 'AclDemo',
  },
})

const route = useRoute()
const router = useRouter()

const detailLoading = ref(false)
const detailError = ref('')
const detailData = ref(null)
const snack = ref({ show: false, text: '', color: 'success' })

async function fetchOrderDetail() {
  detailLoading.value = true
  detailError.value = ''
  try {
    const body = {}
    const id = String(route.params.id || '').trim()
    const orderSn = String(route.query.orderSn || '').trim()
    if (id)
      body.id = Number(id)
    else if (orderSn)
      body['order_sn'] = orderSn
    else
      throw new Error('缺少订单标识')

    const res = await $api('/ordernew/getOrderDdDetail', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1 && res.data)
      detailData.value = res.data
    else
      detailError.value = res?.msg || '加载详情失败'
  }
  catch (e) {
    detailError.value = e?.data?.msg || e?.message || '网络请求失败'
  }
  finally {
    detailLoading.value = false
  }
}

function backToList() {
  router.push({ name: 'apps-print-label-orders' })
}

function downloadLabelPdf() {
  const label = detailData.value?.label || {}
  const source = label.ht_pdf || label.wp_data || ''
  if (!source) {
    snack.value = { show: true, text: '暂无面单文件', color: 'warning' }

    return
  }
  const filename = `${detailData.value?.['order_sn'] || 'label'}.pdf`
  const src = String(source).trim()
  if (/^https?:\/\//i.test(src)) {
    window.open(src, '_blank', 'noopener')

    return
  }
  if (/^data:/i.test(src)) {
    const a = document.createElement('a')

    a.href = src
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    return
  }
  if (src.startsWith('/') || /^\w+\//.test(src) || /\.(?:pdf|png|jpe?g|webp)(?:\?|#|$)/i.test(src)) {
    window.open(resolveBackendFileUrl(src), '_blank', 'noopener')

    return
  }
  const href = `data:application/pdf;base64,${src}`
  const a = document.createElement('a')

  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

onMounted(fetchOrderDetail)
</script>

<template>
  <VContainer
    fluid
    class="pa-4"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2200"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg">
      <VCardItem class="px-4 pt-4 pb-2">
        <template #prepend>
          <IconBtn @click="backToList">
            <VIcon icon="tabler-arrow-left" />
          </IconBtn>
        </template>
        <template #title>
          <span class="text-h6 font-weight-medium">运单详情</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ detailData?.order_sn || '—' }}</span>
        </template>
        <template #append>
          <VBtn
            variant="tonal"
            size="small"
            prepend-icon="tabler-download"
            :disabled="detailLoading || !detailData"
            @click="downloadLabelPdf"
          >
            下载面单
          </VBtn>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4">
        <VAlert
          v-if="detailError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ detailError }}
        </VAlert>
        <VProgressLinear
          v-if="detailLoading"
          indeterminate
          color="primary"
          class="mb-4"
        />
        <template v-if="detailData && !detailLoading">
          <VCard
            variant="tonal"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                基础信息
              </div>
              <div class="text-body-2 py-1">
                状态：{{ resolveYundanStatus(detailData?.status).text }}
              </div>
              <div class="text-body-2 py-1">
                线路：{{ detailData?.transport_line || '—' }}
              </div>
              <div class="text-body-2 py-1">
                跟踪号：{{ detailData?.label?.ht_tracking_no || '—' }}
              </div>
              <div class="text-body-2 py-1">
                参考号：{{ detailData?.order_meta?.cankaohao || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard
            variant="outlined"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                发件人
              </div>
              <div class="text-body-2">
                {{ detailData?.send?.name || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.send?.country || '' }} {{ detailData?.send?.province || '' }} {{ detailData?.send?.city || '' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ detailData?.send?.address || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.send?.telephone || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard
            variant="outlined"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                收件人
              </div>
              <div class="text-body-2">
                {{ detailData?.receive?.name || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.receive?.country || '' }} {{ detailData?.receive?.province || '' }} {{ detailData?.receive?.city || '' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ detailData?.receive?.address || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.receive?.telephone || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard variant="outlined">
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                包裹信息
              </div>
              <div
                v-for="(p, idx) in (detailData?.packages || [])"
                :key="idx"
                class="text-body-2 py-1"
              >
                #{{ idx + 1 }} 重量 {{ p.weight ?? '—' }}，尺寸 {{ p.length ?? '—' }} × {{ p.width ?? '—' }} × {{ p.height ?? '—' }}，申报 {{ p.value ?? '—' }}
              </div>
            </VCardText>
          </VCard>
        </template>
      </VCardText>
    </VCard>
  </VContainer>
</template>
