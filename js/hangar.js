// RocketYgles : le jardin de Papi entre deux vols (mode Facile, maquette planche H). L'atelier est devenu une rue en
// coupe : un bâtiment de chaque sorte, peint une fois au Canvas (Art.TOWN), avec par-dessus en HTML leur niveau, ce
// qu'ils produisent, le bouton pour les ouvrir ou leur cadenas. On touche un bâtiment pour ouvrir sa fenêtre ; celle de
// l'atelier garde les améliorations de l'avion. La logique (niveaux, production) est dans js/town.js.
'use strict';

const Hangar = {
  ICONS: {
    wing: '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 24 C10 18 24 16 36 20 C26 22 14 24 4 28z" fill="#fff" stroke="#2a1b3d" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    body: '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 22 C4 16 12 14 22 14 C30 14 36 16 37 20 C36 24 30 26 22 26 C12 26 4 25 4 22z" fill="#fff6e6" stroke="#2a1b3d" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    elastic: '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 6 L20 30 L32 6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
    ramp: '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><path d="M2 30 H24 C30 30 34 24 38 12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
  },
  BG: { wing: 'linear-gradient(#ffb3c8,#ff6f93)', body: 'linear-gradient(#f6d8a8,#d9a560)', elastic: 'linear-gradient(#ffd0de,#ff4f81)', ramp: 'linear-gradient(#f3c487,#c98a45)' },
  // Petites icônes des ressources : l'or (une pièce), les pièces détachées (un écrou), les idées (une ampoule)
  RES: {
    gold: '<i class="coin sm"></i>',
    parts: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#ffd23f" stroke="#2a1b3d" stroke-width="2.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="4" fill="#5f8f74" stroke="#2a1b3d" stroke-width="2"/></svg>',
    ideas: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" fill="#fff3b0" stroke="#2a1b3d" stroke-width="2.2"/><rect x="8.5" y="18" width="7" height="3.5" rx="1.2" fill="#c9cfdc" stroke="#2a1b3d" stroke-width="2"/></svg>',
    plane: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13 L22 6 L17 13 L22 20z" fill="#e8bd84" stroke="#2a1b3d" stroke-width="2" stroke-linejoin="round"/></svg>',
    lock: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#e9e5f3" stroke="#fff" stroke-width="2"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#fff" stroke-width="2.4"/></svg>',
  },
  s: 0.7, painted: '', sheetK: null, timer: 0, sayT: 0,

  // Le prix d'une amélioration de l'avion, avec la remise de l'atelier
  upCost(m, k, lv) { return Math.round(upPrice(k, lv) * (1 - Town.discount(m)) / 5) * 5; },

  // Taille de la rue selon l'écran : elle remplit la hauteur libre (entre le titre et LANCER en portrait)
  layout() {
    // en portrait, on garde la place de la barre du haut, du titre et du conseil (environ 190 px) et de LANCER (104 px)
    const land = innerWidth > innerHeight, free = land ? innerHeight - 70 : innerHeight - 300;
    this.s = Math.max(0.45, Math.min(land ? 0.85 : 0.72, free / Art.TOWN.H, land ? innerWidth / Art.TOWN.W : 1)); // portrait : deux bâtiments à l'écran, comme la maquette
    const s = this.s, inner = $('#hStreetIn'), cv = $('#hCanvas');
    inner.style.width = Art.TOWN.W * s + 'px'; inner.style.height = Art.TOWN.H * s + 'px';
    $('#hStreet').style.height = Art.TOWN.H * s + 'px'; $('#sHangar').style.setProperty('--sh', Art.TOWN.H * s + 'px');
    cv.style.width = Art.TOWN.W * s + 'px'; cv.style.height = Art.TOWN.H * s + 'px';
    this.painted = '';
  },

  // La rue peinte (une fois par état : un bâtiment qui ouvre la fait repeindre)
  async paint(m) {
    const key = Object.keys(BUILDINGS).map(k => Town.status(m, k) === 'far' ? 0 : 1).join('') + this.s + LANG;
    if (key === this.painted) return;
    this.painted = key;
    try { await document.fonts.load('20px Bangers'); } catch (e) { /* police de secours */ }
    const cv = $('#hCanvas'), r = Math.min(window.devicePixelRatio || 1, 2), s = this.s;
    cv.width = Math.ceil(Art.TOWN.W * s * r); cv.height = Math.ceil(Art.TOWN.H * s * r);
    const c = cv.getContext('2d'); c.setTransform(r * s, 0, 0, r * s, 0, 0);
    const L = { atelier: T('L’ATELIER DE PAPI'), limonade: T('LIMONADE'), remise: T('LA REMISE'), bureau: T('LE BUREAU À PLANS'), manche: T('LA MANCHE À AIR') };
    Art.TOWN.paint(c, L, k => Town.status(m, k) !== 'far'); // grisé et cadenas : seulement si le record est trop court
  },

  // Tout ce qui se lit sur la rue : réserves, niveaux, production, boutons pour ouvrir, cadenas
  render() {
    const m = App.meta(); Town.state(m);
    $('#hGold').textContent = nfmt(m.gold); $('#hParts').textContent = nfmt(m.parts); $('#hIdeas').textContent = nfmt(m.ideas);
    $('#hPartsW').hidden = !Town.level(m, 'remise') && !m.parts; $('#hIdeasW').hidden = !Town.level(m, 'bureau') && !m.ideas;
    $('#hStock').hidden = $('#hPartsW').hidden && $('#hIdeasW').hidden; // pièces et idées dans une seule puce
    $('#hRecord').textContent = nfmt(m.record) + ' m'; App.fitBar($('#sHangar .topbar'), $('#hRecChip'));
    this.paint(m);
    const s = this.s, box = $('#hMarks'), rates = Town.rates(m); box.textContent = '';
    const add = (cls, x, y, html, k) => { const d = document.createElement(k ? 'button' : 'div'); d.className = cls; d.style.left = x * s + 'px'; d.style.top = y * s + 'px'; d.innerHTML = html; if (k) { d.type = 'button'; d.dataset.k = k; } box.appendChild(d); return d; };
    for (const [k, x] of Object.entries(Art.TOWN.SLOTS)) {
      const st = Town.status(m, k), B = BUILDINGS[k], lv = Town.level(m, k);
      // la zone qu'on touche : tout le bâtiment
      const hit = add('bhit', x - 125, 120, '', k); hit.setAttribute('aria-label', T(B.name)); hit.dataset.act = 'open'; hit.style.width = 250 * s + 'px'; hit.style.height = 340 * s + 'px';
      if (st === 'open') {
        add('glass badge', x, 150, T('NIV. ') + lv);
        if (k === 'atelier') add('glass prod', x, 466, '<span class="line">' + this.RES.plane + T('Améliorer l’avion') + '</span>');
        else if (B.res) add('glass prod', x, 466, '<span class="line">' + this.RES[B.res] + '+' + nfmt(B.rate(lv)) + T(' / min') + '</span><span class="mini"><i style="width:' + Math.round(Town.progress(m, B.res) * 100) + '%"></i></span>').dataset.res = B.res;
        else add('glass prod', x, 466, '<span class="line">+' + Math.round(B.effect(lv).helps * 100) + T(' % d’aides') + '</span>');
      } else if (st === 'buy') {
        const b = add('candy sun bopen' + (m.gold < B.open ? ' poor' : ''), x, 462, T('OUVRIR · ') + nfmt(B.open) + this.RES.gold, k); b.dataset.act = 'buy';
      } else add('lock', x, 470, this.RES.lock + T('Record de ') + '<b>' + nfmt(B.unlock) + ' m</b>');
    }
    if (rates.gold + rates.parts + rates.ideas === 0 && m.flights < 3) this.hint(T('Touche l’atelier pour améliorer l’avion'));
    else this.hint(Object.keys(BUILDINGS).some(k => Town.status(m, k) === 'buy') ? T('Un bâtiment peut ouvrir : fais glisser la rue') : T('Touche un bâtiment pour l’améliorer'));
    this.dots();
    if (this.sheetK) this.sheet(this.sheetK);
  },

  // Le conseil sous le titre ; say() y affiche un message un moment, puis le conseil revient
  hint(txt) { this.hintTxt = txt; if (!this.sayT) $('#hHintTxt').textContent = txt; },
  say(txt) { clearTimeout(this.sayT); $('#hHintTxt').textContent = txt; $('#hHint').classList.add('say'); this.sayT = setTimeout(() => { this.sayT = 0; $('#hHint').classList.remove('say'); $('#hHintTxt').textContent = this.hintTxt || ''; }, 3500); },

  // Les points sous la rue : les bâtiments visibles
  dots() {
    const st = $('#hStreet'), a = st.scrollLeft, b = a + st.clientWidth;
    $('#hDots').innerHTML = Object.values(Art.TOWN.SLOTS).map(x => '<i class="' + (x * this.s > a && x * this.s < b ? 'on' : '') + '"></i>').join('');
  },

  // La fenêtre d'un bâtiment : ce qu'il fait, ce que le niveau suivant donne de plus, et un seul bouton
  sheet(k) {
    const m = App.meta(), B = BUILDINGS[k], lv = Town.level(m, k), max = lv >= B.max, price = Town.price(k, lv);
    this.sheetK = k; $('#hDim').hidden = false; $('#hSheet').hidden = false;
    $('#hSName').textContent = T(B.name).toUpperCase();
    $('#hSPips').innerHTML = Array.from({ length: B.max }, (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('');
    $('#hSPips').setAttribute('aria-label', T('Niveau ') + lv + T(' sur ') + B.max);
    const next = max ? '' : ' <span class="arrow">→ ', body = $('#hSBody');
    let html = '';
    if (B.res) {
      const r = B.rate(lv), n = max ? '' : next + nfmt(B.rate(lv + 1)) + '</span>' + T(' au niveau ') + (lv + 1);
      html += '<div class="info">' + this.RES[B.res].replace('class="ic"', 'class="ic lg"').replace('coin sm', 'coin') + '<div><b>' + nfmt(r) + ' ' + T({ gold: 'or', parts: 'pièces', ideas: 'idées' }[B.res]) + T(' par minute') + '</b>' + n + '<small>' + T(B.what) + '</small></div></div>';
      html += '<div class="info"><svg class="ic lg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#2a1b3d" stroke-width="2.4"/><path d="M12 6.5 V12 L15.5 14" fill="none" stroke="#2a1b3d" stroke-width="2.4" stroke-linecap="round"/></svg><div>' + T('Jeu fermé, la production continue') + '<small>' + T('pendant 2 heures au plus.') + '</small></div></div>';
    } else if (k === 'manche') {
      const h = l => Math.round(B.effect(l).helps * 100) + ' %';
      html += '<div class="info">' + this.RES.plane.replace('class="ic"', 'class="ic lg"') + '<div><b>' + T('Aides en vol : +') + h(lv) + '</b>' + (max ? '' : next + '+' + h(lv + 1) + '</span>') + '<small>' + T(B.what) + '</small></div></div>';
    } else { // l'atelier : les améliorations de l'avion, puis le prochain avion
      html += '<div id="hUps" class="ups"></div>';
      const t = TOWN.next, ok = m.parts >= t.parts && m.ideas >= t.ideas;
      html += '<div class="uprow' + (ok ? '' : ' off') + '"><span class="upico" style="background:linear-gradient(#8cc8ff,#3f8ff0)">' + this.RES.plane + '</span><div class="uptx"><b>' + T('L’avion en plastique') + '</b><small>' + T('Avec des pièces et des idées') + '</small></div>'
        + '<button class="buy" type="button" data-next="1">' + this.RES.parts + nfmt(t.parts) + this.RES.ideas + nfmt(t.ideas) + '</button></div>';
      const d = Math.round(Town.discount(m) * 100);
      if (d) html += '<p class="muted center">' + T('Grâce à l’atelier : −') + d + T(' % sur les améliorations') + '</p>';
    }
    body.innerHTML = html;
    if (k === 'atelier') this.ups(m);
    const go = $('#hSBuy');
    go.disabled = max; go.classList.toggle('poor', !max && m.gold < price);
    go.innerHTML = max ? T('AU MAXIMUM') : (k === 'atelier' ? T('AMÉLIORER L’ATELIER · ') : T('AMÉLIORER · ')) + nfmt(price) + this.RES.gold;
  },
  close() { this.sheetK = null; $('#hSheet').hidden = true; $('#hDim').hidden = true; },

  // Les quatre améliorations de l'avion (dans la fenêtre de l'atelier)
  ups(m) {
    const box = $('#hUps'); box.textContent = '';
    for (const [k, U] of Object.entries(UPGRADES)) {
      const lv = m.up[k] || 0, max = lv >= U.max, price = this.upCost(m, k, lv), poor = !max && m.gold < price;
      const row = document.createElement('div'); row.className = 'uprow'; row.dataset.k = k;
      row.innerHTML = '<span class="upico" style="background:' + this.BG[U.icon] + '">' + this.ICONS[U.icon] + '</span>'
        + '<div class="uptx"><b>' + T(U.name) + '</b><span class="pips" aria-label="' + T('Niveau ') + lv + T(' sur ') + U.max + '">'
        + Array.from({ length: U.max }, (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('') + '</span><small>' + T(U.what) + '</small></div>'
        + '<button class="buy' + (poor ? ' poor' : '') + '" type="button"' + (max ? ' disabled' : '') + ' aria-label="' + (max ? T('Au maximum') : T('Améliorer pour ') + price + T(' or')) + '">'
        + (max ? T('Max') : '<i class="coin sm"></i>' + nfmt(price)) + '</button>';
      box.appendChild(row);
    }
  },

  buyUp(k) {
    const m = App.meta(), lv = m.up[k] || 0, U = UPGRADES[k];
    if (lv >= U.max) return;
    const price = this.upCost(m, k, lv);
    if (m.gold < price) { this.say(T('Encore ') + nfmt(price - m.gold) + T(' or, et Papi te monte ça !')); return; }
    m.gold -= price; m.up[k] = lv + 1; App.saveMeta(m);
    this.render();
    const row = document.querySelector('.uprow[data-k="' + k + '"]'); if (row) { row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought'); }
  },
  // Ouvrir ou améliorer un bâtiment
  buyB(k) {
    const m = App.meta(); Town.produce(m, Date.now());
    const lv = Town.level(m, k), price = Town.price(k, lv);
    if (!Town.buy(m, k)) { if (lv < BUILDINGS[k].max && m.gold < price) this.say(T('Encore ') + nfmt(price - m.gold) + T(' or, et Papi te monte ça !')); return; }
    App.saveMeta(m);
    if (!lv) { this.say(T(BUILDINGS[k].name) + T(' est ouvert !')); this.close(); }
    this.render();
  },

  // La production avance pendant qu'on regarde la rue ; au retour, on dit ce qui a été produit en notre absence
  produce(away) {
    const m = App.meta(), got = Town.produce(m, Date.now());
    if (got.gold || got.parts || got.ideas) {
      App.saveMeta(m);
      $('#hGold').textContent = nfmt(m.gold); $('#hParts').textContent = nfmt(m.parts); $('#hIdeas').textContent = nfmt(m.ideas);
      if (away && got.away >= 1) this.say(T('Pendant ton absence : ') + [['gold', 'or'], ['parts', 'pièces'], ['ideas', 'idées']].filter(([r]) => got[r]).map(([r, n]) => '+' + nfmt(got[r]) + ' ' + T(n)).join(', '));
      if (this.sheetK) this.sheet(this.sheetK);
    } else if (!m.town.at) App.saveMeta(m);
    for (const p of document.querySelectorAll('#hMarks .prod[data-res] .mini i')) p.style.width = Math.round(Town.progress(m, p.closest('.prod').dataset.res) * 100) + '%';
  },
  start() { this.layout(); this.produce(true); this.render(); clearInterval(this.timer); this.timer = setInterval(() => this.produce(false), 1000); },
  stop() { clearInterval(this.timer); this.timer = 0; this.produce(false); },

  init() {
    $('#hMarks').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-k]'); if (!b) return;
      const k = b.dataset.k, st = Town.status(App.meta(), k);
      if (b.dataset.act === 'buy') this.buyB(k);
      else if (st === 'open') this.sheet(k);
      else if (st === 'buy') this.say(T('Touche « Ouvrir » pour ouvrir ce bâtiment'));
      else this.say(T('Il faut d’abord un record de ') + nfmt(BUILDINGS[k].unlock) + ' m');
    });
    $('#hSheet').addEventListener('click', ev => {
      if (ev.target.closest('#hSClose')) return this.close();
      if (ev.target.closest('#hSBuy')) return this.buyB(this.sheetK);
      if (ev.target.closest('[data-next]')) { const m = App.meta(), t = TOWN.next; return this.say(m.parts >= t.parts && m.ideas >= t.ideas ? T('Papi finit les plans de l’avion en plastique : bientôt !') : T('Il faut ') + nfmt(t.parts) + T(' pièces et ') + nfmt(t.ideas) + T(' idées')); }
      const b = ev.target.closest('.buy'); if (b && !b.disabled) { const row = b.closest('.uprow[data-k]'); if (row) this.buyUp(row.dataset.k); }
    });
    $('#hDim').addEventListener('click', () => this.close());
    $('#hStreet').addEventListener('scroll', () => this.dots(), { passive: true });
    addEventListener('resize', () => { if (App.screen === 'hangar') { this.layout(); this.render(); } });
    $('#hGo').addEventListener('click', () => App.startFlight());
  },
};
