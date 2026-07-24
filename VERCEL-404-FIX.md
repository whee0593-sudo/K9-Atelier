# Vercel 404 排查指南

> **404 = 网站还没成功发布到 Vercel**，和 DNS 无关。要先修好 Vercel，再改域名。

---

## 最常见原因：GitHub 上是空的（或代码没推上去）

本地项目有代码，但 **GitHub 仓库里可能没有文件**，Vercel 连的是空仓库 → 部署失败或空站 → 404。

### 请您检查 GitHub

1. 打开您的 GitHub 仓库（例如 `github.com/您的用户名/k9-atelier`）
2. 看里面有没有这些文件夹/文件：
   - `src/`
   - `package.json`
   - `public/logo.png`
   - `content/business.json`

**如果只有 README 或几乎是空的** → 需要把本地代码 push 上去（见下方「重新上传代码」）。

---

## 第 2 步：看 Vercel 部署是否成功

1. 打开 Vercel → 您的 **k9-atelier** 项目
2. 点顶部 **Deployments**
3. 看最新一条是什么状态：

| 状态 | 意思 | 怎么办 |
|------|------|--------|
| **Ready**（绿色） | 部署成功 | 点 **Visit** 看真实网址（可能不是 k9-atelier.vercel.app） |
| **Error**（红色） | 构建失败 | 点进去看 **Build Logs**，把报错发我 |
| **没有记录** | 从没部署成功 | 检查 GitHub 是否有代码，再 Redeploy |

---

## 第 3 步：核对 Vercel 项目设置

Vercel 项目 → **Settings → General**：

| 设置 | 应填 |
|------|------|
| **Framework Preset** | Next.js |
| **Root Directory** | 留空或 `./`（不要填 `src`） |
| **Build Command** | `next build`（默认） |
| **Output Directory** | 留空（Next.js 自动） |
| **Production Branch** | `main` |

改完后：**Deployments → 最新一条 ⋯ → Redeploy**

---

## 重新上传代码到 GitHub（若 GitHub 是空的）

在 Cursor 终端运行（**把地址换成您的 GitHub 仓库**）：

```powershell
cd C:\Users\Mark\Projects\k9-atelier
git remote add origin https://github.com/您的用户名/k9-atelier.git
git push -u origin main
```

若提示 `remote origin already exists`：

```powershell
git remote set-url origin https://github.com/您的用户名/k9-atelier.git
git push -u origin main
```

Push 成功后，Vercel 通常会自动重新部署。等 1–2 分钟再点 **Deployments → Visit**。

---

## 如何找到正确的预览网址

不要死记 `k9-atelier.vercel.app`。

1. Vercel → **Deployments**
2. 最新 **Ready** 的那条 → 点 **Visit**
3. 浏览器地址栏里的才是当前有效链接（可能是 `k9-atelier-xxxx.vercel.app`）

---

## 修好后顺序

```
① GitHub 有完整代码
② Vercel Deployments 显示 Ready
③ Visit 能打开 K9 Atelier 网站
④ 再改 WordPress.com DNS（A + www CNAME）
```

---

## 请发给我（方便继续帮您）

1. **GitHub 仓库链接**
2. Vercel **Deployments** 最新一条是 Ready 还是 Error？
3. 若是 Error，**Build Logs 最后几行**（复制文字）
