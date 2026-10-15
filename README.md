# stockx-pic-downloader

在 [StockX](https://stockx.com) 商品详情页一键下载商品主图。若为 360° 商品图，会按序号保存多张图片。

## 功能

- 在商品主图区域旁显示 **Download Pic**（单张）或 **Download Pics**（360° 多张）。
- 下载的是**源图**：360° 图组固定取 `dpr=3`，实测为该 CDN 能给出的最大尺寸（宽 2400，详见[关于清晰度](#关于清晰度)）。
- 按钮上实时显示进度，下完把落地尺寸留在按钮上（如 `已存 36 张 · 2400×1800`）；
  任何一张没到源图上限都会标 `⚠️`。下完看一眼按钮就知道有没有拿到高清，不用去翻文件夹。
- 文件名带商品标识：360° 图组存为 `<商品 slug>-imgNN.jpg`，不同商品不会互相重名。

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
  - `DEFAULT_IMAGE_DPR`（当前为 **3**）、`MAX_SOURCE_WIDTH`（2400）、`CLAMPED_WIDTH`（800）
  - `withImageDpr(href, dpr?)` 用于给图片链接加上 `dpr` 参数
  - `getStockxProductImageUrls(documentOrRoot?, { dpr? })` → `{ urls, isThreeSixty, mainImageSrc, picContainer } | null`（`urls` 默认带 `dpr=3`）
  - `buildImageDownloadUrls(mainImageSrc, isThreeSixty, { dpr? })` → `string[]`
  - `downloadImage(url[, document])` → `Promise<{ filename, width, height, bytes, url }>` — 保存名按 **`blob` / `Content-Type` 的实际图片类型** 决定后缀（如 avif、webp），不再盲信 URL 里的 `.jpg`；返回的宽高是解码后的真实尺寸
  - `getImageSize(blob)` → `Promise<{ width, height }>`；`assessImageQuality(width)` → `"max" | "small" | "degraded" | "unknown"`
  - `resolveDownloadFilename(response, blob, url)` / `extensionFromImageMime(mime)` / `parseMimeType(header)`
  - `getFilenameFromResponse(response)` / `getFilenameFromUrl(url)` / `stockx360FilenameStem(url)`
  - `staggerDownloadImages(urls[, document[, gapMs[, hooks]]])` — 按间隔依次调用 `downloadImage`；`hooks` 可选，支持 `onProgress({ index, finished, total, result, error })` 与 `onDone({ results, total, failed })`
- **`stockx-pic-downloader.js`**：Tampermonkey 元数据 + **页面 UI 与交互**（选节点、样式同步、MutationObserver、`history` 等），内部调用上述 core API。

要做浏览器扩展时：只复用 **`stockx-pic-core.js`**，在扩展里自行实现 UI、入口和页面生命周期；需要排队下载时用 `staggerDownloadImages`，或自行 `await downloadImage`。

## 关于清晰度

StockX 图片走 Imgix CDN。页面自己在 `srcset` 里给浏览器的最优档是 `w=576&dpr=3`，只有 **1536×1152**。

本脚本会把页面 `src` 自带的 `w` / `h` / `q` **全部剥掉**，只换成 `dpr=3`，拿到 **2400 宽的原生源图** —— 比页面给浏览器的还大 1.56 倍。

实测 6 款商品（360° 图组各 36 帧，全部一致）：

| 请求参数 | 实际落地 |
|---|---|
| 页面 `srcset` 的 3x（`w=576&dpr=3`） | 1536×1152 |
| `?w=800` / `?w=2400` / `?w=9999` | 800 宽（`w` 被 CDN 钳在 800） |
| **`?dpr=3`（本脚本用的）** | **2400 宽 ← 源图上限** |
| `?dpr=4` / `?dpr=6` / `?dpr=10` | 与 `dpr=3` **完全一致**，不会再大 |
| `?q=95` / `?q=100` | 与不带 `q` **完全一致**（默认已是最高质量） |

结论：**`dpr=3` 就是天花板；`w` 是死路；`q` 不用加。**

2400 也确认是真源图而非插值放大：把 2400 那版缩回 800，与原生 800 渲染逐像素比对，RMS 差 ≈ 1。

> ⚠️ `buildImageDownloadUrls` 里 `mainImageSrc.split("?")[0]` 那行**不能**改成「保留原参数再覆盖 dpr」——
> 页面 src 带着 `w=576&h=384`，会把放大结果重新钳回 1536，分辨率静默腰斩。
> `assessImageQuality` 和按钮上的 `⚠️` 就是为这种情况兜底的。

## 使用

1. 打开任意 StockX 商品详情页，等待页面加载完成。
2. 在主图附近点击 **Download Pic** 或 **Download Pics**，即可开始下载。多张时会依次下载，间隔很短。
3. 下载过程中按钮显示 `下载中 12/36`；结束后结果留在按钮上，例如 `已存 36 张 · 2400×1800`。
   若出现 `⚠️`，说明有图没到源图上限（看控制台日志里每张的实际尺寸）。

仅适用于 `https://stockx.com/*` 页面；若 StockX 改版导致按钮不出现或下载失败，需等待脚本适配。

## 更新

Tampermonkey 会按脚本配置检查新版本；也可在 **管理面板** 中对该脚本执行 **检查更新**。

## 许可

本项目采用 **MIT** 许可，全文见仓库中的 [`LICENSE`](LICENSE)。

## 问题与建议

<https://github.com/Wiiiiill/stockx-pic-downloader/issues>
