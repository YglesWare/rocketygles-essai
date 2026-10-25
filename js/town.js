// RocketYgles : les bâtiments du jardin de Papi (mode Facile), sans aucun dessin : niveaux, ouverture et production.
// La production suit le temps réel ; jeu fermé, elle continue pendant TOWN.awayCap minutes au plus. Le dessin et les
// fenêtres sont dans js/hangar.js, les réglages dans js/data.js (BUILDINGS, TOWN).
'use strict';

const Town = {
  RES: ['gold', 'parts', 'ideas'],
  // L'état des bâtiments dans la progression (meta.town), complété pour une ancienne sauvegarde
  state(m) {
    const t = m.town = Object.assign({ lv: {}, at: 0, acc: {} }, m.town);
    t.lv = Object.assign({ atelier: 1 }, t.lv); t.acc = Object.assign({ gold: 0, parts: 0, ideas: 0 }, t.acc);
    m.parts = m.parts || 0; m.ideas = m.ideas || 0;
    return t;
  },
  level(m, k) { return (m.town && m.town.lv && m.town.lv[k]) || (k === 'atelier' ? 1 : 0); },
  // open : ouvert ; buy : le record suffit, il reste à payer ; far : le record est encore trop court
  status(m, k) { return this.level(m, k) > 0 ? 'open' : (m.record || 0) >= BUILDINGS[k].unlock ? 'buy' : 'far'; },
  // Prix pour ouvrir (niveau 0) ou pour passer au niveau suivant
  price(k, lv) { const B = BUILDINGS[k]; return lv === 0 ? B.open : Math.round(B.base * Math.pow(B.grow, lv - 1) / 5) * 5; },
  // Ouvrir ou améliorer un bâtiment ; false si c'est impossible (trop loin, au maximum, pas assez d'or)
  buy(m, k) {
    const lv = this.level(m, k), B = BUILDINGS[k];
    if (lv >= B.max || this.status(m, k) === 'far') return false;
    const p = this.price(k, lv); if (m.gold < p) return false;
    m.gold -= p; this.state(m).lv[k] = lv + 1; return true;
  },
  // Ce que la rue produit par minute, ressource par ressource
  rates(m) { const r = { gold: 0, parts: 0, ideas: 0 }; for (const [k, B] of Object.entries(BUILDINGS)) if (B.res && this.level(m, k)) r[B.res] += B.rate(this.level(m, k)); return r; },
  // Fait avancer la production jusqu'à now (en ms) : renvoie ce qui a été gagné, et away, les minutes comptées
  produce(m, now) {
    const t = this.state(m), r = this.rates(m), got = { gold: 0, parts: 0, ideas: 0, away: 0 };
    if (!t.at || now < t.at) { t.at = now; return got; }
    got.away = Math.min(TOWN.awayCap, (now - t.at) / 60000); t.at = now;
    for (const res of this.RES) { t.acc[res] += r[res] * got.away; got[res] = Math.floor(t.acc[res]); t.acc[res] -= got[res]; }
    m.gold += got.gold; m.parts += got.parts; m.ideas += got.ideas;
    return got;
  },
  // Où en est la prochaine unité, de 0 à 1 (la petite barre sous un bâtiment)
  progress(m, res) { return Math.min(1, Math.max(0, (this.state(m).acc[res] || 0) % 1)); },
  discount(m) { return BUILDINGS.atelier.effect(this.level(m, 'atelier')).discount; },
};
