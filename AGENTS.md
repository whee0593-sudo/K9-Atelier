# K9 Atelier

移动宠物美容的营销站 + 在线预约网站。

- 技术栈：Next.js 15（App Router）+ React 19 + TypeScript + Tailwind CSS v4。包管理器用 **npm**（`package-lock.json`）。
- 无数据库作为业务配置源。服务、定价、费用、出行/预约规则、隐私设置等业务数据以 `content/business.json` 为唯一真相源。**网站所有显示文案只用英文**（不要在业务数据里保留中文对照 `*Zh` 字段）；用户自行输入的内容仍可包含中文。
- Auth 目前是预览桩，不是完整后端账号体系：客人/管理员「登录」是 `localStorage`/cookie 桩（见 `src/lib/customer-session.ts`、`src/lib/site-access.ts`），没有后端用户库作为主存储。（Supabase 相关能力按各阶段文档接入。）

## Cursor Cloud 专用说明

标准命令见 `package.json`：`npm run dev`（→ http://localhost:3000）、`npm run build`、`npm run start`。容易踩坑的点：

- **本地开发也可能开着隐私门禁。** 当 `content/business.json` 里 `site.privacyMode: true` 且配置了 `SITE_ACCESS_PASSWORD` 时，`middleware.ts` 会把非公开页重定向到 `/under-construction`。要看真实站点，需要解锁：
  - 打开 `/login/admin`，输入仅服务端环境变量 `SITE_ACCESS_PASSWORD` 的密码并提交。这会通过 `POST /api/site-access` 设置 HttpOnly cookie `k9-site-access`。
  - 或者设置环境变量 `SITE_PRIVACY_MODE=false`，在本地完全关掉门禁（见 `src/lib/site-access.ts` 里的 `isPrivacyModeEnabled`）。
  - 密钥和移动服务基地私有地址不要写进 `business.json`。把 `SITE_ACCESS_PASSWORD`、`SITE_PREVIEW_SHARE_TOKEN`、`SITE_BASE_ADDRESS`、`GOOGLE_MAPS_API_KEY` 放进 `.env.local`；`.env*.local` 已 gitignore。
  - 出行报价：若设置了 `GOOGLE_MAPS_API_KEY`，服务端用 Google Geocoding + Routes。密钥缺失，或 Google 返回 `REQUEST_DENIED` 等配置类错误时，`src/lib/geo.ts` 会回退到 Nominatim + OSRM。Google 返回 `ZERO_RESULTS` 的地址不会再去 OSM 重试。设置说明见 `content/MAPS.md`。
- **首页（`/`）是极简入口**（logo + “Book Service” / “Online Shop” 按钮），不是长营销页。丰富内容在 `/services`、`/book`、`/service-area` 等。没有 `/home` 路由。
- **预约是 `/book` 上的 6 步客人流程**：狗狗资料 → 日期时间（先地址再日历）→ 护理/服务 → 主人资料 + 登录密码 → 支付方式存档（不扣款）→ 确认。确认后会保存家庭/狗狗档案，并发送邮件 + 短信。老客人可在主人资料步骤登录。
- **只有真正必需的信息可以拦住建档或预约。** 客户：名、姓、地址、电话、邮箱。付款：成功保存有效付款方式（预约不扣款）。狗狗：名字、品种、体重。预约：已选服务、可约日期、客户能选的时间段。新建账号还需要登录密码。Arrival Window 由后台排程生成，缺失或为 null 不能返回 400/500，也不能回滚预约。疫苗信息和文件完全可选；上传、存储、通知、营销或其他无关数据库错误都不能挡住预约。详见 `content/BOOKING-RULES.md`。
- **开箱即用不了 `npm run lint`。** 仓库没有提交 ESLint 配置，`next lint` 会进入交互式 “How would you like to configure ESLint?”，无法非交互运行。`next build` 仍可正常编译和类型检查。
- **`npm run dev` 运行时不要跑 `npm run build`。** 生产构建会覆盖共用的 `.next` 目录，导致开发服务器出现 `MODULE_NOT_FOUND` / `Cannot find module './xxx.js'` 一类 500。恢复：停掉 dev，`rm -rf .next`，再 `npm run dev`。
- **Walkthrough 证据只要截图。** UI 验证通过后附截图即可。除非用户明确要求，不要录制或发送演示视频。
- 部署目标是 Vercel（推到 `main` 会自动部署）。见 `DEPLOY.md` / `VERCEL-404-FIX.md`。
