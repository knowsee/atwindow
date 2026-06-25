<script setup>
import AccountSettingsAccount from '@/views/pages/account-settings/AccountSettingsAccount.vue'
import AccountSettingsSecurity from '@/views/pages/account-settings/AccountSettingsSecurity.vue'

const route = useRoute('pages-account-settings-tab')
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const allowedTabs = ['account', 'security']

const activeTab = computed({
  get: () => route.params.tab,
  set: () => route.params.tab,
})

const tabs = computed(() => [
  {
    title: t('pages.accountSettings.tabs.account'),
    icon: 'tabler-users',
    tab: 'account',
  },
  {
    title: t('pages.accountSettings.tabs.security'),
    icon: 'tabler-lock',
    tab: 'security',
  },
])

watch(
  () => route.params.tab,
  tab => {
    const s = String(tab || '')
    if (s && !allowedTabs.includes(s))
      router.replace({ name: 'pages-account-settings-tab', params: { tab: 'account' } })
  },
  { immediate: true },
)

definePage({ meta: { navActiveLink: 'pages-account-settings-tab' } })
</script>

<template>
  <div>
    <VTabs
      v-model="activeTab"
      class="v-tabs-pill"
    >
      <VTab
        v-for="item in tabs"
        :key="item.tab"
        :value="item.tab"
        :to="{ name: 'pages-account-settings-tab', params: { tab: item.tab } }"
      >
        <VIcon
          size="20"
          start
          :icon="item.icon"
        />
        {{ item.title }}
      </VTab>
    </VTabs>

    <VWindow
      v-model="activeTab"
      class="mt-6 disable-tab-transition"
      :touch="false"
    >
      <VWindowItem value="account">
        <AccountSettingsAccount />
      </VWindowItem>

      <VWindowItem value="security">
        <AccountSettingsSecurity />
      </VWindowItem>
    </VWindow>
  </div>
</template>
