// RocketYgles : chargement du jeu. Les données d'abord (js/storage.js), puis les scripts dans l'ordre.
// Dans un fichier à part, et non dans index.html : la règle de sécurité de la page (CSP) n'autorise aucun script écrit dans la page.
'use strict';
// Langue choisie, ou celle du téléphone en « Auto » (même règle que LANG, js/i18n.js) : ses tables de textes avant js/i18n.js
// (l'anglais sert aussi de secours à l'espagnol). Calculée une fois les données chargées.
const bootLang = () => {
  const p = store.get('rocketygles.lang') || 'auto', nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').toLowerCase();
  return ['fr', 'en', 'es'].includes(p) ? p : nav.startsWith('fr') ? 'fr' : nav.startsWith('es') ? 'es' : 'en';
};
// PixiJS sans « eval » (pixi-unsafe-eval) : la règle de sécurité de la page interdit le code généré à la volée.
// WebView trop ancienne (js/oldwv.js) : le message de mise à jour reste seul à l'écran
if (!window.RY_OLD_WV) store.boot(() => [
  'js/errors.js', ...(bootLang() !== 'fr' ? ['js/lang/en.js'] : []), ...(bootLang() === 'es' ? ['js/lang/es.js'] : []), 'js/i18n.js',
  'js/data.js', 'js/town.js', 'js/news.js', 'js/vendor/pixi.min.js', 'js/vendor/pixi-unsafe-eval.min.js', 'js/art.js', 'js/flight.js', 'js/scene.js', 'js/hangar.js', 'js/app.js',
]);
