// RocketYgles : le dessin du vol avec PixiJS (WebGL). Les décors sont peints une fois (js/art.js) puis défilent en
// parallaxe ; seuls l'avion, les pièces, les pigeons et les particules bougent. La physique est dans js/flight.js.
// Repère : 1 m = SCALE px ; le sol est à groundY sur l'écran, et la caméra suit l'avion.
'use strict';

const Scene = {
  SCALE: 16, app: null, ready: null, tex: {}, layers: {}, items: [], parts: [], stressSprites: [],
  W: 0, H: 0, camX: 0, camY: 0, built: null, trail: [], streaks: [], shake: 0,
  calm: matchMedia('(prefers-reduced-motion: reduce)').matches, // le téléphone demande moins d'animations : pas de secousses

  // Création de l'application PixiJS dans #stage ; résolution limitée à 2 (1,5 en économie de batterie)
  init(host) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const app = new PIXI.Application();
      const eco = !!(App.opts().eco);
      await app.init({ resizeTo: host, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, eco ? 1.5 : 2), background: '#6fb2f2', preference: 'webgl' });
      host.appendChild(app.canvas);
      app.ticker.maxFPS = App.opts().fps60 ? 60 : 30;
      this.app = app; this.paint(); this.build();
      app.renderer.on('resize', () => this.layout());
      this.layout();
      return app;
    })();
    return this.ready;
  },

  // Les textures, peintes une seule fois
  // Chaque texture déclare sa densité : un dessin de 160 px reste large de 160 px à l'écran, quel que soit le téléphone
  texture(w, h, f, res) { const R = res || Math.min(window.devicePixelRatio || 1, 2); return new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: Art.canvas(w, h, R, f.bind(Art)), resolution: R }) }); },
  paint() {
    const T = (w, h, f, res) => this.texture(w, h, f, res);
    this.tex = {
      sky: T(390, 844, Art.sky, 1), cloud: T(150, 80, Art.cloud),
      mountains: T(1200, 220, Art.mountains, 1), hills: T(1000, 180, Art.hills, 1),
      fore: T(800, 110, Art.fore, 1), plane: T(Art.PLANE.w, Art.PLANE.h, (c, w, h) => Art.plane(c, w, h, 'carton', true)), coin: T(40, 40, Art.coin), dot: T(24, 24, Art.dot, 1),
      bird: [0, 1, 2, 3].map(f => T(72, 62, (c, w, h) => Art.bird(c, w, h, f))),
    };
    // Ce qu'on croise en vol (Art.OBST) : chaque dessin, mis à l'échelle de sa taille physique (OBST), dans une texture
    // de w × h px dont le point d'accroche (pied ou centre) est en (ox, oy)
    const O = Art.OBST, D = (w, h, ox, oy, f, draw) => ({ t: T(w, h, c => { c.translate(ox, oy); c.scale(f, f); c.lineJoin = 'round'; c.lineCap = 'round'; draw(c); }), a: [ox / w, oy / h] });
    this.ob = {
      tree: D(104, 132, 52, 124, 0.655, c => O.pommier(c)), hedge: D(92, 32, 5, 27, 0.41, c => O.haie(c, OBST.hedgeW * 16 / 0.41)),
      fence: D(88, 30, 44, 28, 0.55, c => O.cloture(c)), balloons: D(60, 76, 32, 98, 0.55, c => O.ballons(c)),
      bbq: D(34, 56, 17, 54, 0.45, c => O.barbecue(c)), heat: D(52, 196, 26, 194, 1, c => O.chaleur(c, OBST.heat.w * 32, OBST.heat.top * 16)),
      spray: D(132, 56, 66, 52, 0.49, c => O.arroseur(c)), cloud: D(130, 76, 65, 45, 0.8, c => O.nuage(c)), rain: D(112, 100, 0, 0, 1, c => O.pluie(c, 112, 100)),
      goose: [1, 0].map(up => D(50, 38, 26, 19, 0.5, c => O.oie(c, up))), kite: D(50, 100, 20, 26, 0.6, c => O.cerfvolant(c)), girl: D(18, 34, 9, 32, 0.9, c => O.fillette(c)),
      mast: D(30, 236, 16, 233, 1, c => O.eolienne(c, OBST.hub * 16)), rotor: D(172, 172, 86, 86, 1.2, c => O.rotor(c)), wind: D(52, 66, 3, 8, 1, c => O.vent(c, 4)),
    };
  },

  build() {
    const st = this.app.stage, L = this.layers;
    L.sky = new PIXI.Sprite(this.tex.sky);
    L.clouds = new PIXI.Container();
    for (let i = 0; i < 5; i++) { const s = new PIXI.Sprite(this.tex.cloud); s.anchor.set(0.5); s.scale.set(1.2 + (i % 3) * 0.5); s.alpha = 0.92; s.baseX = i * 260 + 60; s.baseY = 120 + (i * 97) % 260; L.clouds.addChild(s); }
    L.mountains = new PIXI.TilingSprite({ texture: this.tex.mountains, width: 400, height: 220 });
    L.hills = new PIXI.TilingSprite({ texture: this.tex.hills, width: 400, height: 180 });
    // Sous les collines, leur couleur du bas jusqu'au pré (sur un tremplin haut, la caméra descend plus que les collines)
    L.hillsBase = new PIXI.Graphics();
    L.world = new PIXI.Container();
    L.ground = new PIXI.Graphics();
    // La piste (une texture peinte à chaque vol) et la catapulte : attache du fond et ses brins derrière l'avion,
    // crochet, attache de devant et ses brins devant lui
    L.runway = new PIXI.Sprite(); L.cleatFar = new PIXI.Sprite(); L.cleatNear = new PIXI.Sprite();
    L.elastic = new PIXI.Graphics(); L.hook = new PIXI.Graphics(); L.elasticNear = new PIXI.Graphics();
    L.itemsC = new PIXI.Container(); L.partsC = new PIXI.Container();
    // L'avion pivote sur ses roues : le point d'accroche est sous les roues (entre les deux), là où il touche la piste
    L.shadow = new PIXI.Graphics(); L.plane = new PIXI.Sprite(this.tex.plane); L.plane.anchor.set(Art.PLANE.ax / Art.PLANE.w, Art.PLANE.ay / Art.PLANE.h); L.plane.scale.set(Art.PLANE.scale);
    // Effets de vitesse : traînée d'air et écharpe derrière l'avion, traits de vent et herbes floues devant
    L.trail = new PIXI.Graphics(); L.scarf = new PIXI.Graphics(); L.streaksC = new PIXI.Container();
    L.fore = new PIXI.TilingSprite({ texture: this.tex.fore, width: 400, height: 110 });
    L.world.addChild(L.ground, L.runway, L.shadow, L.itemsC, L.cleatFar, L.elastic, L.trail, L.plane, L.scarf, L.hook, L.cleatNear, L.elasticNear, L.partsC);
    st.addChild(L.sky, L.clouds, L.mountains, L.hills, L.hillsBase, L.world, L.streaksC, L.fore);
  },

  layout() {
    const s = this.app.screen; this.W = s.width; this.H = s.height;
    const L = this.layers, W = this.W;
    L.sky.width = W; L.sky.height = this.H;
    for (const t of [L.mountains, L.hills, L.fore]) t.width = W;
    // Le sol aux deux tiers : la piste reste au-dessus de la bulle de Papi et de la jauge
    this.groundY = Math.round(this.H * 0.64);
  },

  // Une nouvelle piste à chaque vol : sa hauteur et son tremplin dépendent des améliorations (dessin de ref/tremplins.html,
  // à la vraie géométrie de la physique), et la catapulte du niveau de l'élastique (ref/elastiques.html)
  setFlight(st) {
    const S = this.SCALE, p = st.p, L = this.layers;
    const xl = -PHYS.runway - 2.5, xr = p.rampLen + 1.6, top = p.deckY + p.rise + 4;
    const g = { H: p.deckY, rise: p.rise, len: p.rampLen, R: PHYS.runway, top: m => Flight.deck(st, m) };
    for (const k of ['runway', 'cleatFar', 'cleatNear']) if (L[k].texture && L[k].texture !== PIXI.Texture.EMPTY) L[k].texture.destroy(true);
    L.runway.texture = this.texture((xr - xl) * S, top * S + 20, c => Art.runway(c, g, m => (m - xl) * S, m => (top - m) * S, top * S, p.lvRamp));
    L.runway.position.set(xl * S, -top * S);
    // les attaches, peintes une fois : celle du fond (avec le treuil au niveau 10) et celle de devant
    const es = this.elasticStyle = Art.elasticStyle(p.lvElastic), cx = PHYS.catapult * S, dy = -p.deckY * S;
    L.cleatFar.texture = this.texture(100, 60, c => { Art.cleat(c, 80, 50, es, true); if (es.winch) Art.winch(c, 34, 50); });
    L.cleatFar.position.set(cx - 80, dy - 50);
    L.cleatNear.texture = this.texture(40, 26, c => Art.cleat(c, 20, 20, es, false));
    L.cleatNear.position.set(cx - 20, dy - 20);
    this.cleats = [[cx - 8, dy - 9], [cx, dy - 7]];
    // pièces, oiseaux, obstacles et aides
    for (const v of this.items) v.c.destroy({ children: true }); this.items = [];
    for (const it of st.items) { const v = this.itemView(it); L.itemsC.addChild(v.c); this.items.push(v); }
    for (const p2 of this.parts) p2.s.destroy(); this.parts = [];
    this.camX = st.x * S - this.W * 0.32; this.camY = this.camTarget(st); this.trail = []; this.shake = 0;
    for (const s of this.streaks) s.s.destroy(); this.streaks = [];
  },

  // Le dessin d'un élément du vol : un conteneur posé à son pied (au sol) ou à sa place (ce qui vole) ;
  // parts : les morceaux qui bougent (ballons, colonne d'air chaud, pluie, cerf-volant, rotor, vent)
  itemView(it) {
    const S = this.SCALE, c = new PIXI.Container(), v = { it, c, parts: {} };
    const spr = (o, x, y) => { const s = new PIXI.Sprite(o.t); s.anchor.set(o.a[0], o.a[1]); s.position.set(x || 0, y || 0); c.addChild(s); return s; };
    const up = m => -(m - it.g) * S; // une hauteur au-dessus du pied, en pixels
    if (it.kind === 'coin' || it.kind === 'bird') { const s = spr({ t: it.kind === 'coin' ? this.tex.coin : this.tex.bird[0], a: [0.5, 0.5] }); s.scale.set(it.kind === 'coin' ? 1.1 : 1.24); v.parts.s = s; return v; }
    if (it.kind === 'goose') { v.parts.s = spr(this.ob.goose[0]); return v; }
    c.position.set(it.x * S, -it.g * S);
    switch (it.kind) {
      case 'tree': spr(this.ob.tree); break;
      case 'hedge': spr(this.ob.hedge); break;
      case 'balloons': spr(this.ob.fence); v.parts.b = spr(this.ob.balloons); break;
      case 'bbq': v.parts.h = spr(this.ob.heat); spr(this.ob.bbq); break;
      case 'sprinkler': spr(this.ob.spray); break;
      case 'rain': { const h = (it.top - it.g) * S; v.parts.r = new PIXI.TilingSprite({ texture: this.ob.rain.t, width: 112, height: h }); v.parts.r.position.set(-56, -h); c.addChild(v.parts.r); spr(this.ob.cloud, 0, -h); break; }
      case 'kite': {
        const ky = up(it.y), gx = (it.gx - it.x) * S, gy = up(it.gy), line = new PIXI.Graphics();
        line.moveTo(0, ky + 26).quadraticCurveTo(gx * 0.4, (ky + gy) / 2 + 30, gx + 3, gy - 20).stroke({ color: 0x2a1b3d, width: 1.5, alpha: 0.7 }); c.addChild(line);
        spr(this.ob.girl, gx, gy); v.parts.k = spr(this.ob.kite, 0, ky); break;
      }
      case 'turbine': v.parts.w = spr(this.ob.wind, 0.5 * S + 70, up(it.hub) - 20); spr(this.ob.mast); v.parts.r = spr(this.ob.rotor, -14, up(it.hub) - 1); break;
    }
    return v;
  },

  // Hauteur de la caméra : sur la piste, l'avion reste aux trois cinquièmes de l'écran (sous le titre et les conseils,
  // même sur le tremplin le plus haut) ; en vol, on ne monte que s'il s'approche du haut
  camTarget(st) {
    const onDeck = st.phase === 'ready' || st.phase === 'shot' || st.phase === 'roll';
    return Math.max(0, st.y * this.SCALE - (this.groundY - this.H * (onDeck ? 0.6 : 0.34)));
  },

  // Particules : poussière, étincelles d'or, plumes
  burst(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i++) {
      const s = new PIXI.Sprite(this.tex.dot); s.anchor.set(0.5); s.tint = color; s.scale.set(0.4 + Math.random() * 0.5);
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.layers.partsC.addChild(s); this.parts.push({ s, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, t: 0 });
    }
  },

  // Dessine l'état du vol
  draw(st, dt) {
    const L = this.layers, S = this.SCALE, W = this.W, H = this.H;
    // Caméra : l'avion à un tiers de l'écran ; on monte avec lui quand il s'approche du haut
    const tx = st.x * S - W * 0.32, ty = this.camTarget(st);
    this.camX += (tx - this.camX) * Math.min(1, dt * 6); this.camY += (ty - this.camY) * Math.min(1, dt * 4);
    // Secousse (lâcher, décollage, atterrissage), qui s'amortit vite
    this.shake = Math.max(0, this.shake - dt * 14);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    L.world.position.set(-this.camX + sx, this.groundY + this.camY + sy);
    L.mountains.y = this.groundY - 200 + this.camY * 0.15; L.mountains.tilePosition.x = -this.camX * 0.08;
    L.hills.y = this.groundY - 120 + this.camY * 0.35; L.hills.tilePosition.x = -this.camX * 0.25;
    L.hillsBase.clear(); if (L.hills.y + 178 < H) L.hillsBase.rect(0, L.hills.y + 178, W, H).fill({ color: 0xc9cf9f });
    // Le pré : son relief est celui de la physique (Flight.ground), redessiné sur la largeur de l'écran
    const gr = L.ground, x0 = Math.floor(this.camX / 8) * 8 - 16, x1 = this.camX + W + 16, bottom = H;
    gr.clear(); gr.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 8) gr.lineTo(x, -Flight.ground(x / S) * S);
    gr.lineTo(x1, bottom).closePath().fill({ color: 0x5cbf52 });
    gr.moveTo(x0, -Flight.ground(x0 / S) * S + 26); for (let x = x0; x <= x1; x += 8) gr.lineTo(x, -Flight.ground(x / S) * S + 26);
    gr.lineTo(x1, bottom).lineTo(x0, bottom).closePath().fill({ color: 0x47a845 });
    gr.moveTo(x0, -Flight.ground(x0 / S) * S + 2); for (let x = x0; x <= x1; x += 8) gr.lineTo(x, -Flight.ground(x / S) * S + 2);
    gr.stroke({ color: 0xd9f59a, width: 4, alpha: 0.8 });
    for (let k = Math.floor(x0 / 37); k * 37 < x1; k++) { const fx = k * 37 + ((k * 53) % 17), fy = -Flight.ground(fx / S) * S + 30 + ((k * 71) % 90); gr.circle(fx, fy, 2.4).fill({ color: [0xfff2a8, 0xffb3c7, 0xffffff][((k % 3) + 3) % 3] }); }
    for (const c of L.clouds.children) { c.x = ((c.baseX - this.camX * 0.14) % (W + 300) + W + 300) % (W + 300) - 150; c.y = c.baseY + this.camY * 0.05; }
    // Herbes floues du premier plan : plus rapides que le sol, visibles seulement près du sol
    L.fore.y = H - 96 + this.camY * 1.3; L.fore.tilePosition.x = -this.camX * 1.5; L.fore.visible = L.fore.y < H;
    // L'avion
    const px = st.x * S, py = -st.y * S, rolling = st.phase === 'roll' || st.phase === 'shot';
    // Vitesse de l'avion (m/s), et sa part de « vitesse maximale » pour doser les effets
    const v = st.phase === 'air' ? Math.hypot(st.vx, st.vy) : st.speed || 0, vn = Math.min(1, v / 18);
    // Petites vibrations : sur la piste (les roues), puis un léger tangage en vol
    const wob = rolling ? Math.sin(st.t * 45) * 0.012 * vn : st.phase === 'air' ? Math.sin(st.t * 5.5) * 0.025 * vn : 0;
    // Après un choc dur, l'avion fait un tour sur lui-même ; mouillé, le carton fonce
    const spin = st.spin > 0 ? (1 - st.spin / OBST.spin) * Math.PI * 2 : 0;
    L.plane.position.set(px, py + (rolling ? Math.sin(st.t * 38) * vn : 0)); L.plane.rotation = -st.pitch + wob + spin; L.plane.tint = st.wet > 0 ? 0xb8c2d6 : 0xffffff;
    this.effects(st, dt, px, py, v, vn);
    L.shadow.clear(); const sh = Math.max(0, 1 - st.y / 25);
    if (st.phase === 'air') { const gy = -Flight.ground(st.x) * S; L.shadow.ellipse(px, gy - 1, (34 * sh + 8) * Art.PLANE.scale, 5 * sh + 1).fill({ color: 0x1e3214, alpha: 0.25 * sh }); }
    // L'élastique : à plat le long de la piste, des attaches au crochet sous le nez tant que l'avion y est accroché ;
    // une fois lâché, il se rétracte contre ses attaches
    const es = this.elasticStyle, hooked = st.phase === 'ready' || st.phase === 'shot';
    const hk = hooked ? [px + PHYS.hook * S, py - 9 * Art.PLANE.scale] : [this.cleats[1][0] - 6, this.cleats[1][1]];
    const strands = (gr, [ax, ay]) => es.strands.forEach(([col, w], i) => {
      const off = (i - (es.strands.length - 1) / 2) * (w * 0.7);
      gr.moveTo(ax, ay + off).lineTo(hk[0], hk[1] + off).stroke({ color: 0x2a1b3d, width: w + 3, cap: 'round' });
      gr.moveTo(ax, ay + off).lineTo(hk[0], hk[1] + off).stroke({ color: col, width: w, cap: 'round' });
    });
    L.elastic.clear(); L.hook.clear(); L.elasticNear.clear();
    strands(L.elastic, this.cleats[0]);
    if (hooked) {
      L.hook.moveTo(hk[0] - 7, hk[1] - 7).quadraticCurveTo(hk[0] + 4, hk[1] - 5, hk[0], hk[1] + 2).stroke({ color: 0x2a1b3d, width: 3, cap: 'round' });
      if (es.pouch) L.hook.ellipse(hk[0] + 2, hk[1], 6, 7).fill({ color: 0x93603a }).stroke({ color: 0x2a1b3d, width: 2 });
    }
    strands(L.elasticNear, this.cleats[1]);
    // Pièces, oiseaux, obstacles et aides (seulement ceux qui sont à l'écran ; les grands débordent jusqu'à 260 px)
    for (const { it, c, parts: P } of this.items) {
      const sx = it.x * S, flies = it.kind === 'bird' || it.kind === 'goose';
      c.visible = sx > this.camX - 260 && sx < this.camX + W + 260 && !it.taken && !(flies && it.hit);
      if (!c.visible) continue;
      if (it.kind === 'coin') { c.position.set(sx, -it.y * S); P.s.scale.x = 1.1 * Math.abs(Math.cos(st.t * 3 + it.x)); }
      else if (it.kind === 'bird') { c.position.set(sx, -it.y * S + Math.sin(it.flap * 0.5) * 3); P.s.texture = this.tex.bird[Math.floor(it.flap) % 4]; }
      else if (it.kind === 'goose') { c.position.set(sx, -it.y * S + Math.sin(it.flap * 0.5) * 2); P.s.texture = this.ob.goose[Math.floor(it.flap / 3) % 2].t; }
      else if (it.kind === 'balloons') { P.b.visible = !it.popped; P.b.y = Math.sin(st.t * 2 + it.x) * 2; }
      else if (it.kind === 'bbq') P.h.alpha = 0.75 + 0.25 * Math.sin(st.t * 3);
      else if (it.kind === 'rain') P.r.tilePosition.y = st.t * 220;
      else if (it.kind === 'kite') P.k.rotation = Math.sin(st.t * 1.7 + it.x) * 0.12;
      else if (it.kind === 'turbine') { P.r.rotation = st.t * 1.8; P.w.alpha = 0.5 + 0.5 * Math.abs(Math.sin(st.t * 2)); }
    }
    // Événements du vol : effets
    for (const ev of st.events.splice(0)) {
      if (ev.kind === 'coin') this.burst(ev.x * S, -ev.y * S, 10, 0xffd23f, 90, 0.5);
      else if (ev.kind === 'hit') { // un choc : des éclats de ce qu'on a touché ; plus forts et secousse pour un choc dur
        const col = { feather: 0xe9e5f3, leaf: 0x7cc25e, wood: 0x8a5a32, paper: 0xff4f81, string: 0xffffff, metal: 0xeceaf6 }[ev.what];
        this.burst(ev.x * S, -ev.y * S, ev.hard ? 18 : 12, col, ev.hard ? 110 : 70, 0.8); this.kick(ev.hard ? 7 : 3);
      } else if (ev.kind === 'pop') { for (const col of [0xff4f81, 0xffd23f, 0x7fd3ff, 0x5cd86a, 0xb18cff]) this.burst(ev.x * S, -ev.y * S, 5, col, 120, 0.7); this.kick(3); }
      else if (ev.kind === 'wet') this.burst(ev.x * S, -ev.y * S, 14, 0x7fd3ff, 60, 0.7);
      else if (ev.kind === 'land' || ev.kind === 'launch') { this.burst(px, py - 4, 14, 0xf0d7aa, 50, 0.7); this.kick(ev.kind === 'land' ? 7 : 4); }
      else if (ev.kind === 'takeoff') { this.burst(px - 10, py - 10, 18, 0xffffff, 110, 0.6); this.kick(4); for (let k = 0; k < 8; k++) this.streak(st, 1); }
    }
    if (rolling && Math.random() < 0.5) this.burst(px - 20, py + 10, 1, 0xf0d7aa, 30, 0.5);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.t += dt;
      if (p.t >= p.life) { p.s.destroy(); this.parts.splice(i, 1); continue; }
      p.vy += 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s.position.set(p.x, p.y); p.s.alpha = 1 - p.t / p.life;
    }
    for (const s of this.stressSprites) { s.rotation += dt; s.x = ((s.x + s.vx * dt) % W + W) % W; }
  },

  kick(n) { if (!this.calm) this.shake = Math.max(this.shake, n); },

  // Traînée d'air, écharpe d'Yglou et traits de vent : tous dosés par la vitesse de l'avion
  effects(st, dt, px, py, v, vn) {
    const L = this.layers, rot = L.plane.rotation, cos = Math.cos(rot), sin = Math.sin(rot);
    const ps = Art.PLANE.scale, at = (lx, ly) => [px + (lx * cos - ly * sin) * ps, py + (lx * sin + ly * cos) * ps]; // point de l'avion → monde
    // Traînée : le bout de la queue laisse une trace d'air qui s'efface
    const tail = at(-72, -30);
    if (st.phase === 'air' || st.phase === 'roll' || st.phase === 'shot') this.trail.push({ x: tail[0], y: tail[1], v: vn });
    if (st.phase === 'done' || st.phase === 'ready') this.trail.length = 0;
    while (this.trail.length > 26) this.trail.shift();
    const g = L.trail; g.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i], k = i / this.trail.length;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xffffff, width: 1.5 + 7 * k, alpha: 0.75 * k * Math.max(0.3, b.v), cap: 'round' });
    }
    // L'écharpe : un ruban rose accroché au cou d'Yglou, qui ondule de plus en plus vite
    const sc = L.scarf; sc.clear();
    if (st.phase !== 'ready') {
      // au-dessus de l'avion : un ruban souple qui part du cou d'Yglou, ondule et s'affine vers le bout
      const pts = [];
      for (let k = 0; k <= 14; k++) { const lx = -10 - k * (3.4 + 2 * vn), ly = -46 - k * 0.45 + Math.sin(st.t * (7 + 12 * vn) - k * 0.55) * k * (0.22 + 0.55 * vn); pts.push(at(lx, ly)); }
      for (const [col, w0, w1] of [[0x2a1b3d, 6.5, 3], [0xff5d8c, 4.2, 1.4]]) for (let k = 1; k < pts.length; k++) {
        const t = k / (pts.length - 1); sc.moveTo(pts[k - 1][0], pts[k - 1][1]).lineTo(pts[k][0], pts[k][1]).stroke({ color: col, width: (w0 + (w1 - w0) * t) * ps, cap: 'round' });
      }
    }
    // Traits de vent : ils naissent à droite et filent vers la gauche, plus nombreux quand on va vite
    if ((st.phase === 'air' || st.phase === 'roll' || st.phase === 'shot') && v > 5 && Math.random() < vn * dt * 26) this.streak(st, vn);
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i]; s.s.x -= s.v * dt;
      if (s.s.x < -80) { s.s.destroy(); this.streaks.splice(i, 1); }
    }
  },
  streak(st, vn) {
    const s = new PIXI.Sprite(this.tex.dot); s.anchor.set(0.5); s.tint = 0xffffff;
    s.scale.set(2.5 + Math.random() * 4, 0.12 + Math.random() * 0.08); s.alpha = 0.25 + 0.4 * vn;
    s.x = this.W + 60; s.y = 60 + Math.random() * (this.H * 0.75);
    this.layers.streaksC.addChild(s); this.streaks.push({ s, v: 500 + 900 * vn + Math.random() * 300 });
  },

  // Test de performance : n objets animés en plus (index.html?stress=300), pour mesurer les images/s sur un vrai téléphone
  stress(n) {
    for (let i = 0; i < n; i++) {
      const s = new PIXI.Sprite(i % 3 ? this.tex.coin : this.tex.bird[0]); s.anchor.set(0.5);
      s.x = Math.random() * this.W; s.y = 60 + Math.random() * (this.H - 200); s.vx = 20 + Math.random() * 60;
      this.app.stage.addChild(s); this.stressSprites.push(s);
    }
  },
  fps() { return this.app ? Math.round(this.app.ticker.FPS) : 0; },
  pause() { if (this.app) this.app.ticker.stop(); },
  resume() { if (this.app) this.app.ticker.start(); },
};
