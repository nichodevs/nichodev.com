"use strict";

function updateLanguageLinks() {
  for (const link of document.querySelectorAll(".site-language a")) {
    const target = new URL(link.href);
    target.hash = location.hash;
    link.href = target.href;
  }
}

updateLanguageLinks();
window.addEventListener("hashchange", updateLanguageLinks);
