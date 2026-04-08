// ==UserScript==
// @name         stockx-pic-downloader
// @namespace    http://tampermonkey.net/
// @version      2026-04-08
// @description  stockx-pic-downloader
// @author       https://github.com/Wiiiiill
// @match        https://stockx.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stockx.com
// @grant        none
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

window.onload = () => {
  const picContainer = document.querySelector('[data-component="SingleImage"]');
  const isThreeSixtyImage = !!picContainer.querySelector("#three-sixty-image");

  const btnContainer = document.createElement("div");
  btnContainer.classList.add(picContainer.classList.value);
  const btn = document.createElement("button");
  btn.id = "download-pic";
  btn.classList.add(
    ...Array.from(
      document
        .querySelector(`[data-testid="BuyContainer"`)
        .querySelectorAll("a"),
    )
      .pop()
      .classList.value.split(" "),
    picContainer.firstChild.classList.value,
  );
  btn.textContent = `Download ${isThreeSixtyImage ? "Pics" : "Pic"}`;
  btn.onclick = () => {
    let urls = [];
    const t = picContainer.querySelector("img").src.split("?")[0];
    if (isThreeSixtyImage) {
      let tt = t.split("/");
      tt.pop();
      tt = tt.join("/");
      for (let i = 1; i <= 36; i++) {
        urls.push(`${tt}/img${("0" + i).slice(-2)}.jpg`);
      }
    } else {
      urls.push(t);
    }
    for (let i = 0; i < urls.length; i++)
      setTimeout(() => downloadImage(urls[i]), i * 500);
  };
  btnContainer.appendChild(btn);
  picContainer.parentElement.appendChild(btnContainer);
};
