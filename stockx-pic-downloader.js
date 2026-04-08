// ==UserScript==
// @name         stockx-pic-downloader
// @namespace    http://tampermonkey.net/
// @version      2026-04-08
// @description  stockx-pic-downloader
// @author       https://github.com/Wiiiiill
// @match        https://stockx.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stockx.com
// @grant        none
// @run-at      document-end
// @homepageURL  https://github.com/Wiiiiill/stockx-pic-downloader
// @supportURL   https://github.com/Wiiiiill/stockx-pic-downloader/issues
// @downloadURL  https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-downloader.js
// @updateURL    https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-downloader.js
// ==/UserScript==

/**
 * 下载图片并保留原始文件名
 * @param {string} url - 图片的URL地址
 * @returns {Promise<void>}
 */
async function downloadImage(url) {
  try {
    // 发起请求获取图片
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    // 从响应头或URL中获取文件名
    let filename = getFilenameFromResponse(response) || getFilenameFromUrl(url);

    // 将响应数据转换为Blob
    const blob = await response.blob();

    // 创建临时下载链接
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;

    // 触发点击下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放Blob URL内存
    URL.revokeObjectURL(blobUrl);

    console.log(`图片已下载: ${filename}`);
  } catch (error) {
    console.error("下载过程中发生错误:", error);
    throw error;
  }
}

/**
 * 从响应头中提取文件名
 * @param {Response} response - 响应对象
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
 * 从URL中提取文件名
 * @param {string} url - 图片URL
 * @returns {string}
 */
function getFilenameFromUrl(url) {
  try {
    // 处理URL编码和查询参数
    const urlObj = new URL(url);
    let filename = urlObj.pathname.split("/").pop() || "download";

    // 解码URL编码的字符（如空格、中文等）
    filename = decodeURIComponent(filename);

    // 如果没有扩展名，添加默认扩展名
    if (!filename.includes(".")) {
      const contentType = url.searchParams.get("type") || "image/jpeg";
      const ext = contentType.split("/")[1] || "jpg";
      filename += "." + ext;
    }

    return filename;
  } catch {
    // 如果URL解析失败，使用默认文件名
    return "image.jpg";
  }
}

/** 无刷新切商品时：用「当前地址 + 主图 src」判断要不要重建按钮 */
const DOWNLOADER_UI_ID = "stockx-pic-downloader-root";

let debounceId = 0;
function scheduleDownloadUiUpdate() {
  clearTimeout(debounceId);
  debounceId = setTimeout(updateDownloadUi, 120);
}

function updateDownloadUi() {
  const picContainer = document.querySelector('[data-component="SingleImage"]');
  const buyContainer = document.querySelector('[data-testid="BuyContainer"]');
  const buyAnchors = buyContainer?.querySelectorAll("a");
  const styleAnchor = buyAnchors?.[buyAnchors.length - 1];
  const picLeadEl = picContainer?.firstElementChild;
  const img = picContainer?.querySelector("img");

  if (!picContainer || !buyContainer || !styleAnchor || !picLeadEl || !img?.src) {
    document.getElementById(DOWNLOADER_UI_ID)?.remove();
    return;
  }

  const boundKey = `${location.href}\0${img.src}`;
  const parentEl = picContainer.parentElement;
  const existing = document.getElementById(DOWNLOADER_UI_ID);
  if (
    existing &&
    existing.dataset.boundKey === boundKey &&
    existing.isConnected &&
    existing.parentElement === parentEl
  ) {
    return;
  }

  existing?.remove();

  const isThreeSixtyImage = !!picContainer.querySelector("#three-sixty-image");
  const btnContainer = document.createElement("div");
  btnContainer.id = DOWNLOADER_UI_ID;
  btnContainer.dataset.boundKey = boundKey;
  btnContainer.classList.add(...picContainer.classList);

  const btn = document.createElement("button");
  btn.id = "download-pic";
  btn.classList.add(...styleAnchor.classList, ...picLeadEl.classList);
  btn.textContent = isThreeSixtyImage ? "Download Pics" : "Download Pic";
  btn.onclick = () => {
    const base = picContainer.querySelector("img").src.split("?")[0];
    const urls = isThreeSixtyImage
      ? Array.from({ length: 36 }, (_, i) => {
          const parts = base.split("/");
          parts.pop();
          return `${parts.join("/")}/img${String(i + 1).padStart(2, "0")}.jpg`;
        })
      : [base];
    urls.forEach((url, i) => setTimeout(() => downloadImage(url), i * 500));
  };

  btnContainer.appendChild(btn);
  parentEl?.appendChild(btnContainer);
}

function initDownloadUi() {
  new MutationObserver(scheduleDownloadUiUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("popstate", scheduleDownloadUiUpdate);
  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function (...args) {
    const ret = push.apply(this, args);
    scheduleDownloadUiUpdate();
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = replace.apply(this, args);
    scheduleDownloadUiUpdate();
    return ret;
  };

  scheduleDownloadUiUpdate();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDownloadUi);
} else {
  initDownloadUi();
}
