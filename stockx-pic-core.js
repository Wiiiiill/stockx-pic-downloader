/**
 * StockX 商品图 — 核心能力：从详情页 DOM 解析商品图 URL（主图 / 360°）、下载与文件名。
 *
 * @fileoverview
 */

(function () {
  "use strict";

  const DEFAULT_IMAGE_DPR = 3;

  /**
   * 源图宽度上限。实测六款商品，`dpr=3` 时宽度一律到 2400，再往上调 dpr 不会更大。
   */
  const MAX_SOURCE_WIDTH = 2400;

  /**
   * CDN 对 `w` 的钳制量级：URL 里只要残留 `w=576&h=384`，dpr 放大后仍会被打回这个档。
   */
  const CLAMPED_WIDTH = 800;

  /**
   * 为 StockX 图片 URL 设置 dpr 查询参数（会覆盖已有 dpr）。
   *
   * @param {string} href 绝对地址（可无 query）
   * @param {number} [dpr=DEFAULT_IMAGE_DPR]
   * @returns {string}
   */
  function withImageDpr(href, dpr) {
    const n = dpr ?? DEFAULT_IMAGE_DPR;
    const u = new URL(href);
    u.searchParams.set("dpr", String(n));
    return u.href;
  }

  /**
   * @param {string} [headerValue] Content-Type 等，可带 charset
   * @returns {string}
   */
  function parseMimeType(headerValue) {
    if (!headerValue) return "";
    return headerValue.split(";")[0].trim().toLowerCase();
  }

  /** @param {string} mime */
  function extensionFromImageMime(mime) {
    if (!mime) return null;
    const map = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/pjpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/bmp": "bmp",
      "image/svg+xml": "svg",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
    };
    return map[mime] || null;
  }

  /** @param {string} filename */
  function stripFilenameExtension(filename) {
    const i = filename.lastIndexOf(".");
    if (i <= 0) return filename;
    return filename.slice(0, i);
  }

  /**
   * StockX 360° 图组的路径形如 `/360/<slug>/Images/<slug>/Lv2/imgNN.jpg`。
   *
   * 每个商品的帧名都是 img01…img36，光用帧名做主名会跨商品重名
   * （浏览器会自作主张存成 `img01 (1).jpg`，两个商品就混在一起了），
   * 所以拼上商品 slug。
   *
   * @param {string} url
   * @returns {string|null} 命中 360° 图组时返回主名，否则 null
   */
  function stockx360FilenameStem(url) {
    try {
      const match = new URL(url).pathname.match(
        /^\/360\/([^/]+)\/Images\/[^/]+\/[^/]+\/(img\d+)\./,
      );
      return match ? `${match[1]}-${match[2]}` : null;
    } catch {
      return null;
    }
  }

  /**
   * 路径最后一段去掉后缀，用作下载主名。
   *
   * 360° 图组走 {@link stockx360FilenameStem} 带商品 slug；
   * 其余（如商品主图 `-Product.jpg`）本身已含商品信息，沿用原文件名。
   *
   * @param {string} url
   * @returns {string}
   */
  function basenameStemFromUrl(url) {
    const stockxStem = stockx360FilenameStem(url);
    if (stockxStem) return stockxStem;
    try {
      const urlObj = new URL(url);
      const last = urlObj.pathname.split("/").pop() || "download";
      return stripFilenameExtension(decodeURIComponent(last));
    } catch {
      return "download";
    }
  }

  /**
   * 结合响应类型决定下载文件名后缀（避免 URL 写 .jpg 实为 avif 等问题）。
   * @param {Response} response
   * @param {Blob} blob
   * @param {string} requestUrl
   * @returns {string}
   */
  function resolveDownloadFilename(response, blob, requestUrl) {
    const mime =
      parseMimeType(blob.type) ||
      parseMimeType(response.headers.get("Content-Type"));
    const ext = extensionFromImageMime(mime);

    const fromHeader = getFilenameFromResponse(response);
    if (fromHeader) {
      if (ext) return `${stripFilenameExtension(fromHeader)}.${ext}`;
      return fromHeader;
    }

    const stem = basenameStemFromUrl(requestUrl);
    if (ext) return `${stem}.${ext}`;
    return getFilenameFromUrl(requestUrl);
  }

  /**
   * 读出图片的真实像素尺寸。blob 是原始字节，浏览器不会二次压缩，
   * 所以这里拿到的宽高就是落地文件的宽高，可直接用来判断清晰度。
   *
   * @param {Blob} blob
   * @returns {Promise<{ width: number, height: number }>}
   */
  async function getImageSize(blob) {
    if (typeof globalThis.createImageBitmap === "function") {
      const bitmap = await globalThis.createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return size;
    }

    // 老版本 Firefox 等没有 createImageBitmap 时兜底
    const objectUrl = globalThis.URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const img = new globalThis.Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("图片解码失败"));
        img.src = objectUrl;
      });
    } finally {
      globalThis.URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * 按落地宽度判断清晰度档位。
   *
   * 不硬性要求等于 {@link MAX_SOURCE_WIDTH}：源图本身偏小的商品是正常的，
   * 只有被打回 {@link CLAMPED_WIDTH} 才说明 dpr 没生效、确实拿到了低清。
   *
   * @param {number} width
   * @returns {"max" | "small" | "degraded" | "unknown"}
   */
  function assessImageQuality(width) {
    if (!width || width <= 0) return "unknown";
    if (width <= CLAMPED_WIDTH) return "degraded";
    if (width < MAX_SOURCE_WIDTH) return "small";
    return "max";
  }

  /**
   * @param {string} url
   * @param {Document} [documentRef]
   * @returns {Promise<{ filename: string, width: number, height: number, bytes: number, url: string }>}
   */
  async function downloadImage(url, documentRef) {
    const doc = documentRef || globalThis.document;
    try {
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      const filename = resolveDownloadFilename(response, blob, url);
      const size = await getImageSize(blob);
      const blobUrl = globalThis.URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
      globalThis.URL.revokeObjectURL(blobUrl);

      const result = {
        filename,
        width: size.width,
        height: size.height,
        bytes: blob.size,
        url,
      };
      console.log(
        `图片已下载: ${filename} (${size.width}×${size.height}, ${blob.size} 字节)`,
      );
      return result;
    } catch (error) {
      console.error("下载过程中发生错误:", error);
      throw error;
    }
  }

  /**
   * @param {Response} response
   * @returns {string|null}
   */
  function getFilenameFromResponse(response) {
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * @param {string} url
   * @returns {string}
   */
  function getFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split("/").pop() || "download";
      filename = decodeURIComponent(filename);
      if (!filename.includes(".")) {
        const contentType = url.searchParams.get("type") || "image/jpeg";
        const ext = contentType.split("/")[1] || "jpg";
        filename += "." + ext;
      }
      return filename;
    } catch {
      return "image.jpg";
    }
  }

  /**
   * 根据商品主图 URL（与是否为 360°）生成待下载的图片 URL 列表（均带 dpr）。
   *
   * @param {string} mainImageSrc 页面里主图 img 的 src（可带查询串，路径以无 query 部分推导）
   * @param {boolean} isThreeSixty 是否 360° 序列图
   * @param {{ dpr?: number }} [options] 默认 dpr 为 3
   * @returns {string[]}
   */
  function buildImageDownloadUrls(mainImageSrc, isThreeSixty, options) {
    const dpr = options?.dpr ?? DEFAULT_IMAGE_DPR;
    // 必须把页面 src 自带的 query 全部剥掉，别改成「保留再覆盖」。
    // 它带着 w=576&h=384，会把 dpr 放大后的结果重新钳回 1536；
    // 剥干净只留 dpr=3 才能拿到 2400 的源图（两者实测差 1.56 倍）。
    const base = mainImageSrc.split("?")[0];
    if (!isThreeSixty) return [withImageDpr(base, dpr)];
    return Array.from({ length: 36 }, (_, i) => {
      const parts = base.split("/");
      parts.pop();
      const frame = `${parts.join("/")}/img${String(i + 1).padStart(2, "0")}.jpg`;
      return withImageDpr(frame, dpr);
    });
  }

  /**
   * 从 StockX 商品详情 DOM 读取当前商品图：单张主图或 360° 共 36 张的直链列表（均带 dpr）。
   *
   * @param {Document|Element} [root] 查找起点，默认当前 document
   * @param {{ dpr?: number }} [options] 下载用 dpr，默认 3
   * @returns {{ urls: string[], isThreeSixty: boolean, mainImageSrc: string, picContainer: Element } | null}
   */
  function getStockxProductImageUrls(root, options) {
    const base = root || globalThis.document;
    const picContainer = base.querySelector('[data-component="SingleImage"]');
    if (!picContainer) return null;
    const img = picContainer.querySelector("img");
    if (!img?.src) return null;
    const isThreeSixty = !!picContainer.querySelector("#three-sixty-image");
    const urls = buildImageDownloadUrls(img.src, isThreeSixty, options);
    return {
      urls,
      isThreeSixty,
      mainImageSrc: img.src,
      picContainer,
    };
  }

  /**
   * 按间隔依次触发下载（无 UI，仅调度）。
   *
   * @param {string[]} urls
   * @param {Document} [documentRef]
   * @param {number} [gapMs=500]
   * @param {{
   *   onProgress?: (p: { index: number, finished: number, total: number, result: object|null, error: Error|null }) => void,
   *   onDone?: (p: { results: object[], total: number, failed: number }) => void,
   * }} [hooks] 进度回调；`onDone` 在全部落定后触发一次
   */
  function staggerDownloadImages(urls, documentRef, gapMs, hooks) {
    const doc = documentRef || globalThis.document;
    const win = doc.defaultView || globalThis;
    const gap = gapMs ?? 500;
    const total = urls.length;
    const results = [];
    let finished = 0;

    const settle = (index, result, error) => {
      finished += 1;
      if (result) results.push(result);
      hooks?.onProgress?.({ index, finished, total, result, error });
      if (finished === total) {
        hooks?.onDone?.({
          results,
          total,
          failed: total - results.length,
        });
      }
    };

    urls.forEach((url, i) =>
      win.setTimeout(
        () =>
          downloadImage(url, doc).then(
            (result) => settle(i, result, null),
            (error) => settle(i, null, error),
          ),
        i * gap,
      ),
    );
  }

  globalThis.StockxPicCore = {
    DEFAULT_IMAGE_DPR,
    MAX_SOURCE_WIDTH,
    CLAMPED_WIDTH,
    downloadImage: (url, documentRef) =>
      downloadImage(url, documentRef ?? globalThis.document),
    getImageSize,
    assessImageQuality,
    getFilenameFromResponse,
    getFilenameFromUrl,
    stockx360FilenameStem,
    parseMimeType,
    extensionFromImageMime,
    resolveDownloadFilename,
    withImageDpr,
    buildImageDownloadUrls,
    getStockxProductImageUrls,
    staggerDownloadImages,
  };
})();
