/* ============================================================
   auth.js — логика форм входа и регистрации (телефон + пароль)
   Сессия хранится в httpOnly-куке (ставит сервер), поэтому здесь
   никаких токенов в localStorage — JS их даже не видит.
   ============================================================ */

var MIN_PASSWORD = 8;
var PHONE_RE = /^(?:\+7|7|8)?\s*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$/;

function setFieldError(name, message) {
  var el = document.querySelector('[data-error-for="' + name + '"]');
  var input = document.getElementById(name);
  if (el) el.textContent = message || "";
  if (input) input.classList.toggle("is-invalid", !!message);
}

function clearErrors(names) {
  names.forEach(function (n) { setFieldError(n, ""); });
  var alert = document.getElementById("form-alert");
  if (alert) { alert.classList.remove("show"); alert.textContent = ""; }
}

function showAlert(message) {
  var alert = document.getElementById("form-alert");
  if (alert) { alert.textContent = message; alert.classList.add("show"); }
}

function setLoading(btn, loading, idleLabel) {
  if (!btn) return;
  btn.disabled = loading;
  var label = btn.querySelector(".btn-label");
  if (loading) {
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  } else if (label === null) {
    btn.innerHTML = '<span class="btn-label">' + idleLabel + "</span>";
  }
}

async function postJson(url, body) {
  var res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) return { ok: false, error: data.error || "Что-то пошло не так" };
  return { ok: true, data: data };
}

/* ============================================================
   ФОРМА ВХОДА
   ============================================================ */

function initLoginForm() {
  var form = document.getElementById("login-form");
  if (!form) return;
  var btn = document.getElementById("submit-btn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors(["phone", "password"]);

    var phone = form.phone.value.trim();
    var password = form.password.value;
    var valid = true;

    if (!PHONE_RE.test(phone)) { setFieldError("phone", "Введите корректный номер телефона"); valid = false; }
    if (!password) { setFieldError("password", "Введите пароль"); valid = false; }
    if (!valid) return;

    setLoading(btn, true);
    var result = await postJson("/api/auth/login", { phone: phone, password: password });
    if (!result.ok) {
      showAlert(result.error);
      setLoading(btn, false, "Войти");
      return;
    }
    window.location.href = "/dashboard.html";
  });
}

/* ============================================================
   ФОРМА РЕГИСТРАЦИИ
   ============================================================ */

function initRegisterForm() {
  var form = document.getElementById("register-form");
  if (!form) return;
  var btn = document.getElementById("submit-btn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors(["phone", "password", "confirm"]);

    var phone = form.phone.value.trim();
    var password = form.password.value;
    var confirm = form.confirm.value;
    var valid = true;

    if (!PHONE_RE.test(phone)) { setFieldError("phone", "Введите корректный номер телефона"); valid = false; }
    if (password.length < MIN_PASSWORD) { setFieldError("password", "Минимум " + MIN_PASSWORD + " символов"); valid = false; }
    if (confirm !== password) { setFieldError("confirm", "Пароли не совпадают"); valid = false; }
    if (!valid) return;

    setLoading(btn, true);
    var result = await postJson("/api/auth/register", { phone: phone, password: password, confirmPassword: confirm });
    if (!result.ok) {
      showAlert(result.error);
      setLoading(btn, false, "Зарегистрироваться");
      return;
    }
    window.location.href = "/dashboard.html";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initLoginForm();
  initRegisterForm();
});
