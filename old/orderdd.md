# Shipping 下单与试算接口文档

## 下单接口（录单）

### 接口信息

- **URL**: `/api/Ordernewapi/shippingOrder`
- **Method**: `POST`
- **鉴权**: `ApiAccessTokenCheck` + `ApiRateLimit`
- **说明**: 仅录入订单，不直接请求上游渠道下单

### 请求参数

- `owner_userid` (int, required): 订单归属用户 ID
- `provider` (int, required): 物流服务商 ID
- `channel_code` (string, required): 下单渠道编码（下单必须传）
- `cankaohao` (string, required): 参考号，系统内唯一
- `sender` (object, required): 发件人信息，至少 `name/country/address1`
- `recipient` (object, required): 收件人信息，至少 `name/country_code(or country)/address1`
- `package` (object, required): 包裹信息，`weight` 必须 > 0
- `items` (array, required): 商品明细（兼容旧字段 `sku`）
- `currency` (string, optional): 默认 `USD`
- `customer_fee` (number, optional)
- `upstream_fee` (number, optional)
- `signature_required` (int|bool, optional): 是否签名服务

### 成功响应

```json
{
  "code": 1,
  "msg": "success",
  "data": {
    "order_sn": "SO17100000001234",
    "id": 12345
  }
}
```

### 说明

- 下单会原子化写入：
  - `fa_shipping_order`（主订单）
  - `fa_shipping_package`（包裹与 customs_items）
- `channel_code` 在下单时使用；试算接口不使用 `channel_code`

## 接口信息

- **URL**: `/api/Ordernewapi/shippingRate`
- **Method**: `POST`
- **鉴权**: 与 `shipping/order` 一致（`ApiAccessTokenCheck` + `ApiRateLimit`）
- **说明**: 入参结构与下单接口保持一致，试算维度为 `provider`：
  - 单 provider 试算（`provider`）
  - 多 provider 复选试算（`providers`）
  - 多 provider 返回按价格升序排序（最便宜在最前）

---

## 请求参数

### 顶层参数

- `owner_userid` (int, required): 订单归属用户 ID（与 `order` 保持一致）
- `provider` (int, optional): 单 provider 试算时传入
- `providers` (int[], optional): 多 provider 试算时传入（与 `provider` 二选一）
- `cankaohao` (string, optional): 参考号，建议传入用于日志追踪
- `extra` (object, optional): 扩展字段，透传给驱动

### 地址参数（与下单保持一致）

- `sender` (object, required): 发件人信息
- `recipient` (object, required): 收件人信息

地址对象常用字段：

- `name` (string)
- `telephone` (string)
- `country` / `country_code` (string, ISO 国家码，如 `US`)
- `state` / `province` (string)
- `city` (string)
- `postcode` / `code` (string)
- `address1` / `address` (string)
- `address2` (string, optional)
- `street` (string, optional)

> 也支持 `sender_address_id` / `recipient_address_id`，若传入会先读取地址簿，再与 `sender`/`recipient` 字段合并。

### 包裹参数

- `package` (object, required):
  - `weight` (number, required, > 0)
  - `length` (number, optional)
  - `width` (number, optional)
  - `height` (number, optional)
  - `declared_value` / `value` (number, optional)

### 商品参数

- `items` (array, required，兼容旧字段 `sku`)
  - `sku` (string, required)
  - `en_name` (string, optional)
  - `cn_name` (string, optional)
  - `qty` / `sku_num` (int, optional，默认 1)
  - `weight` (number, optional)
  - `values` / `value` (number, optional)

---

## 请求示例

### 1) 单 provider 试算（指定 `provider`）

```json
{
  "owner_userid": 10001,
  "provider": 20,
  "cankaohao": "RATE-TEST-001",
  "sender": {
    "name": "Sender A",
    "telephone": "6261234567",
    "country": "US",
    "state": "CA",
    "city": "Chino",
    "postcode": "91710",
    "address1": "14244 Telephone Ave"
  },
  "recipient": {
    "name": "Receiver B",
    "telephone": "9170000000",
    "country_code": "US",
    "province": "NY",
    "city": "New York",
    "postcode": "10001",
    "address1": "5th Ave"
  },
  "package": {
    "weight": 1.2,
    "length": 10,
    "width": 8,
    "height": 6,
    "declared_value": 20
  },
  "items": [
    {
      "sku": "SKU-001",
      "en_name": "Phone Case",
      "cn_name": "手机壳",
      "qty": 1,
      "weight": 1.2,
      "value": 20
    }
  ],
  "extra": {
    "remark": "rate test"
  }
}
```

### 2) 多 provider 试算（`providers`）

```json
{
  "owner_userid": 10001,
  "providers": [20, 50, 2002],
  "cankaohao": "RATE-TEST-002",
  "sender": {
    "name": "Sender A",
    "telephone": "6261234567",
    "country": "US",
    "state": "CA",
    "city": "Chino",
    "postcode": "91710",
    "address1": "14244 Telephone Ave"
  },
  "recipient": {
    "name": "Receiver B",
    "telephone": "9170000000",
    "country_code": "US",
    "province": "NY",
    "city": "New York",
    "postcode": "10001",
    "address1": "5th Ave"
  },
  "package": {
    "weight": 1.2,
    "length": 10,
    "width": 8,
    "height": 6
  },
  "items": [
    {
      "sku": "SKU-001",
      "qty": 1,
      "weight": 1.2,
      "value": 20
    }
  ]
}
```

---

## 响应格式

### 成功响应（单 provider）

```json
{
  "code": 1,
  "msg": "success",
  "data": {
    "provider": 20,
    "mode": "single",
    "rates": [
      {
        "provider": 20,
        "entryport": "US_DHLE_LAX",
        "rateName": "default",
        "zone": 1,
        "isFar": false,
        "totalFee": 7.56,
        "notes": "",
        "raw": {}
      }
    ],
    "raw": {}
  }
}
```

### 成功响应（多 provider，已按价格升序）

```json
{
  "code": 1,
  "msg": "success",
  "data": {
    "providers": [20, 50, 2002],
    "mode": "multi",
    "rates": [
      {
        "provider": 20,
        "entryport": "US_DHLE_ORD",
        "rateName": "economy",
        "zone": 2,
        "isFar": false,
        "totalFee": 6.99,
        "notes": "",
        "raw": {}
      },
      {
        "provider": 50,
        "entryport": "UPS",
        "rateName": "standard",
        "zone": 2,
        "isFar": false,
        "totalFee": 7.56,
        "notes": "",
        "raw": {}
      }
    ],
    "failed_providers": [
      {
        "provider": 2002,
        "message": "试算失败: ..."
      }
    ]
  }
}
```

---

## 错误说明

- `owner_userid` 缺失：`缺少参数 owner_userid`
- `provider` 无效：`provider 不存在或无效`
- 地址不完整：`sender/recipient 信息不完整`
- 包裹重量非法：`package.weight 必须大于 0`
- 商品为空：`缺少有效 items（或 sku）`
- 试算失败：返回上游驱动错误信息

