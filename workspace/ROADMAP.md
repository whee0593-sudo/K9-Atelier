# K9 Atelier 路线图

## 第二阶段：预约 + 支付（当前重点）

### 2A 展示页补全（1–2 天）
- [ ] About Us — 品牌故事、award-winning 经历
- [ ] FAQ — 取消政策、准备事项、45 lbs 规则、SPA 不与全套同日
- [ ] Contact — 邮箱、Instagram、Facebook、预约时间

### 2B 预约流程（核心）
- [ ] 选服务 + 宠物体重档
- [ ] 宠物信息（名字、品种、备注）
- [ ] 上门地址 → Google Maps 算单程距离
- [ ] 自动算 travel fee（10 英里免费，超出 $6.50/英里，最远 20 英里）
- [ ] 选日期时间（周一–五 9:00–16:00）
- [ ] 45 lbs+ 仅显示手剥毛 / 临终关怀

### 2C 支付
- [ ] 注册 Stripe（公司账户）
- [ ] 预约确认前收 **$50 固定定金**
- [ ] 测试环境先跑通，再开 live

### 2D 通知
- [ ] 预约成功 → 邮件发 penny@k9atelier.com
- [ ] 预约成功 → 确认邮件发客户

---

## 第三阶段：运营工具（可选）

- [ ] Amelia 或简易管理页 — 查看预约列表
- [ ] 取消/改期政策页面上线
- [ ] SEO（本地搜索：mobile dog grooming FL）
- [ ] 客户评价 / 相册
- [ ] 第二阶段商城（产品）

---

## 技术备忘（给 AI / 开发者）

- 业务数据单一来源：`content/business.json`
- 部署：push to `main` → Vercel 自动部署
- 域名 DNS：WordPress.com；邮箱 MX：Hostinger
- 设计：典雅温柔配色，见 `content/BRAND.md`
