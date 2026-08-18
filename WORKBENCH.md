# K9 Atelier 工作台

> 所有 K9 Atelier 相关工作的「总控制台」——链接、进度、待办，都在这里。

---

## 快速链接

| 用途 | 链接 / 位置 |
|------|-------------|
| **正式网站** | https://k9atelier.com |
| **代码仓库** | https://github.com/whee0593-sudo/K9-Atelier |
| **网站托管** | https://vercel.com/dashboard |
| **域名 / DNS** | https://wordpress.com/domains |
| **企业邮箱** | Hostinger hPanel → Emails |
| **本地预览** | 终端运行 `npm run dev` → http://localhost:3000 |

---

## 项目文件夹（Cursor 工作区）

```
C:\Users\Mark\Projects\k9-atelier
```

**建议：** 在 Cursor 里用 **File → Open Folder** 打开这个文件夹，作为 K9 Atelier 专属工作区。以后所有网站、预约、内容修改都在这里进行。

---

## 进度总览

| 阶段 | 内容 | 状态 |
|------|------|------|
| **1A** | 规划、品牌、服务菜单 | ✅ 完成 |
| **1B** | 展示网站（首页、服务、服务范围） | ✅ 完成 |
| **1C** | GitHub + Vercel + k9atelier.com 上线 | ✅ 完成 |
| **2A** | 关于我们、FAQ、联系页 | ⏳ 待做 |
| **2B** | 在线预约表单 + 距离/路费计算 | ⏳ 待做 |
| **2C** | Stripe 存卡（预约不扣款） | ⏳ 待配置密钥 |
| **2D** | 确认邮件（您和客户都收到） | ⏳ 待做 |
| **3** | 管理后台 / 预约列表（可选 Amelia） | 以后 |

---

## 待您决定（阻塞后续开发）

- [ ] **取消规则**（FAQ 已有 48 小时政策；是否还要改）
- [ ] **你家地址**（仅后台算距离，不公开完整地址）
- [ ] **对外电话**（有了可加进网站）

---

## 改内容时常用文件

| 要改什么 | 改哪个文件 |
|----------|------------|
| 服务、价格、路费、付款规则 | `content/business.json` |
| 服务页长文案 | `content/SERVICES.md` |
| 配色、品牌 | `content/BRAND.md` |
| 首页 | `src/app/page.tsx` |
| 服务页 | `src/app/services/page.tsx` |
| 全站导航 / 页脚 | `src/components/Header.tsx`、`Footer.tsx` |

改完本地预览 → `git push` → Vercel 自动更新网站（约 1–2 分钟）。

---

## 日常工作流（简单版）

```
1. 打开 Cursor → 打开 k9-atelier 文件夹
2. 告诉 AI 要做什么（改文案、加页面、做预约等）
3. 本地 npm run dev 预览
4. 满意后 git push → 网站自动更新
5. 邮箱、Instagram 等日常运营在 Hostinger / 社交平台处理
```

---

## 下一步建议（按优先级）

1. **补全展示页** — About、FAQ、Contact（提升专业度）
2. **在线预约** — 选服务、宠物信息、地址、算路费、选时间
3. **Stripe 存卡** — 预约时验证并保存卡，不扣款
4. **确认邮件** — 自动通知您和客户
5. **Hostinger MX** — 若邮箱还有问题，在 WordPress.com DNS 补 MX

---

## 相关文档

- [PLAN.md](./PLAN.md) — 总体规划
- [ROADMAP.md](./workspace/ROADMAP.md) — 分阶段路线图
- [content/SERVICES.md](./content/SERVICES.md) — 服务菜单终稿
- [DEPLOY.md](./DEPLOY.md) — 部署与 DNS
- [supabase/AUTH_SETUP.md](./supabase/AUTH_SETUP.md) — Supabase 登录邮件 + Redirect URLs

*工作台版本：2026-07-29*
