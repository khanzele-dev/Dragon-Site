/* ============================================================
   buy.js — покупка VPN без регистрации: карточки тарифов из /api/plans
   (тот же источник, что и на главной/в кабинете), кнопка создаёт гостевой
   платёж и уводит на оплату. Результат — на order-result.html.
   ============================================================ */

(function () {
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function planCardHTML(plan) {
    var featured = plan.badge ? " is-popular" : "";
    var badgeHtml = plan.badge ? escapeHtml(plan.badge) : "&nbsp;";
    return (
      '<div class="plan' + featured + '">' +
      '<p class="plan-badge">' + badgeHtml + "</p>" +
      '<p class="plan-name">' + escapeHtml(plan.name) + "</p>" +
      '<p class="plan-price"><sup>₽</sup>' + Number(plan.priceRub).toLocaleString("ru-RU") + "</p>" +
      '<span class="plan-save">&nbsp;</span>' +
      '<button type="button" class="plan-btn" data-plan-id="' + plan.id + '">Выбрать</button>' +
      "</div>"
    );
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = "Обработка…";
      btn.style.pointerEvents = "none";
      btn.style.opacity = ".7";
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
      btn.style.pointerEvents = "";
      btn.style.opacity = "";
    }
  }

  function showError(card, message) {
    var existing = card.querySelector(".plan-error");
    if (existing) existing.remove();
    var p = document.createElement("p");
    p.className = "plan-error";
    p.textContent = message;
    card.appendChild(p);
  }

  async function buyPlan(btn) {
    var planId = btn.getAttribute("data-plan-id");
    var card = btn.closest(".plan");

    setLoading(btn, true);
    try {
      var payRes = await fetch("/api/guest/payments/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planId }),
      });
      var payData = await payRes.json().catch(function () { return {}; });

      if (!payRes.ok) {
        showError(card, payData.error || "Не удалось создать платёж. Попробуйте позже.");
        return;
      }
      if (payData.confirmationUrl) {
        window.location.href = payData.confirmationUrl;
      } else {
        showError(card, "Не удалось получить ссылку на оплату.");
      }
    } catch (e) {
      showError(card, "Ошибка сети. Попробуйте позже.");
    } finally {
      setLoading(btn, false);
    }
  }

  function bindButtons(container) {
    var buttons = container.querySelectorAll(".plan-btn[data-plan-id]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        buyPlan(btn);
      });
    });
  }

  async function renderInto(container) {
    try {
      var res = await fetch("/api/plans");
      if (!res.ok) throw new Error("plans failed");
      var data = await res.json();
      var plans = data.plans || [];
      if (plans.length === 0) {
        container.innerHTML = '<p class="plans-empty">Тарифы временно недоступны.</p>';
        return;
      }
      container.innerHTML = plans.map(planCardHTML).join("");
      bindButtons(container);
    } catch (e) {
      container.innerHTML = '<p class="plans-empty">Не удалось загрузить тарифы. Обновите страницу.</p>';
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var containers = document.querySelectorAll(".plans-row[data-plans-auto]");
    containers.forEach(function (container) {
      renderInto(container);
    });
  });
})();
