/**
 * Pure Flow i18n — path-based locales: /en/ /fr/ /fa/ /zh/
 */
(function () {
  "use strict";

  var LOCALES = ["en", "fr", "fa", "zh"];
  var DEFAULT = "en";
  var SITE_ORIGINS = ["https://pureflow-pool.pages.dev", "https://pureflow.sourcea.app"];

  function siteOrigin() {
    var cfg = window.PUREFLOW_CONFIG || {};
    return (cfg.siteUrl || window.location.origin).replace(/\/$/, "").replace(/\/(en|fr|fa|zh)\/?$/, "");
  }

  function getLocaleFromPath() {
    var seg = (window.location.pathname || "").split("/").filter(Boolean)[0];
    return LOCALES.indexOf(seg) !== -1 ? seg : DEFAULT;
  }

  function get(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o && o[k] !== undefined ? o[k] : null;
    }, obj);
  }

  function localePath(code) {
    return "/" + code + "/";
  }

  function applyStrings(dict) {
    if (!dict) return;

    document.documentElement.lang = dict.htmlLang || dict.code || "en-CA";
    document.documentElement.dir = dict.dir || "ltr";
    document.body.classList.toggle("is-rtl", dict.dir === "rtl");

    var title = get(dict, "meta.title");
    var desc = get(dict, "meta.description");
    if (title) document.title = title;
    if (desc) {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", desc);
    }

    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogTitle && get(dict, "meta.ogTitle")) ogTitle.setAttribute("content", get(dict, "meta.ogTitle"));
    if (ogDesc && get(dict, "meta.ogDescription")) ogDesc.setAttribute("content", get(dict, "meta.ogDescription"));
    if (ogLocale && dict.ogLocale) ogLocale.setAttribute("content", dict.ogLocale);

    var canonical = document.querySelector('link[rel="canonical"]');
    var origin = siteOrigin();
    var path = localePath(dict.code || DEFAULT);
    if (canonical) canonical.setAttribute("href", origin + path);

    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", origin + path);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var val = get(dict, el.getAttribute("data-i18n"));
      if (val != null) el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var val = get(dict, el.getAttribute("data-i18n-html"));
      if (val != null) el.innerHTML = val;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var val = get(dict, el.getAttribute("data-i18n-placeholder"));
      if (val != null) el.setAttribute("placeholder", val);
    });

    document.querySelectorAll("select[data-i18n-options]").forEach(function (select) {
      var prefix = select.getAttribute("data-i18n-options");
      select.querySelectorAll("option").forEach(function (opt) {
        var key = opt.getAttribute("data-i18n-opt");
        if (!key) return;
        var val = get(dict, prefix + "." + key);
        if (val != null) opt.textContent = val;
      });
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-attr");
      var attr = el.getAttribute("data-i18n-attr-target") || "aria-label";
      var val = get(dict, key);
      if (val != null) el.setAttribute(attr, val);
    });

    buildLangSwitcher(dict);
    window.PUREFLOW_I18N = { locale: dict.code, dict: dict };
    document.dispatchEvent(new CustomEvent("pureflow:locale", { detail: dict }));
  }

  function buildLangSwitcher(dict) {
    var current = dict.code || DEFAULT;
    var origin = siteOrigin();

    function fillSwitcher(wrap) {
      if (!wrap) return;
      wrap.innerHTML = "";
      var label = document.createElement("span");
      label.className = "lang-switcher-label";
      label.textContent = get(dict, "langSwitcher.label") || "Language";
      wrap.appendChild(label);
      var list = document.createElement("div");
      list.className = "lang-switcher-list";
      LOCALES.forEach(function (code) {
        var a = document.createElement("a");
        a.href = origin + localePath(code);
        a.textContent = ({ en: "EN", fr: "FR", fa: "FA", zh: "中文" })[code] || code.toUpperCase();
        a.lang = code;
        a.className = "lang-switcher-link" + (code === current ? " is-active" : "");
        if (code === current) a.setAttribute("aria-current", "page");
        list.appendChild(a);
      });
      wrap.appendChild(list);
    }

    fillSwitcher(document.getElementById("lang-switcher"));
    fillSwitcher(document.getElementById("lang-switcher-mobile"));
  }

  function loadLocale(code) {
    return fetch("/locales/" + code + ".json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("locale_load_failed");
        return r.json();
      });
  }

  function init() {
    var code = getLocaleFromPath();
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.location.replace(siteOrigin() + localePath(DEFAULT));
      return;
    }
    loadLocale(code)
      .catch(function () {
        return loadLocale(DEFAULT);
      })
      .then(applyStrings)
      .catch(function () {
        /* English HTML fallback remains */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
