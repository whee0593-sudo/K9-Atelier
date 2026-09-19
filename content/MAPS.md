# Google Maps 路费计算（内部说明）

网站预约界面是英文。这份说明给 Penny / 内部用。

政策不变：10 英里内免费，超出按单程开车距离每英里 $6.50，最远 20 英里。  
**有钥匙时，地址查询和开车里程走 Google Maps；没有钥匙时，仍用原来的免费地图服务。**

不要把钥匙写进 `business.json`，也不要用 `NEXT_PUBLIC_` 前缀（那会把钥匙暴露给浏览器）。

---

## 1. 在 Google Cloud 打开两个产品

打开 [Google Cloud Console](https://console.cloud.google.com/) → 你们收到 API key 邮件的那个项目：

1. **APIs & Services → Library**，启用（钥匙加进 Vercel 还不够，这两个必须点 Enable）：
   - **Geocoding API**（把地址变成坐标）
   - **Routes API**（算开车距离）

   没开的话，正式站会先试 Google，失败后再退回原来的免费地图。路费要完全按 Google 算，必须把这两个打开。
2. **APIs & Services → Credentials** → 打开这把 key：
   - **API restrictions**：只允许上面这两个（不要开成不限制）
   - **Application restrictions**：选 **None**  
     （钥匙只放在服务器上。如果改成 HTTP referrer / 网站限制，Vercel 后台请求会失败。）
3. **Billing → Budgets & alerts**：设一个每月预算提醒，避免意外用量。

评价同步、地址自动补全、网页嵌地图这次**不要开**。

---

## 2. 把钥匙加到 Vercel

Vercel 项目 → **Settings → Environment Variables**（Production + Preview）：

| 名称 | 值 |
|------|------|
| `GOOGLE_MAPS_API_KEY` | Google 给你的 API key |

加完后 **Redeploy** 一次。

本地测试写在 `.env.local`（不要提交到 Git）：

```
GOOGLE_MAPS_API_KEY=your-key
SITE_BASE_ADDRESS=your-private-street-address-city-state-zip
```

`SITE_BASE_ADDRESS` 本来就要有：它是算路费的出发地址，不会显示在网站上。
