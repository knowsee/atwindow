# Extend Drop-Shipping Order Export Fields

## Context

`exportOrders()` in `src/pages/apps/drop-shipping/order/list.vue` maps rows from the
`/order/excelYjdf` export API into an xlsx via `downloadXlsx`. Comparing the export code
(lines 273-310) against the actual API response reveals one bug and 15 omitted fields.

Actual API record shape (sample):
```json
{
  "order_sn": "...", "cankaohao": "...", "ht_orderno": "", "ht_tracking_no": "",
  "warehouse_name": "...", "transport_type": "Amazon", "erp_type": "系统",
  "username": "test", "country": "美国", "receive_name": "...",
  "receive_telephone": "...", "receive_address": "...", "receive_city": "...",
  "receive_province": "...", "receive_country": "US", "receive_postcode": "...",
  "sku": "...", "sku_num": "...", "cn_name": "...", "total_weight": "7.000",
  "total_fee": "0.00", "handle_fee": "0.00", "paisong_fee": "0.00",
  "zitick_fee": "0.00", "pp_fee": "0.00", "material_fee": "0.00",
  "status": 14, "create_time": "2026-06-08 09:44:50", "fahuo_time": ""
}
```

## Bug

- `list.vue:287` maps `'createtime': row.createtime ?? ''`, but the API returns `create_time`.
  The "Created at" export column is therefore **always empty**. Fix to `row.create_time`.

## Scope (confirmed: all fields + bug fix)

Add all 15 missing fields the API returns. Keep existing columns. Final column set (28)
in this grouped order — bold = new:

1. `order_sn` (orderNo)
2. `cankaohao` (referenceNo)
3. **`ht_orderno`** (htOrderNo)
4. `receive_name` → key `name` (recipient)
5. `receive_telephone` (receiveTelephone)
6. `receive_address` (receiveAddress)
7. `receive_city` (receiveCity)
8. `receive_province` (receiveProvince)
9. `receive_country` (receiveCountry)
10. **`receive_postcode`** (receivePostcode)
11. **`country`** (country)
12. `warehouse_name` (warehouse)
13. **`transport_type`** (transport)
14. **`erp_type`** (source)
15. `sku` (sku)
16. **`sku_num`** (skuNum)
17. **`cn_name`** (cnName)
18. **`total_weight`** (totalWeight)
19. `ht_tracking_no` (trackingNo)
20. `total_fee` (fee)
21. **`handle_fee`** (handleFee)
22. **`paisong_fee`** (paisongFee)
23. **`zitick_fee`** (zitickFee)
24. **`pp_fee`** (ppFee)
25. **`material_fee`** (materialFee)
26. `status_name` (status) — keep `row.status_name || getStatusText(row)`; API returns numeric
   `status` so `getStatusText` handles it (e.g. `14` → problem order).
27. **`username`** (username)
28. `create_time` (createdAt) — **bug fix**
29. **`fahuo_time`** (shippedAt)

> Note: list is 29 items because identity has `order_sn`+`cankaohao`+`ht_orderno`; the
> header count is 29 (the summary said 28; use this ordered list as source of truth).

## Changes

### 1. `src/pages/apps/drop-shipping/order/list.vue`

#### a) `rows = list.map(row => ({ ... }))` (lines 273-288)
Replace the object literal with the full field set above. Use `row.<api_field> ?? ''` for
each, except `status_name` which stays `row.status_name || getStatusText(row)`. Use
`row.create_time` (not `createtime`). Map `receive_name` to the `name` key (existing convention).

#### b) `columns` array (lines 293-308)
Replace with 29 entries in the ordered list above, each
`{ key: '<key>', title: t('pages.dropShippingOrderList.headers.<i18nKey>') }`.

### 2. i18n — add new header keys to `dropShippingOrderList.headers` in all three locales

Add these keys inside `headers` (zh.json, en.json, fr.json — lines ~879-895). Insert after
the matching existing keys to keep grouping readable; JSON validity must be preserved
(trailing commas). `transport`, `source`, `shippedAt` reuse the wording already used under
`filters` for consistency.

| key              | zh                  | en                 | fr                         |
| ---------------- | ------------------- | ------------------ | -------------------------- |
| htOrderNo        | HT订单号            | HT order no.       | N° de commande HT          |
| receivePostcode  | 收件人邮编          | Recipient postcode | Code postal destinataire   |
| country          | 国家                | Country            | Pays                       |
| transport        | 运输方式            | Transport method   | Mode de transport          |
| source           | 来源                | Source             | Source                     |
| skuNum           | SKU数量             | SKU quantity       | Quantité SKU               |
| cnName           | 中文名称            | Chinese name       | Nom chinois                |
| totalWeight      | 总重量              | Total weight       | Poids total                |
| handleFee        | 处理费              | Handling fee       | Frais de traitement        |
| paisongFee       | 派送费              | Delivery fee       | Frais de livraison         |
| zitickFee        | 自提费              | Self-pickup fee    | Frais de retrait           |
| ppFee            | PP费                | PP fee             | Frais PP                   |
| materialFee      | 材料费              | Material fee       | Frais de matériel          |
| username         | 操作人              | Operator           | Opérateur                  |
| shippedAt        | 发货时间            | Shipped at         | Expédiée le                |

`createdAt` already exists in `headers` — reuse it (no new key needed).

## Out of scope

- List endpoint (`/order/orderListV2`) display/template fields — leave as-is.
- Status rendering chip color logic.
- Filter/search/buildBody logic.
- The export endpoint request body.

## Validation

1. Run lint/typecheck for the repo (check AGENTS.md / package.json scripts; e.g.
   `npm run lint` and `npm run type-check` or equivalent).
2. Confirm all three JSON locale files remain valid JSON (no trailing commas / parse errors).
3. Manually trigger an export from the order list page:
   - "Created at" column now populates (`create_time`).
   - 15 new columns appear with localized headers in zh/en/fr.
   - `status` shows a localized name (e.g. problem order for status 14).
   - Empty string fields (e.g. `fahuo_time`, `ht_orderno`) export as blank, not `undefined`.
