"use strict";

(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/pwa-worker.js").catch(error => {
      console.warn("Nichodev service worker registration failed", error);
    });
  }

  const installButton = document.querySelector(".pwa-install");
  const installHelp = document.querySelector(".pwa-dialog");
  const nativeInstall = installHelp.querySelector(".pwa-native");
  let invitation;

  installButton.hidden = navigator.standalone || matchMedia("(display-mode: standalone)").matches;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    invitation = event;
    nativeInstall.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    invitation = null;
    installButton.hidden = true;
    installHelp.close();
  });

  installHelp.addEventListener("close", () => {
    if (!installButton.hidden) installButton.focus();
  });

  async function requestInstall() {
    if (!invitation) {
      installHelp.showModal();
      return;
    }
    const current = invitation;
    invitation = null;
    nativeInstall.hidden = true;
    installButton.disabled = true;
    try {
      await current.prompt();
    } catch {
      installHelp.showModal();
    } finally {
      installButton.disabled = false;
    }
  }
  installButton.addEventListener("click", requestInstall);
  nativeInstall.addEventListener("click", requestInstall);

  function choosePlatform(platform) {
    for (const button of installHelp.querySelectorAll("[data-pwa-platform]")) {
      button.setAttribute("aria-pressed", String(button.dataset.pwaPlatform === platform));
    }
    for (const section of installHelp.querySelectorAll("[data-pwa-instructions]")) {
      section.hidden = section.dataset.pwaInstructions !== platform;
    }
  }

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  choosePlatform(ios ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop");
  for (const button of installHelp.querySelectorAll("[data-pwa-platform]")) {
    button.addEventListener("click", () => choosePlatform(button.dataset.pwaPlatform));
  }
})();
