/* ============================================================
   renew.js — продление VPN без регистрации: вставить ссылку подписки →
   посмотреть статус → выбрать тариф → оплата. Использует общие форматтеры
   из subscriptionShared.js (fmtDate, monthsRemaining, STATUS_MAP и т.п.).
   ============================================================ */

(function () {
  var currentSubscriptionKey = "";

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

  function setFormError(message) {
    var el = document.getElementById("renew-form-error");
    if (el) el.textContent = message || "";
  }

  function renderSubscription(sub) {
    var st = STATUS_MAP[sub.status] || { label: "Неизвестно", isActive: false };
    document.getElementById("renew-status-badge").textContent = st.isActive ? "Активна" : "Неактивна";
    document.getElementById("renew-status-badge").className = "badge " + (st.isActive ? "active" : "inactive");

    var remainingMonths = monthsRemaining(sub.expireAt);
    var remainingDays = daysRemaining(sub.expireAt);
    document.getElementById("renew-status-period").textContent = remainingMonths > 0
      ? pluralMonths(remainingMonths) + " (" + pluralDays(remainingDays) + ")"
      : pluralDays(remainingDays);
    document.getElementById("renew-status-expire").textContent = fmtDate(sub.expireAt);

    var usedGB = bytesToGB(sub.trafficUsedBytes);
    var limitGB = bytesToGB(sub.trafficLimitBytes);
    var pct = limitGB > 0 ? Math.min(100, (usedGB / limitGB) * 100) : 0;
    document.getElementById("renew-traffic-used").textContent = usedGB.toFixed(1) + " ГБ";
    document.getElementById("renew-traffic-limit").textContent = limitGB.toFixed(0);
    document.getElementById("renew-traffic-bar").style.width = pct.toFixed(1) + "%";

    document.getElementById("renew-status-card").style.display = "";
    document.getElementById("renew-status-card-traffic").style.display = "";
    document.getElementById("renew-plans-card").style.display = "";
  }

  async function lookupSubscription(e) {
    e.preventDefault();
    setFormError("");
    var input = document.getElementById("renew-key-input");
    var key = input.value.trim();
    if (!key) return;

    var btn = document.getElementById("renew-lookup-btn");
    btn.disabled = true;
    btn.textContent = "Проверяем…";
    try {
      var res = await fetch("/api/guest/subscription/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionKey: key }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        setFormError(data.error || "Не удалось найти подписку.");
        return;
      }
      currentSubscriptionKey = key;
      renderSubscription(data.subscription);
    } catch (err) {
      setFormError("Ошибка сети. Попробуйте позже.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Проверить";
    }
  }

  function setPlanLoading(btn, loading) {
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

  function showPlanError(card, message) {
    var existing = card.querySelector(".plan-error");
    if (existing) existing.remove();
    var p = document.createElement("p");
    p.className = "plan-error";
    p.textContent = message;
    card.appendChild(p);
  }

  async function renewWithPlan(btn) {
    var planId = btn.getAttribute("data-plan-id");
    var card = btn.closest(".plan");
    setPlanLoading(btn, true);
    try {
      var res = await fetch("/api/guest/payments/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionKey: currentSubscriptionKey, planId: planId }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showPlanError(card, data.error || "Не удалось создать платёж. Попробуйте позже.");
        return;
      }
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        showPlanError(card, "Не удалось получить ссылку на оплату.");
      }
    } catch (e) {
      showPlanError(card, "Ошибка сети. Попробуйте позже.");
    } finally {
      setPlanLoading(btn, false);
    }
  }

  async function renderPlans() {
    var container = document.querySelector(".plans-row[data-plans-auto]");
    if (!container) return;
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
      container.querySelectorAll(".plan-btn[data-plan-id]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          renewWithPlan(btn);
        });
      });
    } catch (e) {
      container.innerHTML = '<p class="plans-empty">Не удалось загрузить тарифы. Обновите страницу.</p>';
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("renew-lookup-form");
    if (form) form.addEventListener("submit", lookupSubscription);
    renderPlans();
  });
})();
