// RocketYgles : l'application. Deux écrans pour le POC : l'atelier de Papi (js/hangar.js) et le vol (js/scene.js +
// js/flight.js). Un seul gestionnaire du bouton retour (guide, partie 3) ; la boucle de dessin ne tourne que pendant un vol,
// à 30 images/s (60 en option), et s'arrête dans l'atelier.
'use strict';

const $ = s => document.querySelector(s);
const App = {
  META: 'rocketygles.meta', OPTS: 'rocketygles.opts', screen: 'boot', st: null, input: { up: false, down: false }, pull: 0, pulling: null, doneAt: 0,

  meta() {
    const m = Object.assign({ gold: 50, up: {}, record: 0, flights: 0 }, store.get(this.META) || {});
    m.up = Object.assign({ wings: 0, body: 0, elastic: 0, ramp: 0 }, m.up); return m;
  },
  saveMeta(m) { store.set(this.META, m); },
  opts() { return Object.assign({ fps60: false, eco: false }, store.get(this.OPTS) || {}); },

  show(name) {
    this.screen = name;
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== 's' + name[0].toUpperCase() + name.slice(1);
    if (name === 'hangar') { Hangar.start(); Scene.pause(); } else Hangar.stop();
  },

  // Une barre du haut qui déborde de l'écran : on resserre ses puces ; si ça ne suffit pas, on cache spare (une puce
  // dont l'information se lit ailleurs). Appelée quand un nombre de la barre change de longueur.
  fitBar(bar, spare) {
    bar.classList.remove('tight'); if (spare) spare.hidden = false;
    if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add('tight');
    if (spare && bar.scrollWidth > bar.clientWidth + 1) spare.hidden = true;
  },

  // Un seul gestionnaire pour la flèche Retour, Échap et le bouton retour d'Android
  back() {
    if (this.screen === 'hangar' && Hangar.sheetK) { Hangar.close(); return true; }
    if (this.screen === 'flight') {
      if (!this.st || this.st.phase === 'ready' || this.st.phase === 'done') this.show('hangar');
      return true; // en plein vol : on ne quitte pas par erreur
    }
    return false;
  },

  // Bulle de Papi sur l'écran de vol (une phrase, puis elle s'efface)
  say(txt, ms) {
    const b = $('#papi'); $('#papiTxt').textContent = txt; b.hidden = false;
    clearTimeout(this.sayT); if (ms) this.sayT = setTimeout(() => { b.hidden = true; }, ms);
  },

  async startFlight() {
    const m = this.meta();
    this.show('flight');
    await Scene.init($('#stage'));
    // L'écran de vol était caché quand PixiJS a démarré : on lui redonne sa taille
    Scene.app.resize(); Scene.layout();
    this.st = Flight.create(m, m.flights + 1); this.pull = 0; this.doneAt = 0;
    Scene.setFlight(this.st);
    $('#fTitle').textContent = T('VOL N° ') + (m.flights + 1);
    $('#fGoal').textContent = T('Objectif : planer plus de ') + nfmt(this.goal(m)) + ' m';
    $('#fRecord').textContent = nfmt(m.record) + ' m';
    $('#fGain').textContent = '+0'; $('#fDist').textContent = '0 m';
    this.phaseUI(); this.fitBar($('#fTop')); this.barLen = 0;
    if (m.flights < 2) this.say(m.flights ? T('Lève le nez avec ▲ pour planer plus longtemps, mais pas trop : l’avion décroche !') : T('Tire bien l’élastique, mon petit ! Le tremplin t’envoie en l’air, et tes ailes en carton font le reste. Hé hé hé…'));
    else $('#papi').hidden = true;
    Scene.resume();
  },
  // L'objectif affiché : la centaine de mètres suivante après le record
  goal(m) { return Math.max(50, Math.floor(m.record / 50) * 50 + 50); },

  // Ce qui se voit selon le moment du vol
  phaseUI() {
    const ph = this.st ? this.st.phase : 'ready', ready = ph === 'ready', done = ph === 'done';
    $('#fTop').hidden = false; $('#fIntro').hidden = !ready; $('#fPull').hidden = !ready; $('#fHint').hidden = !ready;
    $('#fPad').hidden = ph !== 'air'; $('#fEnd').hidden = !done; $('#fBack').hidden = !(ready || done);
  },

  // Une image : la physique avance de dt, puis la scène se dessine
  tick(dt) {
    const st = this.st; if (!st || this.screen !== 'flight') return;
    const before = st.phase;
    Flight.step(st, dt, this.input);
    Scene.draw(st, dt);
    if (st.phase !== 'ready') {
      const r = Flight.result(st);
      $('#fDist').textContent = nfmt(r.dist) + ' m'; $('#fGain').textContent = '+' + nfmt(r.gold);
      const len = $('#fDist').textContent.length + $('#fGain').textContent.length; if (len !== this.barLen) { this.barLen = len; this.fitBar($('#fTop')); }
      $('#fPullBar').style.width = '0%';
    }
    if (before !== st.phase) {
      this.phaseUI();
      if (st.phase === 'air') $('#papi').hidden = true;
      if (st.phase === 'done') this.endFlight();
    }
    // Vol fini : la scène se rendort au bout de 2 s (batterie)
    if (st.phase === 'done' && this.doneAt && performance.now() - this.doneAt > 2000) Scene.pause();
  },

  endFlight() {
    const st = this.st, r = Flight.result(st), m = this.meta(), rec = r.dist > m.record;
    m.gold += r.gold; m.flights++; if (rec) m.record = Math.floor(r.dist); this.saveMeta(m);
    $('#eDist').textContent = nfmt(r.dist) + ' m';
    $('#eGold').textContent = '+' + nfmt(r.gold);
    $('#eCoins').textContent = r.coins ? plur(r.coins, ' pièce ramassée', ' pièces ramassées') : '';
    $('#eRec').hidden = !rec;
    $('#eStuck').hidden = r.dist > 0;
    this.doneAt = performance.now();
    $('#eAgain').focus({ preventScroll: true });
  },

  // Tirer l'élastique : on pose le doigt n'importe où, on recule, on lâche
  bindPull() {
    const stage = $('#stage');
    stage.addEventListener('pointerdown', ev => {
      if (this.screen !== 'flight' || !this.st || this.st.phase !== 'ready') return;
      this.pulling = { x: ev.clientX, y: ev.clientY }; stage.setPointerCapture(ev.pointerId);
    });
    stage.addEventListener('pointermove', ev => {
      if (!this.pulling) return;
      const d = Math.hypot(ev.clientX - this.pulling.x, ev.clientY - this.pulling.y);
      this.pull = Math.min(1, d / 160); Flight.aim(this.st, this.pull); $('#fPullBar').style.width = Math.round(this.pull * 100) + '%';
      $('#fPullN').textContent = Math.max(1, Math.ceil(this.pull * 5)) + ' / 5';
    });
    const release = () => {
      if (!this.pulling) return; this.pulling = null;
      if (this.pull < 0.08) { this.say(T('Glisse ton doigt pour tirer l’élastique, puis lâche !'), 2500); this.pull = 0; Flight.aim(this.st, 0); return; }
      Flight.launch(this.st, this.pull); this.pull = 0; this.phaseUI();
    };
    stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
  },

  // ▲ / ▼ : on maintient le bouton (ou les flèches du clavier)
  bindPad() {
    for (const [id, k] of [['#bUp', 'up'], ['#bDown', 'down']]) {
      const b = $(id), on = ev => { ev.preventDefault(); this.input[k] = true; b.classList.add('on'); }, off = () => { this.input[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
    addEventListener('keydown', ev => {
      if (ev.key === 'ArrowUp') this.input.up = true; else if (ev.key === 'ArrowDown') this.input.down = true;
      else if (ev.key === 'Escape') this.back();
    });
    addEventListener('keyup', ev => { if (ev.key === 'ArrowUp') this.input.up = false; else if (ev.key === 'ArrowDown') this.input.down = false; });
  },

  async init() {
    Hangar.init(); this.bindPull(); this.bindPad();
    $('#fBack').addEventListener('click', () => this.back());
    $('#eHangar').addEventListener('click', () => this.show('hangar'));
    $('#eAgain').addEventListener('click', () => this.startFlight());
    // Bouton retour d'Android (Capacitor) : le même gestionnaire ; sur l'atelier, on laisse l'appli se fermer
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.addListener('backButton', () => { if (!this.back()) Capacitor.Plugins.App.exitApp(); });
    this.show('hangar');
    // La boucle : PixiJS appelle tick à chaque image (30 par seconde par défaut)
    await Scene.init($('#stage'));
    Scene.app.ticker.add(t => this.tick(Math.min(0.05, t.deltaMS / 1000)));
    Scene.pause();
    const n = +(new URLSearchParams(location.search).get('stress') || 0);
    if (n) { this.startFlight().then(() => { Scene.stress(n); setInterval(() => { $('#fps').hidden = false; $('#fps').textContent = Scene.fps() + ' img/s · ' + n + ' objets'; }, 500); }); }
  },
};
App.init();
