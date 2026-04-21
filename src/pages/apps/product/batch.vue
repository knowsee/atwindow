<script setup>
import { $api } from '@/utils/api'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const fileInputRef = ref()
const selectedFile = ref(null)
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push('/apps/product/list')
}

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event?.target?.files?.[0]

  selectedFile.value = file || null
}

async function submitBatch() {
  if (!selectedFile.value) {
    toast('请先选择 Excel 文件', 'warning')
    
    return
  }

  const ext = selectedFile.value.name.split('.').pop()?.toLowerCase()
  if (!['xls', 'xlsx'].includes(ext || '')) {
    toast('仅支持 .xls / .xlsx 文件', 'warning')
    
    return
  }

  submitting.value = true
  try {
    const formData = new FormData()

    formData.append('file', selectedFile.value)

    const accessToken = useCookie('accessToken').value
    if (accessToken)
      formData.append('token', accessToken)

    const res = await $api('/product/excel', {
      method: 'POST',
      body: formData,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '批量新增提交成功', 'success')
      setTimeout(() => goList(), 700)
      
      return
    }

    toast(res?.msg || '批量新增失败', 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || '批量新增失败', 'error')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <VContainer
    fluid
    class="product-batch pa-0"
  >
    <div class="product-batch__inner pb-12">
      <div class="product-batch__hero mb-6">
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          批量新增产品
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          上传 Excel 模板文件后批量导入产品数据。
        </p>
      </div>

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2600"
      >
        {{ snack.text }}
      </VSnackbar>

      <PrintLabelSectionCard
        title="上传文件"
        subtitle="仅支持 .xls / .xlsx，建议先下载模板填写。"
      >
        <template #append>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            返回列表
          </VBtn>
        </template>

        <input
          ref="fileInputRef"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="d-none"
          @change="onFileChange"
        >

        <VSheet
          rounded="lg"
          border
          class="product-batch-upload"
          @click="pickFile"
        >
          <div class="product-batch-upload__inner">
            <VIcon
              icon="tabler-file-spreadsheet"
              size="30"
              class="text-primary mb-2"
            />
            <div class="text-subtitle-2">
              点击选择 Excel 文件
            </div>
            <div
              v-if="selectedFile"
              class="text-body-2 text-primary mt-2 text-center"
            >
              {{ selectedFile.name }}
            </div>
            <div
              v-else
              class="text-caption text-medium-emphasis mt-2"
            >
              未选择文件
            </div>
          </div>
        </VSheet>

        <div class="mt-3 text-body-2">
          模板下载：
          <a
            href="/download/产品批量添加模板.xls"
            class="text-primary"
            target="_blank"
            rel="noopener"
          >
            产品批量添加模板.xls
          </a>
        </div>
      </PrintLabelSectionCard>

      <VCard
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            :loading="submitting"
            prepend-icon="tabler-upload"
            @click="submitBatch"
          >
            提交导入
          </VBtn>
        </VCardText>
      </VCard>
    </div>
  </VContainer>
</template>

<style scoped>
.product-batch {
  background: rgb(var(--v-theme-background));
}

.product-batch__inner {
  max-inline-size: 1440px;
  margin-inline: auto;
  padding: 1.5rem;
}

.product-batch-upload {
  cursor: pointer;
  border-style: dashed;
  transition: all 0.2s ease;
}

.product-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.product-batch-upload__inner {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
