/* ============================================================
   home.js — главная: вкладки «Как подключиться» (выбор устройства)
   и плавное появление блоков при прокрутке.
   ============================================================ */

(function () {
  /* Определяем платформу посетителя, чтобы сразу открыть нужную вкладку.
     iPadOS прикидывается macOS, поэтому смотрим ещё и на тач. */
  function detectOs() {
    var ua = navigator.userAgent || "";
    if (/Android TV|AFT|SMART-TV|SmartTV|BRAVIA|GoogleTV/i.test(ua)) return "tv";
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Macintosh/i.test(ua)) return navigator.maxTouchPoints > 1 ? "ios" : "macos";
    if (/Windows/i.test(ua)) return "windows";
    if (/Linux|X11/i.test(ua)) return "linux";
    return null;
  }

  function initOsTabs() {
    var list = document.querySelector(".os-tabs");
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll(".os-tab"));

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    list.addEventListener("click", function (e) {
      var tab = e.target.closest(".os-tab");
      if (tab) select(tab, false);
    });

    list.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        select(next, true);
      }
    });

    var os = detectOs();
    var detected = os && list.querySelector('[data-os="' + os + '"]');
    if (detected) select(detected, false);
  }

  /* Появление при прокрутке. Класс на <html> ставим только когда
     IntersectionObserver доступен — без JS блоки просто видны сразу. */
  function initReveal() {
    var items = document.querySelectorAll(".reveal-up");
    if (!items.length || !("IntersectionObserver" in window)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initOsTabs();
    initReveal();
  });
})();
