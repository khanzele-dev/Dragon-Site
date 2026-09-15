/* ============================================================
   orderResult.js — страница результата гостевого заказа (покупка/продление
   без регистрации). Читает order_token из query, сверяет статус так же,
   как syncPendingPayment() в личном кабинете (см. pollUntilResolved в
   subscriptionShared.js), и при успехе показывает ссылку/QR/добавление в
   приложение — переиспользуя те же хелперы, что и dashboard.js.
   ============================================================ */

(function () {
  function show(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "";
  }
  function hide(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  async function fetchStatus(token) {
    var res = await fetch("/api/guest/orders/status?token=" + encodeURIComponent(token));
    if (!res.ok) return null;
    return res.json();
  }

  function renderSuccess(data) {
    hide("order-pending");
    hide("order-failed");
    show("order-success");

    document.getElementById("order-plan-name").textContent = data.planName || "";

    var subUrl = data.subscriptionUrl || "";
    var input = document.getElementById("sub-url");
    if (input) input.value = subUrl;
    renderQR("qr-code", subUrl);
    initCopy("copy-btn", "sub-url");
    bindAddVpnButtons(subUrl);
    bindCopySubLinkButtons(subUrl);
  }

  function renderFailed(message) {
    hide("order-pending");
    hide("order-success");
    show("order-failed");
    var el = document.getElementById("order-failed-message");
    if (el) el.textContent = message || "Не удалось подтвердить оплату.";
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var token = new URLSearchParams(window.location.search).get("order_token");
    if (!token) {
      renderFailed("Ссылка результата заказа неполная — токен не найден.");
      return;
    }

    var result = await pollUntilResolved(
      function () { return fetchStatus(token); },
      function (data) { return data && (data.status === "SUCCEEDED" || data.status === "CANCELED" || data.status === "FAILED"); },
      8,
      1500,
    );

    if (!result) {
      renderFailed("Не удалось получить статус заказа. Обновите страницу или напишите в поддержку.");
      return;
    }

    if (result.status === "SUCCEEDED" && result.fulfilledAt) {
      renderSuccess(result);
    } else if (result.status === "SUCCEEDED" && !result.fulfilledAt) {
      renderFailed("Оплата прошла, но выдача доступа задерживается. Обновите страницу через минуту или напишите в поддержку.");
    } else if (result.status === "CANCELED") {
      renderFailed("Оплата отменена.");
    } else {
      renderFailed("Платёж не подтверждён. Обновите страницу через минуту или напишите в поддержку.");
    }
  });
})();
