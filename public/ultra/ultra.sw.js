importScripts('/ultra/ultra.bundle.js');
importScripts('/ultra/ultra.config.js');

"use strict"; (() => {
  var p = self.Ultraviolet,
    w = [
      "cross-origin-embedder-policy",
      "cross-origin-opener-policy",
      "cross-origin-resource-policy",
      "content-security-policy",
      "content-security-policy-report-only",
      "expect-ct",
      "feature-policy",
      "origin-isolation",
      "strict-transport-security",
      "upgrade-insecure-requests",
      "x-content-type-options",
      "x-download-options",
      "x-frame-options",
      "x-permitted-cross-domain-policies",
      "x-powered-by",
      "x-xss-protection"
    ],
    S = ["GET", "HEAD"],
    b = class extends p.EventEmitter {
      constructor(t = __uv$config) {
        super();
        t.bare || (t.bare = "/bare/");
        t.prefix || (t.prefix = "/service/");
        this.config = t;
        let i = (Array.isArray(t.bare) ? t.bare : [t.bare]).map(e => new URL(e, location).toString());
        this.address = i[~~(Math.random() * i.length)];
        this.bareClient = new p.BareClient(this.address);
      }

      async fetch({ request: t }) {
        let i;
        try {
          // Directly fetch if not starting with UV prefix
          if (!t.url.startsWith(location.origin + this.config.prefix)) return await fetch(t);

          // Initialize UV instance and cookie database
          let e = new p(this.config, this.address);
          typeof this.config.construct == "function" && this.config.construct(e, "service");
          let a = await e.cookie.db();
          e.meta.origin = location.origin;
          e.meta.base = e.meta.url = new URL(e.sourceUrl(t.url));
          let r = new g(t, this, e, S.includes(t.method.toUpperCase()) ? null : await t.blob());

          // Handle blob URLs
          if (e.meta.url.protocol === "blob:") {
            r.blob = !0;
            r.base = r.url = new URL(r.url.pathname);
          }

          // Manage referrer and origin headers
          if (t.referrer && t.referrer.startsWith(location.origin)) {
            let n = new URL(e.sourceUrl(t.referrer));
            (r.headers.origin || e.meta.url.origin !== n.origin && t.mode === "cors") && (r.headers.origin = n.origin);
            r.headers.referer = n.href;
          }

          // Manage cookies
          let l = await e.cookie.getCookies(a) || [],
            c = e.cookie.serialize(l, e.meta, !1);
          r.headers["user-agent"] = navigator.userAgent;
          c && (r.headers.cookie = c);

          let f = new m(r, null, null);
          if (this.emit("request", f), f.intercepted) return f.returnValue;

          i = r.blob ? "blob:" + location.origin + r.url.pathname : r.url;

          // Fetch via Bare client
          let h = await this.bareClient.fetch(i, {
            headers: r.headers,
            method: r.method,
            body: r.body,
            credentials: r.credentials,
            mode: location.origin !== r.address.origin ? "cors" : r.mode,
            cache: r.cache,
            redirect: r.redirect
          });

          let s = new y(r, h),
            d = new m(s, null, null);

          if (this.emit("beforemod", d), d.intercepted) return d.returnValue;

          // Remove security headers
          for (let n of w) s.headers[n] && delete s.headers[n];

          // Rewrite location header
          if (s.headers.location) s.headers.location = e.rewriteUrl(s.headers.location);

          // Manage content-disposition for document
          if (t.destination === "document") {
            let n = s.headers["content-disposition"];
            if (!/\s*?((inline|attachment);\s*?)filename=/i.test(n)) {
              let u = /^\s*?attachment/i.test(n) ? "attachment" : "inline",
                [v] = new URL(h.finalURL).pathname.split("/").slice(-1);
              s.headers["content-disposition"] = `${u}; filename=${JSON.stringify(v)}`;
            }
          }

          // Set cookies and notify clients
          if (s.headers["set-cookie"]) {
            Promise.resolve(e.cookie.setCookies(s.headers["set-cookie"], a, e.meta)).then(() => {
              self.clients.matchAll().then(function(n) {
                n.forEach(function(u) {
                  u.postMessage({ msg: "updateCookies", url: e.meta.url.href });
                });
              });
            });
            delete s.headers["set-cookie"];
          }

          // Handle different content types
          if (s.body) switch (t.destination) {
            case "script":
            case "worker":
              let n = [e.bundleScript, e.clientScript, e.configScript, e.handlerScript].map(u => JSON.stringify(u)).join(",");
              s.body = `if (!self.__uv && self.importScripts) { ${e.createJsInject(this.address, this.bareClient.manifest, e.cookie.serialize(l, e.meta, !0), t.referrer)} importScripts(${n}); }
              ` + e.js.rewrite(await h.text());
              break;
            case "style":
              s.body = e.rewriteCSS(await h.text());
              break;
            case "iframe":
            case "document":
              x(e.meta.url, s.headers["content-type"] || "") && (s.body = e.rewriteHtml(await h.text(), {
                document: !0,
                injectHead: e.createHtmlInject(e.handlerScript, e.bundleScript, e.clientScript, e.configScript, this.address, this.bareClient.manifest, e.cookie.serialize(l, e.meta, !0), t.referrer)
              }));
              break;
          }

          // Manage event-stream content type
          r.headers.accept === "text/event-stream" && (s.headers["content-type"] = "text/event-stream");

          // Handle cross-origin isolation
          crossOriginIsolated && (s.headers["Cross-Origin-Embedder-Policy"] = "require-corp");

          this.emit("response", d);
          return d.intercepted ? d.returnValue : new Response(s.body, { headers: s.headers, status: s.status, statusText: s.statusText });
        } catch (e) {
          console.error('Error in service worker fetch handler:', e);
          return ["document", "iframe"].includes(t.destination) ? (console.error(e), O(e, i, this.address)) : new Response(void 0, { status: 500 });
        }
      }

      static Ultraviolet = p;
    };

  self.UVServiceWorker = b;

  // Utility classes and functions
  var y = class {
    constructor(t, i) {
      this.request = t;
      this.raw = i;
      this.ultraviolet = t.ultraviolet;
      this.headers = {};
      for (let e in i.rawHeaders) this.headers[e.toLowerCase()] = i.rawHeaders[e];
      this.status = i.status;
      this.statusText = i.statusText;
      this.body = i.body;
    }

    get url() { return this.request.url }
    get base() { return this.request.base }
    set base(t) { this.request.base = t }
  };

  var g = class {
    constructor(t, i, e, a = null) {
      this.ultraviolet = e;
      this.request = t;
      this.headers = Object.fromEntries(t.headers.entries());
      this.method = t.method;
      this.address = i.address;
      this.body = a || null;
      this.cache = t.cache;
      this.redirect = t.redirect;
      this.credentials = "omit";
      this.mode = t.mode === "cors" ? t.mode : "same-origin";
      this.blob = !1;
    }

    get url() { return this.ultraviolet.meta.url }
    set url(t) { this.ultraviolet.meta.url = t }
    get base() { return this.ultraviolet.meta.base }
    set base(t) { this.ultraviolet.meta.base = t }
  };

  function x(o, t = "") {
    return (p.mime.contentType(t || o.pathname) || "text/html").split(";")[0] === "text/html";
  }

  var m = class {
    #e;
    #t;
    constructor(t = {}, i = null, e = null) {
      this.#e = !1;
      this.#t = null;
      this.data = t;
      this.target = i;
      this.that = e;
    }

    get intercepted() { return this.#e }
    set intercepted(t) { this.#e = t }
    get returnValue() { return this.#t }
    set returnValue(t) { this.#t = t }
  };

  function O(o, t, i) {
    let e = p.html.create({ title: "500 Internal Server Error" }),
      a = JSON.stringify(o.stack || o);
    return e.body.innerHTML = `<h1>Internal Server Error</h1><hr><code>${t}</code><p>Internal Server Error has occured on <code>${i}</code></p><hr><pre>${a}</pre>`,
      new Response(e.toString(), { headers: { "content-type": "text/html" }, status: 500 });
  }

  // Listen to fetch events
  self.addEventListener("fetch", function (t) {
    t.respondWith(new self.UVServiceWorker().fetch({ event: t, request: t.request }));
  });

  // Update cookies on message
  self.addEventListener("message", function (t) {
    t.data.msg === "updateCookies" && t.waitUntil(caches.delete(t.data.url));
  });

  // Activate the service worker
  self.addEventListener("activate", function (t) {
    t.waitUntil((async () => {
      let i = await self.clients.matchAll({ includeUncontrolled: !0 });
      for (let e of i) e.postMessage({ msg: "reload" });
      await self.clients.claim();
    })());
  });

  // Install the service worker
  self.addEventListener("install", function (t) {
    self.skipWaiting();
  });

  // Handle font load errors
  self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.url.includes('.woff') || request.url.includes('.woff2') || request.url.includes('.ttf')) {
      event.respondWith(
        caches.match(request).then(response => {
          return response || fetch(request).then(fetchResponse => {
            return caches.open('font-cache').then(cache => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          }).catch(error => {
            console.error('Font load error:', error);
            return new Response('Font not found', { status: 404 });
          });
        })
      );
    }
  });

})();
