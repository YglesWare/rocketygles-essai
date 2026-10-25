// RocketYgles : remontée d'erreurs. Chargé en premier : chaque erreur du jeu est notée sur l'appareil (version, écran,
// message technique, rien de personnel). La même erreur n'est notée qu'une fois par session. L'envoi au serveur viendra avec
// Supabase (et sera déclaré dans DONNEES.md).
'use strict';

// Jeu lancé en développement sur l'ordinateur (serveur local, tests automatiques) : rien n'est noté.
// L'appli est servie elle aussi depuis « localhost » (Capacitor) : elle n'est jamais concernée.
const DEV_HOST = !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  && (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:');
const Errors = {
  KEY: 'rocketygles.errq', MAX: 30, session: new Map(),
  note(msg, src, line, stack) {
    try {
      if (DEV_HOST) return;
      msg = String(msg || 'Erreur').slice(0, 500); src = String(src || '').replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 200);
      const sig = msg + '|' + src + '|' + (line | 0), seen = this.session.get(sig);
      if (seen) { seen.n++; return; }
      const e = { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2),
        build: typeof BUILD !== 'undefined' ? BUILD : 0, screen: String(typeof App === 'object' ? App.screen : 'boot').slice(0, 20),
        msg, src, line: line | 0, stack: String(stack || '').slice(0, 2000), n: 1, at: Date.now(), sig };
      this.session.set(sig, e);
      const q = store.get(this.KEY) || []; q.push(e); while (q.length > this.MAX) q.shift(); store.set(this.KEY, q);
    } catch (e2) { /* ne jamais planter en notant une erreur */ }
  },
};
addEventListener('error', ev => { if (ev.message) Errors.note(ev.message, ev.filename, ev.lineno, ev.error && ev.error.stack); });
addEventListener('unhandledrejection', ev => { const r = ev.reason; Errors.note((r && r.message) || String(r), '', 0, r && r.stack); });
