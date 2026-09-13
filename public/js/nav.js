/* ============================================================
   nav.js — переключение ссылки "Войти" / "Личный кабинет" и
   бургер-меню для мобильной навигации.
   Сессия — httpOnly-кука, поэтому статус смотрим через лёгкий запрос
   к /api/users/me, а не читаем из localStorage.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", async function () {
    var links = document.querySelectorAll(".auth-nav-link");
    if (!links.length) return;

    try {
      var res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (res.ok) {
        links.forEach(function (link) {
          link.textContent = "Личный кабинет";
          link.setAttribute("href", "/dashboard.html");
        });
      }
    } catch (e) {
      // сеть недоступна — оставляем ссылку на вход по умолчанию
    }
  });
})();

/* ============================================================
   Бургер-меню (мобильная навигация, ≤720px)
   ============================================================ */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var burger = document.getElementById("nav-burger");
    var menu = document.getElementById("nav-mobile-menu");
    if (!burger || !menu) return;

    function setOpen(open) {
      menu.classList.toggle("show", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("nav-open", open);
    }

    burger.addEventListener("click", function () {
      setOpen(!menu.classList.contains("show"));
    });

    menu.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () { setOpen(false); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  });
})();
