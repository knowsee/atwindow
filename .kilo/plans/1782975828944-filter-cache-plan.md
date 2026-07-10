# 列表页筛选条件 sessionStorage 缓存

参考 `src/pages/apps/drop-shipping/package/list.vue` 的入库模块缓存模式，对 3 个列表页添加筛选条件会话缓存。

## 改动文件

### 1. `src/pages/apps/drop-shipping/order/list.vue`

- 添加 `FILTERS_CACHE_KEY = 'ds-order-list-filters'`
- 添加 `getDefaultFilters()` 返回默认筛选值
- 添加 `loadCachedFilters()` / `saveCachedFilters(f)` / `clearCachedFilters()`
- `filters` 初始化改为 `loadCachedFilters() || getDefaultFilters()`
- `searchList()` 中调用 `saveCachedFilters(filters.value)`
- `onStatusTabChange(v)` 中调用 `saveCachedFilters(filters.value)`（快速筛选切换也需缓存）
- `resetFilters()` 中调用 `clearCachedFilters()`

### 2. `src/pages/apps/drop-shipping/order-label/list.vue`

- 添加 `FILTERS_CACHE_KEY = 'ds-order-label-list-filters'`
- 添加 `getDefaultFilters()` 返回默认筛选值
- 添加 `loadCachedFilters()` / `saveCachedFilters(f)` / `clearCachedFilters()`
- `filters` 初始化改为 `loadCachedFilters() || getDefaultFilters()`
- `searchList()` 中调用 `saveCachedFilters(filters.value)`
- `resetFilters()` 中调用 `clearCachedFilters()`

### 3. `src/pages/apps/product/list.vue`

- 使用 `reactive` 而非 `ref`，缓存恢复和重置需用 `Object.assign`
- 添加 `FILTERS_CACHE_KEY = 'product-list-filters'`
- 添加 `getDefaultFilters()` 返回默认筛选值
- 添加 `loadCachedFilters()` / `saveCachedFilters(f)` / `clearCachedFilters()`
- 在 `onMounted` 中从缓存恢复：`Object.assign(filters, cached)`
- `searchList()` 中调用 `saveCachedFilters(filters)`
- `resetSearch()` 中调用 `clearCachedFilters()` 和 `Object.assign(filters, getDefaultFilters())`

## 不缓存的内容

- 分页页码（page/itemsPerPage）— 遵循入库模块模式，返回时重置到第 1 页
- 其他状态（排序、选中行等）

## 验证

1. 在每个列表页设置筛选条件并搜索
2. 点击某行进入详情页
3. 浏览器返回 / 手动导航回列表页
4. 确认筛选条件已保留，列表数据按条件重新加载
5. 点击重置按钮，确认缓存被清除，筛选条件恢复默认