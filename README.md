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

脚本会通过 `@require` 加载同仓库的 [`stockx-pic-core.js`](stockx-pic-core.js)；若你 fork 了项目，请把 `@require` 里的 GitHub 地址改成你的 raw 链接，或本地调试时用 Tampermonkey 允许的本地 `@require`。

## 核心逻辑与扩展

- **`stockx-pic-core.js`**：「从详情页读出商品图 URL（单主图或 360°）+ 下载 + 文件名」；**不包含**按钮、路由监听。注入后存在全局 **`StockxPicCore`**：
  - `DEFAULT_IMAGE_DPR`（当前为 **3**）、`withImageDpr(href, dpr?)` 用于给图片链接加上 `dpr` 参数
  - `getStockxProductImageUrls(documentOrRoot?, { dpr? })` → `{ urls, isThreeSixty, mainImageSrc, picContainer } | null`（`urls` 默认带 `dpr=3`）
  - `buildImageDownloadUrls(mainImageSrc, isThreeSixty, { dpr? })` → `string[]`
  - `downloadImage(url[, document])` — 保存名按 **`blob` / `Content-Type` 的实际图片类型** 决定后缀（如 avif、webp），不再盲信 URL 里的 `.jpg`
  - `resolveDownloadFilename(response, blob, url)` / `extensionFromImageMime(mime)` / `parseMimeType(header)`
  - `getFilenameFromResponse(response)` / `getFilenameFromUrl(url)`
  - `staggerDownloadImages(urls[, document[, gapMs]])` — 按间隔依次调用 `downloadImage`
- **`stockx-pic-downloader.js`**：Tampermonkey 元数据 + **页面 UI 与交互**（选节点、样式同步、MutationObserver、`history` 等），内部调用上述 core API。

要做浏览器扩展时：只复用 **`stockx-pic-core.js`**，在扩展里自行实现 UI、入口和页面生命周期；需要排队下载时用 `staggerDownloadImages`，或自行 `await downloadImage`。

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
