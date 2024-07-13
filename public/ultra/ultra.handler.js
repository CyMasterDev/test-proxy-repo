"use strict";

(() => {
  // Ensure required variables are present
  const { Ultraviolet, UVClient, __uv$config, __uv$bareData, __uv$bareURL, __uv$cookies } = self;

  if (!Ultraviolet || !UVClient || !__uv$config || !__uv$bareData || !__uv$bareURL || !__uv$cookies) {
    throw new TypeError("Unable to load global UV data");
  }

  // Initialize Ultraviolet and its hook
  if (!self.__uv) {
    initializeUltraviolet(self);
  }

  self.__uvHook = initializeUltraviolet;

  function initializeUltraviolet(context) {
    if ("__uv" in context && context.__uv instanceof Ultraviolet) {
      return false;
    }

    removeExistingScripts(context);

    const isWorkerContext = !context.window;
    const uvInstance = new Ultraviolet(__uv$config);
    const bareClient = new Ultraviolet.BareClient(__uv$bareURL, __uv$bareData);
    const uvClient = new UVClient(context, bareClient, isWorkerContext);

    defineUltravioletProperties(context, uvInstance, uvClient);
    setupEventListeners(context, uvInstance, uvClient, __uv$cookies);
  }

  function removeExistingScripts(context) {
    if (context.document) {
      const scripts = context.document.querySelectorAll("script[__uv-script]");
      scripts.forEach(script => script.remove());
    }
  }

  function defineUltravioletProperties(context, uvInstance, uvClient) {
    Object.defineProperty(context, "__uv", {
      value: uvInstance,
      enumerable: false,
    });

    uvInstance.meta.origin = location.origin;
    uvInstance.location = uvClient.location.emulate(
      url => (url === "about:srcdoc" ? new URL(url) : new URL(uvInstance.sourceUrl(url))),
      url => uvInstance.rewriteUrl(url)
    );
  }

  function setupEventListeners(context, uvInstance, uvClient, cookies) {
    const storagePrefix = "__uv$";

    uvInstance.meta.url = uvInstance.location;
    uvInstance.domain = uvInstance.meta.url.host;
    uvInstance.blobUrls = new Map();
    uvInstance.referrer = "";
    uvInstance.cookies = [];
    uvInstance.localStorageObj = {};
    uvInstance.sessionStorageObj = {};
    uvInstance.location.href = "about:srcdoc" ? uvInstance.meta = context.parent.__uv.meta : null;

    if (context.EventTarget) {
      uvInstance.addEventListener = context.EventTarget.prototype.addEventListener;
      uvInstance.removeListener = context.EventTarget.prototype.removeListener;
      uvInstance.dispatchEvent = context.EventTarget.prototype.dispatchEvent;
    }

    setupStorage(context, uvClient, uvInstance, storagePrefix);
    setupElementHooks(context, uvClient, uvInstance, cookies, storagePrefix);
    setupNetworkHooks(context, uvClient, uvInstance, cookies);
    setupDocumentHooks(context, uvClient, uvInstance, storagePrefix);
    setupWebSocketHooks(context, uvClient, uvInstance, cookies);
    setupMiscellaneousHooks(context, uvClient, uvInstance, cookies);
  }

  function setupStorage(context, uvClient, uvInstance, storagePrefix) {
    const storageHandler = {
      get: (target, prop) => {
        if (target === uvClient.storage.sessionStorage) return uvInstance.sessionStorageObj;
        if (target === uvClient.storage.localStorage) return uvInstance.localStorageObj;
        return undefined;
      },
      enumerable: false
    };

    Object.defineProperty(uvClient.storage.storeProto, "__uv$storageObj", storageHandler);

    if (context.localStorage) {
      for (const key in context.localStorage) {
        if (key.startsWith(storagePrefix + uvInstance.location.origin + "@")) {
          uvInstance.localStorageObj[key.slice((storagePrefix + uvInstance.location.origin + "@").length)] = context.localStorage.getItem(key);
        }
      }
      uvInstance.lsWrap = uvClient.storage.emulate(uvClient.storage.localStorage, uvInstance.localStorageObj);
    }

    if (context.sessionStorage) {
      for (const key in context.sessionStorage) {
        if (key.startsWith(storagePrefix + uvInstance.location.origin + "@")) {
          uvInstance.sessionStorageObj[key.slice((storagePrefix + uvInstance.location.origin + "@").length)] = context.sessionStorage.getItem(key);
        }
      }
      uvInstance.ssWrap = uvClient.storage.emulate(uvClient.storage.sessionStorage, uvInstance.sessionStorageObj);
    }
  }

  function setupElementHooks(context, uvClient, uvInstance, cookies, storagePrefix) {
    const elements = [
      "HTMLMediaElement", "HTMLScriptElement", "HTMLAudioElement", "HTMLVideoElement", "HTMLInputElement",
      "HTMLEmbedElement", "HTMLTrackElement", "HTMLAnchorElement", "HTMLIFrameElement", "HTMLAreaElement",
      "HTMLLinkElement", "HTMLBaseElement", "HTMLFormElement", "HTMLImageElement", "HTMLSourceElement"
    ];

    elements.forEach(element => {
      if (context[element]) {
        uvClient.nativeMethods.defineProperty(context, element, {
          value: context[element],
          enumerable: false
        });
      }
    });

    uvClient.fetch.on("request", data => data.input = uvInstance.rewriteUrl(data.input));
    uvClient.fetch.on("requestUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.fetch.on("responseUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.xhr.on("open", data => data.input = uvInstance.rewriteUrl(data.input));
    uvClient.xhr.on("responseUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.workers.on("worker", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.workers.on("addModule", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.workers.on("importScripts", data => {
      for (const script in data.scripts) {
        data.scripts[script] = uvInstance.rewriteUrl(data.scripts[script]);
      }
    });
    uvClient.workers.on("postMessage", data => {
      const origin = data.origin;
      data.origin = "*";
      data.message = { __data: data.message, __origin: uvInstance.meta.url.origin, __to: origin };
    });
    uvClient.navigator.on("sendBeacon", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.document.on("getCookie", data => data.value = cookies);
    uvClient.document.on("setCookie", data => handleSetCookie(data, uvInstance, cookies));
    uvClient.element.on("setInnerHTML", data => handleSetInnerHTML(data, uvInstance));
    uvClient.element.on("getInnerHTML", data => handleGetInnerHTML(data, uvInstance));
    uvClient.element.on("setOuterHTML", data => data.value = uvInstance.rewriteHtml(data.value, { document: data.that.tagName === "HTML" }));
    uvClient.element.on("getOuterHTML", data => handleGetOuterHTML(data, uvInstance));
    uvClient.document.on("write", data => data.html.length && (data.html = [uvInstance.rewriteHtml(data.html.join(""))]));
    uvClient.document.on("writeln", data => data.html.length && (data.html = [uvInstance.rewriteHtml(data.html.join(""))]));
    uvClient.element.on("insertAdjacentHTML", data => data.html = uvInstance.rewriteHtml(data.html));
    uvClient.eventSource.on("construct", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.eventSource.on("url", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.idb.on("idbFactoryOpen", data => data.name !== "__op" && (data.name = `${uvInstance.meta.url.origin}@${data.name}`));
    uvClient.idb.on("idbFactoryName", data => data.value = data.value.slice(uvInstance.meta.url.origin.length + 1));
    uvClient.history.on("replaceState", data => handleHistoryState(data, uvInstance));
    uvClient.history.on("pushState", data => handleHistoryState(data, uvInstance));
    uvClient.element.on("getAttribute", data => handleGetAttribute(data, uvClient, uvInstance));
    uvClient.message.on("postMessage", data => handleMessagePost(data, uvClient, uvInstance));
    uvClient.message.on("data", data => handleMessageData(data, uvClient));
    uvClient.message.on("origin", data => handleMessageOrigin(data, uvClient));
    uvClient.overrideDescriptor(context, "origin", { get: () => uvInstance.location.origin });
    uvClient.node.on("baseURI", data => data.value.startsWith(context.location.origin) && (data.value = uvInstance.sourceUrl(data.value)));
    uvClient.element.on("setAttribute", data => handleSetAttribute(data, uvInstance));
    uvClient.element.on("audio", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.element.hookProperty([context.HTMLAnchorElement, context.HTMLAreaElement, context.HTMLLinkElement, context.HTMLBaseElement], "href", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "href", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty(context.HTMLFormElement, "action", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "action", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty(context.HTMLIFrameElement, "src", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "src", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty([context.HTMLImageElement, context.HTMLScriptElement, context.HTMLMediaElement, context.HTMLSourceElement], "src", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "src", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty(context.HTMLInputElement, "formAction", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "formaction", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty(context.HTMLTrackElement, "src", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "src", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty(context.HTMLInputElement, "src", {
      get: (target, prop) => uvInstance.sourceUrl(target.call(prop)),
      set: (target, prop, [value]) => {
        uvClient.element.setAttribute.call(this, "src", uvInstance.rewriteUrl(value));
        return value;
      }
    });
    uvClient.element.hookProperty([context.HTMLScriptElement, context.HTMLLinkElement, context.HTMLIFrameElement], "integrity", {
      value: null
    });
    uvClient.element.hookProperty([context.HTMLLinkElement, context.HTMLScriptElement], "nonce", {
      value: null
    });
  }

  function handleSetCookie(data, uvInstance, cookies) {
    if (!data.value.includes("path=")) {
      data.value += ";path=/";
    }
    data.value = data.value
      .split(";")
      .filter(cookie => !cookie.trim().startsWith("domain"))
      .join(";");
    cookies = uvInstance.cookie(data.value);
  }

  function handleSetInnerHTML(data, uvInstance) {
    data.value = uvInstance.rewriteHtml(data.value, { document: data.that.tagName === "HTML" });
  }

  function handleGetInnerHTML(data, uvInstance) {
    if (data.that.tagName === "HTML") {
      const documentElement = data.that.querySelector("html");
      if (documentElement) {
        data.value = uvInstance.sourceHtml(data.value);
      }
    } else {
      data.value = uvInstance.sourceHtml(data.value);
    }
  }

  function handleGetOuterHTML(data, uvInstance) {
    if (data.that.tagName === "HTML") {
      const documentElement = data.that.querySelector("html");
      if (documentElement) {
        data.value = uvInstance.sourceHtml(data.value);
      }
    } else {
      data.value = uvInstance.sourceHtml(data.value);
    }
  }

  function handleHistoryState(data, uvInstance) {
    if (typeof data.input[2] === "string") {
      data.input[2] = uvInstance.rewriteUrl(data.input[2]);
    }
  }

  function handleGetAttribute(data, uvClient, uvInstance) {
    const attributeName = data.attribute;
    if (["src", "href", "action", "formaction"].includes(attributeName)) {
      data.value = uvInstance.sourceUrl(data.value);
    }
  }

  function handleMessagePost(data, uvClient, uvInstance) {
    if (data.origin !== "*" && data.origin !== uvClient.location.origin) {
      return;
    }
    data.origin = "*";
    data.message = {
      __data: data.message,
      __origin: uvInstance.meta.url.origin,
      __to: data.origin,
    };
  }

  function handleMessageData(data, uvClient) {
    if (data.message && "__data" in data.message && "__origin" in data.message) {
      const origin = data.message.__origin;
      const target = data.message.__to;
      if (target !== "*" && target !== uvClient.location.origin) {
        return;
      }
      data.message = data.message.__data;
      data.origin = origin;
    }
  }

  function handleMessageOrigin(data, uvClient) {
    if (data.origin === uvClient.location.origin) {
      data.origin = uvInstance.meta.url.origin;
    }
  }

  function handleSetAttribute(data, uvInstance) {
    if (["src", "href", "action", "formaction"].includes(data.attribute)) {
      data.value = uvInstance.rewriteUrl(data.value);
    }
  }

  function setupNetworkHooks(context, uvClient, uvInstance, cookies) {
    uvClient.fetch.on("request", data => data.input = uvInstance.rewriteUrl(data.input));
    uvClient.fetch.on("requestUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.fetch.on("responseUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.xhr.on("open", data => data.input = uvInstance.rewriteUrl(data.input));
    uvClient.xhr.on("responseUrl", data => data.value = uvInstance.sourceUrl(data.value));
    uvClient.navigator.on("sendBeacon", data => data.url = uvInstance.rewriteUrl(data.url));
  }

  function setupDocumentHooks(context, uvClient, uvInstance, storagePrefix) {
    uvClient.document.on("getCookie", data => data.value = uvInstance.cookies);
    uvClient.document.on("setCookie", data => handleSetCookie(data, uvInstance, uvInstance.cookies));
    uvClient.document.on("write", data => data.html.length && (data.html = [uvInstance.rewriteHtml(data.html.join(""))]));
    uvClient.document.on("writeln", data => data.html.length && (data.html = [uvInstance.rewriteHtml(data.html.join(""))]));
  }

  function setupWebSocketHooks(context, uvClient, uvInstance, cookies) {
    uvClient.webSocket.on("construct", data => data.url = uvInstance.rewriteUrl(data.url));
    uvClient.webSocket.on("url", data => data.url = uvInstance.rewriteUrl(data.url));
  }

  function setupMiscellaneousHooks(context, uvClient, uvInstance, cookies) {
    uvClient.overrideDescriptor(context, "origin", { get: () => uvInstance.location.origin });
    uvClient.node.on("baseURI", data => data.value.startsWith(context.location.origin) && (data.value = uvInstance.sourceUrl(data.value)));
  }
})();
