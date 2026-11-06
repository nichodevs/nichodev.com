"use strict";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/pwa-worker.js").catch(error => {
    console.warn("Nichodev service worker registration failed", error);
  });
}

if (navigator.standalone) document.querySelector(".pwa-install").hidden = true;
