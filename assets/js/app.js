/* K-NEWS — application */
(() => {
  'use strict';
  const { LANGS, S, CATS, WX } = window.I18N;
  const { icon } = window.ICONS;

  // ordre des rubriques : les priorités (Belgique, économie, marchés, monde) d'abord
  // ordre des rubriques : chez nous (Châtelet, Charleroi), puis les priorités
  const CAT_ORDER = ['chatelet', 'charleroi', 'belgique', 'economie', 'finance', 'monde', 'sante', 'faits-divers', 'tech', 'sport', 'culture'];
  const PRIORITY_CATS = ['chatelet', 'charleroi', 'belgique', 'economie', 'finance', 'monde'];
  const BRUSSELS = { lat: 50.8503, lon: 4.3517, name: 'Bruxelles', fallback: true };
  const NEWS_URL = 'data/news.json';
  const REFRESH_MS = 10 * 60 * 1000;
  const POLL_MS = 4 * 60 * 1000; // vérifie s'il y a une nouvelle édition

  // ———————————————————————————————————————— stockage local
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('journal:' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('journal:' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ }
    },
  };

  const state = {
    lang: store.get('lang', 'fr'),
    theme: store.get('theme', 'auto'),
    scale: store.get('scale', 1),
    hidden: store.get('hidden', []),
    saved: store.get('saved', []),
    loc: store.get('loc', null),
    weather: store.get('weather', null),
    markets: store.get('markets', []),
    news: null,
    newsLoadedAt: 0,
    tab: 'home',
    fluxFilter: 'all',
    fluxBuiltFor: '',
    readerId: null,
    readerList: [],
    pending: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ———————————————————————————————————————— langue & formats
  const locale = () => LANGS[state.lang].locale;
  const t = (key, vars = {}) => (S[state.lang][key] ?? S.fr[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const catName = (c) => CATS[c]?.[state.lang] || CATS[c]?.fr || c;
  const pick = (obj, lang = state.lang) => (obj && (obj[lang] || obj.fr || Object.values(obj)[0])) || '';
  const titleOf = (a) => pick(a.title);
  const summaryOf = (a) => pick(a.summary);
  const isTranslated = (a) => state.lang !== a.lang && !!(a.title && a.title[state.lang]);

  const fmt = {
    time: (d) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
    hour: (d) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', hour12: false }).format(d).replace(/\s*h$/i, '') + (state.lang === 'fr' ? 'h' : ''),
    fullDate: (d) => new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d),
    dayMonth: (d) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(d),
    weekday: (d) => new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(d),
    num: (n, digits = 0) => new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    rel(iso) {
      const d = new Date(iso);
      const min = Math.round((Date.now() - d) / 60000);
      const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' });
      if (min < 1) return rtf.format(0, 'minute');
      if (min < 60) return rtf.format(-min, 'minute');
      if (min < 24 * 60) return rtf.format(-Math.round(min / 60), 'hour');
      return fmt.dayMonth(d);
    },
  };
  const cap = (s) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);

  // ———————————————————————————————————————— apparence
  function applyChrome() {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = LANGS[state.lang].dir;
    html.dataset.theme = state.theme;
    html.style.setProperty('--scale', state.scale);
    const dark = state.theme === 'dark' || (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1012' : '#f6f4ef');
    $$('.tabbar [data-tab]').forEach((b) => {
      $('.tab-label', b).textContent = t(b.dataset.tab);
      b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false');
    });
    $('#lang-btn').textContent = state.lang.toUpperCase();
  }

  // ———————————————————————————————————————— toasts & feuilles
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function openSheet(id) {
    const s = $('#' + id);
    s.hidden = false;
    requestAnimationFrame(() => s.classList.add('open'));
  }
  function closeSheet(id) {
    const s = $('#' + id);
    s.classList.remove('open');
    setTimeout(() => (s.hidden = true), 250);
  }

  function renderLangSheet() {
    $('#lang-list').innerHTML = Object.entries(LANGS)
      .map(([code, l]) => `<button class="sheet-option${code === state.lang ? ' active' : ''}" data-action="set-lang" data-lang="${code}" lang="${code}" dir="${l.dir}">
        <span>${l.name}</span>${code === state.lang ? icon('check') : ''}</button>`)
      .join('');
    $('#lang-title').textContent = t('language');
  }

  // ———————————————————————————————————————— visuels d'articles
  function art(a, cls = '') {
    return `<div class="art art-${esc(a.cat)} ${cls}">${icon(a.cat)}<span class="art-src">${esc(a.source)}</span></div>`;
  }
  // une vraie photo, ou rien (mise en page texte, comme dans un journal)
  function media(a, cls = 'media') {
    if (!a.image) return '';
    return `<div class="${cls}"><img src="${esc(a.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>`;
  }
  const byline = (a) => (a.written ? t('newsroom') : a.source);
  function dots(a) {
    const n = a.importance || 0;
    if (!n) return '';
    return `<span class="imp imp-${n}" title="${esc(t('importance', { n }))}" aria-label="${esc(t('importance', { n }))}">${'<i></i>'.repeat(5)}</span>`;
  }
  function meta(a, { coverage = false } = {}) {
    const cov = coverage && a.coverage > 1 ? `<span class="cov">${icon('layers')}${t('coverage', { n: a.coverage })}</span>` : '';
    return `<div class="meta"><span class="src">${esc(byline(a))}</span><span class="sep">·</span><time datetime="${esc(a.publishedAt)}">${esc(fmt.rel(a.publishedAt))}</time>${cov}</div>`;
  }
  const kicker = (a, withDots = false) => `<span class="kicker k-${esc(a.cat)}">${esc(catName(a.cat))}</span>${withDots ? dots(a) : ''}`;
  // les articles s'ouvrent dans l'application (lecteur intégré)
  const link = (a, cls, inner) => `<a class="${cls}" href="#lire-${esc(a.id)}" data-read="${esc(a.id)}">${inner}</a>`;

  // ———————————————————————————————————————— sélection éditoriale
  const visible = () => (state.news?.articles || []).filter((a) => !state.hidden.includes(a.cat));
  const byId = (id) => state.news?.articles.find((a) => a.id === id) || state.saved.find((a) => a.id === id);

  function editorialOrder(list) {
    const top = (state.news?.top || []).map((id) => list.find((a) => a.id === id)).filter(Boolean);
    // ensuite, strictement par ordre d'importance (l'édition est déjà triée)
    return [...top, ...list.filter((a) => !top.includes(a))];
  }

  // ———————————————————————————————————————— page d'accueil : couverture
  function greeting(h) {
    if (h < 5) return t('night');
    if (h < 12) return t('morning');
    if (h < 18) return t('afternoon');
    if (h < 22) return t('evening');
    return t('night');
  }

  function tickClock() {
    const now = new Date();
    const hm = fmt.time(now);
    const el = $('#clock-hm');
    if (el.textContent !== hm) {
      el.textContent = hm;
      $('#today').textContent = cap(fmt.fullDate(now));
      $('#greeting').textContent = greeting(now.getHours());
    }
    $('#clock-s').textContent = String(now.getSeconds()).padStart(2, '0');
  }

  function wxInfo(code, isDay = 1) {
    const day = !!isDay;
    if (code === 0) return { key: 'clear', icon: day ? 'sun' : 'moon', sky: day ? 'clear' : 'night' };
    if (code === 1) return { key: day ? 'mostly' : 'mostlyNight', icon: day ? 'cloudSun' : 'cloudMoon', sky: day ? 'clear' : 'night' };
    if (code === 2) return { key: 'partly', icon: day ? 'cloudSun' : 'cloudMoon', sky: day ? 'cloud' : 'night' };
    if (code === 3) return { key: 'overcast', icon: 'cloud', sky: 'cloud' };
    if (code === 45 || code === 48) return { key: 'fog', icon: 'fog', sky: 'cloud' };
    if (code >= 51 && code <= 57) return { key: 'drizzle', icon: 'drizzle', sky: 'rain' };
    if (code === 65 || code === 67) return { key: 'heavyRain', icon: 'rain', sky: 'rain' };
    if (code >= 61 && code <= 67) return { key: 'rain', icon: 'rain', sky: 'rain' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { key: 'snow', icon: 'snow', sky: 'snow' };
    if (code >= 80 && code <= 82) return { key: 'showers', icon: 'rain', sky: 'rain' };
    if (code >= 95) return { key: 'storm', icon: 'storm', sky: 'storm' };
    return { key: 'partly', icon: 'cloud', sky: 'cloud' };
  }
  const wxLabel = (key) => WX[key]?.[state.lang] || WX[key]?.fr || '';

  function renderWeather() {
    const w = state.weather;
    const loc = state.loc || BRUSSELS;
    $('#place').innerHTML = `${icon(loc.fallback ? 'pin' : 'locate')}<span>${esc(loc.name || '—')}</span>`;
    const box = $('#weather');
    if (!w) {
      box.innerHTML = `<div class="wx-empty">${esc(t('locating'))}</div>`;
      return;
    }
    const c = w.current;
    const info = wxInfo(c.weather_code, c.is_day);
    $('#cover').dataset.sky = info.sky;
    const d = w.daily;
    const tz = w.utc_offset_seconds || 0;
    const local = (s) => new Date(new Date(s + 'Z').getTime() - tz * 1000); // heure locale du lieu → instant
    const sunrise = local(d.sunrise[0]);
    const sunset = local(d.sunset[0]);

    // prochaines heures
    const nowMs = Date.now();
    const times = w.hourly.time.map(local);
    let start = times.findIndex((x) => x.getTime() > nowMs - 3600e3);
    if (start < 0) start = 0;
    const hours = [];
    for (let i = start; i < Math.min(start + 24, times.length); i++) {
      const hi = wxInfo(w.hourly.weather_code[i], w.hourly.is_day[i]);
      const p = w.hourly.precipitation_probability?.[i] ?? 0;
      hours.push(`<li><span class="h">${i === start ? esc(t('now')) : esc(fmt.hour(times[i]))}</span>${icon(hi.icon)}
        <span class="ht">${Math.round(w.hourly.temperature_2m[i])}°</span><span class="hp">${p >= 20 ? p + '%' : ''}</span></li>`);
    }

    // prochains jours
    const lo = Math.min(...d.temperature_2m_min.slice(0, 6));
    const hi = Math.max(...d.temperature_2m_max.slice(0, 6));
    const span = Math.max(1, hi - lo);
    const days = d.time.slice(0, 6).map((day, i) => {
      const di = wxInfo(d.weather_code[i], 1);
      const mn = d.temperature_2m_min[i], mx = d.temperature_2m_max[i];
      const p = d.precipitation_probability_max?.[i] ?? 0;
      const name = i === 0 ? t('today') : cap(fmt.weekday(new Date(day + 'T12:00:00')));
      return `<li><span class="dn">${esc(name)}</span><span class="di">${icon(di.icon)}<em>${p >= 20 ? p + '%' : ''}</em></span>
        <span class="dmin">${Math.round(mn)}°</span>
        <span class="bar"><i style="inset-inline-start:${((mn - lo) / span) * 100}%;inline-size:${Math.max(6, ((mx - mn) / span) * 100)}%"></i></span>
        <span class="dmax">${Math.round(mx)}°</span></li>`;
    });

    box.innerHTML = `
      <div class="wx-now">
        <div class="wx-icon">${icon(info.icon)}</div>
        <div class="wx-temp">${Math.round(c.temperature_2m)}<sup>°</sup></div>
        <div class="wx-desc">
          <strong>${esc(wxLabel(info.key))}</strong>
          <span>${esc(t('feels'))} ${Math.round(c.apparent_temperature)}° · ↑${Math.round(d.temperature_2m_max[0])}° ↓${Math.round(d.temperature_2m_min[0])}°</span>
        </div>
      </div>
      ${w.sample ? `<p class="wx-sample">${esc(t('sampleWx'))}</p>` : ''}
      <dl class="wx-meta">
        <div>${icon('wind')}<dt>${esc(t('wind'))}</dt><dd>${Math.round(c.wind_speed_10m)} km/h</dd></div>
        <div>${icon('droplet')}<dt>${esc(t('humidity'))}</dt><dd>${Math.round(c.relative_humidity_2m)}%</dd></div>
        <div>${icon('umbrella')}<dt>${esc(t('rain'))}</dt><dd>${d.precipitation_probability_max?.[0] ?? 0}%</dd></div>
        <div>${icon(nowMs < sunset.getTime() ? 'sunset' : 'sunrise')}<dt>${esc(t(nowMs < sunset.getTime() ? 'sunset' : 'sunrise'))}</dt><dd>${esc(fmt.time(nowMs < sunset.getTime() ? sunset : local(d.sunrise[1] || d.sunrise[0])))}</dd></div>
      </dl>
      <ul class="wx-hours" aria-label="24 h">${hours.join('')}</ul>
      <details class="wx-days"><summary>${esc(t('days'))}${icon('chevronDown')}</summary><ul>${days.join('')}</ul></details>`;
    void sunrise;
  }

  function spark(values, up) {
    if (!values || values.length < 2) return '';
    const w = 64, h = 22;
    const mn = Math.min(...values), mx = Math.max(...values);
    const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark ${up ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }

  function renderMarkets() {
    const list = state.markets;
    const box = $('#markets');
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    $('#markets-title').textContent = t('markets');
    $('#markets-list').innerHTML = list
      .map((m) => {
        const up = m.change >= 0;
        const val = fmt.num(m.price, m.digits ?? 2) + (m.unit ? ' ' + m.unit : '');
        return `<li><span class="m-label">${esc(m.label)}</span><span class="m-val">${esc(val)}</span>
          <span class="m-chg ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${fmt.num(Math.abs(m.change), 2)}%</span>${spark(m.spark, up)}</li>`;
      })
      .join('');
  }

  // ———————————————————————————————————————— page d'accueil : les infos
  function renderHome() {
    const box = $('#news');
    if (!state.news) { box.innerHTML = `<div class="loading">${esc(t('loading'))}</div>`; return; }
    const list = visible();
    const ordered = editorialOrder(list);
    const used = new Set();
    const take = (a) => (used.add(a.id), a);

    // la manchette : le sujet le plus important qui a une photo, parmi les trois premiers
    const lead = take(ordered.slice(0, 3).find((a) => a.image) || ordered[0]);
    const essentials = ordered.filter((a) => !used.has(a.id)).slice(0, 6).map(take);

    const gen = new Date(state.news.generatedAt);
    let html = `
      <header class="section-head" id="news-top">
        <h2>${esc(t('home'))}</h2>
        <span>${esc(t('updated', { t: fmt.time(gen) }))}</span>
      </header>`;

    if (lead) {
      html += link(lead, 'lead', `
        ${media(lead, 'media media-lead')}
        <div class="lead-body">
          ${kicker(lead, true)}
          <h3>${esc(titleOf(lead))}</h3>
          <p>${esc(summaryOf(lead))}</p>
          ${meta(lead, { coverage: true })}
        </div>`);
    }

    if (essentials.length) {
      html += `<h2 class="sub-head">${esc(t('essentials'))}</h2><ol class="essentials">`;
      html += essentials
        .map((a, i) => `<li>${link(a, 'row', `
          <span class="num">${i + 2}</span>
          <div class="row-body">${kicker(a, true)}<h4>${esc(titleOf(a))}</h4>${meta(a)}</div>
          ${media(a, 'thumb')}`)}</li>`)
        .join('');
      html += '</ol>';
    }

    for (const cat of CAT_ORDER) {
      if (state.hidden.includes(cat)) continue;
      const items = ordered.filter((a) => a.cat === cat && !used.has(a.id)).slice(0, PRIORITY_CATS.includes(cat) ? 6 : 3);
      if (!items.length) continue;
      items.forEach(take);
      // la carte principale de la rubrique prend une photo si l'un des sujets en a une
      const withImage = items.findIndex((a) => a.image);
      if (withImage > 0) items.unshift(items.splice(withImage, 1)[0]);
      const [first, ...others] = items;
      html += `<section class="cat-block">
        <header class="cat-head k-${cat}">
          <h2>${icon(cat)}${esc(catName(cat))}</h2>
          <button class="see-all" data-action="see-all" data-cat="${cat}">${esc(t('seeAll'))}${icon('arrowRight')}</button>
        </header>
        ${link(first, 'card', `${media(first)}<h3>${esc(titleOf(first))}</h3><p>${esc(summaryOf(first))}</p>${meta(first, { coverage: true })}`)}
        ${others.map((a) => link(a, 'row row-compact', `<div class="row-body"><h4>${esc(titleOf(a))}</h4>${meta(a)}</div>${media(a, 'thumb')}`)).join('')}
      </section>`;
    }

    const latest = [...list].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 12);
    html += `<section class="timeline"><h2 class="sub-head">${esc(t('live'))}</h2><ul>
      ${latest.map((a) => `<li>${link(a, 'tl-item', `<time>${esc(isToday(a.publishedAt) ? fmt.time(new Date(a.publishedAt)) : fmt.dayMonth(new Date(a.publishedAt)))}</time>
        <div><span class="kicker k-${esc(a.cat)}">${esc(catName(a.cat))}</span><h4>${esc(titleOf(a))}</h4></div>`)}</li>`).join('')}
    </ul></section>`;

    const seed = state.news.edition === 'seed';
    html += `<footer class="colophon">
      <div class="brand-mini">K-NEWS</div>
      <p>${esc(t('editionOf', { d: fmt.fullDate(gen) }))} · ${esc(fmt.time(gen))}${seed ? ` · <strong>${esc(t('seedEdition'))}</strong>` : ''}</p>
      ${seed ? `<p class="note">${esc(t('seedNote'))}</p>` : ''}
      <p class="sources"><strong>${esc(t('sources'))} :</strong> ${state.news.sources.map(esc).join(', ')}</p>
      <button class="btn-ghost" data-action="refresh">${icon('refresh')}${esc(t('refresh'))}</button>
    </footer>`;

    box.innerHTML = html;
    $('#scroll-hint-label').textContent = t('scrollHint');
  }
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

  // ———————————————————————————————————————— flux "à la TikTok"
  function fluxList() {
    const list = editorialOrder(visible());
    return state.fluxFilter === 'all' ? list : list.filter((a) => a.cat === state.fluxFilter);
  }

  function renderFluxChips() {
    const cats = CAT_ORDER.filter((c) => !state.hidden.includes(c) && visible().some((a) => a.cat === c));
    $('#flux-chips').innerHTML = ['all', ...cats]
      .map((c) => `<button class="chip${state.fluxFilter === c ? ' active' : ''}" data-action="flux-filter" data-cat="${c}">${esc(c === 'all' ? t('all') : catName(c))}</button>`)
      .join('');
    $('.chip.active', $('#flux-chips'))?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function reel(a, i, n) {
    const saved = state.saved.some((s) => s.id === a.id);
    const others = (a.sources || []).filter((x) => x.source !== a.source).slice(0, 3);
    return `<article class="reel${a.image ? '' : ' no-image'}" data-id="${esc(a.id)}" data-index="${i}">
      <div class="reel-bg">${art(a, 'art-xl')}${a.image ? `<img src="${esc(a.image)}" alt="" ${i > 2 ? 'loading="lazy"' : ''} decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
      <div class="reel-shade"></div>
      <div class="reel-content">
        <div class="reel-top">${kicker(a)}${dots(a)}<span class="reel-count">${i + 1} / ${n}</span></div>
        <div class="reel-meta">${esc(byline(a))} · ${esc(fmt.rel(a.publishedAt))}${a.coverage > 1 ? ` · ${esc(t('coverage', { n: a.coverage }))}` : ''}</div>
        <h2>${esc(titleOf(a))}</h2>
        <p>${esc(summaryOf(a))}</p>
        ${isTranslated(a) ? `<div class="reel-tr">${icon('globe')}${esc(t('translated'))}</div>` : ''}
        ${!a.written && others.length ? `<div class="reel-rel">${esc(t('basedOn', { n: a.coverage }))} · ${others.map((r) => esc(r.source)).join(', ')}</div>` : ''}
        <button class="reel-cta" data-read="${esc(a.id)}">${esc(t('read'))}${icon('arrowRight', 'class="arrow-flip"')}</button>
      </div>
      <div class="reel-actions">
        <button data-action="save" data-id="${esc(a.id)}" aria-pressed="${saved}" aria-label="${esc(t('save'))}">${icon(saved ? 'bookmarkFill' : 'bookmark')}<span>${esc(t('save'))}</span></button>
        <button data-action="share" data-id="${esc(a.id)}" aria-label="${esc(t('share'))}">${icon('share')}<span>${esc(t('share'))}</span></button>
        <button data-action="open-lang" aria-label="${esc(t('language'))}">${icon('globe')}<span>${state.lang.toUpperCase()}</span></button>
      </div>
    </article>`;
  }

  function renderFlux(keepPosition = false) {
    if (!state.news) return;
    const scroller = $('#flux-scroller');
    const current = keepPosition ? currentReelId() : null;
    const list = fluxList();
    renderFluxChips();
    scroller.innerHTML =
      list.map((a, i) => reel(a, i, list.length)).join('') +
      `<section class="reel reel-end"><div class="end-box">${icon('check')}<h2>${esc(t('endTitle'))}</h2><p>${esc(t('endSub'))}</p>
        <button class="btn" data-action="flux-top">${icon('chevronUp')}${esc(t('backTop'))}</button></div></section>`;
    state.fluxBuiltFor = state.lang + state.fluxFilter + state.news.generatedAt + state.hidden.join();
    if (current) {
      const el = scroller.querySelector(`[data-id="${CSS.escape(current)}"]`);
      if (el) scroller.scrollTop = el.offsetTop;
    } else {
      scroller.scrollTop = 0;
    }
  }

  function currentReelId() {
    const scroller = $('#flux-scroller');
    const idx = Math.round(scroller.scrollTop / Math.max(1, scroller.clientHeight));
    return scroller.children[idx]?.dataset.id || null;
  }

  function showSwipeHint() {
    if (store.get('hintSeen', false)) return;
    const h = $('#swipe-hint');
    $('#swipe-hint-title').textContent = t('swipeHint');
    $('#swipe-hint-sub').textContent = t('swipeHintSub');
    h.hidden = false;
    const done = () => { h.hidden = true; store.set('hintSeen', true); };
    $('#flux-scroller').addEventListener('scroll', done, { once: true });
    // l'aide laisse passer l'appui : la carte s'ouvre directement
    document.addEventListener('click', done, { once: true, capture: true });
    setTimeout(done, 5000);
  }

  // ———————————————————————————————————————— articles complets (chiffrés, mot de passe personnel)
  const fullKey = { pass: store.get('key', ''), key: null, ok: false };
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function deriveFullKey(pass) {
    const { salt, iterations } = state.news.crypto;
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function openBox(key, box) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(box.iv) }, key, b64d(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  /** Vérifie le mot de passe sur l'édition en cours ; renvoie true s'il est bon. */
  async function unlockFull(pass) {
    fullKey.ok = false;
    fullKey.key = null;
    if (!pass || !state.news?.crypto || !window.crypto?.subtle) return false;
    try {
      const key = await deriveFullKey(pass);
      if ((await openBox(key, state.news.crypto.check)) !== 'ok') return false;
      Object.assign(fullKey, { pass, key, ok: true });
      return true;
    } catch {
      return false;
    }
  }

  const trFull = store.get('trFull', {}); // traductions des articles complets déjà lus
  async function translateTexts(texts, lang) {
    const out = [];
    let batch = [];
    let size = 0;
    const run = async () => {
      if (!batch.length) return;
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=fr&tl=${lang}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'q=' + encodeURIComponent(batch.join('\n')),
      });
      const d = await r.json();
      const parts = d[0].map((x) => x[0]).join('').split('\n');
      if (parts.length !== batch.length) throw new Error('traduction incomplète');
      out.push(...parts.map((x) => x.trim()));
      batch = [];
      size = 0;
    };
    for (const text of texts) {
      if (size + text.length > 3500) await run();
      batch.push(text.replace(/\s*\n\s*/g, ' '));
      size += text.length;
    }
    await run();
    return out;
  }

  async function loadFull(a) {
    const box = $('#r-full');
    if (!box || box.dataset.id !== a.id) return;
    const show = (blocks, src) => {
      if (state.readerId !== a.id) return;
      box.innerHTML = blocks.map((x) => (x.h ? `<h2>${esc(x.h)}</h2>` : `<p>${esc(x.p)}</p>`)).join('') +
        `<p class="r-textby">${esc(t('textBy', { s: src }))}</p>`;
    };
    try {
      if (!fullKey.key) await unlockFull(fullKey.pass);
      const r = await fetch(`data/articles/${encodeURIComponent(a.id)}.json`);
      if (!r.ok) throw new Error('absent');
      const doc = await openBox(fullKey.key, await r.json());
      let blocks = doc.blocks;
      if (state.lang !== 'fr') {
        const cacheKey = state.lang + ':' + a.id;
        if (trFull[cacheKey]) blocks = trFull[cacheKey];
        else {
          try {
            const tr = await translateTexts(blocks.map((x) => x.p || x.h), state.lang);
            blocks = blocks.map((x, i) => (x.p ? { p: tr[i] } : { h: tr[i] }));
            trFull[cacheKey] = blocks;
            const keys = Object.keys(trFull);
            keys.slice(0, Math.max(0, keys.length - 15)).forEach((k) => delete trFull[k]);
            store.set('trFull', trFull);
          } catch { /* traduction indisponible : texte original */ }
        }
      }
      show(blocks, doc.source);
    } catch {
      if (state.readerId !== a.id) return;
      const sources = a.sources || [];
      box.outerHTML = `<p class="r-note">${esc(t('fullUnavailable'))}</p><section class="r-press">${sources
        .map((x) => `<div class="r-quote"><div class="r-quote-src">${esc(x.source)}</div><h3>${esc(x.title || '')}</h3>${x.summary ? `<p>${esc(x.summary)}</p>` : ''}</div>`)
        .join('')}</section>`;
    }
  }

  // ———————————————————————————————————————— lecteur d'article (dans l'application)
  const bodyOf = (a) => (a.body ? a.body[state.lang] || a.body.fr : null);
  const readingMinutes = (a) => {
    const b = bodyOf(a);
    const text = b ? [b.lede, ...b.keyPoints, ...b.sections.flatMap((x) => x.paragraphs)].join(' ') : summaryOf(a) + (a.sources || []).map((x) => x.summary).join(' ');
    return Math.max(1, Math.round(text.split(/\s+/).length / 220));
  };

  function readerHTML(a) {
    const b = bodyOf(a);
    // texte complet (chiffré) disponible et mot de passe saisi : il sera chargé juste après
    const full = !b && a.full && fullKey.ok && state.news?.crypto;
    const sources = a.sources?.length ? a.sources : [{ source: a.source, url: a.url, title: titleOf(a), summary: summaryOf(a) }];
    const names = [...new Set(sources.map((x) => x.source))];
    const based = names.length > 1 ? t('basedOn', { n: names.length }) : t('basedOnOne', { s: names[0] });
    const list = state.readerList.map(byId).filter(Boolean);
    const idx = list.findIndex((x) => x.id === a.id);
    const next = list[idx + 1];
    const more = editorialOrder(visible()).filter((x) => x.cat === a.cat && x.id !== a.id && x.id !== next?.id).slice(0, 3);

    let html = a.image
      ? `<div class="r-hero"><img src="${esc(a.image)}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.nextElementSibling?.remove();this.parentNode.remove()"></div><p class="r-credit">${esc(t('photo', { s: a.source }))}</p>`
      : '';
    html += `
      <header class="r-head">
        <div class="r-kicker">${kicker(a, true)}${a.importance >= 5 ? `<span class="r-major">${esc(t('major'))}</span>` : ''}</div>
        <h1>${esc(titleOf(a))}</h1>
        <p class="r-lede">${esc(b ? b.lede : summaryOf(a))}</p>
        <div class="r-byline">
          <strong>${esc(full ? a.full.source : byline(a))}</strong>
          <span>${esc(based)}</span>
          <span><time datetime="${esc(a.publishedAt)}">${esc(fmt.rel(a.publishedAt))}</time> · ${esc(t('readTime', { n: full ? a.full.minutes : readingMinutes(a) }))}</span>
        </div>
        ${isTranslated(a) ? `<div class="r-tr">${icon('globe')}${esc(t('translated'))}</div>` : ''}
      </header>`;

    if (b) {
      if (b.keyPoints?.length) html += `<aside class="r-points"><h2>${esc(t('keyPoints'))}</h2><ul>${b.keyPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></aside>`;
      html += `<div class="r-body">${b.sections.map((sec) => `${sec.heading ? `<h2>${esc(sec.heading)}</h2>` : ''}${sec.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')}</div>`;
    } else if (full) {
      html += `<div id="r-full" class="r-body" data-id="${esc(a.id)}"><p class="r-loading">${esc(t('loadingArticle'))}</p></div>`;
    } else {
      if (a.full && state.news?.crypto) html += `<button class="r-lock" data-action="goto-unlock">${icon('lock')}<span>${esc(t('lockedNote'))}</span></button>`;
      // pas de texte complet : revue de presse des médias qui couvrent le sujet
      html += `<section class="r-press"><h2>${esc(t('pressReview'))}</h2>${sources
        .map((x) => `<div class="r-quote"><div class="r-quote-src">${esc(x.source)}</div><h3>${esc(x.title || '')}</h3>${x.summary ? `<p>${esc(x.summary)}</p>` : ''}</div>`)
        .join('')}</section>`;
    }

    // sources citées, sans lien : on reste dans l'application
    html += `<section class="r-sources"><h2>${esc(t('sourcesTitle'))}</h2><ul>${sources
      .map((x) => `<li><div class="r-src"><strong>${esc(x.source)}</strong><span>${esc(x.title || '')}</span></div></li>`)
      .join('')}</ul></section>`;

    if (next) {
      html += `<button class="r-next" data-read="${esc(next.id)}"><span>${esc(t('nextArticle'))}</span><strong>${esc(titleOf(next))}</strong>${icon('arrowRight', 'class="arrow-flip"')}</button>`;
    }
    if (more.length) {
      html += `<section class="r-more"><h2 class="sub-head">${esc(t('alsoRead'))}</h2>${more
        .map((x) => link(x, 'row row-compact', `<div class="row-body"><h4>${esc(titleOf(x))}</h4>${meta(x)}</div>${media(x, 'thumb')}`))
        .join('')}</section>`;
    }
    return html;
  }

  function renderReaderBar(a) {
    const saved = state.saved.some((x) => x.id === a.id);
    $('#reader-actions').innerHTML = `
      <button class="icon-btn" data-action="save" data-id="${esc(a.id)}" aria-pressed="${saved}" aria-label="${esc(t('save'))}">${icon(saved ? 'bookmarkFill' : 'bookmark')}</button>
      <button class="icon-btn" data-action="share" data-id="${esc(a.id)}" aria-label="${esc(t('share'))}">${icon('share')}</button>
      <button class="lang-pill" data-action="open-lang" aria-label="${esc(t('language'))}">${state.lang.toUpperCase()}</button>`;
    $('#reader-back').setAttribute('aria-label', t('back'));
    $('#reader-cat').textContent = catName(a.cat);
  }

  // si le téléphone relance l'application, on revient où on était
  const rememberView = () => store.set('view', { tab: state.tab, readerId: state.readerId, list: state.readerList.slice(0, 200), at: Date.now() });

  function openReader(id, list) {
    const a = byId(id);
    if (!a) return;
    if (list) state.readerList = list;
    if (!state.readerList.includes(id)) state.readerList = [id];
    const r = $('#reader');
    const wasOpen = !r.hidden;
    state.readerId = id;
    renderReaderBar(a);
    $('#reader-body').innerHTML = readerHTML(a);
    loadFull(a);
    $('#reader-scroll').scrollTop = 0;
    $('#reader-progress').style.transform = 'scaleX(0)';
    if (!wasOpen) {
      r.hidden = false;
      requestAnimationFrame(() => r.classList.add('open'));
      try { history.pushState({ reader: true }, ''); } catch { /* cadre restreint */ }
    }
    rememberView();
  }

  function closeReader(fromHistory = false) {
    const r = $('#reader');
    if (r.hidden) return;
    r.classList.remove('open');
    state.readerId = null;
    rememberView();
    setTimeout(() => { r.hidden = true; $('#reader-body').innerHTML = ''; }, 260);
    if (!fromHistory) { try { if (history.state?.reader) history.back(); } catch { /* cadre restreint */ } }
    if (state.pending) showFresh();
  }

  function listFor(origin) {
    if (origin === 'flux') return fluxList().map((x) => x.id);
    if (origin === 'saved') return state.saved.map((x) => x.id);
    return editorialOrder(visible()).map((x) => x.id);
  }

  // ———————————————————————————————————————— favoris
  function toggleSave(id) {
    const i = state.saved.findIndex((s) => s.id === id);
    if (i >= 0) {
      state.saved.splice(i, 1);
      toast(t('removed'));
    } else {
      const a = byId(id);
      if (!a) return;
      const { id: _id, cat, source, url, image, publishedAt, lang, title, summary, sources, written, importance, coverage } = a;
      const body = a.body ? { fr: a.body.fr, ...(a.body[state.lang] ? { [state.lang]: a.body[state.lang] } : {}) } : undefined;
      state.saved.unshift({ id: _id, cat, source, url, image, publishedAt, lang, title, summary, sources, written, importance, coverage, body, savedAt: Date.now() });
      toast(t('savedOk'));
    }
    state.saved = state.saved.slice(0, 120);
    store.set('saved', state.saved);
    $$(`[data-action="save"][data-id="${CSS.escape(id)}"]`).forEach((b) => {
      const on = state.saved.some((s) => s.id === id);
      b.setAttribute('aria-pressed', on);
      b.firstElementChild.outerHTML = icon(on ? 'bookmarkFill' : 'bookmark');
    });
    if (state.tab === 'saved') renderSaved();
  }

  function renderSaved() {
    const box = $('#saved-list');
    $('#saved-title').textContent = t('saved');
    if (!state.saved.length) {
      box.innerHTML = `<div class="empty">${icon('bookmark')}<h3>${esc(t('noSaved'))}</h3><p>${esc(t('noSavedSub'))}</p></div>`;
      return;
    }
    box.innerHTML = state.saved
      .map((a) => `<div class="saved-item">${link(a, 'row', `<div class="row-body">${kicker(a)}<h4>${esc(titleOf(a))}</h4>${meta(a)}</div>${media(a, 'thumb')}`)}
        <button class="icon-btn" data-action="save" data-id="${esc(a.id)}" aria-label="${esc(t('remove'))}">${icon('trash')}</button></div>`)
      .join('');
  }

  async function share(id) {
    const a = byId(id);
    if (!a) return;
    const data = { title: titleOf(a), text: titleOf(a), url: a.url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(a.url); toast(t('copied')); }
    } catch { /* partage annulé */ }
  }

  // ———————————————————————————————————————— réglages
  function renderSettings() {
    $('#settings-title').textContent = t('settings');
    const seg = (action, current, options) =>
      `<div class="segmented" role="radiogroup">${options.map(([v, label, extra = '']) => `<button role="radio" aria-checked="${String(v) === String(current)}" data-action="${action}" data-value="${v}" ${extra}>${label}</button>`).join('')}</div>`;
    const loc = state.loc || BRUSSELS;
    const gen = state.news ? new Date(state.news.generatedAt) : null;
    $('#settings-body').innerHTML = `
      <section class="group"><h3>${esc(t('language'))}</h3>
        ${seg('set-lang', state.lang, Object.entries(LANGS).map(([c, l]) => [c, esc(l.name), `lang="${c}"`]))}
      </section>
      <section class="group"><h3>${esc(t('theme'))}</h3>
        ${seg('set-theme', state.theme, [['auto', esc(t('themeAuto'))], ['light', esc(t('themeLight'))], ['dark', esc(t('themeDark'))]])}
      </section>
      <section class="group"><h3>${esc(t('textSize'))}</h3>
        ${seg('set-scale', state.scale, [[0.9, '<span style="font-size:.8em">A</span>'], [1, 'A'], [1.12, '<span style="font-size:1.2em">A</span>'], [1.25, '<span style="font-size:1.4em">A</span>']])}
      </section>
      <section class="group"><h3>${esc(t('location'))}</h3>
        <div class="loc-current">${icon(loc.fallback ? 'pin' : 'locate')}<span>${esc(loc.name)}</span></div>
        <button class="btn-ghost wide" data-action="use-location">${icon('locate')}${esc(t('useMyLocation'))}</button>
        <div class="search">${icon('search')}<input id="city-search" type="search" autocomplete="off" placeholder="${esc(t('searchCity'))}"></div>
        <ul id="city-results" class="city-results"></ul>
      </section>
      <section class="group" id="full-group"><h3>${esc(t('fullTitle'))}</h3>
        ${fullKey.ok
          ? `<div class="loc-current ok">${icon('check')}<span>${esc(t('unlocked'))}</span></div>
             <button class="btn-ghost wide" data-action="lock">${icon('lock')}${esc(t('lock'))}</button>`
          : `<p class="muted">${esc(t('fullHelp'))}</p>
             ${fullKey.pass && !state.news?.crypto ? `<p class="muted">${esc(t('passSaved'))}</p>` : ''}
             <form class="unlock" data-form="unlock">
               <div class="search">${icon('lock')}<input id="full-pass" type="password" autocomplete="current-password" placeholder="${esc(t('fullPlaceholder'))}"></div>
               <button class="btn" type="submit">${esc(t('unlock'))}</button>
               <p class="form-error" id="full-error" hidden>${esc(t('wrongPass'))}</p>
             </form>`}
      </section>
      <section class="group"><h3>${esc(t('categories'))}</h3>
        <ul class="toggles">${CAT_ORDER.map((c) => `<li><label><span class="k-${c}">${icon(c)}</span><span>${esc(catName(c))}</span>
          <input type="checkbox" role="switch" data-action="toggle-cat" data-cat="${c}" ${state.hidden.includes(c) ? '' : 'checked'}></label></li>`).join('')}</ul>
      </section>
      <section class="group"><h3>${esc(t('install'))}</h3>
        <p class="muted">${esc(t('installSub'))}</p>
        <button class="btn" id="install-btn" data-action="install" hidden>${esc(t('install'))}</button>
      </section>
      <section class="group about"><h3>${esc(t('about'))}</h3>
        <p class="brand-mini">K-NEWS</p>
        ${gen ? `<p class="muted">${esc(t('editionOf', { d: fmt.fullDate(gen) }))} · ${esc(fmt.time(gen))}</p>` : ''}
        ${state.news ? `<p class="muted">${esc(t('sources'))} : ${state.news.sources.map(esc).join(', ')}</p>` : ''}
      </section>`;
    $('#install-btn').hidden = !deferredInstall;
  }

  let searchTimer;
  async function searchCity(q) {
    const out = $('#city-results');
    if (q.trim().length < 2) { out.innerHTML = ''; return; }
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${state.lang}&format=json`);
      const data = await r.json();
      out.innerHTML = (data.results || [])
        .map((c) => `<li><button data-action="pick-city" data-lat="${c.latitude}" data-lon="${c.longitude}" data-name="${esc(c.name)}">
          <strong>${esc(c.name)}</strong><span>${esc([c.admin1, c.country].filter(Boolean).join(', '))}</span></button></li>`)
        .join('');
    } catch {
      out.innerHTML = '';
    }
  }

  // ———————————————————————————————————————— météo
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
        reject,
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 20 * 60 * 1000 },
      );
    });
  }

  async function placeName(lat, lon) {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${state.lang}`);
      const d = await r.json();
      return d.city || d.locality || d.principalSubdivision || '';
    } catch {
      return '';
    }
  }

  async function fetchWeather(loc) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max' +
      '&timezone=auto&forecast_days=7&timeformat=iso8601';
    const r = await fetch(url);
    if (!r.ok) throw new Error('weather ' + r.status);
    const w = await r.json();
    w.fetchedAt = Date.now();
    w.loc = { lat: loc.lat, lon: loc.lon };
    return w;
  }

  async function updateWeather({ forceLocate = false } = {}) {
    let loc = state.loc;
    if (forceLocate || !loc || !loc.manual) {
      try {
        const pos = await getPosition();
        const same = loc && !loc.fallback && Math.abs(loc.lat - pos.lat) < 0.03 && Math.abs(loc.lon - pos.lon) < 0.03;
        loc = { ...pos, name: same && loc.name ? loc.name : (await placeName(pos.lat, pos.lon)) || '📍', manual: false };
      } catch {
        if (!loc || forceLocate) {
          loc = { ...BRUSSELS };
          if (!window.__SAMPLE_WEATHER__ && (forceLocate || !store.get('deniedShown', false))) { toast(t('positionDenied')); store.set('deniedShown', true); }
        }
      }
    }
    state.loc = loc;
    store.set('loc', loc);
    renderWeather();
    try {
      state.weather = await fetchWeather(loc);
      store.set('weather', state.weather);
    } catch {
      // aperçu hors application : météo d'exemple, clairement signalée
      if (!state.weather && window.__SAMPLE_WEATHER__) state.weather = window.__SAMPLE_WEATHER__();
      if (!state.weather) $('#weather').innerHTML = `<div class="wx-empty">${esc(t('weatherOff'))}</div>`;
    }
    renderWeather();
    if (state.tab === 'settings') renderSettings();
  }

  // ———————————————————————————————————————— marchés (complément côté navigateur)
  async function updateMarkets() {
    const server = state.news?.markets || [];
    const have = new Set(server.map((m) => m.id));
    const extra = [];
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const jobs = [];
    if (!have.has('eurusd')) {
      jobs.push(
        fetch(`https://api.frankfurter.app/${start}..?from=EUR&to=USD,TRY`)
          .then((r) => r.json())
          .then((d) => {
            const days = Object.keys(d.rates).sort();
            for (const [cur, digits] of [['USD', 4], ['TRY', 2]]) {
              const series = days.map((k) => d.rates[k][cur]);
              const last = series.at(-1), prev = series.at(-2);
              extra.push({ id: 'eur' + cur.toLowerCase(), label: 'EUR/' + cur, price: last, change: ((last - prev) / prev) * 100, digits, spark: series.slice(-20) });
            }
          }),
      );
    }
    if (!have.has('btc')) {
      jobs.push(
        fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=20&interval=daily')
          .then((r) => r.json())
          .then((d) => {
            const series = d.prices.map((p) => p[1]);
            const last = series.at(-1), prev = series.at(-2);
            extra.push({ id: 'btc', label: 'Bitcoin', price: last, change: ((last - prev) / prev) * 100, digits: 0, unit: '€', spark: series.slice(-20) });
          }),
      );
    }
    await Promise.allSettled(jobs);
    const order = ['bel20', 'cac40', 'stoxx50', 'sp500', 'nasdaq', 'eurusd', 'eurtry', 'brent', 'gold', 'btc'];
    const merged = [...server, ...extra].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (merged.length) {
      state.markets = merged;
      store.set('markets', merged);
    }
    renderMarkets();
  }

  // ———————————————————————————————————————— traduction de secours (si une langue manque)
  const trCache = store.get('tr', {});
  async function ensureLang(lang) {
    if (!state.news || lang === 'fr') return;
    const missing = state.news.articles.filter((a) => !a.title[lang]);
    for (const a of missing) {
      const c = trCache[lang + ':' + a.id];
      if (c) { a.title[lang] = c[0]; a.summary[lang] = c[1]; }
    }
    const todo = missing.filter((a) => !a.title[lang]).slice(0, 60);
    if (!todo.length) return;
    let chunk = [];
    const run = async () => {
      if (!chunk.length) return;
      const lines = chunk.flatMap((a) => [pick(a.title, 'fr'), pick(a.summary, 'fr') || '—'].map((s) => s.replace(/\s*\n\s*/g, ' ')));
      try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${lang}&q=${encodeURIComponent(lines.join('\n'))}`);
        const d = await r.json();
        const out = d[0].map((s) => s[0]).join('').split('\n');
        if (out.length === lines.length) {
          chunk.forEach((a, k) => {
            a.title[lang] = out[2 * k].trim();
            a.summary[lang] = out[2 * k + 1].trim();
            trCache[lang + ':' + a.id] = [a.title[lang], a.summary[lang]];
          });
        }
      } catch { /* traduction indisponible : on garde la version originale */ }
      chunk = [];
    };
    let size = 0;
    for (const a of todo) {
      const len = (pick(a.title, 'fr') + pick(a.summary, 'fr')).length;
      if (size + len > 1500) { await run(); size = 0; }
      chunk.push(a);
      size += len;
    }
    await run();
    store.set('tr', trCache);
  }

  // ———————————————————————————————————————— chargement de l'édition
  async function loadNews() {
    try {
      let data;
      if (window.__NEWS__) data = window.__NEWS__;
      else {
        const r = await fetch(NEWS_URL + '?v=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' });
        if (!r.ok) throw new Error('news ' + r.status);
        data = await r.json();
      }
      state.newsLoadedAt = Date.now();
      const changed = !state.news || state.news.generatedAt !== data.generatedAt;
      if (changed && state.news && busyReading()) {
        // on ne change pas la page sous les yeux du lecteur : on propose la mise à jour
        state.pending = data;
        showFresh();
      } else if (changed) {
        state.news = data;
        if (fullKey.pass) await unlockFull(fullKey.pass);
        await ensureLang(state.lang);
        renderAll();
        updateMarkets();
      }
      if (state.restoreReader) {
        const { id, list } = state.restoreReader;
        state.restoreReader = null;
        if (byId(id)) openReader(id, list);
      }
      $('#offline').hidden = true;
    } catch {
      if (!state.news) renderHome();
      $('#offline').hidden = navigator.onLine;
      $('#offline').textContent = t('offline');
    }
  }

  // nouvelle édition disponible pendant la lecture
  function busyReading() {
    if (state.readerId) return true;
    if (state.tab === 'flux') return $('#flux-scroller').scrollTop > 0;
    if (state.tab === 'home') return $('#view-home').scrollTop > $('#cover').offsetHeight - 80;
    return false;
  }
  function freshCount(data) {
    const known = new Set((state.news?.articles || []).map((a) => a.id));
    return data.articles.filter((a) => !known.has(a.id)).length;
  }
  function showFresh() {
    if (!state.pending || state.readerId) return;
    const n = freshCount(state.pending);
    const b = $('#fresh');
    b.innerHTML = `${icon('chevronUp')}${esc(t('fresh'))}${n ? ` · ${n}` : ''}`;
    b.hidden = false;
  }
  async function applyFresh() {
    $('#fresh').hidden = true;
    if (!state.pending) return;
    state.news = state.pending;
    state.pending = null;
    if (fullKey.pass) await unlockFull(fullKey.pass);
    await ensureLang(state.lang);
    renderAll();
    updateMarkets();
    if (state.tab === 'flux') $('#flux-scroller').scrollTo({ top: 0 });
    else $('#news-top')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ———————————————————————————————————————— navigation
  function setTab(tab) {
    state.tab = tab;
    $$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + tab));
    document.body.dataset.view = tab;
    applyChrome();
    if (tab === 'flux') {
      const key = state.lang + state.fluxFilter + (state.news?.generatedAt || '') + state.hidden.join();
      if (state.fluxBuiltFor !== key) renderFlux();
      showSwipeHint();
    }
    if (tab === 'saved') renderSaved();
    if (tab === 'settings') renderSettings();
    try { history.replaceState(null, '', tab === 'home' ? location.pathname + location.search : '#' + tab); } catch { /* cadre restreint */ }
    rememberView();
  }

  function renderAll() {
    applyChrome();
    tickClock();
    renderWeather();
    renderMarkets();
    renderHome();
    renderLangSheet();
    if (state.tab === 'flux') renderFlux(true);
    else state.fluxBuiltFor = '';
    if (state.tab === 'saved') renderSaved();
    if (state.tab === 'settings') renderSettings();
    if (state.readerId) {
      const a = byId(state.readerId);
      if (a) { renderReaderBar(a); $('#reader-body').innerHTML = readerHTML(a); loadFull(a); }
    }
  }

  async function setLang(lang) {
    if (!LANGS[lang]) return;
    state.lang = lang;
    store.set('lang', lang);
    closeSheet('lang-sheet');
    await ensureLang(lang);
    renderAll();
  }

  // ———————————————————————————————————————— événements
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    const b = $('#install-btn');
    if (b) b.hidden = false;
  });

  document.addEventListener('click', async (e) => {
    const readEl = e.target.closest('[data-read]');
    if (readEl) {
      e.preventDefault();
      const origin = readEl.closest('#reader') ? null : state.tab;
      openReader(readEl.dataset.read, origin ? listFor(origin) : null);
      return;
    }
    const el = e.target.closest('[data-action], .tabbar [data-tab]');
    if (el?.dataset.tab) {
      closeReader();
      if (state.tab === el.dataset.tab) {
        // second appui : retour en haut
        const v = el.dataset.tab === 'flux' ? $('#flux-scroller') : $('#view-' + el.dataset.tab);
        v.scrollTo({ top: 0, behavior: 'smooth' });
      } else setTab(el.dataset.tab);
      return;
    }
    if (!el) {
      // un appui sur une carte du flux ouvre l'article
      const card = e.target.closest('.reel[data-id]');
      if (card && !e.target.closest('a, button')) openReader(card.dataset.id, listFor('flux'));
      return;
    }
    const { action } = el.dataset;
    switch (action) {
      case 'set-lang': setLang(el.dataset.lang || el.dataset.value); break;
      case 'open-lang': renderLangSheet(); openSheet('lang-sheet'); break;
      case 'close-sheet': closeSheet(el.dataset.sheet); break;
      case 'close-reader': closeReader(); break;
      case 'lock': fullKey.ok = false; fullKey.key = null; fullKey.pass = ''; store.set('key', ''); renderSettings(); break;
      case 'goto-unlock': closeReader(); setTab('settings'); setTimeout(() => $('#full-group')?.scrollIntoView({ behavior: 'smooth' }), 50); break;
      case 'apply-fresh': applyFresh(); break;
      case 'set-theme': state.theme = el.dataset.value; store.set('theme', state.theme); applyChrome(); renderSettings(); break;
      case 'set-scale': state.scale = +el.dataset.value; store.set('scale', state.scale); applyChrome(); renderSettings(); break;
      case 'save': e.preventDefault(); toggleSave(el.dataset.id); break;
      case 'share': share(el.dataset.id); break;
      case 'see-all': state.fluxFilter = el.dataset.cat; setTab('flux'); renderFlux(); break;
      case 'flux-filter': state.fluxFilter = el.dataset.cat; renderFlux(); break;
      case 'flux-top': $('#flux-scroller').scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'refresh': state.news = null; renderHome(); await loadNews(); updateWeather(); break;
      case 'scroll-news': $('#news-top')?.scrollIntoView({ behavior: 'smooth' }); break;
      case 'use-location': state.loc = null; await updateWeather({ forceLocate: true }); renderSettings(); break;
      case 'pick-city': {
        state.loc = { lat: +el.dataset.lat, lon: +el.dataset.lon, name: el.dataset.name, manual: true };
        store.set('loc', state.loc);
        renderSettings();
        updateWeather();
        break;
      }
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; el.hidden = true; } break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.action === 'toggle-cat') {
      const c = el.dataset.cat;
      state.hidden = el.checked ? state.hidden.filter((x) => x !== c) : [...new Set([...state.hidden, c])];
      store.set('hidden', state.hidden);
      if (state.hidden.includes(state.fluxFilter)) state.fluxFilter = 'all';
      renderHome();
      state.fluxBuiltFor = '';
    }
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.dataset.form !== 'unlock') return;
    e.preventDefault();
    const pass = $('#full-pass').value.trim();
    if (!pass) return;
    if (!state.news?.crypto) {
      // pas encore d'édition chiffrée : on garde le mot de passe pour la suivante
      fullKey.pass = pass;
      store.set('key', pass);
      toast(t('passSaved'));
      renderSettings();
      return;
    }
    if (await unlockFull(pass)) {
      store.set('key', pass);
      toast(t('unlocked'));
      renderSettings();
    } else {
      $('#full-error').hidden = false;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'city-search') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => searchCity(e.target.value), 300);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#lang-sheet').hidden) closeSheet('lang-sheet');
      else closeReader();
      return;
    }
    if (state.tab !== 'flux' || state.readerId || e.target.matches('input')) return;
    const s = $('#flux-scroller');
    if (['ArrowDown', 'j', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); s.scrollBy({ top: s.clientHeight, behavior: 'smooth' }); }
    if (['ArrowUp', 'k', 'PageUp'].includes(e.key)) { e.preventDefault(); s.scrollBy({ top: -s.clientHeight, behavior: 'smooth' }); }
    if (e.key === 'Enter') { const id = currentReelId(); if (id) openReader(id, listFor('flux')); }
  });

  $('#lang-sheet').addEventListener('click', (e) => { if (e.target.id === 'lang-sheet') closeSheet('lang-sheet'); });

  // L'indicateur "faites défiler" disparaît dès qu'on descend
  $('#view-home').addEventListener('scroll', (e) => {
    document.body.classList.toggle('scrolled', e.target.scrollTop > 40);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - state.newsLoadedAt > POLL_MS) loadNews();
    if (!state.weather || Date.now() - state.weather.fetchedAt > REFRESH_MS * 2) updateWeather();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyChrome);
  window.addEventListener('popstate', () => closeReader(true));
  // barre de progression de lecture
  $('#reader-scroll').addEventListener('scroll', (e) => {
    const el = e.target;
    const p = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    $('#reader-progress').style.transform = `scaleX(${Math.min(1, p)})`;
  }, { passive: true });
  window.addEventListener('online', () => { $('#offline').hidden = true; loadNews(); });
  window.addEventListener('offline', () => { $('#offline').textContent = t('offline'); $('#offline').hidden = false; });

  // ———————————————————————————————————————— démarrage
  function start() {
    const initial = location.hash.slice(1);
    const last = store.get('view', null);
    const recent = last && Date.now() - last.at < 30 * 60 * 1000;
    renderAll();
    const tab = ['flux', 'saved', 'settings'].includes(initial) ? initial : recent && last.tab ? last.tab : 'home';
    setTab(tab);
    if (recent && last.readerId) state.restoreReader = { id: last.readerId, list: last.list };
    setInterval(tickClock, 1000);
    setInterval(() => { if (state.tab === 'home') $$('#news time[datetime]').forEach((el) => (el.textContent = fmt.rel(el.getAttribute('datetime')))); }, 60000);
    loadNews();
    updateWeather();
    if (state.markets.length) renderMarkets();
    // une nouvelle édition est publiée toutes les 10 minutes environ
    setInterval(() => { if (document.visibilityState === 'visible' && !window.__NEWS__) loadNews(); }, POLL_MS);
    if ('serviceWorker' in navigator && !window.__NEWS__ && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  start();
})();
