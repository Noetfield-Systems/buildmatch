(function () {
  "use strict";

  const cfg = window.PUREFLOW_CONFIG || {};
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  const quoteForm = document.getElementById("quote-form");
  const formSuccess = document.getElementById("form-success");
  const formErrors = document.getElementById("form-errors");
  const formSubmit = document.getElementById("form-submit");
  const successLeadId = document.getElementById("success-lead-id");
  const scrollProgress = document.getElementById("scroll-progress");
  const promoBanner = document.getElementById("promo-banner");
  const promoDismiss = document.getElementById("promo-dismiss");
  const navLinks = document.querySelectorAll("[data-nav]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SECTION_IDS = ["services", "pricing", "report", "area", "faq"];
  const QUOTE_API = cfg.quoteApi || "/api/quote";

  function getChromeOffset() {
    let h = header ? header.offsetHeight : 80;
    if (promoBanner && !document.body.classList.contains("promo-hidden")) {
      h += promoBanner.offsetHeight || 0;
    }
    return h + 16;
  }

  function tForm(key, vars) {
    const dict = (window.PUREFLOW_I18N && window.PUREFLOW_I18N.dict) || {};
    const form = dict.form || {};
    let msg = form[key] || "";
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        msg = msg.replace("{" + k + "}", vars[k]);
      });
    }
    return msg;
  }

  // Wire contact info from config
  function wireContact() {
    const phone = cfg.phone || "(604) 555-0123";
    const phoneTel = cfg.phoneTel || "+16045550123";
    const email = cfg.email || "hello@pureflow.sourcea.app";

    document.querySelectorAll("[data-pf-phone]").forEach(function (el) {
      el.textContent = phone;
    });
    document.querySelectorAll("[data-pf-phone-link]").forEach(function (el) {
      el.href = "tel:" + phoneTel;
      if (!el.querySelector("[data-pf-phone]")) {
        const isCallOnly = el.classList.contains("mobile-cta-call");
        el.childNodes.forEach(function (n) {
          if (n.nodeType === 3 && n.textContent.trim() === "Call") return;
        });
        if (isCallOnly) {
          /* keep Call label */
        } else if (el.classList.contains("phone-link")) {
          el.textContent = phone;
        }
      }
    });
    document.querySelectorAll("[data-pf-email-link]").forEach(function (el) {
      el.href = "mailto:" + email;
      el.textContent = email;
    });
    const founding = document.querySelector("[data-pf-founding]");
    if (founding && cfg.foundingSpotsLeft) {
      founding.textContent = "Founding spots left";
      const stat = founding.previousElementSibling;
      if (stat) stat.textContent = String(cfg.foundingSpotsLeft);
    }
  }
  wireContact();

  // Promo banner persistence
  if (promoDismiss && promoBanner) {
    if (localStorage.getItem("pureflow_promo_dismissed") === "1") {
      document.body.classList.add("promo-hidden");
    }
    promoDismiss.addEventListener("click", function () {
      document.body.classList.add("promo-hidden");
      localStorage.setItem("pureflow_promo_dismissed", "1");
    });
  }

  function onScroll() {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;

    if (scrollProgress) scrollProgress.style.width = pct + "%";
    if (header) {
      header.classList.toggle("scrolled", scrollY > 24);
      header.classList.toggle("header-compact", scrollY > 80);
    }

    let current = "";
    const offset = getChromeOffset();
    SECTION_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= offset) current = id;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-nav") === current);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (navToggle && mobileNav) {
    let focusTrapHandler = null;

    function openMobileNav() {
      navToggle.setAttribute("aria-expanded", "true");
      mobileNav.hidden = false;
      navToggle.classList.add("is-open");
      document.body.classList.add("nav-open");
      document.body.style.overflow = "hidden";
      const firstLink = mobileNav.querySelector("a, button");
      if (firstLink) firstLink.focus();

      focusTrapHandler = function (e) {
        if (e.key !== "Tab" || mobileNav.hidden) return;
        const focusable = mobileNav.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", focusTrapHandler);
    }

    function closeMobileNav() {
      navToggle.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
      navToggle.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      document.body.style.overflow = "";
      if (focusTrapHandler) {
        document.removeEventListener("keydown", focusTrapHandler);
        focusTrapHandler = null;
      }
      navToggle.focus();
    }

    navToggle.addEventListener("click", function () {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeMobileNav();
      else openMobileNav();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        closeMobileNav();
      }
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const id = this.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }
    });
  });

  function showFormError(message) {
    if (!formErrors) return;
    formErrors.textContent = message;
    formErrors.hidden = false;
  }

  function clearFormErrors() {
    if (!formErrors) return;
    formErrors.hidden = true;
    formErrors.textContent = "";
    quoteForm.querySelectorAll(".error").forEach(function (el) {
      el.classList.remove("error");
    });
  }

  function setLoading(loading) {
    if (!formSubmit) return;
    formSubmit.disabled = loading;
    formSubmit.classList.toggle("is-loading", loading);
    const loadingEl = formSubmit.querySelector(".btn-loading");
    if (loadingEl) loadingEl.hidden = !loading;
  }

  function validateForm() {
    clearFormErrors();
    const required = quoteForm.querySelectorAll("[required]");
    let valid = true;
    const messages = [];

    required.forEach(function (field) {
      if (!field.value.trim()) {
        field.classList.add("error");
        valid = false;
        const label = field.closest(".form-row")?.querySelector("label");
        const name = label ? label.textContent.replace("*", "").trim() : "Field";
        messages.push(tForm("errorRequired", { field: name }) || name + " is required.");
      }
      if (field.type === "email" && field.value.trim()) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(field.value.trim())) {
          field.classList.add("error");
          valid = false;
          messages.push(tForm("errorEmail") || "Please enter a valid email address.");
        }
      }
      if (field.type === "tel" && field.value.trim()) {
        const digits = field.value.replace(/\D/g, "");
        if (digits.length < 10) {
          field.classList.add("error");
          valid = false;
          messages.push(tForm("errorPhone") || "Please enter a valid phone number.");
        }
      }
    });

    if (!valid) {
      showFormError(messages[0] || tForm("errorGeneric") || "Please complete all required fields.");
      const firstError = quoteForm.querySelector(".error");
      if (firstError) firstError.focus();
    }
    return valid;
  }

  async function submitToApi(data) {
    const res = await fetch(QUOTE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await res.json().catch(function () {
      return { ok: false, error: "bad_response" };
    });
    return { ok: res.ok && payload.ok, status: res.status, payload };
  }

  function storeLeadLocally(data, leadId) {
    try {
      const leads = JSON.parse(localStorage.getItem("pureflow_leads") || "[]");
      leads.push({ ...data, leadId, submittedAt: new Date().toISOString() });
      localStorage.setItem("pureflow_leads", JSON.stringify(leads));
    } catch (_) {
      /* ignore */
    }
  }

  if (quoteForm) {
    quoteForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validateForm()) return;

      const data = Object.fromEntries(new FormData(quoteForm).entries());
      const i18n = window.PUREFLOW_I18N || {};
      data.locale = i18n.locale || (window.PUREFLOW_CONFIG && window.PUREFLOW_CONFIG.locale) || "en";
      setLoading(true);
      clearFormErrors();

      try {
        const result = await submitToApi(data);

        if (!result.ok) {
          const msg =
            result.payload?.messages?.[0] ||
            result.payload?.error ||
            tForm("errorSubmit") ||
            "Something went wrong. Please call us directly.";
          showFormError(typeof msg === "string" ? msg : tForm("errorSubmit") || "Submission failed. Please try calling us.");
          setLoading(false);
          return;
        }

        const leadId = result.payload.leadId || "";
        storeLeadLocally(data, leadId);
        quoteForm.hidden = true;
        formSuccess.hidden = false;
        if (successLeadId && leadId) successLeadId.textContent = leadId;
        formSuccess.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      } catch (_) {
        showFormError(
          tForm("errorNetwork", { phone: cfg.phone || "our office" }) ||
            "Network error. Please try again or call us at " + (cfg.phone || "our office") + "."
        );
      } finally {
        setLoading(false);
      }
    });

    quoteForm.querySelectorAll("input, select, textarea").forEach(function (field) {
      field.addEventListener("input", function () {
        field.classList.remove("error");
        if (formErrors && !formErrors.hidden) {
          const anyError = quoteForm.querySelector(".error");
          if (!anyError) formErrors.hidden = true;
        }
      });
    });
  }

  function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const interest = params.get("interest");
    const property = params.get("property");
    const interestEl = document.getElementById("interest");
    const propertyEl = document.getElementById("property");
    if (interest && interestEl) interestEl.value = interest;
    if (property && propertyEl) propertyEl.value = property;
    if (params.get("book") === "1" || params.get("quote") === "1") {
      const book = document.getElementById("book");
      if (book) book.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    }
  }
  applyQueryParams();

  const observerTargets = document.querySelectorAll(
    ".feature-card, .service-card, .pricing-card, .review-card, .steps-list li, .faq-item, .perk, .stat"
  );

  if ("IntersectionObserver" in window && !reducedMotion) {
    observerTargets.forEach(function (el) {
      el.classList.add("reveal-ready");
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );

    observerTargets.forEach(function (el) {
      observer.observe(el);
    });
  }

  const mobileCta = document.getElementById("mobile-cta-bar");
  const bookSection = document.getElementById("book");
  if (mobileCta && bookSection && "IntersectionObserver" in window) {
    const ctaObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          mobileCta.style.transform = entry.isIntersecting ? "translateY(100%)" : "translateY(0)";
        });
      },
      { threshold: 0.3 }
    );
    ctaObserver.observe(bookSection);
    mobileCta.style.transition = "transform 0.3s ease";
  }
})();
