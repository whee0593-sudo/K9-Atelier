# K9 Atelier 网站规划书

第一阶段目标：展示网站 + 在线预约 + 在线支付  
设计风格：简洁、干净、典雅温柔（与 Logo 配色一致）

---

## 已确认的业务信息

### 品牌
| 项目 | 内容 |
|------|------|
| 名称 | K9 Atelier |
| Logo | `public/logo.png` |
| 标语 | Award-winning grooming experience at your doorstep. |
| 配色 | 奶油白 + 淡紫 + 柔金 + 淡蓝（见 `content/BRAND.md`） |

### 联系
| 项目 | 内容 |
|------|------|
| 邮箱 | penny@k9atelier.com |
| 电话 | 待定 |
| Instagram | K9 Atelier FL |
| Facebook | K9 Atelier |

### 服务范围与 Travel Fee
| 项目 | 规则 |
|------|------|
| 免费半径 | **10 英里**内不加路费 |
| 超出部分 | **$6.50 / 单程英里**（超出 10 英里以外） |
| 最远接单 | **20 英里** |

### 预约政策
| 项目 | 规则 |
|------|------|
| 付款 | **预约时留有效付款方式，预订时不扣款** |
| 可预约时间 | **周一至周五，9:00 – 16:00** |
| 取消规则 | **待定** |

### 体重要求
| 体重 | 可预约服务 |
|------|------------|
| 45 lbs 及以下 | 全部服务（洗护、精剪、SPA、特色护理等） |
| **45 lbs 以上** | **仅**手剥毛（不洗澡）+ 临终关怀服务 |

### 服务菜单 ✅ 已完成
完整终稿见 **`content/SERVICES.md`**，结构化数据见 **`content/business.json`**

**3 大类 · 8 项主服务 · 2 项附加费：**

| 大类 | 服务 |
|------|------|
| 基础洗护与精剪 | Signature Bath & Care、Custom Full Haircut & Styling |
| 专项特色护理 | Hand Stripping、Senior Comfort Care、Creative Accent Coloring |
| 水疗 SPA | Dead Sea Mud Bath、Aromatherapy Oil Bath、Sensitive Skin Treatment |
| 附加费 | Travel Fee ($6.50/英里)、Behavior Fee ($25–50+) |

定价按 **15 / 30 / 45 lbs** 三档体重阶梯；手剥毛按 **$120/小时**；高龄护理为 **+$30–50** 附加。

---

## 开发顺序

| 步骤 | 状态 |
|------|------|
| 1. 规划与业务信息 | ✅ 完成 |
| 2. 安装 Node.js / Git | ✅ 完成 |
| 3. 展示页面（含 Services 页） | ✅ 完成 |
| 4. GitHub + Vercel + k9atelier.com 上线 | ✅ 完成 |
| 5. 预约 + 路费计算 | ⏳ 下一步 |
| 6. Stripe 定金 | 待开始 |
| 7. 确认邮件 | 待开始 |

**专属工作台：** 见 [WORKBENCH.md](./WORKBENCH.md) · 路线图见 [workspace/ROADMAP.md](./workspace/ROADMAP.md)

---

## 仍需要你决定

1. **取消规则**  
2. **你家地址**（仅算距离用，不公开）  
3. **电话**

---

## 项目文件

```
k9-atelier/
├── PLAN.md
├── SETUP.md
├── content/
│   ├── business.json    ← 网站 + 预约系统用的结构化数据
│   ├── SERVICES.md      ← 服务页终稿（中英双语）
│   └── BRAND.md
└── public/logo.png
```

*文档版本：2026-07-24*
