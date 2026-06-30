# Print-Label Shipping List — 复制订单功能

## 目标

在打单运单列表 (`shipping-list.vue`) 新增复制订单功能，点击后将订单数据预填到创建页 (`create.vue`)，用户修改后提交新订单。

## 设计决策（已确认）

- **复制按钮**：独立 tooltip 按钮（`tabler-copy`），放在面单下载按钮和三点菜单之间。操作列宽度从 180 → 220。
- **参考号**：清空（每个订单需唯一参考号，用户填写新值）。
- **地址**：预填但不锁定（用户可直接编辑输入框，来源为 `sender_snapshot` / `recipient_snapshot`）。
- **渠道**：预选原渠道（`detail.provider`），用户可切换。
- **包裹信息**：`pkg`（weight/length/width/height）详情接口不返回，复制时留空。
- **计量单位**：`danwei` 默认公制（0），详情接口不返回此字段。

## 数据流

```
shipping-list copy button click
  → router.push({ name: 'apps-print-label-create', query: { copyFrom: item.id } })
  → create.vue → usePrintLabelCreate composable
  → onMounted: 检测 route.query.copyFrom
  → fetch /Ordernewapi/shippingDetail?order_id=xxx
  → 映射到表单字段 (selectedQid, sender, receiver, products, pkg)
  → 清空 cankaohao
  → 用户修改 → 提交 → /Ordernewapi/shippingOrder (新订单)
```

## 任务列表

### 1. `src/views/apps/print-label/usePrintLabelCreate.js`

在 composable 中新增 copy 检测与预填逻辑：

- 读取 `route.query.copyFrom`，若存在则设 `const isCopy = true`
- 新增 `copyLoading` ref（初始 `false`）
- 在 `onMounted`（或 setup 末尾）中检测 copy：
  ```
  if (route.query.copyFrom) {
    copyLoading = true
    fetch /Ordernewapi/shippingDetail { order_id: Number(copyFrom) }
    映射:
      selectedQid.value = Number(detail.provider)
      cankaohao.value = ''   // 清空
      danwei.value = 0       // 默认公制
      sender.value = { id, name, country, province, city, streetno, address, address2, postCode, telephone, company }
      receiver.value = { ... }  // 同上
      products.value = sku_items.map(item => ({
        sku: item.sku, sku_num: item.qty, en_name: item.en_name, cn_name: item.cn_name, weight: item.weight, value: item.value
      }))
      // pkg 留空（详情接口不返回尺寸）
      // 地址不锁定（senderAddressLocked/receiverAddressLocked 保持 false）
    copyLoading = false
    toast('订单数据已加载，请修改参考号后提交')
  }
  ```

- 地址映射逻辑（从 snapshot 到 form）：
  - `snapshot` 字段：`name`, `telephone`, `street`, `address1`, `address2`, `city`, `state`/`province`, `postcode`, `country_code`/`country`, `company`
  - form 字段：`id`='', `name`, `country`=snapshot.country_code, `province`=snapshot.state, `city`, `streetno`=snapshot.street, `address`=snapshot.address1, `address2`, `postCode`=snapshot.postcode, `telephone`, `company`

- 返回 `copyLoading` 给外部使用

### 2. `src/pages/apps/print-label/shipping-list.vue`

- 在操作列新增复制 tooltip 按钮，位于面单下载按钮和三点菜单之间：
  ```html
  <VTooltip :text="$t('pages.printLabelShippingList.tooltips.copy')">
    <template #activator="{ props: tipProps }">
      <IconBtn v-bind="tipProps" size="small" color="secondary"
        @click="router.push({ name: 'apps-print-label-create', query: { copyFrom: item.id } })">
        <VIcon icon="tabler-copy" size="20" />
      </IconBtn>
    </template>
  </VTooltip>
  ```
- 操作列宽度从 `width: '180'` 改为 `width: '220'`

### 3. `src/pages/apps/print-label/create.vue`

- 从 composable 解构 `copyLoading`（新增返回值）
- 标题：检测 copy 模式时显示 `printLabelCreate.hero.titleCopy`
- 提交按钮：copy 模式时显示 `printLabelCreate.actions.submitCopy`（可选，或复用 submitCreate）
- 在 overlay 中考虑 copy 模式的 loading 状态

### 4. i18n — zh/en/fr

`pages.printLabelShippingList` 新增：
- `tooltips.copy`: "复制" / "Copy" / "Copier"

`pages.printLabelCreate` 新增：
- `hero.titleCopy`: "复制运单" / "Copy shipping label" / "Copier l'étiquette d'expédition"
- `messages.copyLoaded`: "订单数据已加载，请修改参考号后提交" / "Order data loaded, please modify the reference number before submitting" / "Données de commande chargées, veuillez modifier le numéro de référence avant de soumettre"
- `messages.copyLoadFailed`: "加载订单数据失败" / "Failed to load order data" / "Échec du chargement des données de commande"

## 风险 / 边界情况

- 详情接口 `/Ordernewapi/shippingDetail` 的 `sender_snapshot`/`recipient_snapshot` 字段名需确认（`country_code` vs `country`，`state` vs `province`）。创建映射时需同时兼容两种字段名。
- 包裹尺寸（pkg weight/length/width/height）详情接口不返回，复制时需要用户手动填写。
- `sku_items` 的 `weight` 和 `value` 字段可能为 null，需做空值处理。
- 复制后渠道切换时，发件/收件国家锁定（`senderCountryLock`/`receiverCountryLock`）应按新渠道规则重新计算，因此复制时不预锁定地址是正确的。

## 验证

- 列表点击复制 → 创建页预填渠道、地址、货品，参考号为空
- 修改参考号后提交 → 新订单创建成功
- 复制后切换渠道 → 国家锁定规则正确更新
- 复制后地址可编辑
- `npm run lint` 无新增错误