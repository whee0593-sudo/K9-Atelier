# 下一步：GitHub + Vercel 上线（您现在在这里）

代码已在您电脑上提交好。按下面顺序操作即可。

---

## 第 1 步：在 GitHub 创建仓库（约 2 分钟）

1. 打开 **https://github.com/new**
2. 填写：
   - **Repository name**：`k9-atelier`（或您喜欢的名字）
   - **Visibility**：Private（私有）或 Public 均可
   - **不要**勾选 "Add a README"（我们已有代码）
3. 点 **Create repository**
4. 创建后会看到一个页面，上面有仓库地址，类似：
   - `https://github.com/您的用户名/k9-atelier.git`

---

## 第 2 步：把代码上传到 GitHub

在 Cursor 终端运行（**把下面地址换成您 GitHub 页面上显示的**）：

```powershell
cd C:\Users\Mark\Projects\k9-atelier
git remote add origin https://github.com/您的用户名/k9-atelier.git
git push -u origin main
```

- 第一次 push 会弹出 GitHub 登录窗口，按提示登录即可。
- 若提示输入用户名/密码，密码处应填 **Personal Access Token**（不是 GitHub 登录密码）。  
  如需创建 Token：https://github.com/settings/tokens → Generate new token → 勾选 `repo` 权限。

---

## 第 3 步：在 Vercel 导入项目（约 3 分钟）

1. 打开 **https://vercel.com/dashboard**
2. 点 **Add New… → Project**
3. 点 **Import Git Repository**
4. 若首次使用：点 **Continue with GitHub**，授权 Vercel 访问 GitHub
5. 在列表里找到 **k9-atelier**，点 **Import**
6. 设置保持默认即可：
   - Framework Preset：**Next.js**
   - Root Directory：`./`
   - Build Command：`next build`（默认）
7. 点 **Deploy**，等待 1–2 分钟
8. 完成后点 **Visit**，应能看到 K9 Atelier 网站（临时网址如 `k9-atelier.vercel.app`）

---

## 第 4 步：绑定 k9atelier.com

1. 在 Vercel 项目里 → **Settings → Domains**
2. 输入 `k9atelier.com` → **Add**
3. 再输入 `www.k9atelier.com` → **Add**
4. Vercel 会显示 **Invalid Configuration** 和需要添加的 DNS 记录——这是正常的，下一步去 WordPress.com 改 DNS

**通常需要：**

| 类型 | Name / Host | Value |
|------|-------------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

（以 Vercel 页面显示的为准。）

---

## 第 5 步：WordPress.com 改 DNS

1. 登录 **https://wordpress.com/domains**
2. 点 **k9atelier.com** → **Manage domain** → **DNS records**
3. **删除** 指向旧 WordPress 站的记录（如有 A 记录指向 WordPress、或 CNAME 到 wordpress.com）
4. **添加** Vercel 要求的 A 记录和 CNAME（见上表）
5. 保存

等待 10 分钟～48 小时，Vercel 里域名状态会变成 **Valid**，然后 https://k9atelier.com 就是新网站。

---

## 完成后告诉我

请回复：
1. GitHub 仓库链接（例如 `https://github.com/xxx/k9-atelier`）
2. Vercel 临时网址（例如 `xxx.vercel.app`）
3. 若某一步报错，把错误信息发我

我可以帮您排查 DNS 或部署问题。

---

## 可选：设置 Git 身份（以后提交代码用）

若希望以后 git 提交不报错，在终端运行一次（把名字和邮箱改成您的）：

```powershell
git config --global user.name "Your Name"
git config --global user.email "penny@k9atelier.com"
```

*只需设置一次。*
