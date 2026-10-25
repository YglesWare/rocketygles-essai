// RocketYgles : les dessins, peints une seule fois au Canvas 2D puis donnés à PixiJS comme textures (js/scene.js).
// Même style que la référence graphique (ref/decors.html) : lumière, brume, profondeur, contour encre, volumes en dégradés.
// Les bandes de décor (montagnes, collines, pré) se répètent sans couture, pour défiler en parallaxe.
'use strict';

const Art = {
  INK: '#2a1b3d',
  // Un canvas de travail à la bonne densité ; draw(c, w, h) dessine en unités CSS
  canvas(w, h, res, draw) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * res); cv.height = Math.ceil(h * res);
    const c = cv.getContext('2d'); c.scale(res, res); draw(c, w, h); return cv;
  },
  lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; },
  rg(c, x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; },

  // Le ciel de fin d'après-midi, avec le soleil, son halo et des rayons doux (ne bouge pas)
  sky(c, w, h) {
    c.fillStyle = this.lg(c, 0, 0, 0, h, [[0, '#2f6fd6'], [0.35, '#6fb2f2'], [0.6, '#bfe0fb'], [0.75, '#ffe1b8'], [0.87, '#ffc890'], [1, '#ffb070']]); c.fillRect(0, 0, w, h);
    const sx = w * 0.8, sy = h * 0.62;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = this.rg(c, sx, sy, 0, h * 0.4, [[0, 'rgba(255,240,200,.85)'], [0.25, 'rgba(255,214,150,.32)'], [1, 'rgba(255,200,140,0)']]); c.fillRect(0, 0, w, h);
    c.filter = 'blur(10px)';
    for (let i = 0; i < 7; i++) { const a = -2.5 + i * 0.36, s = 0.05 + (i % 3) * 0.035; c.fillStyle = 'rgba(255,245,215,.045)'; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, h * 1.2, a, a + s); c.closePath(); c.fill(); }
    c.restore();
    c.save(); c.shadowColor = 'rgba(255,230,170,1)'; c.shadowBlur = 50; c.fillStyle = '#fff7dc'; c.beginPath(); c.arc(sx, sy, 34, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // Un nuage en boules : éclairé par le haut, ombré en bas, avec une ombre douce dessous
  cloud(c, w, h) {
    const x = w / 2, y = h * 0.55, s = h * 0.32;
    const blobs = [[0, 0, 1], [-0.9, 0.25, 0.7], [0.95, 0.2, 0.75], [-0.4, -0.45, 0.75], [0.45, -0.5, 0.8], [1.6, 0.4, 0.5], [-1.55, 0.45, 0.48]];
    c.save(); c.fillStyle = 'rgba(70,60,140,.16)'; c.filter = 'blur(6px)'; c.beginPath(); c.ellipse(x, y + s * 0.75, s * 2, s * 0.35, 0, 0, Math.PI * 2); c.fill(); c.restore();
    for (const [dx, dy, r] of blobs) {
      const bx = x + dx * s, by = y + dy * s, br = r * s;
      c.fillStyle = this.rg(c, bx - br * 0.3, by - br * 0.5, br * 0.1, br * 1.25, [[0, '#ffffff'], [0.55, '#ffffff'], [1, '#c9c4ea']]);
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
    }
  },

  // Silhouette qui se répète exactement tous les w pixels (sommes de sinus à périodes entières)
  ridge(w, base, amp, waves) { return x => base - waves.reduce((s, [n, a, ph]) => s + Math.sin((x / w) * Math.PI * 2 * n + ph) * a * amp, 0); },
  band(c, w, h, f, top, bot, crest) {
    c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 4) c.lineTo(x, f(x)); c.lineTo(w, h); c.closePath();
    c.fillStyle = this.lg(c, 0, h * 0.2, 0, h, [[0, top], [1, bot]]); c.fill();
    if (crest) { c.save(); c.clip(); c.strokeStyle = crest; c.lineWidth = 8; c.filter = 'blur(3px)'; c.beginPath(); for (let x = 0; x <= w; x += 4) c[x ? 'lineTo' : 'moveTo'](x, f(x)); c.stroke(); c.restore(); }
  },
  mountains(c, w, h) {
    const f = this.ridge(w, h * 0.45, h * 0.3, [[2, 0.6, 0.3], [5, 0.3, 1.1], [11, 0.12, 2]]);
    this.band(c, w, h, f, '#b7b6d8', '#e9c9c6');
  },
  hills(c, w, h) {
    const f = this.ridge(w, h * 0.45, h * 0.25, [[3, 0.6, 0.8], [7, 0.25, 0.2]]);
    this.band(c, w, h, f, '#93b98a', '#c9cf9f', 'rgba(255,240,190,.55)');
    for (let i = 0; i < 9; i++) { const x = (i + 0.3) * w / 9, y = f(x) + 4; this.tree(c, x, y, 8 + (i % 3) * 2); }
  },
  // Touffes d'herbe floues au premier plan : elles défilent plus vite que le sol (sensation de vitesse)
  fore(c, w, h) {
    c.filter = 'blur(2px)';
    for (let i = 0; i < 46; i++) {
      const x = (i * 131) % w, hh = 34 + ((i * 47) % 50), col = i % 2 ? '#2f7d36' : '#3f9a3f';
      c.strokeStyle = col; c.lineWidth = 5 + (i % 3); c.lineCap = 'round';
      for (const dx of [-6, 0, 6]) if (x + dx > 8 && x + dx < w - 8) { c.beginPath(); c.moveTo(x + dx, h); c.quadraticCurveTo(x + dx + 4, h - hh / 2, x + dx * 2.2 + 3, h - hh); c.stroke(); }
    }
    for (let i = 0; i < 9; i++) { c.fillStyle = ['#fff2a8', '#ffb3c7', '#ffffff'][i % 3]; c.beginPath(); c.arc(30 + i * w / 9, h - 30 - (i % 3) * 14, 5, 0, Math.PI * 2); c.fill(); }
  },
  tree(c, x, y, s) {
    c.fillStyle = 'rgba(20,40,20,.25)'; c.beginPath(); c.ellipse(x + s * 0.3, y, s * 0.9, s * 0.22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6b4a2c'; c.fillRect(x - s * 0.1, y - s * 0.9, s * 0.2, s * 0.9);
    c.fillStyle = this.rg(c, x - s * 0.3, y - s * 1.6, s * 0.1, s * 1.1, [[0, '#9ccf7a'], [1, '#5f9a52']]);
    c.beginPath(); c.arc(x, y - s * 1.3, s * 0.75, 0, Math.PI * 2); c.arc(x - s * 0.45, y - s, s * 0.5, 0, Math.PI * 2); c.arc(x + s * 0.45, y - s * 1.05, s * 0.55, 0, Math.PI * 2); c.fill();
  },

  // Yglou de profil, tourné vers la droite : casque d'aviateur, lunettes, écharpe. noScarf : sans l'écharpe (dans le jeu,
  // une écharpe animée la remplace, js/scene.js)
  yglouSide(c, x, y, r, noScarf) {
    const INK = this.INK;
    c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    // l'écharpe flotte vers l'arrière en remontant, soulevée par le vent (elle passe au-dessus de l'avion)
    if (!noScarf) {
      c.fillStyle = this.lg(c, -r * 3, 0, 0, 0, [[0, '#d8355f'], [1, '#ff6f93']]); c.lineWidth = r * 0.12;
      c.beginPath(); c.moveTo(-r * 0.3, r * 0.5); c.bezierCurveTo(-r * 1.2, r * 0.2, -r * 1.9, r * 0.35, -r * 2.9, -r * 0.15); c.lineTo(-r * 2.75, r * 0.3); c.bezierCurveTo(-r * 1.9, r * 0.75, -r * 1.1, r * 0.7, -r * 0.2, r * 0.9); c.closePath(); c.fill(); c.stroke();
    }
    c.fillStyle = '#e0a640'; c.lineWidth = r * 0.1;
    for (const [a, k] of [[-2.2, 1], [-2.5, 0.85], [-2.75, 0.7]]) { c.save(); c.translate(-r * 0.3, -r * 0.62); c.rotate(a); c.beginPath(); c.moveTo(0, -r * 0.13); c.quadraticCurveTo(r * 0.6 * k, -r * 0.2, r * 0.95 * k, 0); c.quadraticCurveTo(r * 0.55 * k, r * 0.16, 0, r * 0.13); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = this.rg(c, r * 0.15, -r * 0.35, r * 0.1, r * 1.2, [[0, '#d99a55'], [1, '#8a5226']]); c.lineWidth = r * 0.12;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = this.lg(c, 0, -r, 0, 0, [[0, '#7a4a2a'], [1, '#5a341c']]); c.beginPath(); c.arc(-r * 0.15, -r * 0.1, r * 1.05, Math.PI * 1.02, Math.PI * 1.78); c.lineTo(-r * 0.15, -r * 0.1); c.closePath(); c.fill();
    c.restore();
    c.lineWidth = r * 0.1; c.fillStyle = '#3b2a1f';
    c.beginPath(); c.moveTo(-r * 0.75, -r * 0.62); c.quadraticCurveTo(-r * 0.1, -r * 0.95, r * 0.55, -r * 0.7); c.lineTo(r * 0.5, -r * 0.55); c.quadraticCurveTo(-r * 0.1, -r * 0.8, -r * 0.7, -r * 0.48); c.closePath(); c.fill();
    c.fillStyle = this.rg(c, r * 0.18, -r * 0.78, r * 0.02, r * 0.3, [[0, '#e8fbff'], [1, '#5fb4e8']]); c.beginPath(); c.ellipse(r * 0.2, -r * 0.72, r * 0.27, r * 0.22, -0.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.lineWidth = r * 0.08; c.beginPath(); c.ellipse(r * 0.42, -r * 0.12, r * 0.2, r * 0.24, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(r * 0.5, -r * 0.1, r * 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.46, -r * 0.18, r * 0.045, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(r * 0.22, -r * 0.42); c.quadraticCurveTo(r * 0.45, -r * 0.5, r * 0.66, -r * 0.36); c.stroke();
    c.fillStyle = 'rgba(255,120,150,.45)'; c.beginPath(); c.ellipse(r * 0.18, r * 0.28, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = this.lg(c, r * 0.7, -r * 0.2, r * 1.4, r * 0.4, [[0, '#ffe066'], [1, '#f0a400']]); c.lineWidth = r * 0.1;
    c.beginPath(); c.moveTo(r * 0.72, -r * 0.22); c.quadraticCurveTo(r * 1.3, -r * 0.2, r * 1.42, r * 0.22); c.quadraticCurveTo(r * 1.36, r * 0.36, r * 1.18, r * 0.24); c.quadraticCurveTo(r * 1.0, r * 0.3, r * 0.78, r * 0.3); c.closePath(); c.fill(); c.stroke();
    c.restore();
  },

  // Les avions d'Yglou, du carton à l'acier (validés le 24 octobre 2026, ref/avions.html). Vue de côté, nez à droite,
  // dessinés autour du centre du fuselage. plane() les place dans un cadre de PLANE.w × PLANE.h ; le point d'appui
  // (entre les deux roues, au ras de la piste) est en (PLANE.ax, PLANE.ay). noScarf : sans l'écharpe (le jeu l'anime).
  // scale : sa taille dans le jeu (à 75 %, les arbres et l'éolienne gardent des proportions crédibles à côté de lui).
  PLANE: { w: 176, h: 110, ox: 80, oy: 68, ax: 87, ay: 97, scale: 0.75 },
  plane(c, w, h, kind, noScarf) {
    c.translate(this.PLANE.ox, this.PLANE.oy); c.lineJoin = 'round'; c.lineCap = 'round';
    this.PLANES[kind || 'carton'].call(this, c, noScarf);
  },
  // Le fuselage commun (nez à droite, de -62 à 70)
  fuselage(c) { c.beginPath(); c.moveTo(-62, 4); c.bezierCurveTo(-60, -16, -30, -20, 10, -19); c.bezierCurveTo(44, -18, 64, -12, 70, 0); c.bezierCurveTo(64, 12, 44, 16, 10, 16); c.bezierCurveTo(-30, 16, -60, 16, -62, 4); c.closePath(); },
  // Le cockpit creusé et Yglou dedans ; canopy : verrière fermée (acier) au lieu du pare-brise
  cockpit(c, canopy, noScarf) {
    const INK = this.INK, hx = 8, hy = -17, hrx = 22, hry = 5.5;
    if (canopy) {
      // Verrière fermée : pas de trou ni de rebord ; Yglou est assis derrière le haut du fuselage, sous un dôme de verre
      // dont on ne trace que la courbe (aucun trait ne passe devant lui). Pas de vent : pas d'écharpe.
      c.save(); c.beginPath(); c.moveTo(-62, 4); c.bezierCurveTo(-60, -16, -30, -20, 10, -19); c.bezierCurveTo(44, -18, 64, -12, 70, 0);
      c.lineTo(120, 0); c.lineTo(120, -200); c.lineTo(-120, -200); c.lineTo(-120, 4); c.closePath(); c.clip();
      this.yglouSide(c, hx + 1, hy - 10, 13, true); c.restore();
      c.strokeStyle = INK; c.lineWidth = 3.2; c.beginPath(); c.moveTo(-30, -19.2); c.bezierCurveTo(-10, -19.6, 10, -19.4, 44, -17.6); c.stroke(); // le bord du fuselage repasse devant
      const dome = () => { c.moveTo(-17, -17); c.bezierCurveTo(-16, -60, 30, -62, 42, -17); };
      c.beginPath(); dome(); c.closePath(); c.fillStyle = this.lg(c, 0, -58, 0, -17, [[0, 'rgba(220,245,255,.42)'], [1, 'rgba(150,215,255,.18)']]); c.fill();
      c.save(); c.beginPath(); dome(); c.closePath(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-10, -26); c.bezierCurveTo(-9, -42, 2, -50, 14, -51); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(24, -48, 2.4, 1.6, 0.3, 0, Math.PI * 2); c.fill();
      c.restore();
      c.beginPath(); dome(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      return;
    }
    c.fillStyle = this.lg(c, 0, hy - hry, 0, hy + hry, [[0, '#1c1226'], [1, '#4a3048']]); c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2); c.fill();
    // bord arrière du trou d'abord (il passe derrière Yglou), puis Yglou, puis seulement le bord avant (il cache le bas de son corps)
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, Math.PI, Math.PI * 2); c.stroke();
    c.save(); c.beginPath(); c.rect(-120, -200, 240, 200 + hy); c.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2); c.clip(); this.yglouSide(c, hx + 1, hy - 10, 13, noScarf); c.restore();
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI); c.stroke();
    // pare-brise : bombé vers l'avant, incliné vers l'arrière
    c.fillStyle = 'rgba(170,230,255,.5)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(41, -17); c.quadraticCurveTo(40, -31, 30, -37); c.lineTo(28, -34); c.quadraticCurveTo(34, -29, 34, -17); c.closePath(); c.fill(); c.stroke();
  },
  // Hélice qui tourne : un disque flou, deux pales visibles et le cône
  prop(c, x, r, blade, spinner) {
    c.save(); c.translate(x, 0);
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(4, 0, 5, r, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(42,27,61,.25)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = blade; c.strokeStyle = this.INK; c.lineWidth = 2;
    c.beginPath(); c.ellipse(4, -r * 0.55, 2.6, r * 0.45, 0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(4, r * 0.55, 2.6, r * 0.45, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = spinner; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-2, -7); c.quadraticCurveTo(14, -6, 15, 0); c.quadraticCurveTo(14, 6, -2, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
  },
  wheel(c, x, y, tire, hub, deco) { c.strokeStyle = this.INK; c.lineWidth = 2.5; c.fillStyle = tire; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = hub; c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.5; c.stroke(); if (deco) deco(x, y); },
  leg(c, x, col) { c.strokeStyle = this.INK; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 8); c.lineTo(x, 20); c.stroke(); c.strokeStyle = col; c.lineWidth = 2.5; c.stroke(); },

  // Chaque avion est appelé avec this = Art. Les roues d'abord : elles passent derrière le fuselage et l'aile.
  PLANES: {
    // Carton : cannelures sur les tranches, ruban adhésif, sigles de colis, roues en bouchons sur une paille
    carton(c, noScarf) {
      const INK = this.INK;
      c.strokeStyle = '#ff8fb0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-36, 20); c.lineTo(50, 20); c.stroke(); // la paille
      for (const x of [-30, 44]) this.wheel(c, x, 20, '#e8384f', '#ff8fa0', (wx, wy) => { c.strokeStyle = 'rgba(42,27,61,.4)'; c.lineWidth = 1; for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; c.beginPath(); c.moveTo(wx + Math.cos(t) * 6.5, wy + Math.sin(t) * 6.5); c.lineTo(wx + Math.cos(t) * 9, wy + Math.sin(t) * 9); c.stroke(); } });
      this.fuselage(c); c.fillStyle = this.lg(c, 0, -20, 0, 16, [[0, '#f2d39f'], [0.5, '#ddae70'], [1, '#b47c40']]); c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(120,70,25,.22)'; c.lineWidth = 1.2; for (let i = -70; i < 80; i += 5) { c.beginPath(); c.moveTo(i, -22); c.lineTo(i + 4, 18); c.stroke(); }
      c.fillStyle = 'rgba(255,240,190,.72)'; c.fillRect(24, -22, 10, 40); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(25, -22, 2, 40); // ruban adhésif
      c.strokeStyle = 'rgba(95,55,25,.55)'; c.lineWidth = 1.6; // sigles « haut » d'un colis
      for (const x of [-34, -27]) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, -2); c.moveTo(x - 3, 1); c.lineTo(x, -3); c.lineTo(x + 3, 1); c.stroke(); }
      c.beginPath(); c.arc(-12, 3, 4.5, 0.3, 5.6); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(4, -11, 52, 4, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      c.strokeStyle = INK; c.lineWidth = 3.2; this.fuselage(c); c.stroke();
      // nez : une tranche de carton avec ses cannelures
      c.save(); c.beginPath(); c.ellipse(66, 0, 6, 11, 0, 0, Math.PI * 2); c.fillStyle = '#c9965a'; c.fill(); c.clip(); c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.2; c.beginPath(); for (let y = -11; y < 12; y += 3) { c.moveTo(60, y); c.quadraticCurveTo(66, y - 2, 72, y); } c.stroke(); c.restore();
      c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.ellipse(66, 0, 6, 11, 0, 0, Math.PI * 2); c.stroke();
      this.cockpit(c, false, noScarf);
      c.lineWidth = 3; c.fillStyle = this.lg(c, 0, -40, 0, -6, [[0, '#e8bd84'], [1, '#c08a4c']]);
      c.beginPath(); c.moveTo(-58, 0); c.lineTo(-70, -30); c.lineTo(-52, -28); c.lineTo(-38, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,240,190,.75)'; c.fillRect(-66, -24, 18, 6);
      c.fillStyle = this.lg(c, 0, 2, 0, 22, [[0, '#f0cb92'], [1, '#bd8547']]);
      c.beginPath(); c.moveTo(-18, 2); c.lineTo(36, 2); c.quadraticCurveTo(52, 6, 50, 14); c.lineTo(-30, 22); c.quadraticCurveTo(-34, 14, -18, 2); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.2; c.beginPath(); for (let x = -28; x < 48; x += 4) { c.moveTo(x, 19 - (x + 28) * 0.1); c.quadraticCurveTo(x + 2, 22 - (x + 28) * 0.1, x + 4, 19 - (x + 32) * 0.1); } c.stroke();
    },
    // Plastique : un jouet brillant aux couleurs vives, avec ses lignes de moulage et une petite hélice
    plastique(c, noScarf) {
      for (const x of [-30, 44]) { this.leg(c, x, '#ffd23f'); this.wheel(c, x, 20, '#2a2236', '#ffffff'); }
      this.fuselage(c); c.fillStyle = this.lg(c, 0, -20, 0, 16, [[0, '#8cc8ff'], [0.45, '#3f8ff0'], [1, '#1e58b8']]); c.fill();
      c.save(); c.clip();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(0, -12, 50, 3.5, -0.02, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-62, 2); c.bezierCurveTo(-20, 0, 30, 0, 70, 1); c.stroke();
      c.fillStyle = '#ffd23f'; c.fillRect(-62, 6, 140, 4); c.fillStyle = 'rgba(42,27,61,.35)'; for (const x of [-40, -10, 30]) { c.beginPath(); c.arc(x, 1, 1.6, 0, Math.PI * 2); c.fill(); }
      c.restore();
      c.strokeStyle = this.INK; c.lineWidth = 3.2; this.fuselage(c); c.stroke();
      this.cockpit(c, false, noScarf);
      c.lineWidth = 3; c.fillStyle = this.lg(c, 0, -40, 0, -6, [[0, '#ff8aa8'], [1, '#e0305c']]);
      c.beginPath(); c.moveTo(-58, 0); c.quadraticCurveTo(-74, -30, -60, -32); c.quadraticCurveTo(-48, -30, -38, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = this.lg(c, 0, 2, 0, 22, [[0, '#fff1a0'], [1, '#f5b800']]);
      c.beginPath(); c.moveTo(-18, 2); c.lineTo(38, 2); c.quadraticCurveTo(54, 4, 52, 13); c.quadraticCurveTo(10, 24, -30, 22); c.quadraticCurveTo(-34, 14, -18, 2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(10, 6, 26, 2, -0.05, 0, Math.PI * 2); c.fill();
      this.prop(c, 68, 16, '#ff4f81', '#ffd23f');
    },
    // Bois : planches, veines et clous, ailes à nervures, hélice en bois
    bois(c, noScarf) {
      for (const x of [-30, 44]) { this.leg(c, x, '#a8743f'); this.wheel(c, x, 20, '#c28c52', '#7a4c25', (wx, wy) => { c.strokeStyle = '#5e3a1c'; c.lineWidth = 1.5; for (let a = 0; a < 3; a++) { const t = a / 3 * Math.PI; c.beginPath(); c.moveTo(wx + Math.cos(t) * 8, wy + Math.sin(t) * 8); c.lineTo(wx - Math.cos(t) * 8, wy - Math.sin(t) * 8); c.stroke(); } }); }
      this.fuselage(c); c.fillStyle = this.lg(c, 0, -20, 0, 16, [[0, '#f0c088'], [0.5, '#d29454'], [1, '#9c6230']]); c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(90,50,20,.55)'; c.lineWidth = 1.4; for (const y of [-9, 2, 11]) { c.beginPath(); c.moveTo(-70, y); c.lineTo(75, y); c.stroke(); } // les planches
      c.strokeStyle = 'rgba(110,62,25,.35)'; c.lineWidth = 1; // les veines
      for (let i = 0; i < 9; i++) { const y = -16 + i * 3.6, x0 = -60 + (i * 37) % 60; c.beginPath(); c.moveTo(x0, y); c.bezierCurveTo(x0 + 20, y - 2, x0 + 30, y + 2, x0 + 55, y); c.stroke(); c.beginPath(); c.ellipse(x0 + 70, y, 5, 1.6, 0, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = '#4a3042'; for (const x of [-48, -18, 20, 50]) for (const y of [-5, 6]) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); } // les clous
      c.fillStyle = 'rgba(255,240,210,.35)'; c.beginPath(); c.ellipse(4, -12, 52, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      c.strokeStyle = this.INK; c.lineWidth = 3.2; this.fuselage(c); c.stroke();
      this.cockpit(c, false, noScarf);
      c.lineWidth = 3; c.fillStyle = this.lg(c, 0, -40, 0, -6, [[0, '#e7b47b'], [1, '#b0733a']]);
      c.beginPath(); c.moveTo(-58, 0); c.lineTo(-70, -30); c.lineTo(-52, -30); c.lineTo(-38, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff4f81'; c.beginPath(); c.moveTo(-68.5, -27); c.lineTo(-53, -27); c.lineTo(-51, -23); c.lineTo(-67, -23); c.closePath(); c.fill();
      c.fillStyle = this.lg(c, 0, 2, 0, 22, [[0, '#f0c088'], [1, '#b0733a']]);
      c.beginPath(); c.moveTo(-18, 2); c.lineTo(36, 2); c.quadraticCurveTo(52, 6, 50, 14); c.lineTo(-30, 22); c.quadraticCurveTo(-34, 14, -18, 2); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,240,210,.7)'; c.lineWidth = 2.5; for (const x of [-12, 4, 20, 34]) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x - 3, 19); c.stroke(); } // nervures
      this.prop(c, 68, 18, '#c28c52', '#8a5a2e');
    },
    // Acier : métal poli, panneaux et rivets, capot peint, grande hélice, verrière fermée, roues carénées
    acier(c) {
      const INK = this.INK;
      for (const x of [-30, 44]) { this.leg(c, x, '#c9cfdc'); this.wheel(c, x, 21, '#2a2236', '#d9dde8'); c.fillStyle = this.lg(c, x - 10, 0, x + 10, 0, [[0, '#d9dde8'], [1, '#8c93a8']]); c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 11, 18); c.quadraticCurveTo(x - 10, 8, x, 8); c.quadraticCurveTo(x + 12, 8, x + 12, 18); c.closePath(); c.fill(); c.stroke(); }
      this.fuselage(c); c.fillStyle = this.lg(c, 0, -20, 0, 16, [[0, '#f8f9fd'], [0.35, '#d3d8e4'], [0.6, '#a9b0c3'], [1, '#6f7790']]); c.fill();
      c.save(); c.clip();
      c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(-70, -14, 150, 2.5); // reflet net du métal poli
      c.strokeStyle = 'rgba(60,66,90,.45)'; c.lineWidth = 1.2; for (const x of [-40, -14, 14]) { c.beginPath(); c.moveTo(x, -22); c.lineTo(x + 2, 18); c.stroke(); } // panneaux
      c.fillStyle = 'rgba(60,66,90,.55)'; for (let x = -54; x < 50; x += 5) { c.beginPath(); c.arc(x, -6, 0.9, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x, 10, 0.9, 0, Math.PI * 2); c.fill(); } // rivets
      c.fillStyle = '#ff4f81'; c.fillRect(-62, 2, 120, 4); // bande peinte
      c.fillStyle = this.lg(c, 44, 0, 72, 0, [[0, '#ff7aa0'], [1, '#c8305a']]); c.fillRect(44, -22, 30, 44); // capot rouge
      c.restore();
      c.strokeStyle = INK; c.lineWidth = 3.2; this.fuselage(c); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(44, -17); c.lineTo(44, 15); c.stroke();
      c.fillStyle = '#4a4458'; c.beginPath(); c.roundRect(48, 8, 10, 3.5, 1.5); c.fill(); c.beginPath(); c.roundRect(52, 4, 10, 3.5, 1.5); c.fill(); // pots d'échappement
      c.save(); c.font = '400 9px Bangers, Impact, sans-serif'; c.fillStyle = INK; c.fillText('YG-01', -40, 0); c.restore();
      this.cockpit(c, true); c.strokeStyle = INK;
      c.lineWidth = 3; c.fillStyle = this.lg(c, 0, -40, 0, -6, [[0, '#eef0f6'], [1, '#9aa1b6']]);
      c.beginPath(); c.moveTo(-58, 0); c.lineTo(-68, -30); c.quadraticCurveTo(-60, -34, -50, -30); c.lineTo(-38, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff4f81'; c.beginPath(); c.moveTo(-67.3, -28); c.quadraticCurveTo(-60, -32, -51, -28.5); c.lineTo(-49.5, -25); c.quadraticCurveTo(-59, -28, -66, -24.5); c.closePath(); c.fill();
      c.fillStyle = this.lg(c, 0, 2, 0, 22, [[0, '#f4f6fb'], [1, '#8f97ad']]);
      c.beginPath(); c.moveTo(-18, 2); c.lineTo(38, 2); c.quadraticCurveTo(54, 4, 52, 13); c.lineTo(-30, 22); c.quadraticCurveTo(-34, 14, -18, 2); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(60,66,90,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-26, 18); c.lineTo(46, 10); c.stroke();
      c.fillStyle = '#ff4f81'; c.beginPath(); c.moveTo(44, 3); c.quadraticCurveTo(54, 4, 52, 13); c.lineTo(46, 13.6); c.closePath(); c.fill();
      this.prop(c, 72, 22, '#4a4458', '#ff4f81');
    },
  },

  // La piste de Papi et son tremplin (validés le 24 octobre 2026, ref/tremplins.html). g : { H (hauteur de la piste),
  // R (longueur de la piste plate), len (longueur du relevé), top(m) (hauteur du tablier en m) } ; X, Y : mètres → pixels ;
  // gy : le sol en pixels ; lv : niveau du tremplin (garde-corps dès 3, fanions dès 6)
  runway(c, g, X, Y, gy, lv) {
    const INK = this.INK, S = X(1) - X(0);
    // ombre de la piste au sol
    c.save(); c.filter = 'blur(8px)'; c.fillStyle = 'rgba(30,50,20,.35)'; c.beginPath(); c.ellipse((X(-g.R) + X(g.len)) / 2 + 20, gy + 6, (X(g.len) - X(-g.R)) / 2 + 30, 10, 0, 0, Math.PI * 2); c.fill(); c.restore();
    // Les tréteaux : jambes en A, liens horizontaux, croisillons ; plus haut le tremplin, plus il y a d'étages
    const tiers = Math.max(1, Math.round(g.H / 3.5));
    const bents = []; for (let m = -g.R + 1; m < g.len - 0.5; m += 4) bents.push(m); bents.push(g.len - 0.4);
    const wood = (x1, y1, x2, y2, w, light) => { c.strokeStyle = INK; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = light ? '#d8a467' : '#a8743f'; c.lineWidth = w; c.stroke(); };
    c.lineCap = 'round';
    // croisillons entre deux tréteaux (derrière)
    for (let i = 0; i < bents.length - 1; i++) {
      const a = bents[i], b = bents[i + 1];
      for (let t = 0; t < tiers; t++) {
        const ya = Y(g.top(a) * t / tiers), yb = Y(g.top(a) * (t + 1) / tiers), yc = Y(g.top(b) * t / tiers), yd = Y(g.top(b) * (t + 1) / tiers);
        c.strokeStyle = '#7a4c25'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(a), ya); c.lineTo(X(b), yd); c.moveTo(X(a), yb); c.lineTo(X(b), yc); c.stroke();
      }
    }
    for (const m of bents) {
      const top = Y(g.top(m) - 0.15), sp = 0.12 * g.top(m) * S + 6;
      wood(X(m) - sp, gy, X(m) - 3, top, 6, false); wood(X(m) + sp, gy, X(m) + 3, top, 6, true);
      for (let t = 1; t < tiers; t++) { const yy = Y(g.top(m) * t / tiers), w = sp * (1 - t / tiers) + 3; wood(X(m) - w - 3, yy, X(m) + w + 3, yy, 4, true); }
      c.fillStyle = '#8a8197'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(X(m) - sp - 9, gy - 6, 16, 8, 3); c.roundRect(X(m) + sp - 7, gy - 6, 16, 8, 3); c.fill(); c.stroke(); // pierres sous les pieds
    }
    // échelle au départ
    const lx = X(-g.R) - 26; wood(lx, gy, lx + 4, Y(g.H) + 4, 4, false); wood(lx + 18, gy, lx + 22, Y(g.H) + 4, 4, true);
    for (let yy = gy - 14; yy > Y(g.H) + 10; yy -= 14) wood(lx + 3, yy, lx + 19, yy, 3, true);
    // Le tablier : planches claires et foncées, poutre de rive boulonnée, liseré de lumière, rebord du tremplin
    const pts = []; for (let m = -g.R; m <= g.len + 0.001; m += 0.25) pts.push([X(m), Y(g.top(m))]);
    const edge = dy => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1] + dy); for (const [x, y] of pts) c.lineTo(x, y + dy); };
    c.lineJoin = 'round'; c.lineCap = 'butt';
    edge(9); c.strokeStyle = INK; c.lineWidth = 17; c.stroke(); edge(9); c.strokeStyle = '#7a4c25'; c.lineWidth = 12; c.stroke(); // poutre
    edge(1.5); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); edge(1.5); c.strokeStyle = '#efbd7e'; c.lineWidth = 5; c.stroke(); // dessus des planches
    for (let i = 0; i < pts.length - 2; i += 3) { const [x, y] = pts[i]; c.fillStyle = (i / 3) % 2 ? 'rgba(160,100,45,.35)' : 'rgba(255,235,190,.25)'; c.fillRect(x, y - 2, (pts[i + 3] || pts[i])[0] - x, 5); }
    c.fillStyle = '#4a3042'; for (let i = 4; i < pts.length; i += 8) { const [x, y] = pts[i]; c.beginPath(); c.arc(x, y + 9, 1.8, 0, Math.PI * 2); c.fill(); } // boulons
    c.strokeStyle = 'rgba(255,248,220,.9)'; c.lineWidth = 1.5; edge(-1.5); c.stroke();
    c.lineCap = 'round';
    // garde-corps (dès le niveau 3) et fanions (dès le niveau 6)
    if (lv >= 3) {
      for (let i = 0; i < pts.length - 10; i += 10) { const [x, y] = pts[i]; wood(x, y - 2, x, y - 18, 3, true); }
      c.strokeStyle = INK; c.lineWidth = 5; edge(-18); c.stroke(); c.strokeStyle = lv >= 6 ? '#ff4f81' : '#c28c52'; c.lineWidth = 2.5; edge(-18); c.stroke();
    }
    if (lv >= 6) {
      c.strokeStyle = 'rgba(42,27,61,.5)'; c.lineWidth = 1.2; c.beginPath();
      const fl = []; for (let i = 0; i < pts.length - 6; i += 6) fl.push([pts[i][0], pts[i][1] - 18 + 5]);
      for (const [x, y] of fl) c.lineTo(x, y); c.stroke();
      fl.forEach(([x, y], i) => { if (i === fl.length - 1) return; const nx = fl[i + 1][0]; c.fillStyle = ['#ffd23f', '#ff4f81', '#7fd3ff', '#5cd86a'][i % 4]; c.beginPath(); c.moveTo(x + 2, y); c.lineTo(nx - 2, y); c.lineTo((x + nx) / 2, y + 9); c.closePath(); c.fill(); });
    }
    // fanion au bout du tremplin
    const [ex, ey] = pts[pts.length - 1];
    wood(ex - 2, ey, ex - 2, ey - 34, 3, true);
    c.fillStyle = '#ff4f81'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 1, ey - 34); c.quadraticCurveTo(ex + 12, ey - 32, ex + 22, ey - 27); c.quadraticCurveTo(ex + 10, ey - 25, ex - 1, ey - 22); c.closePath(); c.fill(); c.stroke();
  },

  // La catapulte à élastique (validée le 24 octobre 2026, ref/elastiques.html) : à plat, comme sur un porte-avions.
  // Les attaches sont posées sur la bande de roulement au bout de la piste, juste avant que le tremplin se relève ;
  // l'élastique court le long de la piste jusqu'au crochet sous le nez de l'avion. Cinq looks, du bois à l'acier,
  // chacun valable jusqu'au suivant : niveaux 0-1, 2-3, 4-6, 7-9, puis 10.
  ELASTIC: [
    [0, { name: 'Un piquet cloué et un élastique', fork: 'branch', strands: [['#ff6f93', 3]], pouch: false }],
    [2, { name: 'Élastique doublé, attache ficelée', fork: 'branch', strands: [['#ff6f93', 3], ['#ff3d72', 3]], pouch: false, twine: true }],
    [4, { name: 'Plaque vissée, gros élastique, poche en cuir', fork: 'planed', strands: [['#e8384f', 6]], pouch: true }],
    [7, { name: 'Trois brins tressés, plaque en métal', fork: 'bracket', strands: [['#ff4f81', 4], ['#ff8a3d', 4], ['#ffd23f', 4]], pouch: true }],
    [10, { name: 'Taquet en acier, sandow et treuil', fork: 'steel', strands: [['#2a2236', 8]], pouch: true, winch: true }],
  ],
  elasticStyle(lv) { let s = this.ELASTIC[0][1]; for (const [l, st] of this.ELASTIC) if (lv >= l) s = st; return s; },
  // Une attache, posée en (x, y) sur la piste ; far : celle du fond de la piste (un peu décalée).
  // Renvoie le point où l'élastique s'accroche.
  cleat(c, x, y, st, far) {
    c.save(); if (far) { c.translate(-8, -2); c.globalAlpha = 0.85; }
    c.strokeStyle = this.INK; c.lineWidth = 2.2;
    if (st.fork === 'branch') { // un piquet de bois cloué à plat
      c.fillStyle = this.lg(c, 0, y - 8, 0, y, [[0, '#c28c52'], [1, '#7a4c25']]); c.beginPath(); c.roundRect(x - 12, y - 7, 24, 7, 2); c.fill(); c.stroke();
      c.fillStyle = '#4a3042'; for (const dx of [-7, 7]) { c.beginPath(); c.arc(x + dx, y - 3.5, 1.6, 0, Math.PI * 2); c.fill(); }
      if (st.twine) { c.strokeStyle = '#d9c08a'; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 3 - 2, y - 8); c.lineTo(x + i * 3 + 2, y); c.stroke(); } }
    } else if (st.fork === 'planed' || st.fork === 'bracket') { // une plaque vissée et son anneau
      c.fillStyle = st.fork === 'bracket' ? this.lg(c, 0, y - 6, 0, y, [[0, '#eef0f6'], [1, '#8f88aa']]) : this.lg(c, 0, y - 6, 0, y, [[0, '#f0c088'], [1, '#a8693a']]);
      c.beginPath(); c.roundRect(x - 14, y - 5, 28, 5, 2); c.fill(); c.stroke();
      c.fillStyle = '#2a2236'; for (const dx of [-9, 9]) { c.beginPath(); c.arc(x + dx, y - 2.5, 1.4, 0, Math.PI * 2); c.fill(); }
      c.lineWidth = 2.6; c.beginPath(); c.ellipse(x, y - 9, 4, 5, 0, 0, Math.PI * 2); c.stroke();
    } else { // un taquet en acier boulonné, bout rouge
      c.fillStyle = this.lg(c, 0, y - 12, 0, y, [[0, '#eef0f6'], [1, '#6f7790']]);
      c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x - 12, y - 6); c.lineTo(x - 16, y - 11); c.lineTo(x + 16, y - 11); c.lineTo(x + 12, y - 6); c.lineTo(x + 16, y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff4f81'; c.beginPath(); c.roundRect(x - 16, y - 13, 32, 4, 2); c.fill(); c.stroke();
    }
    c.restore();
    return far ? [x - 8, y - 9] : [x, y - 7];
  },
  // Le treuil, près des attaches : il tend l'élastique (niveau 10)
  winch(c, wx, y) {
    c.fillStyle = this.lg(c, 0, y - 32, 0, y, [[0, '#e9e5f3'], [1, '#8f88aa']]); c.strokeStyle = this.INK; c.lineWidth = 2.5; c.beginPath(); c.arc(wx, y - 15, 13, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#2a2236'; c.beginPath(); c.arc(wx, y - 15, 4, 0, Math.PI * 2); c.fill();
    c.lineWidth = 4; c.beginPath(); c.moveTo(wx, y - 15); c.lineTo(wx + 14, y - 30); c.stroke(); c.fillStyle = '#ff4f81'; c.beginPath(); c.arc(wx + 14, y - 30, 5, 0, Math.PI * 2); c.fill(); c.lineWidth = 2; c.stroke();
  },
  // La catapulte entière au Canvas (pages de référence) : attaches, brins, crochet et poche ; plane() dessine l'avion entre
  // les brins du fond et ceux de devant. Dans le jeu, les brins bougent : js/scene.js les trace avec PixiJS.
  catapult(c, cx, y, hook, lv, plane) {
    const st = this.elasticStyle(lv), INK = this.INK;
    const strand = (a, col, w, i, n) => { const off = (i - (n - 1) / 2) * (w * 0.7); c.strokeStyle = INK; c.lineWidth = w + 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0], a[1] + off); c.lineTo(hook[0], hook[1] + off); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
    const farT = this.cleat(c, cx, y, st, true);
    st.strands.forEach(([col, w], i) => strand(farT, col, w, i, st.strands.length));
    if (st.winch) this.winch(c, cx - 46, y);
    if (plane) plane();
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(hook[0] - 7, hook[1] - 7); c.quadraticCurveTo(hook[0] + 4, hook[1] - 5, hook[0], hook[1] + 2); c.stroke();
    if (st.pouch) { c.fillStyle = this.lg(c, hook[0] - 6, 0, hook[0] + 6, 0, [[0, '#7a4a2a'], [1, '#b07a45']]); c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.ellipse(hook[0] + 2, hook[1], 6, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    const nearT = this.cleat(c, cx, y, st, false);
    st.strands.forEach(([col, w], i) => strand(nearT, col, w, i, st.strands.length));
    return st;
  },

  // Ce qu'on croise en vol (validé le 24 octobre 2026, ref/obstacles.html, planche G). Chaque dessin est fait autour de
  // l'origine : le pied au sol (0, 0) pour ce qui est posé par terre, le centre pour ce qui vole ; y vers le bas.
  // Tailles de la maquette : le jeu les met à l'échelle de sa physique (js/scene.js, OBST dans js/data.js).
  OBST: {
    // Le pommier de Papi (182 px de haut) : tronc et branches, feuillage en boules, pommes
    pommier(c) {
      const A = Art, INK = A.INK;
      c.fillStyle = 'rgba(20,40,20,.25)'; c.beginPath(); c.ellipse(6, 2, 60, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = A.lg(c, -10, 0, 10, 0, [[0, '#8a5a32'], [1, '#5e3a1c']]); c.beginPath(); c.moveTo(-10, 0); c.lineTo(-7, -70); c.lineTo(-20, -95); c.lineTo(-12, -98); c.lineTo(0, -80); c.lineTo(14, -100); c.lineTo(20, -95); c.lineTo(7, -72); c.lineTo(10, 0); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      const blobs = [[0, -130, 46], [-40, -110, 34], [40, -112, 36], [-22, -150, 32], [24, -152, 34], [0, -100, 30]];
      for (const [dx, dy, r] of blobs) { c.fillStyle = A.rg(c, dx - r * 0.3, dy - r * 0.4, r * 0.1, r * 1.2, [[0, '#a6d878'], [1, '#4f8f44']]); c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); for (const [dx, dy, r] of blobs) { c.moveTo(dx + r, dy); c.arc(dx, dy, r, 0, Math.PI * 2); } c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      for (const [dx, dy, r] of blobs) { c.fillStyle = A.rg(c, dx - r * 0.3, dy - r * 0.4, r * 0.1, r * 1.2, [[0, '#a6d878'], [1, '#5a9a4a']]); c.beginPath(); c.arc(dx, dy, r - 2.5, 0, Math.PI * 2); c.fill(); }
      for (const [dx, dy] of [[-30, -118], [18, -140], [36, -104], [-6, -160], [-44, -96], [8, -112]]) { c.fillStyle = A.rg(c, dx - 2, dy - 2, 1, 7, [[0, '#ff9a8a'], [1, '#d8283c']]); c.beginPath(); c.arc(dx, dy, 6, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.8; c.stroke(); }
    },
    // La haie (170 × 58 px), de 0 à w, fleurie
    haie(c, w) {
      const A = Art, top = -48;
      c.fillStyle = 'rgba(20,40,20,.25)'; c.beginPath(); c.ellipse(w / 2, 2, w / 2 + 8, 7, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, top + 10);
      for (let x = 0; x < w; x += 17) c.quadraticCurveTo(x + 8.5, top - 10 + (Math.round(x / 17) % 2) * 5, Math.min(w, x + 17), top + 4);
      c.lineTo(w, 0); c.closePath(); c.fillStyle = A.lg(c, 0, top, 0, 0, [[0, '#7cc25e'], [1, '#2f7d36']]); c.fill(); c.strokeStyle = A.INK; c.lineWidth = 2.5; c.stroke();
      c.strokeStyle = 'rgba(30,80,30,.45)'; c.lineWidth = 1.5; for (let i = 0; i < Math.round(w / 6.5); i++) { const x = 8 + (i * 37) % (w - 14), y = top + 10 + (i * 23) % 32; c.beginPath(); c.arc(x, y, 5, 3.6, 5.8); c.stroke(); }
      for (let i = 0; i < Math.round(w / 19); i++) { c.fillStyle = ['#ffffff', '#ffb3c7', '#fff2a8'][i % 3]; c.beginPath(); c.arc(14 + i * 18, top + 8 + (i % 3) * 10, 3, 0, Math.PI * 2); c.fill(); }
    },
    // La clôture du jardin (150 × 46 px), centrée ; les ballons y sont noués (nœud en (0, -44))
    cloture(c) {
      const A = Art; c.strokeStyle = A.INK; c.lineWidth = 2;
      for (const px of [-65, 0, 65]) { c.fillStyle = A.lg(c, px - 5, 0, px + 5, 0, [[0, '#f3e2c4'], [1, '#c9a46e']]); c.beginPath(); c.roundRect(px - 5, -46, 10, 46, 2); c.fill(); c.stroke(); }
      c.fillStyle = '#e8d2ad'; c.beginPath(); c.roundRect(-75, -38, 150, 7, 2); c.roundRect(-75, -20, 150, 7, 2); c.fill(); c.stroke();
    },
    // Le bouquet de ballons de fête et leurs ficelles jusqu'au nœud de la clôture (au-dessus du poteau du milieu)
    ballons(c) {
      const A = Art, knot = [0, -44], balls = [[-35, -134, '#ff4f81'], [-5, -150, '#ffd23f'], [27, -136, '#7fd3ff'], [-19, -108, '#5cd86a'], [15, -112, '#b18cff']];
      for (const [bx, by] of balls) { c.strokeStyle = 'rgba(42,27,61,.6)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(knot[0], knot[1]); c.quadraticCurveTo((knot[0] + bx) / 2 + 6, (knot[1] + by) / 2 + 10, bx, by + 22); c.stroke(); }
      for (const [bx, by, col] of balls) {
        c.fillStyle = A.rg(c, bx - 6, by - 8, 2, 26, [[0, '#ffffff'], [0.25, col], [1, col]]); c.beginPath(); c.ellipse(bx, by, 16, 20, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = A.INK; c.lineWidth = 2.2; c.stroke();
        c.fillStyle = col; c.beginPath(); c.moveTo(bx - 4, by + 24); c.lineTo(bx + 4, by + 24); c.lineTo(bx, by + 19); c.closePath(); c.fill(); c.lineWidth = 1.6; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(bx - 6, by - 8, 3.5, 6, -0.5, 0, Math.PI * 2); c.fill();
      }
    },
    // Le barbecue boule de Papi (60 × 52 px) : pieds, cuve, braises, saucisses, un peu de fumée
    barbecue(c) {
      const A = Art, INK = A.INK;
      for (const [dx, dy, r] of [[-6, -60, 9], [4, -78, 11], [-4, -98, 13]]) { c.fillStyle = 'rgba(240,236,250,.85)'; c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round'; for (const [a, b] of [[-14, -26], [14, 26], [0, 0]]) { c.beginPath(); c.moveTo(a, -26); c.lineTo(b, 0); c.stroke(); }
      c.fillStyle = A.lg(c, 0, -46, 0, -22, [[0, '#4a4458'], [1, '#1f1a2a']]); c.beginPath(); c.moveTo(-30, -44); c.quadraticCurveTo(0, -6, 30, -44); c.closePath(); c.fill(); c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#ff7a3d'; c.beginPath(); c.ellipse(0, -44, 28, 4, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 2; c.stroke();
      for (const dx of [-14, 0, 14]) { c.fillStyle = A.lg(c, 0, -52, 0, -44, [[0, '#d9714a'], [1, '#9c3f22']]); c.beginPath(); c.roundRect(dx - 6, -52, 12, 7, 3.5); c.fill(); c.lineWidth = 1.6; c.stroke(); }
    },
    // La colonne d'air chaud au-dessus du barbecue (w × h px, de bas en haut) : une lueur et des flèches qui montent
    chaleur(c, w, h) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = Art.lg(c, 0, -h, 0, 0, [[0, 'rgba(255,200,120,0)'], [1, 'rgba(255,190,110,.45)']]);
      c.beginPath(); c.moveTo(-w * 0.28, 0); c.bezierCurveTo(-w * 0.44, -h * 0.4, -w * 0.22, -h * 0.7, -w * 0.5, -h); c.lineTo(w * 0.5, -h); c.bezierCurveTo(w * 0.24, -h * 0.7, w * 0.44, -h * 0.4, w * 0.28, 0); c.closePath(); c.fill(); c.restore();
      c.strokeStyle = 'rgba(255,140,60,.85)'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < 6; i++) { const ox = -w * 0.18 + (i % 3) * w * 0.18, oy = -30 - i * (h - 60) / 6; c.beginPath(); c.moveTo(ox, oy); c.bezierCurveTo(ox + 6, oy - 10, ox - 6, oy - 20, ox, oy - 30); c.moveTo(ox - 6, oy - 23); c.lineTo(ox, oy - 31); c.lineTo(ox + 6, oy - 23); c.stroke(); }
    },
    // L'arroseur (au sol) et son éventail de gouttes (portée ~125 px de chaque côté)
    arroseur(c) {
      const A = Art, INK = A.INK;
      for (const [a0, s] of [[-2.4, 1], [-0.74, -1]]) for (let k = 0; k < 7; k++) {
        const a = a0 + s * k * 0.28, v = 78 + (k % 3) * 8;
        for (let t = 0.12; t < 1; t += 0.07) { const px = Math.cos(a) * v * t * 1.6, py = -14 + Math.sin(a) * v * t * 1.6 + 120 * t * t; if (py > 0) break; c.fillStyle = 'rgba(80,170,240,' + (0.9 - t * 0.5) + ')'; c.beginPath(); c.arc(px, py, 2.6, 0, Math.PI * 2); c.fill(); }
      }
      c.fillStyle = A.lg(c, 0, -16, 0, 0, [[0, '#ffd23f'], [1, '#e09a00']]); c.beginPath(); c.roundRect(-12, -10, 24, 10, 3); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#3f8ff0'; c.beginPath(); c.roundRect(-4, -20, 8, 12, 2); c.fill(); c.stroke();
    },
    // Le nuage d'averse (~190 × 110 px), centré
    nuage(c) {
      const blobs = [[0, 0, 34], [-36, 10, 26], [36, 10, 28], [-16, -18, 26], [18, -20, 28], [60, 18, 18], [-60, 18, 17]];
      for (const [dx, dy, r] of blobs) { c.fillStyle = Art.rg(c, dx - r * 0.3, dy - r * 0.5, r * 0.1, r * 1.25, [[0, '#d8d4ea'], [0.6, '#a49fbf'], [1, '#6f6890']]); c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); }
    },
    // La pluie sous le nuage : des traits penchés sur w × h px, qui se répètent de haut en bas
    pluie(c, w, h) {
      c.strokeStyle = 'rgba(80,140,220,.7)'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < Math.round(w * h / 380); i++) { const rx = 6 + (i * 29) % (w - 12), ry = (i * 17) % h; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - 5, ry + 16); c.stroke(); }
    },
    // Une bernache (≈ 90 px d'envergure), tournée vers la gauche ; up : ailes levées
    oie(c, up) {
      const A = Art, INK = A.INK;
      c.save(); c.scale(-1, 1);
      const wing = back => {
        const k = up ? -1 : 1, tips = [[-36, 20], [-26, 27], [-15, 30], [-4, 29], [7, 23]];
        c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(-30, k * 4, tips[0][0], k * tips[0][1]);
        for (const [tx, ty] of tips.slice(1)) c.quadraticCurveTo(tx - 6, k * (ty + 3), tx, k * ty);
        c.quadraticCurveTo(14, k * 8, 12, -2); c.closePath();
        c.fillStyle = back ? A.lg(c, 0, 0, 0, k * 36, [[0, '#8d86ac'], [1, '#5f587c']]) : A.lg(c, 0, 0, 0, k * 36, [[0, '#d8d3e8'], [0.7, '#a59fc0'], [1, '#6f688e']]);
        c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
        if (!back) { c.strokeStyle = 'rgba(42,27,61,.35)'; c.lineWidth = 1.2; c.beginPath(); for (const tx of [-24, -13, -2]) { c.moveTo(tx + 6, k * 6); c.lineTo(tx, k * 26); } c.stroke(); }
      };
      c.save(); c.translate(4, 0); c.scale(0.8, 0.8); wing(true); c.restore();
      c.fillStyle = '#2a2236'; c.beginPath(); c.moveTo(-18, -3); c.lineTo(-30, -6); c.lineTo(-28, 4); c.lineTo(-18, 4); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = A.lg(c, 0, -10, 0, 10, [[0, '#b9a98f'], [0.6, '#8f7d64'], [1, '#e9e2d4']]); c.beginPath(); c.ellipse(0, 0, 22, 9.5, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 2.2; c.stroke();
      c.strokeStyle = INK; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(16, -3); c.quadraticCurveTo(26, -6, 33, -11); c.stroke(); c.strokeStyle = '#2a2236'; c.lineWidth = 5; c.stroke();
      c.fillStyle = '#2a2236'; c.beginPath(); c.ellipse(36, -12, 7, 5.5, -0.2, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(35, -10, 3.5, 2.4, -0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a4458'; c.beginPath(); c.moveTo(42, -14); c.lineTo(49, -12); c.lineTo(42, -9.5); c.closePath(); c.fill(); c.lineWidth = 1.4; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(38.5, -13.5, 1.3, 0, Math.PI * 2); c.fill();
      wing(false);
      c.restore();
    },
    // Le cerf-volant (60 × 84 px, centré) et sa queue à nœuds ; la ficelle part de (0, 44)
    cerfvolant(c) {
      const A = Art, INK = A.INK;
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 44); c.bezierCurveTo(30, 70, 10, 100, 46, 120); c.stroke();
      for (const [bx, by, col] of [[16, 66, '#ffd23f'], [20, 92, '#7fd3ff'], [38, 114, '#5cd86a']]) { c.fillStyle = col; c.beginPath(); c.moveTo(bx - 7, by - 5); c.lineTo(bx, by); c.lineTo(bx - 7, by + 5); c.closePath(); c.moveTo(bx + 7, by - 5); c.lineTo(bx, by); c.lineTo(bx + 7, by + 5); c.closePath(); c.fill(); c.lineWidth = 1.4; c.stroke(); }
      const P = [[0, -40], [30, 0], [0, 44], [-30, 0]], cols = ['#ff4f81', '#ffd23f', '#7fd3ff', '#5cd86a'];
      for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, 0); c.lineTo(P[i][0], P[i][1]); c.lineTo(P[(i + 1) % 4][0], P[(i + 1) % 4][1]); c.closePath(); c.fill(); }
      c.beginPath(); P.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y)); c.closePath(); c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[2][0], P[2][1]); c.moveTo(P[1][0], P[1][1]); c.lineTo(P[3][0], P[3][1]); c.lineWidth = 1.6; c.stroke();
    },
    // La petite fille de la ferme qui tient le cerf-volant (au sol)
    fillette(c) {
      c.strokeStyle = Art.INK; c.fillStyle = '#ff6f93'; c.beginPath(); c.moveTo(-7, 0); c.lineTo(0, -22); c.lineTo(7, 0); c.closePath(); c.fill(); c.lineWidth = 1.8; c.stroke();
      c.fillStyle = '#f4c89a'; c.beginPath(); c.arc(0, -27, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    },
    // Le mât et la nacelle de l'éolienne (hub : hauteur du moyeu en px, au-dessus du pied)
    eolienne(c, hub) {
      const A = Art;
      c.fillStyle = A.lg(c, -6, 0, 6, 0, [[0, '#ffffff'], [1, '#c9c4dd']]); c.beginPath(); c.moveTo(-4 * hub / 124, -hub); c.lineTo(4 * hub / 124, -hub); c.lineTo(8 * hub / 124, 0); c.lineTo(-8 * hub / 124, 0); c.closePath(); c.fill(); c.strokeStyle = A.INK; c.lineWidth = 2.2; c.stroke();
      c.fillStyle = '#eceaf6'; c.beginPath(); c.roundRect(-14, -hub - 7, 24, 12, 5); c.fill(); c.lineWidth = 2; c.stroke();
    },
    // Le rotor de l'éolienne, centré sur le moyeu : trois pales (66 px) à bout rouge
    rotor(c) {
      const A = Art;
      for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI * 2 / 3); c.fillStyle = A.lg(c, 0, -4, 0, 4, [[0, '#ffffff'], [1, '#d3cfe6']]); c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(30, -8, 66, -2); c.lineTo(66, 2); c.quadraticCurveTo(30, 5, 0, 3); c.closePath(); c.fill(); c.strokeStyle = A.INK; c.lineWidth = 1.8; c.stroke(); c.fillStyle = '#ff4f81'; c.fillRect(56, -2.5, 9, 4.5); c.restore(); }
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = A.INK; c.lineWidth = 1.8; c.stroke();
    },
    // Des flèches de vent qui poussent vers la droite (aide derrière l'éolienne)
    vent(c, n) {
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < n; i++) { const ox = (i % 2) * 14, oy = i * 16; c.beginPath(); c.moveTo(ox, oy); c.bezierCurveTo(ox + 10, oy - 6, ox + 20, oy + 6, ox + 30, oy); c.moveTo(ox + 23, oy - 6); c.lineTo(ox + 31, oy); c.lineTo(ox + 23, oy + 6); c.stroke(); }
    },
  },

  coin(c, w, h) {
    const x = w / 2, y = h / 2, r = w * 0.3;
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = this.rg(c, x, y, 0, w / 2, [[0, 'rgba(255,220,90,.55)'], [1, 'rgba(255,200,60,0)']]); c.fillRect(0, 0, w, h); c.restore();
    c.fillStyle = this.rg(c, x - r * 0.3, y - r * 0.3, 1, r * 1.1, [[0, '#fff1a8'], [0.6, '#ffd23f'], [1, '#e0a000']]); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = this.INK; c.lineWidth = 2.5; c.stroke(); c.strokeStyle = 'rgba(160,100,0,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * 0.55, 0, Math.PI * 2); c.stroke();
  },
  // Un pigeon de profil, tourné vers la gauche (il vole vers l'avion) : corps en volume, gorge irisée, gros œil orange,
  // ailes à plumes avec les deux barres sombres des pigeons, queue en éventail. frame 0 à 3 : battement d'ailes.
  bird(c, w, h, frame) {
    const INK = this.INK, lw = 2.2;
    c.translate(w / 2 + 2, h / 2 + 4); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = lw;
    // Battement vu de côté : l'aile monte, passe à l'horizontale, descend sous le corps, puis remonte
    const wingA = [-1.75, -0.6, 0.75, -0.6][frame % 4];
    // Une aile large : bord d'attaque arrondi, plumes en éventail au bout, deux barres sombres ; dark = l'aile du fond
    const wing = (a, dark) => {
      c.save(); c.translate(2, -6); c.rotate(a);
      const tips = [[27, -3], [25.5, 2.5], [21.5, 6], [16.5, 8], [11, 8.5]];
      c.beginPath(); c.moveTo(-2, -5); c.bezierCurveTo(8, -11, 20, -9, tips[0][0], tips[0][1]);
      for (let i = 1; i < tips.length; i++) { const [px, py] = tips[i - 1], [qx, qy] = tips[i], mx = (px + qx) / 2, my = (py + qy) / 2, nx = (qy - py), ny = -(qx - px), n = Math.hypot(nx, ny) || 1; c.quadraticCurveTo(mx - nx / n * 1.8, my - ny / n * 1.8, qx, qy); }
      c.quadraticCurveTo(3, 8.5, -2, 5); c.closePath();
      c.fillStyle = this.lg(c, -2, 0, 27, 0, dark ? [[0, '#a29cbf'], [0.6, '#8a84aa'], [1, '#625b80']] : [[0, '#eceaf6'], [0.6, '#c2bdd8'], [1, '#7e779c']]); c.fill(); c.stroke();
      if (!dark) {
        c.strokeStyle = 'rgba(42,27,61,.6)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(7, -6); c.quadraticCurveTo(8.5, 0, 7.5, 6.5); c.moveTo(11.5, -6.5); c.quadraticCurveTo(13, 0, 12, 7); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -4.5); c.bezierCurveTo(8, -9, 18, -8, 24, -4); c.stroke();
        c.strokeStyle = INK; c.lineWidth = lw;
      }
      c.restore();
    };
    wing(wingA - 0.25, true);
    // queue en éventail, bout sombre
    c.fillStyle = this.lg(c, 14, 0, 26, 0, [[0, '#b4aecb'], [0.75, '#9993b6'], [0.76, '#4f4766'], [1, '#4f4766']]);
    c.beginPath(); c.moveTo(12, -3); c.lineTo(27, -6); c.quadraticCurveTo(29, 0, 27, 6); c.lineTo(12, 4); c.closePath(); c.fill(); c.stroke();
    // corps : dos gris-bleu, poitrail rosé
    c.fillStyle = this.lg(c, 0, -12, 0, 10, [[0, '#dfe0f0'], [0.55, '#b9b4d2'], [1, '#8e88ad']]);
    c.beginPath(); c.moveTo(-12, -4); c.bezierCurveTo(-8, -12, 8, -10, 16, -2); c.bezierCurveTo(12, 8, -2, 11, -10, 6); c.bezierCurveTo(-14, 3, -14, -1, -12, -4); c.closePath(); c.fill();
    c.save(); c.clip(); c.fillStyle = 'rgba(255,190,220,.45)'; c.beginPath(); c.ellipse(-8, 3, 7, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(0, -7, 9, 2.5, -0.1, 0, Math.PI * 2); c.fill(); c.restore();
    c.stroke();
    // pattes repliées
    c.strokeStyle = '#e8708f'; c.lineWidth = 2; c.beginPath(); c.moveTo(-1, 8); c.lineTo(2, 11); c.moveTo(3, 8); c.lineTo(6, 10.5); c.stroke(); c.strokeStyle = INK; c.lineWidth = lw;
    // tête et gorge irisée
    c.fillStyle = this.lg(c, -14, -6, -6, 2, [[0, '#8fe0b4'], [0.5, '#a98be0'], [1, '#c9a8e8']]);
    c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-13, 1, -7, 2); c.quadraticCurveTo(-6, -6, -10, -9); c.closePath(); c.fill();
    c.fillStyle = this.rg(c, -16, -14, 1, 9, [[0, '#d5d3e6'], [1, '#a29dbe']]); c.beginPath(); c.arc(-15, -10, 7, 0, Math.PI * 2); c.fill(); c.stroke();
    // bec sombre et sa petite bosse blanche
    c.fillStyle = '#5a4a66'; c.beginPath(); c.moveTo(-21, -10); c.quadraticCurveTo(-27, -9, -28, -6.5); c.quadraticCurveTo(-24, -7.5, -21, -7.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f4f1fa'; c.beginPath(); c.ellipse(-21.5, -10.5, 2, 1.3, -0.3, 0, Math.PI * 2); c.fill();
    // gros œil orange, pupille, reflet
    c.fillStyle = '#ff9d2e'; c.beginPath(); c.arc(-16, -11.5, 3.3, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(-16.6, -11.4, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-17.4, -12.4, 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,120,150,.45)'; c.beginPath(); c.ellipse(-13, -7, 2.2, 1.3, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = lw; wing(wingA, false);
  },
  // Une particule ronde et douce (poussière, étincelles, plumes)
  dot(c, w, h) { c.fillStyle = this.rg(c, w / 2, h / 2, 0, w / 2, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, w, h); },
};

// La rue du jardin de Papi (mode Facile, validée le 24 octobre 2026, ref/rue.html, planche H) : une rue en coupe, vue
// de côté, de W × H px, le sol à GY ; SLOTS : le milieu de chaque bâtiment. paint(c, L, open) peint toute la rue ;
// L : les enseignes (traduites par le jeu) ; open(k) : le bâtiment k est-il ouvert (sinon grisé, avec un cadenas).
Art.TOWN = (() => {
  const INK = Art.INK, lg = (c, ...a) => Art.lg(c, ...a), rg = (c, ...a) => Art.rg(c, ...a);
  const W = 1640, H = 560, GY = 452, SLOTS = { atelier: 190, limonade: 500, remise: 800, bureau: 1110, manche: 1430 };
  const ink = (c, w) => { c.strokeStyle = INK; c.lineWidth = w; c.stroke(); };
  const rect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r || 0); };
  const label = (c, x, y, text, bg, fg) => { // une enseigne en bois peint
    c.font = '400 20px Bangers, Impact, sans-serif'; const w = c.measureText(text).width + 22;
    c.fillStyle = bg || '#fff3d6'; rect(c, x - w / 2, y - 15, w, 30, 7); c.fill(); ink(c, 2.5);
    c.fillStyle = fg || INK; c.textAlign = 'center'; c.fillText(text, x, y + 7); c.textAlign = 'left';
  };
  const planks = (c, x, y, w, h, a, b) => { // un mur de planches verticales
    c.fillStyle = lg(c, 0, y, 0, y + h, [[0, a], [1, b]]); rect(c, x, y, w, h); c.fill();
    c.strokeStyle = 'rgba(90,50,20,.35)'; c.lineWidth = 1.5; for (let px = x + 14; px < x + w; px += 14) { c.beginPath(); c.moveTo(px, y); c.lineTo(px, y + h); c.stroke(); }
    rect(c, x, y, w, h); ink(c, 3);
  };

  // Le décor : ciel de fin d'après-midi, montagnes, collines, palissade du fond, pelouse, chemin de gravier
  function decor(c) {
    c.fillStyle = lg(c, 0, 0, 0, H, [[0, '#3f86e0'], [0.5, '#a9d6fa'], [0.78, '#ffe1b8'], [1, '#ffc890']]); c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, W * 0.86, GY - 120, 0, 380, [[0, 'rgba(255,240,200,.65)'], [1, 'rgba(255,200,140,0)']]); c.fillRect(0, 0, W, H); c.restore();
    for (const [x, y, s] of [[260, 90, 1], [760, 60, 0.8], [1250, 110, 1.1], [1560, 50, 0.7]]) { c.save(); c.translate(x - 75 * s, y - 40 * s); c.scale(s, s); Art.cloud(c, 150, 80); c.restore(); }
    c.save(); c.translate(0, GY - 230); Art.mountains(c, W, 220); c.restore();
    c.save(); c.translate(0, GY - 150); Art.hills(c, W, 180); c.restore();
    // palissade du jardin, au fond
    c.fillStyle = '#e9d8b6'; c.strokeStyle = 'rgba(42,27,61,.5)'; c.lineWidth = 1.5;
    for (let x = 6; x < W; x += 26) { c.beginPath(); c.moveTo(x, GY - 6); c.lineTo(x, GY - 52); c.lineTo(x + 9, GY - 60); c.lineTo(x + 18, GY - 52); c.lineTo(x + 18, GY - 6); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = '#d9c39a'; c.fillRect(0, GY - 44, W, 6); c.fillRect(0, GY - 22, W, 6);
    c.fillStyle = lg(c, 0, GY - 8, 0, H, [[0, '#6cc35a'], [1, '#3f9a3f']]); c.fillRect(0, GY - 8, W, H - GY + 8);
    c.strokeStyle = 'rgba(255,240,180,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, GY - 7); c.lineTo(W, GY - 7); c.stroke();
    // le chemin de gravier, devant les bâtiments
    c.fillStyle = lg(c, 0, GY + 18, 0, GY + 62, [[0, '#efe0c0'], [1, '#d9c39a']]); rect(c, -10, GY + 22, W + 20, 40, 20); c.fill(); ink(c, 2);
    for (let i = 0; i < 160; i++) { c.fillStyle = i % 2 ? 'rgba(140,110,70,.35)' : 'rgba(255,255,255,.5)'; c.beginPath(); c.arc((i * 97) % W, GY + 30 + (i * 37) % 26, 1.6, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 40; i++) { c.fillStyle = ['#fff2a8', '#ffb3c7', '#ffffff'][i % 3]; c.beginPath(); c.arc((i * 211) % W, GY + 4 + (i % 3) * 5, 3, 0, Math.PI * 2); c.fill(); }
  }

  // 1. L'atelier de Papi : un garage en planches, toit de tuiles, grande porte ouverte sur l'établi et l'avion en carton
  function atelier(c, x, L) {
    const w = 250, h = 176, x0 = x - w / 2, top = GY - h;
    c.fillStyle = 'rgba(30,50,20,.25)'; c.beginPath(); c.ellipse(x, GY + 4, w / 2 + 16, 10, 0, 0, Math.PI * 2); c.fill();
    // cheminée et fumée
    c.fillStyle = '#b4544a'; rect(c, x + 60, top - 74, 22, 50); c.fill(); ink(c, 2.5);
    for (const [dx, dy, r] of [[72, -88, 9], [80, -104, 12], [92, -124, 15]]) { c.fillStyle = 'rgba(240,236,250,.85)'; c.beginPath(); c.arc(x + dx, top + dy, r, 0, Math.PI * 2); c.fill(); }
    planks(c, x0, top, w, h, '#e0a668', '#a8693a');
    // toit à deux pans, tuiles rouges
    c.beginPath(); c.moveTo(x0 - 20, top + 6); c.lineTo(x, top - 66); c.lineTo(x0 + w + 20, top + 6); c.closePath();
    c.fillStyle = lg(c, 0, top - 66, 0, top + 6, [[0, '#ff7a6a'], [1, '#c8414a']]); c.fill(); ink(c, 3);
    c.save(); c.clip(); c.strokeStyle = 'rgba(120,30,40,.4)'; c.lineWidth = 1.5; for (let y = top - 56; y < top + 8; y += 12) { c.beginPath(); c.moveTo(x0 - 30, y); c.lineTo(x0 + w + 30, y); c.stroke(); for (let tx = x0 - 20 + (y % 24 ? 0 : 10); tx < x0 + w + 20; tx += 20) { c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y + 12); c.stroke(); } } c.restore();
    // grande porte ouverte : l'intérieur, l'établi, les outils au mur, l'avion sur ses tréteaux
    const dx0 = x0 + 26, dw = 150, dtop = top + 40;
    c.fillStyle = lg(c, 0, dtop, 0, GY, [[0, '#3a2a40'], [1, '#5a4050']]); rect(c, dx0, dtop, dw, GY - dtop); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, dx0 + 40, dtop + 20, 0, 90, [[0, 'rgba(255,220,140,.45)'], [1, 'rgba(255,200,120,0)']]); rect(c, dx0, dtop, dw, GY - dtop); c.fill(); c.restore();
    c.strokeStyle = '#d9a467'; c.lineWidth = 3; for (const [ox, oy, l, a] of [[18, 22, 22, -0.3], [36, 18, 26, 0.2], [56, 24, 20, -0.1]]) { c.save(); c.translate(dx0 + ox, dtop + oy); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, l); c.stroke(); c.restore(); }
    c.fillStyle = '#9aa0b4'; rect(c, dx0 + 94, dtop + 14, 40, 26, 3); c.fill(); ink(c, 1.5); // le plan de l'avion au mur
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(dx0 + 100, dtop + 30); c.lineTo(dx0 + 126, dtop + 24); c.moveTo(dx0 + 110, dtop + 20); c.lineTo(dx0 + 114, dtop + 34); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 4; for (const tx of [dx0 + 34, dx0 + 116]) { c.beginPath(); c.moveTo(tx - 10, GY); c.lineTo(tx, GY - 30); c.lineTo(tx + 10, GY); c.stroke(); }
    c.save(); c.translate(dx0 + 76, GY - 30); c.scale(0.62, 0.62); c.translate(-Art.PLANE.ax, -Art.PLANE.ay); Art.plane(c, Art.PLANE.w, Art.PLANE.h, 'carton'); c.restore();
    rect(c, dx0, dtop, dw, GY - dtop); ink(c, 3);
    // battant de porte replié, fenêtre allumée, enseigne
    planks(c, dx0 + dw + 4, dtop, 26, GY - dtop, '#d8995a', '#9c6230');
    c.fillStyle = lg(c, 0, top + 52, 0, top + 92, [[0, '#fff3c0'], [1, '#ffcf6a']]); rect(c, x0 + w - 40, top + 52, 28, 36, 3); c.fill(); ink(c, 2.5);
    c.beginPath(); c.moveTo(x0 + w - 26, top + 52); c.lineTo(x0 + w - 26, top + 88); c.moveTo(x0 + w - 40, top + 70); c.lineTo(x0 + w - 12, top + 70); ink(c, 2);
    label(c, x, top + 18, L.atelier, '#fff3d6');
  }

  // 2. Le stand de limonade d'Yglou : comptoir rayé, auvent festonné, carafe, verres, pancarte
  function limonade(c, x, L) {
    const w = 170, x0 = x - w / 2, ctop = GY - 82;
    c.fillStyle = 'rgba(30,50,20,.25)'; c.beginPath(); c.ellipse(x, GY + 4, w / 2 + 14, 9, 0, 0, Math.PI * 2); c.fill();
    // poteaux et auvent
    c.fillStyle = '#f3e2c4'; for (const px of [x0 + 6, x0 + w - 18]) { rect(c, px, GY - 196, 12, 196, 3); c.fill(); ink(c, 2.5); }
    // Yglou derrière le comptoir
    Art.yglouSide(c, x - 10, ctop - 26, 22);
    const at = GY - 214;
    c.beginPath(); c.moveTo(x0 - 16, at + 34); c.lineTo(x0 + 6, at); c.lineTo(x0 + w - 6, at); c.lineTo(x0 + w + 16, at + 34); c.closePath();
    c.fillStyle = '#ffffff'; c.fill();
    c.save(); c.clip(); for (let i = 0; i < 12; i++) { c.fillStyle = '#ff6f93'; c.beginPath(); c.moveTo(x0 - 16 + i * 34, at + 40); c.lineTo(x0 + 6 + i * 34 - 12, at - 4); c.lineTo(x0 + 6 + i * 34 + 5, at - 4); c.lineTo(x0 - 16 + i * 34 + 17, at + 40); c.closePath(); c.fill(); } c.restore();
    c.beginPath(); c.moveTo(x0 - 16, at + 34); c.lineTo(x0 + 6, at); c.lineTo(x0 + w - 6, at); c.lineTo(x0 + w + 16, at + 34); c.closePath(); ink(c, 3);
    for (let i = 0; i < 7; i++) { const sx = x0 - 16 + i * (w + 32) / 7; c.fillStyle = i % 2 ? '#ff6f93' : '#ffffff'; c.beginPath(); c.moveTo(sx, at + 34); c.quadraticCurveTo(sx + (w + 32) / 14, at + 52, sx + (w + 32) / 7, at + 34); c.closePath(); c.fill(); ink(c, 2.2); }
    // comptoir rayé jaune
    c.fillStyle = '#fff6d0'; rect(c, x0, ctop, w, GY - ctop, 4); c.fill();
    c.save(); c.clip(); for (let i = 0; i < 8; i++) { c.fillStyle = '#ffd23f'; c.fillRect(x0 + i * 24, ctop, 12, GY - ctop); } c.restore();
    rect(c, x0, ctop, w, GY - ctop, 4); ink(c, 3);
    c.fillStyle = '#d9a467'; rect(c, x0 - 8, ctop - 10, w + 16, 12, 4); c.fill(); ink(c, 2.5);
    // carafe et verres
    c.fillStyle = 'rgba(200,240,255,.6)'; c.beginPath(); c.moveTo(x + 22, ctop - 10); c.lineTo(x + 26, ctop - 52); c.lineTo(x + 52, ctop - 52); c.lineTo(x + 56, ctop - 10); c.closePath(); c.fill();
    c.fillStyle = '#ffe14d'; c.beginPath(); c.moveTo(x + 23, ctop - 12); c.lineTo(x + 25.5, ctop - 38); c.lineTo(x + 52.5, ctop - 38); c.lineTo(x + 55, ctop - 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + 22, ctop - 10); c.lineTo(x + 26, ctop - 52); c.lineTo(x + 52, ctop - 52); c.lineTo(x + 56, ctop - 10); c.closePath(); ink(c, 2.5);
    c.fillStyle = '#fff'; for (const [cx, cy] of [[34, 28], [44, 22]]) { c.beginPath(); c.arc(x + cx, ctop - cy, 3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#7fd36a'; c.beginPath(); c.arc(x + 46, ctop - 52, 6, Math.PI, 0); c.fill(); ink(c, 1.5);
    for (const gx of [x - 62, x - 44]) { c.fillStyle = '#ffe14d'; rect(c, gx, ctop - 28, 14, 18, 2); c.fill(); ink(c, 2); }
    label(c, x, GY - 236, L.limonade, '#fff3d6', '#e0306c');
  }

  // 3. La remise de Papi : abri en tôle ondulée, étagères de cartons, rouleaux de scotch, boîte de vis
  function remise(c, x, L) {
    const w = 220, h = 150, x0 = x - w / 2, top = GY - h;
    c.fillStyle = 'rgba(30,50,20,.25)'; c.beginPath(); c.ellipse(x, GY + 4, w / 2 + 14, 9, 0, 0, Math.PI * 2); c.fill();
    planks(c, x0, top, w, h, '#8fbfa0', '#5f8f74');
    // l'ouverture : étagères
    const ox0 = x0 + 20, ow = 136, otop = top + 30;
    c.fillStyle = lg(c, 0, otop, 0, GY, [[0, '#33283d'], [1, '#4d3c4e']]); rect(c, ox0, otop, ow, GY - otop); c.fill();
    c.fillStyle = '#b07a45'; for (const sy of [otop + 46, otop + 92]) { rect(c, ox0 + 2, sy, ow - 4, 6); c.fill(); ink(c, 1.8); }
    const box = (bx, by, bw, bh) => { c.fillStyle = lg(c, 0, by, 0, by + bh, [[0, '#e8bd84'], [1, '#c08a4c']]); rect(c, bx, by, bw, bh, 2); c.fill(); ink(c, 2); c.fillStyle = 'rgba(255,240,190,.75)'; c.fillRect(bx + bw / 2 - 3, by, 6, bh); };
    box(ox0 + 8, otop + 18, 34, 28); box(ox0 + 46, otop + 10, 40, 36); box(ox0 + 92, otop + 22, 30, 24);
    box(ox0 + 10, otop + 64, 44, 28); box(ox0 + 60, otop + 70, 30, 22);
    for (const [tx, ty] of [[ox0 + 104, otop + 82], [ox0 + 120, otop + 84]]) { c.fillStyle = '#d6eef8'; c.beginPath(); c.arc(tx, ty, 9, 0, Math.PI * 2); c.fill(); ink(c, 2); c.fillStyle = '#4a3a50'; c.beginPath(); c.arc(tx, ty, 4, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#c9cfdc'; rect(c, ox0 + 20, GY - 26, 46, 24, 3); c.fill(); ink(c, 2); // boîte de vis
    c.fillStyle = '#6f7790'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(ox0 + 28 + i * 8, GY - 22, 2.4, 0, Math.PI * 2); c.fill(); }
    rect(c, ox0, otop, ow, GY - otop); ink(c, 3);
    // toit en tôle ondulée, légèrement penché
    c.beginPath(); c.moveTo(x0 - 18, top + 8); c.lineTo(x0 - 10, top - 18); c.lineTo(x0 + w + 14, top - 4); c.lineTo(x0 + w + 18, top + 16); c.closePath();
    c.fillStyle = lg(c, 0, top - 18, 0, top + 16, [[0, '#d7dce8'], [1, '#8f97ad']]); c.fill(); ink(c, 3);
    c.save(); c.clip(); c.strokeStyle = 'rgba(60,66,90,.45)'; c.lineWidth = 2; for (let px = x0 - 16; px < x0 + w + 20; px += 12) { c.beginPath(); c.moveTo(px, top - 22); c.lineTo(px + 2, top + 20); c.stroke(); } c.restore();
    // un écrou peint sur la porte
    c.fillStyle = '#ffd23f'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.lineTo(x0 + w - 22 + Math.cos(a) * 14, top + 74 + Math.sin(a) * 14); } c.closePath(); c.fill(); ink(c, 2.5);
    c.fillStyle = '#5f8f74'; c.beginPath(); c.arc(x0 + w - 22, top + 74, 5.5, 0, Math.PI * 2); c.fill(); ink(c, 2);
    label(c, x, top - 34, L.remise, '#fff3d6');
  }

  // 4. Le bureau à plans de Papi : cabane ronde, grande fenêtre sur la table à dessin et sa lampe, coupole et lunette
  function bureau(c, x, L) {
    const w = 200, h = 150, x0 = x - w / 2, top = GY - h;
    c.fillStyle = 'rgba(30,50,20,.25)'; c.beginPath(); c.ellipse(x, GY + 4, w / 2 + 14, 9, 0, 0, Math.PI * 2); c.fill();
    // coupole et lunette
    c.fillStyle = lg(c, 0, top - 70, 0, top, [[0, '#c9b4ff'], [1, '#8a6fd8']]); c.beginPath(); c.arc(x + 30, top + 2, 52, Math.PI, 0); c.closePath(); c.fill(); ink(c, 3);
    c.save(); c.translate(x + 40, top - 34); c.rotate(-0.6); c.fillStyle = lg(c, 0, -8, 0, 8, [[0, '#ffe066'], [1, '#e0a000']]); rect(c, -6, -9, 64, 18, 6); c.fill(); ink(c, 2.5); c.fillStyle = '#a7e3ff'; c.beginPath(); c.ellipse(58, 0, 4, 9, 0, 0, Math.PI * 2); c.fill(); ink(c, 2); c.restore();
    planks(c, x0, top, w, h, '#f0c088', '#b97a3e');
    // grande fenêtre : table à dessin, plan bleu, lampe allumée
    const fx = x0 + 22, fw = 112, fy = top + 26, fh = 84;
    c.fillStyle = lg(c, 0, fy, 0, fy + fh, [[0, '#ffefc2'], [1, '#ffd27a']]); rect(c, fx, fy, fw, fh, 4); c.fill();
    c.fillStyle = '#3f6fd0'; c.save(); c.translate(fx + 54, fy + 54); c.rotate(-0.15); rect(c, -34, -18, 68, 36, 2); c.fill(); ink(c, 2);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-24, 6); c.lineTo(24, -6); c.moveTo(-6, -12); c.lineTo(-2, 12); c.moveTo(8, -10); c.lineTo(12, 10); c.stroke(); c.restore();
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(fx + 92, fy + fh); c.lineTo(fx + 92, fy + 30); c.lineTo(fx + 76, fy + 18); c.stroke();
    c.fillStyle = '#ff4f81'; c.beginPath(); c.moveTo(fx + 66, fy + 12); c.lineTo(fx + 86, fy + 10); c.lineTo(fx + 80, fy + 26); c.closePath(); c.fill(); ink(c, 2);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, fx + 74, fy + 30, 0, 50, [[0, 'rgba(255,240,170,.7)'], [1, 'rgba(255,220,140,0)']]); rect(c, fx, fy, fw, fh, 4); c.fill(); c.restore();
    rect(c, fx, fy, fw, fh, 4); ink(c, 3); c.beginPath(); c.moveTo(fx + fw / 2, fy); c.lineTo(fx + fw / 2, fy + fh); ink(c, 2);
    // porte, et un seau de plans roulés
    c.fillStyle = lg(c, 0, top + 50, 0, GY, [[0, '#c48a4c'], [1, '#8a5a2a']]); rect(c, x0 + w - 52, top + 50, 36, GY - top - 50, 4); c.fill(); ink(c, 2.5);
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x0 + w - 24, top + 98, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9aa0b4'; rect(c, x0 - 34, GY - 30, 26, 30, 4); c.fill(); ink(c, 2);
    for (const [dx, a] of [[-30, -0.2], [-22, 0.1], [-14, 0.3]]) { c.save(); c.translate(x0 + dx, GY - 28); c.rotate(a); c.fillStyle = '#7fb4ff'; rect(c, -4, -30, 8, 32, 3); c.fill(); ink(c, 1.8); c.restore(); }
    label(c, x - 30, top - 18, L.bureau, '#fff3d6');
  }

  // 5. La manche à air : un mât rayé, la manche qui flotte, l'anémomètre, l'abri météo
  function manche(c, x, L) {
    c.fillStyle = 'rgba(30,50,20,.25)'; c.beginPath(); c.ellipse(x, GY + 4, 90, 9, 0, 0, Math.PI * 2); c.fill();
    // abri météo en lattes blanches sur pieds
    const bx = x - 92, by = GY - 112;
    c.strokeStyle = INK; c.lineWidth = 4; for (const lx of [bx + 8, bx + 52]) { c.beginPath(); c.moveTo(lx, by + 50); c.lineTo(lx, GY); c.stroke(); }
    c.fillStyle = '#ffffff'; rect(c, bx, by, 60, 54, 3); c.fill(); ink(c, 2.5);
    c.strokeStyle = 'rgba(42,27,61,.4)'; c.lineWidth = 1.5; for (let ly = by + 10; ly < by + 50; ly += 8) { c.beginPath(); c.moveTo(bx + 4, ly); c.lineTo(bx + 56, ly + 3); c.stroke(); }
    c.beginPath(); c.moveTo(bx - 6, by + 2); c.lineTo(bx + 30, by - 16); c.lineTo(bx + 66, by + 2); c.closePath(); c.fillStyle = '#ff6f93'; c.fill(); ink(c, 2.5);
    // le mât rayé
    const top = GY - 250;
    c.fillStyle = '#ffffff'; rect(c, x - 6, top, 12, GY - top, 4); c.fill();
    c.save(); c.clip(); c.fillStyle = '#ff6f93'; for (let y = top; y < GY; y += 36) c.fillRect(x - 8, y, 16, 18); c.restore();
    rect(c, x - 6, top, 12, GY - top, 4); ink(c, 2.5);
    // l'anémomètre au sommet
    c.beginPath(); c.moveTo(x - 30, top - 12); c.lineTo(x + 30, top - 12); c.moveTo(x, top); c.lineTo(x, top - 12); ink(c, 3);
    for (const ax of [x - 30, x + 30]) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(ax, top - 12, 8, ax < x ? 0 : Math.PI, ax < x ? Math.PI : Math.PI * 2); c.closePath(); c.fill(); ink(c, 2); }
    // la manche qui flotte vers la droite, rayée orange et blanc
    const mx = x + 6, my = top + 30;
    c.save(); c.translate(mx, my); c.rotate(0.08);
    c.beginPath(); c.moveTo(0, -18); c.lineTo(110, -10); c.quadraticCurveTo(118, 0, 110, 10); c.lineTo(0, 18); c.closePath();
    c.fillStyle = '#ffffff'; c.fill(); c.save(); c.clip(); for (let i = 0; i < 5; i += 2) { c.fillStyle = '#ff8a3d'; c.fillRect(i * 22, -20, 22, 40); } c.restore();
    c.beginPath(); c.moveTo(0, -18); c.lineTo(110, -10); c.quadraticCurveTo(118, 0, 110, 10); c.lineTo(0, 18); c.closePath(); ink(c, 2.5);
    c.beginPath(); c.ellipse(0, 0, 5, 18, 0, 0, Math.PI * 2); c.fillStyle = '#d9d5e6'; c.fill(); ink(c, 2.2);
    c.restore();
    label(c, x - 60, GY - 156, L.manche, '#fff3d6');
  }

  // Un bâtiment encore fermé : grisé, avec un cadenas
  function locked(c, x, draw, L) {
    c.save(); c.filter = 'grayscale(0.85) brightness(1.08) contrast(0.8)'; draw(c, x, L); c.restore();
    const ly = GY - 120; c.fillStyle = '#e9e5f3'; rect(c, x - 22, ly, 44, 36, 7); c.fill(); ink(c, 3);
    c.beginPath(); c.arc(x, ly, 14, Math.PI, 0); ink(c, 5);
    c.fillStyle = INK; c.beginPath(); c.arc(x, ly + 15, 5, 0, Math.PI * 2); c.fill(); c.fillRect(x - 2, ly + 16, 4, 10);
  }
  const DRAW = { atelier, limonade, remise, bureau, manche };
  function paint(c, L, open) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    decor(c);
    c.save(); c.translate(345, GY); c.scale(0.7, 0.7); Art.OBST.pommier(c); c.restore(); // le pommier de Papi
    for (const [k, x] of Object.entries(SLOTS)) { if (open(k)) DRAW[k](c, x, L); else locked(c, x, DRAW[k], L); }
  }
  return { W, H, GY, SLOTS, paint };
})();
