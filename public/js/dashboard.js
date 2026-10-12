/* ============================================================
   dashboard.js — логика личного кабинета
   Доступ к странице уже проверен на edge (proxy.ts) по httpOnly-куке.
   Здесь только подгрузка данных профиля/серверов/платежей через API
   и обработка 401 (сессия истекла/отозвана) на всякий случай.
   ============================================================ */

async function apiGet(url) {
  var res = await fetch(url, { credentials: "same-origin" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("request failed: " + url);
  return res.json();
}

async function fetchUserProfile() {
  return apiGet("/api/users/me");
}

async function fetchNodes() {
  var data = await apiGet("/api/nodes");
  return data.nodes || [];
}

async function fetchPayments() {
  var data = await apiGet("/api/payments");
  return data.payments || [];
}

async function logoutUser() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(function () {});
}

/* ============================================================
   Форматирование, QR, копирование ссылки — вынесено в
   public/js/subscriptionShared.js (переиспользуется гостевыми страницами
   покупки/продления). Здесь остаётся только то, что специфично для кабинета.
   ============================================================ */

/* ============================================================
   Рендер
   ============================================================ */
function renderProfile(payload) {
  document.getElementById("user-phone").textContent = payload.user.phone || "";
  showAdminLink(payload.user.role === "ADMIN");

  var sub = payload.subscription;
  var st = STATUS_MAP[sub && sub.status] || { label: "Нет подписки", isActive: false };
  var badge = document.getElementById("sub-badge");
  badge.textContent = st.isActive ? "Активна" : "Неактивна";
  badge.className = "badge " + (st.isActive ? "active" : "inactive");

  document.getElementById("sub-plan").textContent = sub
    ? (monthsRemaining(sub.expireAt) > 0
        ? pluralMonths(monthsRemaining(sub.expireAt)) + " (" + pluralDays(daysRemaining(sub.expireAt)) + ")"
        : pluralDays(daysRemaining(sub.expireAt)))
    : "Нет подписки";
  renderExpiryAlert(sub, st);
  document.getElementById("sub-expire").textContent = sub ? fmtDate(sub.expireAt) : "—";
  document.getElementById("sub-status").textContent = st.label;

  var connectCard = document.getElementById("connect-card");
  var onboardingCard = document.getElementById("onboarding-card");
  var pricingCard = document.getElementById("dashboard-pricing-card");
  var serversCard = document.getElementById("servers-card");
  toggleCard(connectCard, st.isActive);
  // Инструкция по подключению видна всегда (и в разметке тоже, чтобы не
  // мигать) — и тем, у кого ещё нет подписки, и тем, у кого она активна.
  toggleCard(onboardingCard, true);
  // У активной подписки тарифы открываются кнопкой «Продлить» — если
  // пользователь уже раскрыл их, повторная загрузка профиля их не прячет.
  if (!st.isActive) toggleCard(pricingCard, true);
  toggleCard(serversCard, st.isActive);

  var pricingDesc = document.getElementById("pricing-card-desc");
  if (pricingDesc) {
    pricingDesc.textContent = sub
      ? "Продлить период подписки."
      : "Выберите тариф, чтобы начать пользоваться VPN.";
  }

  var hasLink = !!(sub && sub.subscriptionUrl);
  var onboardLinkBox = document.getElementById("onboard-link-box");
  if (!hasLink && onboardLinkBox) onboardLinkBox.classList.remove("show");
  document.querySelectorAll(".add-vpn-btn, .copy-sub-link, #tv-show-link").forEach(function (b) {
    b.disabled = !hasLink;
  });

  var primaryBtn = document.getElementById("manage-primary-btn");
  if (primaryBtn) primaryBtn.textContent = sub ? "Продлить подписку" : "Выбрать тариф";

  var usedGB = sub ? bytesToGB(sub.trafficUsedBytes) : 0;
  var limitGB = sub ? bytesToGB(sub.trafficLimitBytes) : 0;
  var pct = limitGB > 0 ? Math.min(100, (usedGB / limitGB) * 100) : 0;
  document.getElementById("traffic-used").textContent = sub ? usedGB.toFixed(1) + " ГБ" : "—";
  document.getElementById("traffic-limit").textContent = sub ? limitGB.toFixed(0) : "—";
  document.getElementById("traffic-bar").style.width = pct.toFixed(1) + "%";
  document.getElementById("traffic-hint").textContent = sub
    ? "Осталось " + Math.max(0, limitGB - usedGB).toFixed(1) + " ГБ · использовано " + pct.toFixed(0) + "%"
    : "Оформите подписку, чтобы начать пользоваться VPN";

  currentSubscriptionUrl = (sub && sub.subscriptionUrl) || "";
  var subInput = document.getElementById("sub-url");
  subInput.value = currentSubscriptionUrl;
  renderQR("qr-code", currentSubscriptionUrl);
}

var currentSubscriptionUrl = "";

/** Плашка над карточками: подписка скоро закончится или уже не активна. */
function renderExpiryAlert(sub, st) {
  var alertBox = document.getElementById("expiry-alert");
  var text = document.getElementById("expiry-alert-text");
  if (!alertBox || !text) return;
  var message = "";
  if (sub && st.isActive) {
    var days = daysRemaining(sub.expireAt);
    if (days <= 3) message = "Подписка закончится через " + pluralDays(days) + ". Продлите заранее — ссылка подключения останется прежней.";
  } else if (sub) {
    message = "Подписка не активна (" + st.label.toLowerCase() + "). Продлите её, чтобы VPN снова заработал.";
  }
  text.textContent = message;
  alertBox.querySelector(".dash-alert-btn").hidden = false;
  alertBox.hidden = !message;
}

/** Администратору — ссылка в админку в шапке (в меню и на мобильном). */
function showAdminLink(isAdmin) {
  if (!isAdmin || document.querySelector(".admin-nav-link")) return;
  [
    { parent: ".nav-actions", cls: "nav-link admin-nav-link" },
    { parent: ".nav-mobile-menu", cls: "nav-mobile-link admin-nav-link" },
  ].forEach(function (spot) {
    var parent = document.querySelector(spot.parent);
    if (!parent) return;
    var a = el("a", spot.cls, "Админка");
    a.href = "/admin";
    parent.insertBefore(a, parent.firstChild);
  });
}

/** Кнопки «Продлить» раскрывают тарифы прямо в кабинете. */
function initOpenPricing() {
  document.querySelectorAll("[data-open-pricing]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = document.getElementById("dashboard-pricing-card");
      if (!card) return;
      toggleCard(card, true);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/** Снимает скелетоны: класс на <body> управляет всеми заглушками разом. */
function clearSkeletons() {
  document.body.classList.remove("is-loading");
}

/**
 * Показывает/прячет карточку. При первом появлении добавляет .reveal,
 * чтобы блок проявлялся, а не выскакивал. Класс снимаем после анимации,
 * чтобы не держать лишний композиторный слой.
 */
function toggleCard(card, visible) {
  if (!card) return;
  var wasHidden = getComputedStyle(card).display === "none";
  card.style.display = visible ? "" : "none";
  if (visible && wasHidden) {
    card.classList.add("reveal");
    card.addEventListener("animationend", function handler() {
      card.classList.remove("reveal");
      card.removeEventListener("animationend", handler);
    });
  }
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderNodes(nodes) {
  var countEl = document.getElementById("servers-count");
  var flagsEl = document.getElementById("servers-flags");
  if (!countEl || !flagsEl) return;

  // Пустой список — это почти всегда ошибка панели (например, у API-токена
  // нет доступа к /api/nodes), а не «0 серверов». Не пугаем нулём — прячем блок.
  if (!nodes.length) {
    toggleCard(document.getElementById("servers-card"), false);
    return;
  }

  countEl.textContent = String(nodes.length);

  flagsEl.innerHTML = "";
  var seen = {};
  nodes.forEach(function (n) {
    if (seen[n.countryCode]) return;
    seen[n.countryCode] = true;
    flagsEl.appendChild(el("span", "servers-flag", countryFlag(n.countryCode)));
  });

  if (window.twemoji) {
    window.twemoji.parse(flagsEl, {
      base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/",
      ext: ".svg",
    });
  }
}

function renderPayments(payments) {
  var body = document.getElementById("pay-table-body");
  body.innerHTML = "";
  var statusLabel = { paid: "Оплачен", pending: "В обработке", failed: "Ошибка", refunded: "Возврат", canceled: "Отменён" };
  if (!payments.length) {
    var emptyRow = document.createElement("tr");
    var emptyCell = el("td", null, "Пока нет платежей");
    emptyCell.colSpan = 4;
    emptyRow.appendChild(emptyCell);
    body.appendChild(emptyRow);
    return;
  }
  payments.forEach(function (p) {
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, fmtDate(p.date)));
    tr.appendChild(el("td", null, p.description));
    tr.appendChild(el("td", null, p.amount + " " + p.currency));
    var statusCell = document.createElement("td");
    statusCell.appendChild(el("span", "pay-status " + p.status, statusLabel[p.status] || p.status));
    tr.appendChild(statusCell);
    body.appendChild(tr);
  });
}

/* ============================================================
   Действия
   ============================================================ */
function showLinkBox(hintText) {
  var box = document.getElementById("onboard-link-box");
  var hint = document.getElementById("onboard-link-hint");
  if (!box || !currentSubscriptionUrl) return;
  document.getElementById("onboard-sub-url").value = currentSubscriptionUrl;
  renderQR("onboard-qr-code", currentSubscriptionUrl);
  if (hint) hint.textContent = hintText || "Отсканируйте QR-код в приложении, чтобы импортировать подписку автоматически.";
  box.classList.add("show");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** Переключатель платформ в карточке "Как подключиться". */
function initPlatformSwitch() {
  var switcher = document.getElementById("platform-switch");
  if (!switcher) return;
  switcher.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-platform]");
    if (!btn) return;
    switcher.querySelectorAll("[data-platform]").forEach(function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    document.querySelectorAll("[data-platform-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-platform-panel") !== btn.dataset.platform;
    });
  });
}

/** Кнопки "Добавить VPN в приложение" — открывают диплинк приложения с
 *  текущей ссылкой подписки. Если приложение не поддерживает схему или не
 *  установлено, ничего не ломается — рядом всегда есть текстовый fallback
 *  "Скопируйте ссылку", который работает независимо. */
function initAddVpnButtons() {
  document.querySelectorAll(".add-vpn-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!currentSubscriptionUrl || btn.disabled) return;
      var encoded = encodeURIComponent(currentSubscriptionUrl);
      var schemes = {
        happ: "happ://add/" + encoded,
        v2raytun: "v2raytun://import/" + encoded,
      };
      var url = schemes[btn.dataset.scheme];
      if (url) window.location.href = url;
    });
  });
}

function initCopySubLinkButtons() {
  document.querySelectorAll(".copy-sub-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!currentSubscriptionUrl || btn.disabled) return;
      navigator.clipboard.writeText(currentSubscriptionUrl).then(function () {
        var old = btn.textContent;
        btn.textContent = "Скопировано";
        setTimeout(function () { btn.textContent = old; }, 1600);
      });
    });
  });
}

function initWindowsAltToggle() {
  var toggle = document.getElementById("windows-alt-toggle");
  var panel = document.getElementById("windows-alt-panel");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
  });
}

function initTvShowLink() {
  var btn = document.getElementById("tv-show-link");
  if (!btn) return;
  btn.addEventListener("click", function () {
    showLinkBox("Введите эту ссылку в Happ на телевизоре.");
  });
}

/* ============================================================
   Сверка платежа при возврате со страницы оплаты ЮKassa
   (?payment=pending в returnUrl) — не ждём вебхук, а сверяем сразу.
   ============================================================ */
async function syncPendingPayment() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("payment") !== "pending") return null;

  var banner = document.getElementById("payment-sync-banner");
  if (banner) banner.style.display = "flex";

  var finalStatus = null;
  for (var attempt = 0; attempt < 6; attempt++) {
    try {
      var res = await fetch("/api/payments/sync", { method: "POST", credentials: "same-origin" });
      if (res.ok) {
        var data = await res.json();
        finalStatus = data.status;
        if (data.status === "SUCCEEDED" || data.status === "CANCELED" || data.status === null) break;
      }
    } catch (e) {
      // сеть моргнула — попробуем ещё раз
    }
    await new Promise(function (resolve) { setTimeout(resolve, 1500); });
  }

  if (banner) banner.style.display = "none";
  var url = new URL(window.location.href);
  url.searchParams.delete("payment");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  return finalStatus;
}

/** Сессия недействительна: стираем куку и уходим на вход. Без logout
 *  proxy.ts увидел бы куку с валидной подписью и вернул бы в кабинет. */
async function handleUnauthorized() {
  await logoutUser();
  window.location.href = "/login.html";
}

function initLogout() {
  var buttons = document.querySelectorAll(".logout-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", async function () {
      await logoutUser();
      window.location.href = "/";
    });
  });
}

/* ============================================================
   Инициализация
   ============================================================ */
document.addEventListener("DOMContentLoaded", async function () {
  initCopy("copy-btn", "sub-url");
  initCopy("onboard-copy-btn", "onboard-sub-url");
  initPlatformSwitch();
  initAddVpnButtons();
  initCopySubLinkButtons();
  initWindowsAltToggle();
  initTvShowLink();
  initLogout();
  initOpenPricing();

  // Сверка оплаты после возврата с ЮKassa идёт параллельно с загрузкой —
  // раньше кабинет до 9 секунд стоял на скелетонах, пока она не закончится.
  // Если оплата подтвердилась, перечитываем профиль и платежи.
  syncPendingPayment().then(function (status) {
    if (status !== "SUCCEEDED") return;
    fetchUserProfile().then(renderProfile).catch(function () {});
    fetchPayments().then(renderPayments).catch(function () {});
  });

  try {
    // Три запроса стартуют разом, а не цепочкой — данные приезжают быстрее,
    // и каждый блок заменяет свой скелетон, как только пришёл его ответ.
    var nodesPromise = fetchNodes();
    var paymentsPromise = fetchPayments();
    // Без этого отказ любого из них до своего await всплывёт как unhandled.
    nodesPromise.catch(function () {});
    paymentsPromise.catch(function () {});

    var profile = await fetchUserProfile();
    renderProfile(profile);
    clearSkeletons();

    try {
      renderNodes(await nodesPromise);
    } catch (e) {
      document.getElementById("servers-flags").innerHTML = "";
    }

    try {
      renderPayments(await paymentsPromise);
    } catch (e) {
      renderPayments([]);
    }
  } catch (err) {
    console.log("[dashboard] load error:", err);
    if (err.message === "unauthorized") {
      await handleUnauthorized();
      return;
    }
    // Не оставляем страницу мерцать скелетонами, если данные не пришли.
    clearSkeletons();
    renderPayments([]);
    document.getElementById("servers-flags").innerHTML = "";
    var alertBox = document.getElementById("expiry-alert");
    if (alertBox) {
      document.getElementById("expiry-alert-text").textContent =
        "Не удалось загрузить данные подписки. Обновите страницу через минуту или напишите в поддержку.";
      alertBox.querySelector(".dash-alert-btn").hidden = true;
      alertBox.hidden = false;
    }
  }
});
