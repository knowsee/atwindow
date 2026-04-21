<script setup>
import AppBarSearch from '@core/components/AppBarSearch.vue'
import { useConfigStore } from '@core/stores/config'
import Shepherd from 'shepherd.js'

const props = defineProps({
  /** 与侧栏/顶栏一致的菜单配置（由布局传入，避免本组件再 import 导航产生循环依赖） */
  navItems: {
    type: Array,
    default: () => [],
  },
})

defineOptions({
  inheritAttrs: false,
})

const configStore = useConfigStore()
const { t, te, locale } = useI18n({ useScope: 'global' })
const isAppSearchBarVisible = ref(false)
const isLoading = ref(false)

/** 菜单项 title 为 i18n key 时解析为当前语言文案 */
function navLabel(key) {
  if (typeof key !== 'string')
    return ''

  return te(key) ? t(key) : key
}

const menuItems = computed(() => (Array.isArray(props.navItems) ? props.navItems : []))

/** 扁平化菜单，供搜索与联想 */
function buildMenuFlat(items) {
  if (!Array.isArray(items))
    return []

  const rows = []
  for (const item of items) {
    if (!item || item.heading)
      continue
    const icon = item.icon?.icon || 'tabler-circle'
    if (item.children?.length) {
      for (const ch of item.children) {
        if (!ch?.to)
          continue
        rows.push({
          title: ch.title,
          groupTitle: item.title,
          icon,
          url: typeof ch.to === 'string' ? { name: ch.to } : ch.to,
        })
      }
    }
    else if (item.to) {
      rows.push({
        title: item.title,
        groupTitle: item.title,
        icon,
        url: typeof item.to === 'string' ? { name: item.to } : item.to,
      })
    }
  }

  return rows
}

const menuFlat = computed(() => buildMenuFlat(menuItems.value))

/** 打开弹窗时展示的菜单分组 */
const menuSuggestionGroups = computed(() => {
  if (!Array.isArray(menuItems.value))
    return []

  const groups = []
  for (const item of menuItems.value) {
    if (!item || item.heading)
      continue
    const icon = item.icon?.icon || 'tabler-circle'
    if (item.children?.length) {
      const content = item.children
        .filter(ch => ch?.to)
        .map(ch => ({
          icon,
          title: ch.title,
          url: typeof ch.to === 'string' ? { name: ch.to } : ch.to,
        }))

      if (content.length)
        groups.push({ title: item.title, content })
    }
    else if (item.to) {
      groups.push({
        title: item.title,
        content: [{
          icon,
          title: item.title,
          url: typeof item.to === 'string' ? { name: item.to } : item.to,
        }],
      })
    }
  }

  return groups
})

const noDataSuggestions = computed(() => {
  void locale.value

  return menuFlat.value.slice(0, 6).map(e => ({
    title: e.groupTitle === e.title
      ? navLabel(e.title)
      : `${navLabel(e.groupTitle)} · ${navLabel(e.title)}`,
    icon: e.icon,
    url: e.url,
  }))
})

const searchQuery = ref('')
const router = useRouter()
const searchResult = ref([])

function matchesQuery(text, q) {
  if (!q?.trim())
    return true
  const query = q.trim()
  const hay = String(text ?? '')

  return hay.toLowerCase().includes(query.toLowerCase()) || hay.includes(query)
}

function filterMenuByQuery(q) {
  const query = String(q || '').trim()
  if (!query) {
    searchResult.value = []

    return
  }

  const filtered = menuFlat.value.filter(e =>
    matchesQuery(navLabel(e.title), query)
    || matchesQuery(navLabel(e.groupTitle), query)
    || matchesQuery(e.title, query)
    || matchesQuery(e.groupTitle, query),
  )

  const byGroup = {}
  for (const e of filtered) {
    const g = e.groupTitle
    if (!byGroup[g])
      byGroup[g] = []
    byGroup[g].push({
      title: e.title,
      icon: e.icon,
      url: e.url,
    })
  }

  searchResult.value = Object.keys(byGroup).map(title => ({
    title,
    children: byGroup[title],
  }))
}

function fetchResults() {
  isLoading.value = true
  filterMenuByQuery(searchQuery.value)
  isLoading.value = false
}

watch(searchQuery, fetchResults)

const closeSearchBar = () => {
  isAppSearchBarVisible.value = false
  searchQuery.value = ''
  searchResult.value = []
}

const redirectToSuggestedPage = selected => {
  router.push(selected.url)
  closeSearchBar()
}
</script>

<template>
  <div
    class="d-flex align-center cursor-pointer"
    v-bind="$attrs"
    style="user-select: none;"
    @click="isAppSearchBarVisible = !isAppSearchBarVisible"
  >
    <IconBtn @click="Shepherd.activeTour?.cancel()">
      <VIcon icon="tabler-search" />
    </IconBtn>

    <span
      v-if="configStore.appContentLayoutNav === 'vertical'"
      class="d-none d-md-flex align-center text-disabled ms-2"
      @click="Shepherd.activeTour?.cancel()"
    >
      <span class="me-2">{{ t('search.trigger') }}</span>
      <span class="meta-key">&#8984;K</span>
    </span>
  </div>

  <AppBarSearch
    v-model:is-dialog-visible="isAppSearchBarVisible"
    :search-results="searchResult"
    :is-loading="isLoading"
    @search="searchQuery = $event"
  >
    <template #suggestions>
      <VCardText class="app-bar-search-suggestions pa-12">
        <VRow v-if="menuSuggestionGroups.length">
          <VCol
            v-for="suggestion in menuSuggestionGroups"
            :key="suggestion.title"
            cols="12"
            sm="6"
          >
            <p
              class="custom-letter-spacing text-disabled text-uppercase py-2 px-4 mb-0"
              style="font-size: 0.75rem; line-height: 0.875rem;"
            >
              {{ $t(suggestion.title) }}
            </p>
            <VList class="card-list">
              <VListItem
                v-for="item in suggestion.content"
                :key="`${suggestion.title}-${item.title}`"
                class="app-bar-search-suggestion mx-4 mt-2"
                @click="redirectToSuggestedPage(item)"
              >
                <VListItemTitle>{{ $t(item.title) }}</VListItemTitle>
                <template #prepend>
                  <VIcon
                    :icon="item.icon"
                    size="20"
                    class="me-n1"
                  />
                </template>
              </VListItem>
            </VList>
          </VCol>
        </VRow>
      </VCardText>
    </template>

    <template #noDataSuggestion>
      <div class="mt-9">
        <span class="d-flex justify-center text-disabled mb-2">{{ t('search.tryFromMenu') }}</span>
        <h6
          v-for="suggestion in noDataSuggestions"
          :key="suggestion.title"
          class="app-bar-search-suggestion text-h6 font-weight-regular cursor-pointer py-2 px-4"
          @click="redirectToSuggestedPage(suggestion)"
        >
          <VIcon
            size="20"
            :icon="suggestion.icon"
            class="me-2"
          />
          <span>{{ suggestion.title }}</span>
        </h6>
      </div>
    </template>

    <template #searchResult="{ item }">
      <VListSubheader class="text-disabled custom-letter-spacing font-weight-regular ps-4">
        {{ $t(item.title) }}
      </VListSubheader>
      <VListItem
        v-for="list in item.children"
        :key="list.title"
        :to="list.url"
        @click="closeSearchBar"
      >
        <template #prepend>
          <VIcon
            size="20"
            :icon="list.icon"
            class="me-n1"
          />
        </template>
        <template #append>
          <VIcon
            size="20"
            icon="tabler-corner-down-left"
            class="enter-icon flip-in-rtl"
          />
        </template>
        <VListItemTitle>
          {{ $t(list.title) }}
        </VListItemTitle>
      </VListItem>
    </template>
  </AppBarSearch>
</template>

<style lang="scss">
@use "@styles/variables/vuetify.scss";

.meta-key {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  block-size: 1.5625rem;
  font-size: 0.8125rem;
  line-height: 1.3125rem;
  padding-block: 0.125rem;
  padding-inline: 0.25rem;
}

.app-bar-search-dialog {
  .custom-letter-spacing {
    letter-spacing: 0.8px;
  }

  .card-list {
    --v-card-list-gap: 8px;
  }
}
</style>
