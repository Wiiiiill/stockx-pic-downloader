# stockx-pic-downloader

在 [StockX](https://stockx.com) 商品详情页一键下载商品主图。若为 360° 商品图，会按序号保存多张图片。

## 功能

- 在商品主图区域旁显示 **Download Pic**（单张）或 **Download Pics**（360° 多张）。
- 下载的文件尽量沿用链接或响应中的原始文件名。

## 环境要求

- 桌面端 **Chrome、Edge、Firefox** 等常见浏览器。
- 已安装并启用 **[Tampermonkey](https://www.tampermonkey.net/)**，或使用支持用户脚本的同类扩展（如 Violentmonkey）。

## 安装

1. 在浏览器中打开：  
   [安装链接](https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-downloader.js)
2. 按 Tampermonkey 的提示完成安装。

若未出现安装提示：打开 Tampermonkey → **实用工具** → **从 URL 安装**，粘贴上面的链接后确认。

也可在 Tampermonkey 中新建脚本，将本仓库根目录的 `stockx-pic-downloader.js` 全文复制进去并保存（与链接安装相比，通常不易自动获取更新）。

## 使用

1. 打开任意 StockX 商品详情页，等待页面加载完成。
2. 在主图附近点击 **Download Pic** 或 **Download Pics**，即可开始下载。多张时会依次下载，间隔很短。

仅适用于 `https://stockx.com/*` 页面；若 StockX 改版导致按钮不出现或下载失败，需等待脚本适配。

## 更新

Tampermonkey 会按脚本配置检查新版本；也可在 **管理面板** 中对该脚本执行 **检查更新**。

## 许可

本项目采用 **MIT** 许可，全文见仓库中的 [`LICENSE`](LICENSE)。

## 问题与建议

<https://github.com/Wiiiiill/stockx-pic-downloader/issues>
