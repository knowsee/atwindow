# 新版入库包裹列表界面改造

## 目标

将 `src/pages/apps/drop-shipping/package/list.vue` 从旧接口 (`POST /package/all`) 迁移到新接口 (`POST /ordernew/packageList`)，保留全部现有操作功能，利用新接口更丰富的数据字段设计精简列 + 展开行布局。

## 上下文

- 旧接口返回 `data.data` (数组) + `data.count` (总数)；SKU 为平行数组 `sku[]`/`sku_num[]`/`real_sku_num[]`/`cn_name[]`
- 新接口返回 `data.list` (数组) + `data.total` + `data.current_page` + `data.per_page_num`；SKU 为结构化对象数组 `sku_list[]`
- 新接口状态值：1=待收货, 2=已上架, 3=待上架（与旧 1=未到库/2=已到库/3=已到库未上报含义不同）
- 新接口额外字段：`total_weight`, `total_fee`, `location`, `receivetime`/`receivetime_text`, `sender` (对象或 null), `warehouse_name`
- 列表项假定存在 `id` 字段（用于选中、删除、打印、跳转详情），虽 API 文档未显式列出
- `$api` baseURL 已为 `/api`，故调用路径为 `/ordernew/packageList`
- 不修改共享文件 `useDropShippingShared.js` 中的 `DS_STATUS_DEFS`

## 实施任务

### 1. 修改 `src/pages/apps/drop-shipping/package/list.vue`

#### 1.1 script setup — 数据与状态

- `filters` ref 结构改为：
  ```js
  { status: '', sku: '', trackingNo: '', createTime: '', receiveTime: '' }
  ```
  - `status` 默认空字符串（全部）；从 route query 解析时若有则用 Number
  - `createTime` / `receiveTime` 为 AppDateTimePicker range 文本

- 新增本地状态快捷筛选项（不依赖 shared DS_STATUS_DEFS）：
  ```js
  const quickStatusItems = computed(() => [
    { title: t('pages.dropShippingPackageList.statuses.all'), value: '' },
    { title: t('pages.dropShippingPackageList.statuses.pendingReceive'), value: 1 },
    { title: t('pages.dropShippingPackageList.statuses.onShelf'), value: 2 },
    { title: t('pages.dropShippingPackageList.statuses.pendingShelf'), value: 3 },
  ])
  ```

- `parseRouteQueryToFilters`：保留对 `status` / `tracking_no` / `trackingNo` 的解析，新增 `createTime` / `receiveTime` 默认空字符串

- `headers` computed 改为：
  ```js
  [
    { title: '', key: 'data-table-expand' },
    { title: ...package, key: 'pkg_info', minWidth: '220' },
    { title: ...warehouse, key: 'warehouse_name', minWidth: '120' },
    { title: ...sku, key: 'sku', minWidth: '180' },
    { title: ...status, key: 'status', width: '110', align: 'center' },
    { title: ...receiveTime, key: 'receivetime', minWidth: '160' },
    { title: ...actions, key: 'actions', sortable: false, width: '130', align: 'center', fixed: 'end' },
  ]
  ```

#### 1.2 SKU 数据适配

- `buildSkuRows(item)` 改为直接返回 `item.sku_list`（已是对象数组），兜底 `[]`
- `totalDeclared(item)` = `sku_list.reduce((s,r) => s + Number(r.sku_num||0), 0)`
- `totalActual(item)` = `sku_list.reduce((s,r) => s + Number(r.real_sku_num||0), 0)`
- 模板中 SKU 行渲染：`row.sku`, `row.sku_num`(declared), `row.real_sku_num`(actual)

#### 1.3 状态颜色

- 新增 `resolveStatusColor(status)` 按数值判断：
  - 1 (待收货) → `warning`
  - 2 (已上架) → `success`
  - 3 (待上架) → `info`
  - 默认 → `primary`
- 模板 status 列用 `item.status_text` 显示文字，`resolveStatusColor(item.status)` 取色

#### 1.4 API 调用

- `loadList()` 改为：
  ```js
  const res = await $api('/ordernew/packageList', { method: 'POST', body: buildBody() })
  if (Number(res?.code) === 1 && res?.data) {
    rows.value = Array.isArray(res.data.list) ? res.data.list : []
    total.value = Number(res.data.total) || 0
    return
  }
  ```
- `buildBody()` 改为：
  ```js
  {
    current_page: page.value,
    per_page_num: itemsPerPage.value,
    ...(filters.status !== '' ? { status: Number(filters.status) } : {}),
    ...(filters.sku.trim() ? { sku: filters.sku.trim() } : {}),
    ...(filters.trackingNo.trim() ? { tracking_no: filters.trackingNo.trim() } : {}),
    ...(createTimeRange ? { create_time: createTimeRange } : {}),
    ...(receiveTimeRange ? { receive_time: receiveTimeRange } : {}),
  }
  ```
  - 时间范围用 `normalizeRangeText`（已有，将 ` to ` 转 ` - `）转换后整体传入 `create_time` / `receive_time` 字段（新接口要求单个范围字符串，非拆分字段）

#### 1.5 保留的操作

- `deleteOne(id)`, `batchDelete()`, `requestPrintBoxLabel(idList)`, `printBoxLabel(id)`, `batchPrint()` — 逻辑不变，仍用 `/package/del`, `/package/delBatch`, `/package/dayinPl`
- `item-value="id"` 不变（假定 list 项有 id）
- `goCreate()`, `goBatch()` 不变

#### 1.6 模板 — 筛选区

AppQueryPanel 内 VRow 布局：
- SKU (AppTextField, `@keyup.enter="searchList"`)
- 运单号 (AppTextField, `@keyup.enter="searchList"`)
- 创建时间 (AppDateTimePicker, `mode: 'range'`, `dateFormat: 'Y-m-d'`)
- 入库时间 (AppDateTimePicker, `mode: 'range'`, `dateFormat: 'Y-m-d'`) — 新增

#### 1.7 模板 — VDataTableServer

- 添加 `expand-on-click` 属性（或用 `v-model:expanded` 手动控制）
- 新增 `#expanded-row` 插槽，colspan = headers.length，内容：
  - 上半区：库位 / 重量 / 费用（inline info chips 或 label-value 行）
  - 中间区：发件人信息（sender 为 null 时显示"—"；否则显示 name / address / telephone / country）
  - 下半区：SKU 明细小表（sku / sku_num(预报) / real_sku_num(实收) / status / weight / location）
- `#item.pkg_info` — tracking_no + createtime_text（保留旧样式 pkg-info-cell）
- `#item.warehouse_name` — warehouse_name + icon
- `#item.sku` — sku_list 每行 sku code，单行时附申报→实收对比
- `#item.status` — VChip with status_text + resolveStatusColor
- `#item.receivetime` — receivetime_text 或 "—"（待收货时可能无入库时间）
- `#item.actions` — 不变（detail / print / delete + dots menu）
- `#bottom` — 不变（分页 + itemsPerPage select）

#### 1.8 resetFilters / searchList / onQuickStatusChange

- `resetFilters`：重置为全空（status='', sku='', trackingNo='', createTime='', receiveTime=''），清 route query，调 searchList
- `searchList` / `onQuickStatusChange` 逻辑不变

#### 1.9 样式

- 保留现有 `.ds-pkg-list__table`, `.pkg-info-cell`, `.sku-list`, `.qty-compare`, `.batch-action-bar`, `.slide-down-*`, `.ds-mono` 等
- 新增展开行样式：`.pkg-expanded`（padding、背景色区分）、`.sku-detail-table`（小表紧凑样式）

### 2. i18n — 新增 keys（zh / en / fr 三语言）

在 `pages.dropShippingPackageList` 下新增：

**headers:**
- `receiveTime`: 入库时间 / Received Time / Heure de réception
- `location`: 库位 / Location / Emplacement
- `weight`: 重量 / Weight / Poids
- `fee`: 费用 / Fee / Frais
- `sender`: 发件人 / Sender / Expéditeur

**filters:**
- `receiveTime`: 入库时间 / Received Time / Heure de réception

**statuses:**
- `all`: 全部 / All / Tout
- `pendingReceive`: 待收货 / Pending Receipt / En attente de réception
- `onShelf`: 已上架 / On Shelf / Mis en rayon
- `pendingShelf`: 待上架 / Pending Shelf / En attente de mise en rayon

**expanded (展开行标签):**
- `senderInfo`: 发件人信息 / Sender Info / Infos expéditeur
- `senderName`: 姓名 / Name / Nom
- `senderAddress`: 地址 / Address / Adresse
- `senderTelephone`: 电话 / Phone / Téléphone
- `senderCountry`: 国家 / Country / Pays
- `noSender`: 无发件人 / No sender / Pas d'expéditeur
- `skuDetail`: SKU 明细 / SKU Details / Détails SKU
- `declaredQty`: 预报数量 / Declared Qty / Qté déclarée
- `actualQty`: 实收数量 / Actual Qty / Qté reçue
- `skuStatus`: 状态 / Status / Statut
- `skuWeight`: 重量 / Weight / Poids
- `skuLocation`: 库位 / Location / Emplacement

## 不变的部分

- `useDropShippingShared.js` — 不修改
- `detail.vue`, `create.vue`, `batch.vue` — 不修改
- 路由名 `apps-drop-shipping-package-list` — 不变
- 导航 `navigation/vertical/apps-and-pages.js` — 不变
- dashboard 跳转逻辑 `goDropShippingPackageList` — 不变（仍传 status / tracking_no query）

## 边界与风险

- **id 字段假定**：API 文档未列出 `id`，但删除/打印/详情均依赖。若后端实际不返回 id，选中与操作将失效。需后端确认或补充。
- **status 数值兼容**：dashboard 传来的 `row.status` 可能是新接口的 1/2/3，也可能是旧含义。直接透传给新接口，若不一致需后续对齐。
- **时间范围格式**：新接口要求 `"YYYY-MM-DD - YYYY-MM-DD"`（连字符两侧有空格）。`normalizeRangeText` 已将 flatpickr 的 ` to ` 转为 ` - `，需确认 flatpickr `dateFormat: 'Y-m-d'` 输出不带时间部分。
- **sender 为 null**：`send_id=0` 时 sender 为 null，展开行需判空。
- **receivetime 为 0/空**：待收货状态包裹可能无入库时间，列与展开行均需兜底 "—"。

## 验证步骤

1. `pnpm build` 成功无报错
2. 清空 cookie/localStorage 后首次访问入库列表不白屏
3. 快捷状态切换（全部/待收货/已上架/待上架）正常筛选
4. SKU、运单号、创建时间范围、入库时间范围筛选均生效
5. 分页切换正常，total 与页数一致
6. 展开行显示库位/重量/费用/发件人/SKU 明细
7. 单行删除、批量删除、单行打印、批量打印均正常（依赖 id 存在）
8. 点击行或详情按钮跳转 detail.vue 正常
9. 从 dashboard 携带 status/tracking_no query 跳转后筛选条件正确预填
