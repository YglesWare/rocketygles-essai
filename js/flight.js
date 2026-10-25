// RocketYgles : la physique d'un vol, sans aucun dessin (testable, et utilisable par le bot d'équilibrage).
// Un vol : on recule l'avion, l'élastique le tire jusqu'à ses attaches au bout de la piste plate, le tremplin le relève, puis il plane (portance, traînée,
// décrochage) jusqu'à toucher le sol et glisser. ▲ / ▼ lèvent ou baissent le nez. Unités : mètres et secondes ;
// x vers l'avant (0 = début du tremplin), y vers le haut (0 = le sol).
'use strict';

const Flight = {
  // Petit générateur pseudo-aléatoire : un même numéro de vol donne toujours les mêmes pièces et les mêmes pigeons
  rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; },

  // Caractéristiques de l'avion d'après les améliorations du joueur (meta.up : { wings, body, elastic, ramp })
  plane(up) {
    const lv = k => (up && up[k]) || 0, w = UPGRADES.wings.effect(lv('wings')), b = UPGRADES.body.effect(lv('body'));
    const e = UPGRADES.elastic.effect(lv('elastic')), r = UPGRADES.ramp.effect(lv('ramp'));
    const angle = r.angle * Math.PI / 180, rampLen = 2 * r.rise / Math.tan(angle), mass = Math.max(PHYS.minMass, PHYS.baseMass + w.mass + b.mass);
    // L'élastique rend son énergie : v = √(2E / m)
    return { mass, area: w.area, k: w.k, v0: Math.sqrt(2 * e.energy / mass), reach: e.reach, angle, rise: r.rise, rampLen, deckY: r.deck, lvRamp: lv('ramp'), lvElastic: lv('elastic') };
  },

  create(meta, seed) {
    const p = this.plane(meta && meta.up), rnd = this.rng(seed || 1), items = [];
    // Hauteur d'un vol plané ordinaire à cette distance (au-dessus du sol) : pièces et oiseaux s'y placent
    const eh = x => Math.max(1.2, p.deckY + 1 - x / 9) + rnd() * 3;
    // La manche à air (bâtiment du jardin) prévoit le vent : une part des éléments devient une aide
    const mlv = (meta && meta.town && meta.town.lv && meta.town.lv.manche) || 0, helps = mlv ? BUILDINGS.manche.effect(mlv).helps : 0;
    // Un élément de la zone tiré au hasard, puis une petite arche de pièces avant le suivant
    for (let x = 14; x < 420; x += OBST.gap[0] + rnd() * OBST.gap[1]) {
      const garden = x < OBST.garden, list = helps && rnd() < helps ? (garden ? OBST.GARDEN_HELP : OBST.FIELD_HELP) : garden ? OBST.GARDEN : OBST.FIELD;
      this.place(items, list[Math.floor(rnd() * list.length)], x, rnd, eh);
      const cx = x + OBST.gap[0] / 2, h = eh(cx);
      if (rnd() < 0.8) for (let i = 0; i < 3; i++) items.push({ kind: 'coin', x: cx + i * 1.6, y: h + this.ground(cx + i * 1.6) + Math.sin(i / 2 * Math.PI) * 0.8, r: 0.7, taken: false });
    }
    // L'avion attend accroché à l'élastique au repos ; il est lâché quand son crochet arrive aux attaches (relX)
    const relX = PHYS.catapult - PHYS.hook;
    return { phase: 'ready', p, wet: 0, spin: 0, x: relX - PHYS.slack, restX: relX - PHYS.slack, relX, aim: 0, y: p.deckY, vx: 0, vy: 0, speed: 0, pitch: 0, power: 0,
      t: 0, airT: 0, maxY: p.deckY, coins: 0, hits: 0, items, events: [], lipX: p.rampLen };
  },

  // Un élément au pied x (g : hauteur du sol), avec ce qu'il faut pour les chocs et le dessin
  place(items, kind, x, rnd, eh) {
    const g = this.ground(x), O = OBST;
    if (kind === 'pigeons') { for (let i = 0, n = rnd() < 0.4 ? 2 : 1; i < n; i++) items.push({ kind: 'bird', x: x + i * 3, y: eh(x) + g + i, vx: -1.5 - rnd() * 1.5, r: 0.8, hit: false, flap: rnd() * 6 }); return; }
    if (kind === 'geese') { const y = eh(x) + g + 1; for (const [dx, dy] of [[0, 0], [2.4, 1.4], [4.8, 2.8], [2.4, -1.4], [4.8, -2.8]]) items.push({ kind: 'goose', x: x + dx, y: y + dy, vx: -3, r: 0.7, hit: false, flap: rnd() * 6 }); return; }
    const it = { kind, x, g };
    if (kind === 'balloons') it.y = g + O.balloonY;
    else if (kind === 'rain') it.top = g + 9 + rnd() * 3;
    else if (kind === 'kite') { it.y = g + 6 + rnd() * 5; it.gx = x - O.kiteLine; it.gy = this.ground(it.gx); }
    else if (kind === 'turbine') it.hub = g + O.hub;
    items.push(it);
  },

  // Reculer l'avion : pull de 0 à 1 ; plus l'élastique est fort, plus on recule loin (p.reach)
  aim(st, pull) {
    if (st.phase !== 'ready') return;
    st.aim = Math.max(0, Math.min(1, pull)); st.x = st.restX - st.aim * st.p.reach;
  },
  // Lâcher l'élastique : power de 0 à 1 (tiré plus ou moins fort). Il tire l'avion jusqu'aux attaches (phase « shot »),
  // où l'avion atteint sa vitesse de lancer, puis roule seul vers le tremplin.
  launch(st, power) {
    if (st.phase !== 'ready') return;
    st.power = Math.max(0, Math.min(1, power));
    st.vRel = st.p.v0 * (0.35 + 0.65 * st.power); st.d = Math.max(0.5, st.relX - st.x); st.theta = 0;
    st.speed = 0; st.phase = 'shot'; st.events.push({ kind: 'launch' });
  },

  // Le relief du pré après le tremplin (en m) : plat sous la piste, puis des collines de plus en plus marquées.
  // La même fonction sert à la physique et au dessin (js/scene.js).
  ground(x) {
    if (x < 6) return 0;
    const k = Math.min(1, (x - 6) / 40);
    return Math.max(0, k * (1.5 + 0.9 * Math.sin(x / 11) + 0.6 * Math.sin(x / 4.7 + 1.3)));
  },
  slope(x) { return Math.atan2(this.ground(x + 0.25) - this.ground(x - 0.25), 0.5); },

  // Hauteur de la piste et du tremplin en x (le tremplin est une courbe douce qui finit à l'angle choisi)
  deck(st, x) { if (x <= 0) return st.p.deckY; const u = Math.min(1, x / st.p.rampLen); return st.p.deckY + st.p.rise * u * u; },

  // Avance d'un temps dt (en secondes) ; input : { up, down }
  step(st, dt, input) {
    for (let left = dt; left > 1e-6; left -= PHYS.dt) this.tick(st, Math.min(PHYS.dt, left), input || {});
  },

  tick(st, dt, input) {
    const P = PHYS, p = st.p;
    st.t += dt;
    for (const it of st.items) if ((it.kind === 'bird' || it.kind === 'goose') && !it.hit) { it.x += it.vx * dt; it.flap += dt * 12; }
    if (st.phase === 'shot') {
      // L'élastique se détend comme un ressort : il tire très fort quand il est bien tendu, puis de moins en moins,
      // et l'avion atteint sa vitesse de lancer aux attaches (mouvement d'un ressort : un quart d'oscillation)
      st.theta = Math.min(Math.PI / 2, st.theta + st.vRel / st.d * dt);
      st.x = st.relX - st.d * Math.cos(st.theta); st.speed = st.vRel * Math.sin(st.theta);
      if (st.theta >= Math.PI / 2) { st.x = st.relX; st.speed = st.vRel; st.phase = 'roll'; }
      return;
    }
    if (st.phase === 'roll') {
      st.speed -= P.roll * dt;
      if (st.x > 0) { const u = Math.min(1, st.x / p.rampLen), dh = p.rise * 2 * u / p.rampLen; st.speed -= P.g * dh * dt * (st.speed > 0 ? 1 : 0); st.pitch = Math.atan(dh); }
      if (st.speed <= 0.2) { st.speed = 0; st.phase = 'done'; st.events.push({ kind: 'stuck' }); return; }
      st.x += st.speed * Math.cos(st.pitch) * dt; st.y = this.deck(st, st.x);
      if (st.x >= p.rampLen) { // fin du tremplin : on s'envole
        st.phase = 'air'; st.vx = st.speed * Math.cos(p.angle); st.vy = st.speed * Math.sin(p.angle); st.pitch = p.angle; st.cmd = 0; st.stall = false; st.y = p.deckY + p.rise;
        st.events.push({ kind: 'takeoff' });
      }
      return;
    }
    if (st.phase === 'air') {
      st.airT += dt; st.spin = Math.max(0, st.spin - dt); st.wet = Math.max(0, st.wet - dt);
      const m = p.mass * (st.wet > 0 ? OBST.wetMass : 1); // le carton mouillé est plus lourd
      const v = Math.hypot(st.vx, st.vy) || 0.001, gam = Math.atan2(st.vy, st.vx);
      // La commande : ▲ la monte peu à peu, ▼ la baisse, et sans rien elle revient à zéro
      if (input.up && !input.down) st.cmd = Math.min(1, st.cmd + P.cmdUp * dt);
      else if (input.down && !input.up) st.cmd = Math.max(-1, st.cmd - P.cmdDown * dt);
      else st.cmd -= Math.sign(st.cmd) * Math.min(Math.abs(st.cmd), P.cmdBack * dt);
      // L'angle visé : celui du vol plané (finesse de l'avion à l'incidence trim), plus ou moins la commande
      const clT = P.clSlope * P.trim, glide = -Math.atan((P.cd0 + p.k * clT * clT) / clT);
      const aim = glide + st.cmd * (st.cmd > 0 ? P.aimUp : P.aimDown);
      // La portance qu'il faudrait pour y ramener la trajectoire en douceur, limitée par ce que l'aile peut donner :
      // pas de portance négative (sauf avec ▼). Trop lent, l'avion bien réglé s'enfonce sans décrocher ; c'est ▲ tenu
      // trop longtemps qui le fait décrocher : la portance s'effondre jusqu'à ce qu'on relâche
      const q = 0.5 * P.rho * v * v * p.area, clMax = P.clSlope * P.stall;
      const need = m * (P.g * Math.cos(gam) + v * (aim - gam) / P.settle);
      let cl = Math.max(st.cmd < 0 ? -0.3 : 0, need / q);
      if (st.cmd > 0 && cl > clMax) st.stall = true; else if (st.cmd <= 0 || cl < clMax * 0.7) st.stall = false;
      cl = st.stall ? clMax * 0.45 : Math.min(cl, clMax * 0.95);
      const a = cl / P.clSlope + (st.stall ? 0.2 : 0); // l'incidence qui en découle : le nez, un peu au-dessus de la trajectoire
      const L = q * cl, D = q * (P.cd0 + p.k * cl * cl);
      const ax = (L * (-st.vy / v) - D * (st.vx / v)) / m, ay = (L * (st.vx / v) - D * (st.vy / v)) / m - P.g;
      st.vx += ax * dt; st.vy += ay * dt; st.x += st.vx * dt; st.y += st.vy * dt; st.pitch = Math.atan2(st.vy, st.vx) + a;
      st.maxY = Math.max(st.maxY, st.y);
      this.collide(st, dt);
      // Atterrissage sur le relief : on garde la vitesse le long de la pente
      const gy = this.ground(st.x);
      if (st.y <= gy) { const a = this.slope(st.x); st.y = gy; st.speed = Math.max(0, st.vx * Math.cos(a) + st.vy * Math.sin(a)); st.vx = st.vy = 0; st.phase = 'slide'; st.pitch = a; st.events.push({ kind: 'land' }); }
      return;
    }
    if (st.phase === 'slide') {
      // Glissade : on freine, on accélère en descente et on ralentit en montée ; l'avion suit la pente
      const a = this.slope(st.x);
      st.speed += (-P.slide - P.g * Math.sin(a)) * dt;
      if (st.speed <= 0) { st.speed = 0; st.phase = 'done'; st.events.push({ kind: 'done' }); return; }
      st.x += st.speed * Math.cos(a) * dt; st.y = this.ground(st.x); st.pitch = this.slope(st.x);
    }
  },

  // Ce que l'avion touche (son centre est un peu au-dessus de ses roues). Chaque choc ne compte qu'une fois.
  collide(st, dt) {
    const O = OBST, px = st.x, py = st.y + 0.9, near = (x, y, r) => Math.hypot(x - px, y - py) < r + 0.6;
    for (const it of st.items) {
      if (Math.abs(it.x - px) > 20) continue;
      switch (it.kind) {
        case 'coin': if (!it.taken && near(it.x, it.y, it.r)) { it.taken = true; st.coins++; st.events.push({ kind: 'coin', x: it.x, y: it.y }); } break;
        case 'bird': case 'goose': if (!it.hit && near(it.x, it.y, it.r)) { it.hit = true; this.hit(st, O.bird, false, 'feather'); } break;
        case 'tree':
          if (!it.hitL && near(it.x, it.g + O.tree.canopyY, O.tree.canopyR)) { it.hitL = true; this.hit(st, O.soft, false, 'leaf'); }
          if (!it.hitT && Math.abs(it.x - px) < 0.5 && st.y < it.g + O.tree.trunk) { it.hitT = true; this.hit(st, O.hard, true, 'wood'); }
          break;
        case 'hedge': if (!it.hit && px > it.x && px < it.x + O.hedgeW && st.y < it.g + O.hedgeH) { it.hit = true; this.hit(st, O.hedge, false, 'leaf'); } break;
        case 'balloons': if (!it.popped && near(it.x, it.y, O.balloonR)) { it.popped = true; st.vy = Math.max(st.vy, 0) + O.pop; st.coins += O.popCoins; st.events.push({ kind: 'pop', x: it.x, y: it.y }); } break;
        case 'bbq': if (Math.abs(it.x - px) < O.heat.w && st.y < it.g + O.heat.top) st.y += O.up * dt; break; // l'air chaud porte l'avion
        case 'sprinkler': if (Math.hypot(it.x - px, it.g - st.y) < O.spray) this.wet(st); break;
        case 'rain': if (Math.abs(it.x - px) < O.rainW && st.y < it.top) this.wet(st); break;
        case 'kite':
          if (!it.hit && near(it.x, it.y, O.kiteR)) { it.hit = true; this.hit(st, O.soft, false, 'paper'); }
          if (!it.hitS && this.segDist(px, py, it.x, it.y - 1.4, it.gx, it.gy + 1.5) < 0.5) { it.hitS = true; this.hit(st, O.string, false, 'string'); }
          break;
        case 'turbine':
          if (!it.hitR && near(it.x, it.hub, O.rotor)) { it.hitR = true; this.hit(st, O.hard, true, 'metal'); }
          if (px > it.x + 0.5 && px < it.x + O.gustLen && py > it.hub - O.rotor - 3 && py < it.hub + O.rotor) st.x += O.gust * dt; // vent dans le dos
          break;
      }
    }
  },
  // Un choc : l'avion garde la part keep de sa vitesse ; un choc dur le fait vriller un instant
  hit(st, keep, hard, what) { st.vx *= keep; st.vy *= keep; st.hits++; if (hard) st.spin = OBST.spin; st.events.push({ kind: 'hit', hard, what, x: st.x, y: st.y + 0.9 }); },
  wet(st) { if (!st.wet) st.events.push({ kind: 'wet', x: st.x, y: st.y + 0.9 }); st.wet = OBST.wet; },
  segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); },

  // Distance comptée depuis le bout du tremplin, et or gagné
  result(st) {
    const dist = Math.max(0, st.x - st.lipX);
    return { dist, coins: st.coins, hits: st.hits, gold: Math.floor(dist * GAINS.perMeter) + st.coins * GAINS.coin, maxY: st.maxY };
  },

  // Un vol complet sans affichage (tests, bot) : policy(st) → { up, down }
  simulate(meta, seed, power, policy) {
    const st = this.create(meta, seed); this.aim(st, power ?? 1); this.launch(st, power ?? 1);
    for (let i = 0; i < 120 * 120 && st.phase !== 'done'; i++) this.step(st, PHYS.dt, policy ? policy(st) : {});
    return this.result(st);
  },
};
