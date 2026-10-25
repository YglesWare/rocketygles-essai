// RocketYgles : langues (français d'origine, anglais, espagnol). Le code garde les textes en français ;
// T(texte) renvoie la traduction quand une autre langue est choisie.
// Les tables anglaise (js/lang/en.js, EN) et espagnole (js/lang/es.js, ES) ne sont chargées que si besoin (js/boot.js) ;
// un texte pas encore traduit en espagnol sort en anglais.
'use strict';

const LANG_KEY = 'rocketygles.lang';
const LANG = bootLang();
const LOCALE = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }[LANG];
document.documentElement.lang = LANG;
const I18N = {
  en: typeof EN === 'object' ? EN : {},
  es: LANG === 'es' && typeof ES === 'object' ? ES : null,
  // Une clé enregistrée avec une espace au début ou à la fin vaut aussi pour le texte sans elle (et inversement)
  look(D, s) { if (D[s] !== undefined) return D[s]; const t = s.trim(); const v = D[t] ?? D[' ' + t] ?? D[t + ' '] ?? D[' ' + t + ' ']; return v === undefined ? undefined : s.match(/^\s*/)[0] + v.trim() + s.match(/\s*$/)[0]; },
  find(s) { return (this.es && this.look(this.es, s)) ?? this.look(this.en, s); },
  // Textes fixes de la page : nœuds de texte et attributs (aria-label, title, alt)
  translateDOM(root) {
    if (LANG === 'fr') return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      const v = key && this.find(key); if (v !== undefined && key) n.nodeValue = raw.match(/^\s*/)[0] + v.trim() + raw.match(/\s*$/)[0];
    }
    root.querySelectorAll('[aria-label],[title],[alt]').forEach(el => {
      for (const a of ['aria-label', 'title', 'alt']) { const v = el.getAttribute(a), t = v && this.find(v.trim()); if (t !== undefined && v) el.setAttribute(a, t.trim()); }
    });
  },
};
const T = s => { if (LANG === 'fr' || typeof s !== 'string') return s; const v = I18N.find(s); return v === undefined ? s : v; };
// Nombres à la façon de la langue : « 1 240 » ou « 1,240 »
const nfmt = n => Math.round(n).toLocaleString(LOCALE).replace(/ /g, ' ');
// Singulier ou pluriel : plur(1, ' pièce', ' pièces')
const plur = (n, one, many) => nfmt(n) + (Math.abs(n) === 1 ? T(one) : T(many));
I18N.translateDOM(document.body);
