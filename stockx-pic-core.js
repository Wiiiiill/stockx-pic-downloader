/**
 * StockX 商品图 — 核心能力：从详情页 DOM 解析商品图 URL（主图 / 360°）、下载与文件名。
 *
 * @fileoverview
 */

(function () {
  "use strict";

  const DEFAULT_IMAGE_DPR = 3;

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
   * 路径最后一段去掉后缀，用作下载主名。
   * @param {string} url
   * @returns {string}
   */
  function basenameStemFromUrl(url) {
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
   * @param {string} url
   * @param {Document} [documentRef]
   * @returns {Promise<void>}
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
      const blobUrl = globalThis.URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
      globalThis.URL.revokeObjectURL(blobUrl);
      console.log(`图片已下载: ${filename}`);
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
   */
  function staggerDownloadImages(urls, documentRef, gapMs) {
    const doc = documentRef || globalThis.document;
    const win = doc.defaultView || globalThis;
    const gap = gapMs ?? 500;
    urls.forEach((url, i) =>
      win.setTimeout(() => downloadImage(url, doc), i * gap),
    );
  }

  globalThis.StockxPicCore = {
    DEFAULT_IMAGE_DPR,
    downloadImage: (url, documentRef) =>
      downloadImage(url, documentRef ?? globalThis.document),
    getFilenameFromResponse,
    getFilenameFromUrl,
    parseMimeType,
    extensionFromImageMime,
    resolveDownloadFilename,
    withImageDpr,
    buildImageDownloadUrls,
    getStockxProductImageUrls,
    staggerDownloadImages,
  };
})();
