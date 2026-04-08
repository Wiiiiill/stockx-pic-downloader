/**
 * StockX 商品图 — 核心能力：从详情页 DOM 解析商品图 URL（主图 / 360°）、下载与文件名。
 *
 * @fileoverview
 */

(function () {
  "use strict";

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
      let filename =
        getFilenameFromResponse(response) || getFilenameFromUrl(url);
      const blob = await response.blob();
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
   * 根据商品主图 URL（与是否为 360°）生成待下载的图片 URL 列表。
   *
   * @param {string} mainImageSrc 页面里主图 img 的 src（可带查询串）
   * @param {boolean} isThreeSixty 是否 360° 序列图
   * @returns {string[]}
   */
  function buildImageDownloadUrls(mainImageSrc, isThreeSixty) {
    const base = mainImageSrc.split("?")[0];
    if (!isThreeSixty) return [base];
    return Array.from({ length: 36 }, (_, i) => {
      const parts = base.split("/");
      parts.pop();
      return `${parts.join("/")}/img${String(i + 1).padStart(2, "0")}.jpg`;
    });
  }

  /**
   * 从 StockX 商品详情 DOM 读取当前商品图：单张主图或 360° 共 36 张的直链列表。
   *
   * @param {Document|Element} [root] 查找起点，默认当前 document
   * @returns {{ urls: string[], isThreeSixty: boolean, mainImageSrc: string, picContainer: Element } | null}
   */
  function getStockxProductImageUrls(root) {
    const base = root || globalThis.document;
    const picContainer = base.querySelector('[data-component="SingleImage"]');
    if (!picContainer) return null;
    const img = picContainer.querySelector("img");
    if (!img?.src) return null;
    const isThreeSixty = !!picContainer.querySelector("#three-sixty-image");
    const urls = buildImageDownloadUrls(img.src, isThreeSixty);
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
    downloadImage: (url, documentRef) =>
      downloadImage(url, documentRef ?? globalThis.document),
    getFilenameFromResponse,
    getFilenameFromUrl,
    buildImageDownloadUrls,
    getStockxProductImageUrls,
    staggerDownloadImages,
  };
})();
