// RocketYgles : WebView trop ancienne (Android 7 à 9 jamais mis à jour). Écrit à l'ancienne (ES5), chargé en premier :
// sur ces téléphones, le jeu ne peut pas démarrer ; au lieu d'un écran vide, on explique comment mettre à jour.
(function () {
  if (typeof Object.hasOwn === 'function' && typeof Array.prototype.at === 'function' && typeof structuredClone === 'function') return;
  window.RY_OLD_WV = true;
  var l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase().slice(0, 2);
  var t = {
    fr: ['Mise à jour nécessaire', 'Ton téléphone doit mettre à jour « Android System WebView » pour lancer le jeu.', 'Ouvre le Play Store, cherche « Android System WebView », touche « Mettre à jour », puis relance le jeu.', 'Ouvrir le Play Store'],
    es: ['Actualización necesaria', 'Tu teléfono debe actualizar «Android System WebView» para iniciar el juego.', 'Abre Play Store, busca «Android System WebView», toca «Actualizar» y vuelve a abrir el juego.', 'Abrir Play Store'],
    en: ['Update needed', 'Your phone needs to update “Android System WebView” to start the game.', 'Open the Play Store, search for “Android System WebView”, tap “Update”, then open the game again.', 'Open the Play Store']
  }[l === 'fr' || l === 'es' ? l : 'en'];
  function show() {
    var d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:24px;background:#7fd3ff;font:700 17px/1.4 sans-serif;color:#2a1b3d;text-align:center');
    d.innerHTML = '<div style="max-width:420px;background:#fff;border:3px solid #2a1b3d;border-radius:18px;padding:20px"><h1 style="font-size:24px;margin:0 0 12px">' + t[0] + '</h1><p>' + t[1] + '</p><p>' + t[2] + '</p>'
      + '<a href="https://play.google.com/store/apps/details?id=com.google.android.webview" style="display:inline-block;margin-top:8px;padding:12px 18px;border:3px solid #2a1b3d;border-radius:14px;background:#ffd23f;color:#2a1b3d;text-decoration:none">' + t[3] + '</a></div>';
    document.body.appendChild(d);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
