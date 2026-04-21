<script setup>
import { $api } from '@/utils/api'

const isCurrentPasswordVisible = ref(false)
const isNewPasswordVisible = ref(false)
const isConfirmPasswordVisible = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

const passwordHints = [
  '至少 8 位字符，越长越好',
  '需包含小写字母',
  '需包含数字、符号或空格中至少一类',
]

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function resetForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

async function submitChangePassword() {
  if (!currentPassword.value.trim()) {
    toast('请填写当前密码', 'warning')

    return
  }
  if (!newPassword.value.trim()) {
    toast('请填写新密码', 'warning')

    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast('两次输入的新密码不一致', 'warning')

    return
  }
  if (newPassword.value.length < 8) {
    toast('新密码长度至少 8 位', 'warning')

    return
  }

  submitting.value = true
  try {
    const res = await $api('/user/changePassword', {
      method: 'POST',
      body: {
        'old_password': currentPassword.value,
        'new_password': newPassword.value,
      },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '密码已更新', 'success')
      resetForm()
    }
    else {
      toast(res?.msg || '修改失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '请求失败，请确认已配置修改密码接口', 'error')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2800"
  >
    {{ snack.text }}
  </VSnackbar>

  <VRow>
    <VCol cols="12">
      <VCard title="修改密码">
        <VForm @submit.prevent="submitChangePassword">
          <VCardText class="pt-0">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="currentPassword"
                  :type="isCurrentPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isCurrentPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  label="当前密码"
                  autocomplete="current-password"
                  placeholder="············"
                  @click:append-inner="isCurrentPasswordVisible = !isCurrentPasswordVisible"
                />
              </VCol>
            </VRow>

            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="newPassword"
                  :type="isNewPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isNewPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  label="新密码"
                  autocomplete="new-password"
                  placeholder="············"
                  @click:append-inner="isNewPasswordVisible = !isNewPasswordVisible"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="confirmPassword"
                  :type="isConfirmPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isConfirmPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  label="确认新密码"
                  autocomplete="new-password"
                  placeholder="············"
                  @click:append-inner="isConfirmPasswordVisible = !isConfirmPasswordVisible"
                />
              </VCol>
            </VRow>
          </VCardText>

          <VCardText>
            <h6 class="text-h6 text-medium-emphasis mb-4">
              密码要求
            </h6>
            <VList class="card-list">
              <VListItem
                v-for="item in passwordHints"
                :key="item"
                :title="item"
                class="text-medium-emphasis"
              >
                <template #prepend>
                  <VIcon
                    size="10"
                    icon="tabler-circle-filled"
                  />
                </template>
              </VListItem>
            </VList>
          </VCardText>

          <VCardText class="d-flex flex-wrap gap-4">
            <VBtn
              type="submit"
              :loading="submitting"
            >
              保存
            </VBtn>
            <VBtn
              type="button"
              color="secondary"
              variant="tonal"
              :disabled="submitting"
              @click="resetForm"
            >
              清空
            </VBtn>
          </VCardText>
        </VForm>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss" scoped>
.card-list {
  --v-card-list-gap: 16px;
}
</style>
