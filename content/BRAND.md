# K9 Atelier — 品牌与配色

## 标语

**K9 ATELIER — grooming, elevated.**

## Logo

文件位置：`public/logo.png`

## 浏览器标签小图标（favicon）

浏览器标签页左边、Google 搜索结果前面的小图。现在用的是圆形狗 logo，不是网页里的大图本身。

要换图标：先换成正方形新图（建议 1024×1024）覆盖 `public/logo.png`，再运行：

```
npm install --no-save sharp
npx --yes tsx scripts/generate-favicon.mts
```

会更新这些文件：`public/favicon.ico`、`public/favicon-32x32.png`、`src/app/icon.png`、`src/app/apple-icon.png`、`public/android-chrome-192x192.png`、`public/android-chrome-512x512.png`。

换完后浏览器常会继续显示旧图标（缓存很久）。硬刷新，或关掉标签再重新打开网站，才能看到新图。

## 配色方案（典雅温柔）

从 Logo 提取，用于整站统一风格：

| 名称 | 色值 | 用途 |
|------|------|------|
| Cream 奶油白 | `#FAF7F2` | 页面主背景 |
| Lavender 淡紫 | `#C8B8D8` | 区块背景、按钮 |
| Lavender Light 浅紫 | `#E8DFF0` | 卡片、次要背景 |
| Gold 柔金 | `#C4A882` | 标题、强调、主按钮 |
| Gold Dark 深金 | `#A68B5B` | 按钮悬停、深色文字 |
| Blue 淡蓝 | `#A8C4D4` | 链接、图标、边框 |
| Text 正文 | `#3D3A36` | 主要文字 |
| Text Muted 次要文字 | `#6B6560` | 说明、脚注 |

## 设计风格

- 大量留白，干净排版
- 少动画，不花哨
- 圆角柔和，与 Logo 气质一致
- 移动端优先（客户多用手机预约）
