// RocketYgles : version, réglages de l'économie et de la physique. Tous les chiffres d'équilibrage sont ici,
// pour que le bot et les tests les lisent aux mêmes endroits que le jeu.
'use strict';

const BUILD = 1;

// Améliorations de l'atelier, pour l'avion en carton (palier 1). Prix : base × croissance^niveau.
// effect(niveau) donne la valeur utilisée par la physique (js/flight.js).
const UPGRADES = {
  // Ailes : plus grandes et plus fines, elles freinent moins (meilleure finesse), mais pèsent un peu
  wings: { name: 'Ailes', what: 'On plane plus loin', icon: 'wing', base: 40, grow: 1.55, max: 8, effect: lv => ({ area: 0.30 + 0.03 * lv, k: 0.12 / (1 + 0.3 * lv), mass: 0.015 * lv }) },
  // Carlingue légère : l'élastique lance plus vite un avion plus léger (même énergie, moins de masse)
  body: { name: 'Carlingue légère', what: 'Plus léger : l’élastique le lance plus vite', icon: 'body', base: 60, grow: 1.6, max: 8, effect: lv => ({ mass: -0.06 * lv }) },
  // Élastique : l'énergie qu'il emmagasine (en joules), et jusqu'où on peut reculer l'avion (en m) ; niveau 10 au plus, comme le tremplin
  elastic: { name: 'Élastique plus fort', what: 'Plus de vitesse au départ', icon: 'elastic', base: 50, grow: 1.55, max: 10, effect: lv => ({ energy: 50 + 22 * lv, reach: 6 + 1.1 * lv }) },
  // Tremplin : toute la piste est posée plus haut, et le bout se relève davantage
  // Niveau 10 au plus : ensuite, c'est la fusée qui prend le relais (IDEE.md)
  ramp: { name: 'Tremplin plus haut', what: 'On s’envole de plus haut', icon: 'ramp', base: 70, grow: 1.6, max: 10, effect: lv => ({ deck: 3 + 1.4 * lv, angle: 12 + 2.5 * lv, rise: 0.8 + 0.25 * lv }) },
};
// Les bâtiments du jardin de Papi (mode Facile, planche H ; décidé le 24 octobre 2026). Un record de unlock mètres rend
// le bâtiment achetable, puis on l'ouvre avec open pièces d'or. Chaque niveau le rend plus rapide : il produit rate(niveau)
// par minute de sa ressource (res : or, pièces ou idées). L'atelier (toujours ouvert) fait baisser le prix des
// améliorations de l'avion ; la manche à air ajoute des aides pendant les vols. Améliorer coûte base × grow^(niveau − 1).
// Jeu fermé, la production continue pendant TOWN.awayCap minutes au plus. Pièces et idées : pour le prochain avion.
const BUILDINGS = {
  atelier: { name: 'L’atelier de Papi', what: 'Les améliorations de l’avion coûtent moins cher', unlock: 0, open: 0, base: 300, grow: 1.9, max: 10, effect: lv => ({ discount: 0.05 * (lv - 1) }) },
  limonade: { name: 'Le stand de limonade', what: 'Yglou vend sa limonade aux voisins', unlock: 30, open: 60, base: 90, grow: 1.6, max: 10, res: 'gold', rate: lv => 6 * lv },
  remise: { name: 'La remise', what: 'Des vis, du carton et du scotch pour le prochain avion', unlock: 60, open: 120, base: 140, grow: 1.6, max: 10, res: 'parts', rate: lv => 2 * lv },
  bureau: { name: 'Le bureau à plans', what: 'Papi dessine les plans du prochain avion', unlock: 100, open: 250, base: 220, grow: 1.6, max: 10, res: 'ideas', rate: lv => lv },
  manche: { name: 'La manche à air', what: 'Elle prévoit le vent : plus d’aides pendant les vols', unlock: 150, open: 400, base: 320, grow: 1.7, max: 10, effect: lv => ({ helps: 0.08 * lv }) },
};
const TOWN = { awayCap: 120, next: { parts: 40, ideas: 25 } };
const upPrice = (k, lv) => Math.round(UPGRADES[k].base * Math.pow(UPGRADES[k].grow, lv) / 5) * 5;

// Physique du vol plané (unités : mètres, secondes, kilogrammes). Arcade, mais vraie : portance, traînée, décrochage.
const PHYS = {
  g: 9.81, rho: 1.2,
  baseMass: 1.0, minMass: 0.55,
  runway: 26,                    // piste plate de 26 m (sa hauteur dépend du tremplin) ; le bout se relève
  catapult: -1.6,                // les attaches de l'élastique, sur la piste juste avant le relevé
  hook: 2.3, slack: 1,           // du point d'appui de l'avion à son crochet sous le nez ; mou de l'élastique au repos
  roll: 0.5,                     // freinage des roues sur la piste (m/s²)
  cd0: 0.03,                     // traînée de forme ; la traînée due aux ailes (courtes en carton) dépend d'UPGRADES.wings
  clSlope: 4.6, stall: 0.26,     // portance par radian d'incidence, décrochage vers 15°
  // Un avion bien réglé (stable) : sans commande, son aile donne juste la portance qu'il faut pour ramener en douceur
  // sa trajectoire vers l'angle de plané (celui de sa finesse, à l'incidence trim), en settle secondes.
  // ▲ / ▼ déplacent cet angle visé (cmd de -1 à 1 : vitesse de montée de la commande, de descente, de retour ;
  // jusqu'où elle vise en radians). Demander plus de portance que l'aile n'en donne : décrochage.
  trim: 0.06, settle: 1.5, cmdUp: 1.2, cmdDown: 2, cmdBack: 3, aimUp: 0.5, aimDown: 0.6,
  slide: 3.5,                    // freinage après l'atterrissage (m/s²)
  dt: 1 / 120,                   // pas de calcul fixe, indépendant de l'affichage
};
// Ce qu'on croise en vol (planche G, ref/obstacles.html ; décidé le 24 octobre 2026) : le jardin de Papi jusqu'à 50 m,
// puis la campagne. Placés au hasard selon la zone, un élément tous les gap[0] m plus un tirage jusqu'à gap[1] m.
// Un choc garde une part de la vitesse : soft (feuillage, cerf-volant), hedge (haie), string (ficelle), bird (oiseau),
// hard (tronc, pales : le vol continue, mais l'avion vrille spin secondes). Aides : up (air chaud du barbecue, m/s vers
// le haut), gust (vent derrière l'éolienne, m/s), pop (rebond des ballons, m/s) et popCoins pièces. L'eau mouille le
// carton wet secondes : sa masse est multipliée par wetMass. Tailles en mètres, mêmes proportions que les dessins.
const OBST = {
  garden: 50, gap: [18, 14],
  GARDEN: ['tree', 'hedge', 'balloons', 'bbq', 'sprinkler', 'pigeons'],
  FIELD: ['rain', 'geese', 'kite', 'turbine', 'pigeons'],
  GARDEN_HELP: ['balloons', 'bbq'], FIELD_HELP: ['turbine'], // ce que la manche à air fait venir plus souvent
  soft: 0.85, hedge: 0.7, string: 0.6, bird: 0.8, hard: 0.5, spin: 0.7,
  wet: 3, wetMass: 1.35, up: 3.5, gust: 6, pop: 4, popCoins: 3,
  tree: { canopyY: 5.2, canopyR: 2.1, trunk: 2.9 }, hedgeW: 5, hedgeH: 1.5, balloonY: 4.5, balloonR: 1.55,
  heat: { w: 1.5, top: 12 }, spray: 3.8, rainW: 3.5, kiteR: 1.2, kiteLine: 5, hub: 14, rotor: 5, gustLen: 16,
};
// Gains d'un vol : or par mètre parcouru après le tremplin, et par pièce ramassée
const GAINS = { perMeter: 0.6, coin: 5 };
