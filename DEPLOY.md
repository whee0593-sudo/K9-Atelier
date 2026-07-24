# K9 Atelier — 上线指南（Vercel 免费托管 + k9atelier.com）

> 用日常语言写的步骤。域名在 WordPress.com 购买，网站托管改用 **Vercel（免费）**。

---

## 先搞清楚两件事（很重要）

### WordPress.com vs WordPress.org

| 名称 | 是什么 |
|------|--------|
| **WordPress.com** | 一个平台，可以在上面买域名、建站（您在这里买的 k9atelier.com） |
| **WordPress.org** | 免费网站软件，通常装在自己的主机上 |

**我们的 K9 Atelier 网站不是 WordPress**，是用 **Next.js** 做的。  
所以：**域名可以继续留在 WordPress.com 管理，但网站内容放在 Vercel 上**——只要改 DNS，让 k9atelier.com 指向 Vercel 即可。

### 现在 k9atelier.com 上是什么？

目前打开域名，看到的是**默认模板页**（不是美容网站）。  
上线完成后，会换成我们做的 K9 Atelier 网站。

---

## 整体流程（3 大步）

```
① 把网站代码发布到 Vercel（免费）→ 得到一个 .vercel.app 网址
② 在 Vercel 里添加自定义域名 k9atelier.com
③ 在 WordPress.com 域名后台改 DNS → 指向 Vercel
```

---

## 第 ① 步：发布到 Vercel

### 方法 A：用网站操作（推荐，最简单）

1. 注册/登录 **https://vercel.com**（可用 GitHub 或邮箱注册，免费）
2. 点击 **Add New → Project**
3. 如果代码在 GitHub：选仓库导入  
   **如果还没有 GitHub**：见下方「先把代码放到 GitHub」
4. 框架会自动识别为 **Next.js**，直接点 **Deploy**
5. 等 1–2 分钟，会得到类似 `k9-atelier.vercel.app` 的网址  
   → 先打开这个链接，确认网站正常

### 先把代码放到 GitHub（如还没有）

在 Cursor 终端里（项目文件夹内）：

```powershell
cd C:\Users\Mark\Projects\k9-atelier
git add .
git commit -m "Initial K9 Atelier website"
```

然后：
1. 打开 https://github.com → 新建仓库（如 `k9-atelier`，选 Private 或 Public）
2. 按 GitHub 页面提示，把代码 push 上去
3. 回到 Vercel → Import 这个 GitHub 仓库

### 方法 B：用命令行（可选）

```powershell
cd C:\Users\Mark\Projects\k9-atelier
npx vercel login
npx vercel --prod
```

`vercel login` 会在浏览器里让您登录，我无法替您完成这一步。

---

## 第 ② 步：在 Vercel 绑定 k9atelier.com

1. 打开 Vercel 里您的项目
2. 点 **Settings → Domains**
3. 输入 `k9atelier.com`，点 Add  
4. 再添加 `www.k9atelier.com`（可选，建议一起加）
5. Vercel 会显示需要配置的 **DNS 记录**（请截图或抄下来）

通常类似：

| 类型 | 名称 | 值 |
|------|------|-----|
| **A** | `@`（或留空） | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

（以 Vercel 页面显示的为准，有时会略有不同。）

---

## 第 ③ 步：在 WordPress.com 改 DNS

1. 登录 **https://wordpress.com**
2. 进入 **Domains（域名）** → 选择 **k9atelier.com**
3. 找到 **DNS Records（DNS 记录）** 或 **Manage DNS**
4. **删除或停用** 指向 WordPress 旧网站的记录（例如旧的 A 记录、CNAME 到 wordpress.com）
5. **添加** Vercel 要求的记录：
   - **A 记录**：主机名 `@` → `76.76.21.21`
   - **CNAME 记录**：主机名 `www` → `cname.vercel-dns.com`
6. 保存

### 生效时间

- 快的话 **10–30 分钟**
- 最长可能 **24–48 小时**

期间可以用 Vercel 给的 `xxx.vercel.app` 链接先预览。

### 在 WordPress.com 取消「用 WordPress 建站」

如果域名还绑在 WordPress.com 的免费/付费站上：
- 到 **Site → Settings** 里解除自定义域名，或  
- 不再使用 WordPress.com 建站，只保留**域名 + DNS 管理**

否则 DNS 改完仍可能被旧站抢走。

---

## 常见问题

**问：WordPress.org 转移是什么意思？**  
答：若您是指把站迁到自装 WordPress，和我们这套 Next.js 站是**两回事**。  
我们方案：**域名在 WordPress.com 管 DNS，网站放 Vercel**，不必再装 WordPress。

**问：Vercel 真的免费吗？**  
答：个人小站、访问量不大时，**免费档通常够用**。以后流量很大再考虑升级。

**问：您能帮我直接改域名吗？**  
答：我无法登录您的 WordPress.com 或 Vercel 账户。  
但我可以：写好代码、告诉您每一步点哪里；您登录后照着做即可。

**问：Stripe 支付什么时候接？**  
答：网站先上线展示 + 邮件预约；下一步再接 Stripe 收 $50 定金。

---

## 您现在可以做的（建议顺序）

- [ ] 注册 Vercel 账号  
- [ ] 把项目 push 到 GitHub（或告诉我，我帮您准备 git 命令）  
- [ ] 在 Vercel Deploy 项目  
- [ ] 在 Vercel 添加 k9atelier.com  
- [ ] 在 WordPress.com 改 DNS  
- [ ] 等生效后访问 https://k9atelier.com  

---

## 需要我继续帮您时，请告诉我

1. **Vercel 账号是否已注册？**  
2. **是否有 GitHub 账号？**（有的话我可以帮您写好完整的 git push 命令）  
3. **WordPress.com 里域名页面能否看到 DNS 设置？**（截图描述也行）

我可以根据您的进度，一步一步陪您做完上线。

*文档版本：2026-07-24*
