// RocketYgles : données du joueur dans IndexedDB, hors ligne d'abord (guide, partie 11).
// Le jeu lit en synchrone dans un cache mémoire, chargé depuis IndexedDB avant les autres scripts (store.boot) ;
// chaque écriture part en arrière-plan. Chaque entrée garde sa date de modification et un drapeau « à synchroniser » :
// la future synchro (Supabase, progression versionnée, jamais de fusion) s'y branchera sans toucher au jeu.
// Sans IndexedDB (navigateur ancien ou bloqué), on retombe sur localStorage.
'use strict';

const STORE_DB = 'rocketygles', STORE_VER = 1, STORE_PREFIX = 'rocketygles.';
// Domaine de chaque clé : « local » reste sur l'appareil, « profile » suit le joueur (réglages, la plus récente gagne,
// clé par clé), « progress » est la progression (un seul bloc versionné à la synchro). À déclarer dans DONNEES.md aussi.
const STORE_DOMAINS = { 'rocketygles.lang': 'profile', 'rocketygles.meta': 'progress' };
const idbReq = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

const store = {
  mem: new Map(),      // clé → texte JSON (une copie neuve à chaque lecture)
  db: null, mode: 'memory', queue: new Map(), flushing: null, timer: 0, deviceId: null, failNoted: false,
  domain(k) { return STORE_DOMAINS[k] || 'local'; },

  get(k) { const v = this.mem.get(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { const txt = JSON.stringify(v); if (txt === undefined) return this.del(k); this.mem.set(k, txt); this.write({ k, v: txt, at: Date.now(), dirty: this.domain(k) === 'local' ? 0 : 1 }); },
  // Suppression gardée comme « pierre tombale » pour que la synchronisation la transmette aussi
  del(k) { if (!this.mem.has(k) && this.mode === 'idb') return; this.mem.delete(k); this.write({ k, v: null, del: 1, at: Date.now(), dirty: this.domain(k) === 'local' ? 0 : 1 }); },

  write(rec) {
    if (this.mode === 'local') { try { if (rec.del) localStorage.removeItem(rec.k); else localStorage.setItem(rec.k, rec.v); } catch (e) { /* stockage plein : la partie continue */ } return; }
    if (this.mode !== 'idb') return;
    this.queue.set(rec.k, rec);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 0);
  },
  // Écrit les changements en attente (une transaction) ; à attendre avant un rechargement de la page
  flush() {
    clearTimeout(this.timer); this.timer = 0;
    if (this.mode !== 'idb' || !this.queue.size) return this.flushing || Promise.resolve();
    const recs = [...this.queue.values()]; this.queue.clear();
    const prev = this.flushing || Promise.resolve();
    this.flushing = prev.then(() => new Promise(ok => {
      const tx = this.db.transaction('kv', 'readwrite'), os = tx.objectStore('kv');
      for (const r of recs) os.put(r);
      tx.oncomplete = () => ok();
      // Écriture refusée (téléphone plein…) : rien n'est perdu, les entrées reviennent dans la file (sauf si une plus récente
      // les a remplacées) et on réessaie dans 5 s ; l'erreur est notée une fois
      tx.onerror = tx.onabort = () => {
        for (const r of recs) if (!this.queue.has(r.k)) this.queue.set(r.k, r);
        if (!this.timer) this.timer = setTimeout(() => this.flush(), 5000);
        if (!this.failNoted && typeof Errors === 'object') { this.failNoted = true; Errors.note('IndexedDB : écriture refusée (' + ((tx.error && tx.error.name) || 'abort') + ')', 'storage.js', 0); }
        ok();
      };
    })).finally(() => { if (!this.queue.size) this.flushing = null; });
    return this.flushing;
  },

  // Toutes les entrées, telles qu'enregistrées (pour la synchronisation, une sauvegarde ou un export RGPD)
  async records() {
    await this.flush();
    if (this.mode !== 'idb') return [...this.mem].map(([k, v]) => ({ k, v, at: 0, dirty: 0 }));
    return idbReq(this.db.transaction('kv').objectStore('kv').getAll());
  },
  async sys(k, v) {
    if (this.mode !== 'idb') return null;
    const os = this.db.transaction('sys', v === undefined ? 'readonly' : 'readwrite').objectStore('sys');
    if (v === undefined) { const r = await idbReq(os.get(k)); return r ? r.v : null; }
    await idbReq(os.put({ k, v })); return v;
  },

  async open() {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponible');
    const req = indexedDB.open(STORE_DB, STORE_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      // kv : { k, v (texte JSON), at (date de modification), dirty (1 = à envoyer), del (1 = supprimée) }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' }).createIndex('dirty', 'dirty');
      // sys : identifiant de l'appareil, version de la progression vue à la dernière synchro…
      if (!db.objectStoreNames.contains('sys')) db.createObjectStore('sys', { keyPath: 'k' });
    };
    // Une autre page du jeu bloque la mise à niveau : on n'attend pas indéfiniment
    return Promise.race([idbReq(req), new Promise((ok, ko) => setTimeout(() => ko(new Error('IndexedDB bloquée')), 3000))]);
  },
  async init() {
    try {
      this.db = await this.open(); this.mode = 'idb';
      this.db.onversionchange = () => this.db.close();
      for (const r of await idbReq(this.db.transaction('kv').objectStore('kv').getAll())) if (!r.del && r.v != null) this.mem.set(r.k, r.v);
      this.deviceId = (await this.sys('device')) || (await this.sys('device', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)));
    } catch (e) {
      // Repli : localStorage, lu une fois dans le cache mémoire
      this.db = null; this.mode = 'local';
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(STORE_PREFIX)) this.mem.set(k, localStorage.getItem(k)); } } catch (e2) { this.mode = 'memory'; }
    }
    // Rien ne se perd quand on quitte l'appli ou change d'onglet
    addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
  },
  // Charge les données, puis les scripts du jeu dans l'ordre (ils partagent la même portée globale) ;
  // scripts : la liste, ou une fonction qui la donne une fois les données lues
  boot(scripts) {
    return this.init().catch(() => {}).then(() => {
      for (const src of typeof scripts === 'function' ? scripts() : scripts) { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); }
    });
  },
};
