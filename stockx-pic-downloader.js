// ==UserScript==
// @name         stockx-pic-downloader
// @namespace    http://tampermonkey.net/
// @version      2026-04-08.3
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
    state.debounceId = win.setTimeout(() => updateDownloadUi(win, doc), 120);
  }

  function updateDownloadUi(win, doc) {
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

    const btnContainer = doc.createElement("div");
    btnContainer.id = DOWNLOADER_UI_ID;
    btnContainer.dataset.boundKey = boundKey;
    btnContainer.classList.add(...picContainer.classList);

    const btn = doc.createElement("button");
    btn.id = "download-pic";
    btn.classList.add(...styleAnchor.classList, ...picLeadEl.classList);
    btn.textContent = pack.isThreeSixty ? "Download Pics" : "Download Pic";
    btn.onclick = () => {
      const p = StockxPicCore.getStockxProductImageUrls(doc);
      if (p) StockxPicCore.staggerDownloadImages(p.urls, doc);
    };

    btnContainer.appendChild(btn);
    parentEl?.appendChild(btnContainer);
  }

  function startTampermonkeyUi(win) {
    const doc = win.document;
    const hist = win.history;
    const state = { debounceId: 0 };

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
