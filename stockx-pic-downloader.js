// ==UserScript==
// @name         stockx-pic-downloader
// @namespace    http://tampermonkey.net/
// @version      2026-10-15.1
// @description  stockx-pic-downloader
// @author       https://github.com/Wiiiiill
// @match        https://stockx.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stockx.com
// @grant        none
// @run-at      document-end
// @require      https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-core.js
// @homepageURL  https://github.com/Wiiiiill/stockx-pic-downloader
// @supportURL   https://github.com/Wiiiiill/stockx-pic-downloader/issues
// @downloadURL  https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-downloader.js
// @updateURL    https://raw.githubusercontent.com/Wiiiiill/stockx-pic-downloader/main/stockx-pic-downloader.js
// ==/UserScript==

(function () {
  "use strict";

  const DOWNLOADER_UI_ID = "stockx-pic-downloader-root";

  function scheduleDownloadUiUpdate(win, doc, state) {
    win.clearTimeout(state.debounceId);
    state.debounceId = win.setTimeout(() => updateDownloadUi(win, doc, state), 120);
  }

  /** @param {{ isThreeSixty: boolean }} pack */
  function idleLabel(pack) {
    return pack.isThreeSixty ? "Download Pics" : "Download Pic";
  }

  /**
   * 触发一批下载，并在按钮上实时显示进度与落地尺寸，下完把结果留在按钮上。
   *
   * 「偏小」把所有没到 {@link StockxPicCore.MAX_SOURCE_WIDTH} 的都算上：
   * 源图确实偏小、和剥离 query 那步被改坏（会固定掉到 1536），
   * 光看宽度分不出来，但都属于使用者该知道的情况，靠按钮上显示的具体数字区分。
   *
   * @param {Document} doc
   * @param {HTMLButtonElement} btn
   * @param {{ urls: string[], isThreeSixty: boolean }} pack
   * @param {{ downloading: boolean }} state
   */
  function startDownload(doc, btn, pack, state) {
    if (state.downloading) return;
    state.downloading = true;

    const total = pack.urls.length;
    let sizeLabel = "";
    let small = 0;

    btn.disabled = true;
    btn.textContent = `下载中 0/${total}`;

    StockxPicCore.staggerDownloadImages(pack.urls, doc, undefined, {
      onProgress: ({ finished, result }) => {
        btn.textContent = `下载中 ${finished}/${total}`;
        if (!result) return;
        if (!sizeLabel) sizeLabel = `${result.width}×${result.height}`;
        if (StockxPicCore.assessImageQuality(result.width) !== "max") {
          small += 1;
        }
      },
      onDone: ({ total: done, failed }) => {
        state.downloading = false;
        btn.disabled = false;
        const ok = done - failed - small;
        const bad = failed + small;
        btn.textContent =
          bad === 0
            ? `已存 ${ok} 张 · ${sizeLabel}`
            : `已存 ${ok} 张 · ${bad} 张偏小 ⚠️`;
      },
    });
  }

  function updateDownloadUi(win, doc, state) {
    const pack = StockxPicCore.getStockxProductImageUrls(doc);
    const buyContainer = doc.querySelector('[data-testid="BuyContainer"]');
    const buyAnchors = buyContainer?.querySelectorAll("a");
    const styleAnchor = buyAnchors?.[buyAnchors.length - 1];
    const picContainer = pack?.picContainer;
    const picLeadEl = picContainer?.firstElementChild;

    if (!pack || !buyContainer || !styleAnchor || !picLeadEl) {
      doc.getElementById(DOWNLOADER_UI_ID)?.remove();
      return;
    }

    const boundKey = `${win.location.href}\0${pack.mainImageSrc}`;
    const parentEl = picContainer.parentElement;
    const existing = doc.getElementById(DOWNLOADER_UI_ID);
    if (
      existing &&
      existing.dataset.boundKey === boundKey &&
      existing.isConnected &&
      existing.parentElement === parentEl
    ) {
      return;
    }

    existing?.remove();
    // 换商品会重建按钮，上一批的责任随之结束
    state.downloading = false;

    const btnContainer = doc.createElement("div");
    btnContainer.id = DOWNLOADER_UI_ID;
    btnContainer.dataset.boundKey = boundKey;
    btnContainer.classList.add(...picContainer.classList);

    const btn = doc.createElement("button");
    btn.id = "download-pic";
    btn.classList.add(...styleAnchor.classList, ...picLeadEl.classList);
    btn.textContent = idleLabel(pack);
    btn.onclick = () => {
      const current = StockxPicCore.getStockxProductImageUrls(doc);
      if (current) startDownload(doc, btn, current, state);
    };

    btnContainer.appendChild(btn);
    parentEl?.appendChild(btnContainer);
  }

  function startTampermonkeyUi(win) {
    const doc = win.document;
    const hist = win.history;
    const state = { debounceId: 0, downloading: false };

    const run = () => scheduleDownloadUiUpdate(win, doc, state);
    const observer = new win.MutationObserver(run);
    observer.observe(doc.documentElement, { childList: true, subtree: true });

    win.addEventListener("popstate", run);
    const origPush = hist.pushState;
    const origReplace = hist.replaceState;
    hist.pushState = function (...args) {
      const ret = origPush.apply(hist, args);
      run();
      return ret;
    };
    hist.replaceState = function (...args) {
      const ret = origReplace.apply(hist, args);
      run();
      return ret;
    };

    run();

    return function stopTampermonkeyUi() {
      win.clearTimeout(state.debounceId);
      observer.disconnect();
      win.removeEventListener("popstate", run);
      hist.pushState = origPush;
      hist.replaceState = origReplace;
      doc.getElementById(DOWNLOADER_UI_ID)?.remove();
    };
  }

  function boot() {
    startTampermonkeyUi(window);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
