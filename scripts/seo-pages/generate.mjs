// Генерирует статические SEO-страницы из pages.mjs:
//   public/vpn/<slug>.html  — посадочные страницы
//   public/vpn.html         — хаб со ссылками на все страницы
//   public/sitemap.xml      — карта сайта
//   блок ссылок на главной  — между <!-- SEO-LINKS:START/END --> в public/index.html
//
// Запуск: npm run seo:pages

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS, GROUPS, PAGES, SITE } from "./pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "public");
const TODAY = new Date().toISOString().slice(0, 10);
const OG_IMG = `${SITE}/og-image.png`;

const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const attr = (s) => stripTags(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const pageUrl = (p) => `/vpn/${p.slug}.html`;

const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function head({ title, desc, path, jsonld }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0a0608">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dragon VPN">
<meta property="og:locale" content="ru_RU">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:image" content="${OG_IMG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<meta name="twitter:image" content="${OG_IMG}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<link rel="icon" type="image/png" href="/icon-dark-32x32.png">
<link rel="apple-touch-icon" href="/apple-icon.png">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body class="guest-page seo-page">

<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>
`;
}

const NAV = `<nav>
  <div class="nav-inner">
    <a href="/" class="logo">
      <span class="logo-text">Dragon<span>VPN</span></span>
    </a>
    <div class="nav-actions">
      <a href="/#how" class="nav-link">Как подключиться</a>
      <a href="/login.html" class="nav-link auth-nav-link">Войти</a>
      <a href="/renew.html" class="nav-link">Продлить VPN</a>
      <a href="/buy.html" class="nav-buy">Купить VPN</a>
    </div>
    <button class="nav-burger" id="nav-burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="nav-mobile-menu">
      <span></span><span></span><span></span>
    </button>
  </div>
  <div class="nav-mobile-menu" id="nav-mobile-menu">
    <a href="/#how" class="nav-mobile-link">Как подключиться</a>
    <a href="/login.html" class="nav-mobile-link auth-nav-link">Войти</a>
    <a href="/renew.html" class="nav-mobile-link">Продлить VPN</a>
    <a href="/buy.html" class="nav-mobile-buy">Купить VPN</a>
    <div class="nav-mobile-divider"></div>
    <a href="https://t.me/DragonPNBot" class="nav-mobile-link">Политика</a>
    <a href="https://t.me/DragonPNBot" class="nav-mobile-link">Условия</a>
    <a href="https://t.me/DragonVPNSupport" class="nav-mobile-link">Поддержка</a>
  </div>
</nav>
`;

const FOOTER = `<footer>
  <div class="foot-inner">
    <a href="/" class="foot-logo">
      <span class="logo-text">Dragon<span>VPN</span></span>
    </a>
    <p class="foot-copy">© 2026 Dragon VPN</p>
    <ul class="foot-links">
      <li><a href="/buy.html">Купить VPN</a></li>
      <li><a href="/renew.html">Продлить VPN</a></li>
      <li><a href="/vpn.html">VPN для устройств и сервисов</a></li>
      <li><a href="https://t.me/DragonPNBot">Политика</a></li>
      <li><a href="https://t.me/DragonPNBot">Условия</a></li>
      <li><a href="https://t.me/DragonVPNSupport">Поддержка</a></li>
    </ul>
  </div>
</footer>

<script src="/js/nav.js"></script>
</body>
</html>
`;

function breadcrumbs(items) {
  const html = items
    .map((it, i) => (i < items.length - 1 ? `<a href="${it.path}">${it.name}</a>` : `<span aria-current="page">${it.name}</span>`))
    .join('<span class="crumb-sep" aria-hidden="true">/</span>');
  const ld = {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: stripTags(it.name), item: SITE + it.path })),
  };
  return { html: `<nav class="crumbs rise" aria-label="Хлебные крошки">${html}</nav>`, ld };
}

function appsBlock(keys) {
  return keys
    .map((k) => {
      const a = APPS[k];
      const links = a.links
        .map((l) => `<a class="${l.primary ? "btn-red" : "btn-ghost"} seo-app-btn" href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`)
        .join("\n          ");
      return `      <div class="seo-app">
        <p class="seo-app-name">${a.label}</p>
        <div class="seo-app-links">
          ${links}
        </div>
      </div>`;
    })
    .join("\n");
}

function linksByGroup(exceptSlug) {
  return Object.entries(GROUPS)
    .map(([g, name]) => {
      const items = PAGES.filter((p) => p.group === g && p.slug !== exceptSlug)
        .map((p) => `<a href="${pageUrl(p)}">${p.nav}</a>`)
        .join("");
      return items ? `<div class="seo-links-group"><p>${name}</p><div class="seo-links">${items}</div></div>` : "";
    })
    .join("\n      ");
}

function faqBlock(faq) {
  return faq
    .map((f, i) => `      <details class="faq-item"${i === 0 ? " open" : ""}>
        <summary>${f.q}<span class="faq-icon" aria-hidden="true"></span></summary>
        <p>${f.a}</p>
      </details>`)
    .join("\n");
}

function renderPage(p) {
  const crumbs = breadcrumbs([
    { name: "Главная", path: "/" },
    { name: "VPN для устройств и сервисов", path: "/vpn.html" },
    { name: p.nav, path: pageUrl(p) },
  ]);
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      crumbs.ld,
      {
        "@type": "FAQPage",
        mainEntity: p.faq.map((f) => ({ "@type": "Question", name: stripTags(f.q), acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
    ],
  };
  const perks = p.perks.map((t) => `        <li>${CHECK}${t}</li>`).join("\n");
  const about = p.about.p.map((t) => `      <p>${t}</p>`).join("\n");
  const why = p.why.map((w) => `      <div class="seo-card"><p class="seo-card-title">${w.t}</p><p class="seo-card-desc">${w.d}</p></div>`).join("\n");
  const steps = p.steps
    .map((s, i) => `        <li class="how-step"><span class="how-num">0${i + 1}</span><span class="how-text"><b>${s.t}</b><span>${s.d}</span></span></li>`)
    .join("\n");

  return (
    head({ title: p.title, desc: p.desc, path: pageUrl(p), jsonld }) +
    NAV +
    `
<main class="dash-body">
  <div class="wrap">
    ${crumbs.html}
    <header class="guest-hero">
      <span class="guest-eyebrow rise"><i class="pulse-dot" aria-hidden="true"></i>${p.eyebrow}</span>
      <h1 class="guest-title rise" style="--d:.06s">${p.h1}</h1>
      <p class="guest-lead rise" style="--d:.12s">${p.lead}</p>
      <ul class="guest-perks rise" style="--d:.18s">
${perks}
      </ul>
      <div class="seo-hero-cta rise" style="--d:.24s">
        <a href="/buy.html" class="btn-red">Купить VPN от 115 ₽</a>
        <a href="https://t.me/DragonPNBot" class="btn-ghost" target="_blank" rel="noopener">2 дня бесплатно</a>
      </div>
    </header>

    <section class="seo-section seo-about">
      <h2 class="sec-h2">${p.about.h2}</h2>
${about}
    </section>

    <section class="seo-section">
      <div class="seo-cards">
${why}
      </div>
    </section>

    <section class="seo-section" id="setup">
      <h2 class="sec-h2 seo-center">Как подключить</h2>
      <div class="how-grid">
        <ol class="how-steps">
${steps}
        </ol>
        <div class="how-apps">
          <p class="os-panel-label">Приложения</p>
${appsBlock(p.apps)}
          <p class="how-help">Не получается? Напишите в <a href="https://t.me/DragonVPNSupport" target="_blank" rel="noopener">@DragonVPNSupport</a> — поможем настроить.</p>
        </div>
      </div>
    </section>

    <section class="seo-section">
      <h2 class="sec-h2 seo-center">Частые вопросы</h2>
      <div class="faq-list">
${faqBlock(p.faq)}
      </div>
    </section>

    <section class="seo-section">
      <div class="cta-box">
        <div class="cta-copy">
          <span class="cta-hand">Без автосписаний</span>
          <h2>Подключите Dragon VPN</h2>
          <p>От 115 ₽ в месяц, одна ссылка для всех устройств. Можно купить без регистрации.</p>
        </div>
        <a href="/buy.html" class="btn-red">Купить VPN →</a>
      </div>
    </section>

    <section class="seo-section seo-related">
      <h2 class="seo-related-title">Dragon VPN для других задач</h2>
      ${linksByGroup(p.slug)}
    </section>
  </div>
</main>

` +
    FOOTER
  );
}

function renderHub() {
  const title = "VPN для устройств, сервисов и операторов — Dragon VPN";
  const desc = "Инструкции и подборки Dragon VPN: VPN для iPhone, Android, Windows, Mac и Smart TV, для Roblox, YouTube, Discord и других сервисов, для МТС, Билайна, МегаФона и Т2.";
  const crumbs = breadcrumbs([
    { name: "Главная", path: "/" },
    { name: "VPN для устройств и сервисов", path: "/vpn.html" },
  ]);
  const groups = Object.entries(GROUPS)
    .map(([g, name]) => {
      const cards = PAGES.filter((p) => p.group === g)
        .map((p) => `        <a class="seo-hub-card" href="${pageUrl(p)}"><b>${p.nav}</b><span>${stripTags(p.lead).split(/(?<=[.!?])\s/)[0]}</span></a>`)
        .join("\n");
      return `    <section class="seo-section">
      <h2 class="seo-related-title">${name}</h2>
      <div class="seo-hub-grid">
${cards}
      </div>
    </section>`;
    })
    .join("\n\n");
  const jsonld = { "@context": "https://schema.org", "@graph": [crumbs.ld] };
  return (
    head({ title, desc, path: "/vpn.html", jsonld }) +
    NAV +
    `
<main class="dash-body">
  <div class="wrap">
    ${crumbs.html}
    <header class="guest-hero">
      <span class="guest-eyebrow rise"><i class="pulse-dot" aria-hidden="true"></i>Инструкции</span>
      <h1 class="guest-title rise" style="--d:.06s">VPN для <span class="grad-text">любых задач</span></h1>
      <p class="guest-lead rise" style="--d:.12s">Выберите устройство, сервис или оператора — расскажем, как подключить Dragon VPN и чем он поможет.</p>
    </header>

${groups}
  </div>
</main>

` +
    FOOTER
  );
}

function renderSitemap() {
  const urls = [
    { loc: "/", freq: "weekly", pr: "1.0" },
    { loc: "/buy.html", freq: "monthly", pr: "0.9" },
    { loc: "/renew.html", freq: "monthly", pr: "0.7" },
    { loc: "/vpn.html", freq: "weekly", pr: "0.8" },
    ...PAGES.map((p) => ({ loc: pageUrl(p), freq: "monthly", pr: "0.7" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pr}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function updateHomeLinks() {
  const file = join(PUB, "index.html");
  const html = readFileSync(file, "utf8");
  const start = "<!-- SEO-LINKS:START -->";
  const end = "<!-- SEO-LINKS:END -->";
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error("В index.html нет меток SEO-LINKS");
  const block = `${start}
<section class="seo-home" id="vpn-for">
  <div class="wrap">
    <div class="sec-head reveal-up">
      <span class="guest-eyebrow"><i class="pulse-dot" aria-hidden="true"></i>Для чего</span>
      <h2 class="sec-h2">Dragon VPN для ваших задач</h2>
      <p class="sec-sub">Инструкции для устройств, сервисов и операторов. <a href="/vpn.html">Все страницы →</a></p>
    </div>
    <div class="seo-related reveal-up">
      ${linksByGroup(null)}
    </div>
  </div>
</section>
`;
  writeFileSync(file, html.slice(0, a) + block + html.slice(b), "utf8");
}

mkdirSync(join(PUB, "vpn"), { recursive: true });
for (const p of PAGES) writeFileSync(join(PUB, "vpn", `${p.slug}.html`), renderPage(p), "utf8");
writeFileSync(join(PUB, "vpn.html"), renderHub(), "utf8");
writeFileSync(join(PUB, "sitemap.xml"), renderSitemap(), "utf8");
updateHomeLinks();
console.log(`Готово: ${PAGES.length} страниц + /vpn.html, sitemap.xml и блок ссылок на главной обновлены.`);
