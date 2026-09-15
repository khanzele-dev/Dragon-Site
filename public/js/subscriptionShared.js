/* ============================================================
   subscriptionShared.js — общие хелперы форматирования/QR/копирования,
   используемые и личным кабинетом (dashboard.js), и гостевыми страницами
   покупки/продления/результата заказа (buy.js, renew.js, orderResult.js).
   Обычный global-script без сборки — как и остальные public/js/*.js.
   ============================================================ */

function bytesToGB(bytes) { return bytes / (1024 * 1024 * 1024); }

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  } catch (e) { return iso; }
}

/**
 * Сколько месяцев реально осталось до expireAt, а не название последнего
 * купленного тарифа — так продление 1+1+1 месяц честно показывает "3 месяца",
 * а не "1 месяц" (имя последней покупки).
 */
function monthsRemaining(expireAtIso) {
  var diffMs = new Date(expireAtIso).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  var msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
  return Math.round(diffMs / msPerMonth);
}

function pluralMonths(n) {
  var mod10 = n % 10;
  var mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return n + " месяц";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return n + " месяца";
  return n + " месяцев";
}

/** Сколько дней реально осталось до expireAt — точное число в дополнение к monthsRemaining. */
function daysRemaining(expireAtIso) {
  var diffMs = new Date(expireAtIso).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function pluralDays(n) {
  var mod10 = n % 10;
  var mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return n + " день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return n + " дня";
  return n + " дней";
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "🏳️";
  var upper = code.toUpperCase();
  var base = 0x1F1E6;
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65, base + upper.charCodeAt(1) - 65);
}

var STATUS_MAP = {
  ACTIVE:   { label: "Активна",  isActive: true },
  LIMITED:  { label: "Лимит",    isActive: false },
  DISABLED: { label: "Отключена",isActive: false },
  EXPIRED:  { label: "Истекла",  isActive: false },
};

function renderQR(containerId, url) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (window.QRCode && url) {
    new window.QRCode(container, {
      text: url,
      width: 134,
      height: 134,
      colorDark: "#0a0608",
      colorLight: "#ffffff",
    });
  } else {
    container.textContent = "QR";
  }
}

function initCopy(btnId, inputId) {
  var btn = document.getElementById(btnId);
  var input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", function () {
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(function () {
      var old = btn.textContent;
      btn.textContent = "Скопировано";
      setTimeout(function () { btn.textContent = old; }, 1600);
    }).catch(function () {
      input.select();
      document.execCommand("copy");
    });
  });
}

/** Кнопки "Добавить VPN в приложение" — открывают диплинк приложения с
 *  переданной ссылкой подписки. Если приложение не поддерживает схему или не
 *  установлено, ничего не ломается — рядом всегда есть текстовый fallback
 *  "Скопируйте ссылку", который работает независимо.
 *  Названы иначе, чем в dashboard.js (bind* вместо init*) — там своя версия
 *  читает ссылку лениво из мутируемой переменной (кнопки биндятся до того,
 *  как профиль успевает загрузиться), а здесь ссылка известна сразу. */
function bindAddVpnButtons(subscriptionUrl) {
  document.querySelectorAll(".add-vpn-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!subscriptionUrl || btn.disabled) return;
      var encoded = encodeURIComponent(subscriptionUrl);
      var schemes = {
        happ: "happ://add/" + encoded,
        v2raytun: "v2raytun://import/" + encoded,
      };
      var url = schemes[btn.dataset.scheme];
      if (url) window.location.href = url;
    });
  });
}

function bindCopySubLinkButtons(subscriptionUrl) {
  document.querySelectorAll(".copy-sub-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!subscriptionUrl || btn.disabled) return;
      navigator.clipboard.writeText(subscriptionUrl).then(function () {
        var old = btn.textContent;
        btn.textContent = "Скопировано";
        setTimeout(function () { btn.textContent = old; }, 1600);
      });
    });
  });
}

/**
 * Повторяет запрос до финального статуса заказа — общий поллинг-паттерн,
 * которым пользуются и личный кабинет (?payment=pending), и гостевая
 * страница результата заказа (?order_token=...). Возвращает финальные данные
 * ответа (или null, если так и не дождались за отведённые попытки).
 */
async function pollUntilResolved(fetchStatus, isResolved, attempts, delayMs) {
  var last = null;
  for (var i = 0; i < attempts; i++) {
    try {
      last = await fetchStatus();
      if (last && isResolved(last)) return last;
    } catch (e) {
      // сеть моргнула — попробуем ещё раз
    }
    await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
  }
  return last;
}
