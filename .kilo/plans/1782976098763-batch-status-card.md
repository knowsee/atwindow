# 批量出单上传页 — 内联批次状态卡片

## 目标

在 `batch-upload.vue` 成功上传后，不再自动跳转到订单列表，而是显示一个内联状态卡片，展示最新批次的状态、计数，并提供下载/查看操作。

## 参考

- `src/components/print-label/ShippingBatchStatusDialog.vue` — 批次列表/详情弹窗，包含 `/Ordernewapi/shippingBatches` 和 `/Ordernewapi/shippingBatchDownload` 的调用模式
- `src/pages/apps/print-label/shipping-list.vue` — 列表页中如何使用 `ShippingBatchStatusDialog`

## 改动文件

### 1. `src/pages/apps/print-label/batch-upload.vue`

**新增状态：**
- `batchStatus` — `ref(null)` — 批次对象 `{ id, batch_sn, total_count, success_count, fail_count, status, createtime }`
- `batchStatusLoading` — `ref(false)` — 加载中
- `batchStatusError` — `ref('')` — 错误消息
- `batchDownloading` — `ref(false)` — 下载按钮 loading
- `batchPollTimer` — `let` 变量 — 轮询定时器 ID

**新增函数：**

- `fetchBatchStatus(batchId)` — 调用 `GET /Ordernewapi/shippingBatches?batch_id=<id>`，用与 `ShippingBatchStatusDialog.normalizeBatchesPayload` 相同的逻辑归一化响应，取第一条记录设置到 `batchStatus`
- `startBatchPolling()` / `stopBatchPolling()` — 10s 间隔，调用 `fetchBatchStatus`，`status === 1 || status === 2` 时停止
- `downloadBatchZip()` — 调用 `GET /Ordernewapi/shippingBatchDownload?batch_id=<id>`，从 `res.data.download_url ?? res.data.url` 提取下载链接，通过 `<a>` 点击触发下载（异步回调中 `window.open` 可能被拦截）
- `dismissBatchCard()` — 设置 `batchStatus = null`，停止轮询

**修改 `submitUpload()`：**
- 成功时保存 `batch_sn`/`batch_id`，调用 `fetchBatchStatus(batch_id)`，移除 `setTimeout` 跳转
- 保留 toast 提示

**模板新增：**
- 在上传区域卡片下方、提交按钮卡片上方，添加 `VCard` 条件渲染 `v-if="batchStatus"`
- 内容：batch_sn 标题、状态 chip（info/success/error）、total/success/fail 计数、创建时间
- 操作：下载 ZIP（status=1 时显示）、查看订单列表（跳转 list）、关闭（dismiss）
- 加载状态：`VProgressLinear` 指示器

**清理：**
- `onBeforeUnmount` → `stopBatchPolling()`

### 2. i18n — `zh.json` / `en.json` / `fr.json`

在 `pages.printLabelBatchUpload` 下新增 `batchStatus` 对象：

| key | zh | en | fr |
|-----|----|----|-----|
| `batchStatus.title` | 批量出单状态 | Batch shipping status | Statut d'expédition groupée |
| `batchStatus.statusLabels.processing` | 处理中 | Processing | En cours |
| `batchStatus.statusLabels.completed` | 已完成 | Completed | Terminé |
| `batchStatus.statusLabels.failed` | 失败 | Failed | Échec |
| `batchStatus.counts.total` | 总数 | Total | Total |
| `batchStatus.counts.success` | 成功 | Success | Réussis |
| `batchStatus.counts.fail` | 失败 | Fail | Échecs |
| `batchStatus.actions.downloadZip` | 下载面单ZIP | Download ZIP | Télécharger ZIP |
| `batchStatus.actions.viewOrders` | 查看订单列表 | View order list | Voir les commandes |
| `batchStatus.actions.close` | 关闭 | Close | Fermer |
| `batchStatus.messages.loadFailed` | 加载批次状态失败 | Failed to load batch status | Échec du chargement du statut |

## 不修改

- 不引入 `ShippingBatchStatusDialog` 组件（用户选择内联卡片方案）
- 不修改后端 API（复用已有接口）
- 不修改 `shipping-list.vue` 或 `useYundanList.js`

## 验证

1. 上传文件 → 看到 toast "已创建批次" + 状态卡片出现
2. 卡片显示 batch_sn、状态 chip（处理中）、计数
3. 处理中状态时卡片自动 10s 轮询刷新
4. 完成后状态变为"已完成"，出现"下载面单ZIP"按钮
5. 点击下载 ZIP → 触发下载
6. 点击"查看订单列表" → 跳转到列表页
7. 点击"关闭" → 卡片消失，轮询停止
8. 再次上传 → 旧卡片替换为新批次卡片