# 客人个人账户 — 信息内容说明（中文）

> 网站界面为英文。字段定义在 `content/account-fields.json`，可随时修改。

---

## 账户包含 5 个部分

### 1. Personal Information（个人信息）
| 字段 | 必填 | 用途 |
|------|------|------|
| First / Last Name | 是 | 称呼客户 |
| Email | 是 | 预约确认、提醒 |
| Mobile Phone | 是 | 当天联系、短信提醒 |
| Preferred Contact | 否 | 偏好邮件/电话/短信 |

**Emergency Contact（紧急联系人 — 可选）**
| 字段 | 必填 | 用途 |
|------|------|------|
| Name | 否 | 紧急联系人姓名 |
| Phone | 否 | 紧急联系人电话 |
| Relationship | 否 | 关系（配偶/家人/朋友等） |

### 2. Service Addresses（上门地址）
| 字段 | 必填 | 用途 |
|------|------|------|
| 街道、城市、州、邮编 | 是 | 上门 + **自动算 travel fee** |
| Apt / Unit | 否 | 单元号 |
| Parking / Access Notes | 否 | 停车、门禁 |
| Default address | 否 | 默认服务地址 |
| **可保存多个地址** | | |

### 3. My Pets（宠物档案 — 可多只）

- 每位客户可保存**多只宠物**，各有一份独立档案
- **预约时**从已保存的档案中**选择本次服务的宠物**（每次预约一只）
- 每只宠物均需上传疫苗记录（必填）方可预约

| 字段 | 必填 | 用途 |
|------|------|------|
| Pet Name | 是 | 预约 |
| Breed | 是 | 美容参考 |
| Weight (lbs) | 是 | **定价档位 + 45 lbs 规则** |
| Age / Sex | 否 | Sex 选项：Male / Female / Male, Neutered / Female, Spayed |
| Temperament Notes | 否 | 行为费、特殊保定 |
| Medical Notes | 否 | 高龄/医疗护理 |
| Grooming Preferences | 否 | 造型偏好 |
| ~~Coat Type~~ | — | **已移除** |
| Service & Product Notes | 否 | **仅管理员可见** — 记录每次用的产品与服务 |

**Vaccination Records（疫苗记录 — 每只宠物必填）**
| 字段 | 必填 | 用途 |
|------|------|------|
| Vaccination Expiration Date | 否 | 证书上的过期日（如有） |
| Upload Vaccination Record | **是** | 上传狂犬/疫苗证明（PDF、JPG、PNG、WEBP、HEIC，最大 10 MB） |

**管理员专用页面（客人看不到）：** `/admin/pets` — 查看/编辑 Service & Product Notes

### 4. Payment Methods（付款方式）
- 保存有效信用卡（Stripe，预约时不扣款）
- 以后可扣服务费、取消费等

### 5. Booking History（预约记录）
- 即将到来 / 历史预约（上线预约功能后自动填充）

---

## 网页预览

- 登录页 → **Preview My Account**
- 或直接访问：**/account**

目前是 **Preview 预览模式**（还不能真正注册登录），但字段和布局已定好。

---

## 若要修改字段

编辑 `content/account-fields.json`，保存后 push，网站会自动更新。

*2026-07-29*
