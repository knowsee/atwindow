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
const { t } = useI18n({ useScope: 'global' })

const passwordHints = computed(() => [
  t('pages.accountSettings.security.requirements.length'),
  t('pages.accountSettings.security.requirements.lowercase'),
  t('pages.accountSettings.security.requirements.complexity'),
])

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
    toast(t('pages.accountSettings.security.messages.currentRequired'), 'warning')

    return
  }
  if (!newPassword.value.trim()) {
    toast(t('pages.accountSettings.security.messages.newRequired'), 'warning')

    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast(t('pages.accountSettings.security.messages.mismatch'), 'warning')

    return
  }
  if (newPassword.value.length < 8) {
    toast(t('pages.accountSettings.security.messages.tooShort'), 'warning')

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
      toast(res?.msg || t('pages.accountSettings.security.messages.updated'), 'success')
      resetForm()
    }
    else {
      toast(res?.msg || t('pages.accountSettings.security.messages.failed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountSettings.security.messages.requestFailed'), 'error')
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
      <VCard :title="$t('pages.accountSettings.security.title')">
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
                  :label="$t('pages.accountSettings.security.fields.currentPassword')"
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
                  :label="$t('pages.accountSettings.security.fields.newPassword')"
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
                  :label="$t('pages.accountSettings.security.fields.confirmPassword')"
                  autocomplete="new-password"
                  placeholder="············"
                  @click:append-inner="isConfirmPasswordVisible = !isConfirmPasswordVisible"
                />
              </VCol>
            </VRow>
          </VCardText>

          <VCardText>
            <h6 class="text-h6 text-medium-emphasis mb-4">
              {{ $t('pages.accountSettings.security.requirementsTitle') }}
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
              {{ $t('pages.accountSettings.security.actions.save') }}
            </VBtn>
            <VBtn
              type="button"
              color="secondary"
              variant="tonal"
              :disabled="submitting"
              @click="resetForm"
            >
              {{ $t('pages.accountSettings.security.actions.clear') }}
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
