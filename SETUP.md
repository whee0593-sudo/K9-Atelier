# K9 Atelier - 开发环境安装说明

写给编程小白的步骤说明。只需做一次。

## 这些工具是干什么的？

| 工具 | 一句话解释 |
|------|------------|
| Node.js | 让网站程序在你电脑上运行起来，这样你能本地预览网站 |
| Git | 记录每次改了什么代码，方便备份和恢复 |
| npm | 随 Node.js 一起安装，用来下载网站需要的零件包 |

## 安装 Node.js（推荐 LTS 长期支持版）

1. 打开 https://nodejs.org/
2. 点击绿色的 LTS 按钮下载
3. 双击安装包，一路 Next，默认选项即可
4. 装完后关闭并重新打开 Cursor

或用 PowerShell： winget install OpenJS.NodeJS.LTS

## 安装 Git

1. 打开 https://git-scm.com/download/win
2. 下载并安装，默认选项即可

或用 PowerShell： winget install Git.Git

## 验证是否安装成功

重新打开 PowerShell，运行：

node --version
npm --version
git --version

每个命令都显示版本号即成功。

## 装好后告诉我

回复「装好了」，我会继续初始化网站代码并开始做首页。
