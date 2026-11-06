"use strict";

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.mode !== "navigate" || request.method !== "GET" ||
      url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Private pages and API data always come from the server.
  event.respondWith(fetch(request).catch(() => {
    const english = url.pathname.startsWith("/en/");
    const message = english ? "Reconnect to use Nichodev." : "Conecte-se à internet para usar o Nichodev.";
    const retry = english ? "Try again" : "Tentar novamente";
    const home = english ? "/en/comunidade/" : "/comunidade/";
    return new Response(
      '<!doctype html><html lang="' + (english ? "en" : "pt-BR") +
      '"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Nichodev</title><h1>' + message + '</h1><p><a href="' + home + '">' + retry + '</a></p></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }));
});
