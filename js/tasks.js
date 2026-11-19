/* =========================================================
   Aufgabensammlung – angelehnt an typische Übungsaufgaben
   (Fachkunde Elektrotechnik, Lernfeld 1/2 Elektroniker/-innen)
   Werte in Grundeinheiten. unitOverride: Anzeigeeinheit je Feld.
   ========================================================= */
const TASKS = [
  {
    id: 'spule',
    title: 'Spule mit Wicklungswiderstand',
    level: 1,
    type: 'RL_s',
    given: { U: 230, f: 50, R: 100, L: 0.4 },
    story: 'Eine Drosselspule mit der Induktivität <b>L = 0,4 H</b> hat einen Wicklungswiderstand von <b>R = 100 Ω</b>. Sie wird an das Netz mit <b>U = 230 V</b> und <b>f = 50 Hz</b> angeschlossen. Als Ersatzschaltbild verwendet man eine Reihenschaltung aus R und L.',
    ask: ['XL', 'Z', 'I', 'UR', 'UL', 'phi', 'cosphi'],
    draw: ['UR', 'UL', 'U'],
  },
  {
    id: 'rc-glied',
    title: 'RC-Glied am Netz',
    level: 1,
    type: 'RC_s',
    given: { U: 230, f: 50, R: 470, C: 4.7e-6 },
    story: 'Ein Widerstand <b>R = 470 Ω</b> und ein Kondensator <b>C = 4,7 µF</b> sind in Reihe geschaltet und liegen an <b>U = 230 V / 50 Hz</b>.',
    ask: ['XC', 'Z', 'I', 'UR', 'UC', 'phi', 'cosphi'],
    unitOverride: { I: 'mA' },
    draw: ['UR', 'UC', 'U'],
  },
  {
    id: 'rlc-reihe',
    title: 'R-L-C-Reihenschaltung',
    level: 2,
    type: 'RLC_s',
    given: { U: 230, f: 50, R: 50, L: 0.3, C: 47e-6 },
    story: 'Eine Reihenschaltung besteht aus <b>R = 50 Ω</b>, <b>L = 0,3 H</b> und <b>C = 47 µF</b>. Sie liegt an <b>U = 230 V / 50 Hz</b>. Achtung: Hier lohnt sich ein Blick auf die Teilspannungen!',
    ask: ['XL', 'XC', 'X', 'Z', 'I', 'UR', 'UL', 'UC', 'phi'],
    draw: ['UR', 'UL', 'UC', 'U'],
  },
  {
    id: 'rl-parallel',
    title: 'Heizwiderstand und Drossel parallel',
    level: 2,
    type: 'RL_p',
    given: { U: 230, f: 50, R: 150, L: 0.6 },
    story: 'Ein Heizwiderstand <b>R = 150 Ω</b> und eine (ideale) Drosselspule <b>L = 0,6 H</b> sind parallel an <b>U = 230 V / 50 Hz</b> angeschlossen.',
    ask: ['XL', 'IR', 'IL', 'I', 'Z', 'phi', 'cosphi'],
    draw: ['IR', 'IL', 'I'],
  },
  {
    id: 'rc-parallel',
    title: 'Widerstand und Kondensator parallel',
    level: 2,
    type: 'RC_p',
    given: { U: 230, f: 50, R: 200, C: 10e-6 },
    story: 'Ein Widerstand <b>R = 200 Ω</b> und ein Kondensator <b>C = 10 µF</b> liegen parallel an <b>U = 230 V / 50 Hz</b>.',
    ask: ['XC', 'IR', 'IC', 'I', 'Z', 'phi', 'cosphi'],
    unitOverride: { IR: 'A', IC: 'A' },
    draw: ['IR', 'IC', 'I'],
  },
];

const UNIT_FACTOR = { '': 1, 'V': 1, 'mV': 1e-3, 'kV': 1e3, 'A': 1, 'mA': 1e-3, 'µA': 1e-6, 'Ω': 1, 'kΩ': 1e3, '°': 1 };

/* Standardfelder für eine eigene Aufgabe je Schaltungsart */
function defaultTaskFields(type) {
  const t = Phys.TYPES[type];
  const has = (k) => t.parts.includes(k);
  const ask = [];
  if (has('L')) ask.push('XL');
  if (has('C')) ask.push('XC');
  if (t.mode === 'series') {
    if (has('L') && has('C')) ask.push('X');
    ask.push('Z', 'I', 'UR');
    if (has('L')) ask.push('UL');
    if (has('C')) ask.push('UC');
    ask.push('phi', 'cosphi');
    return { ask, draw: ['UR', ...(has('L') ? ['UL'] : []), ...(has('C') ? ['UC'] : []), 'U'] };
  }
  ask.push('IR');
  if (has('L')) ask.push('IL');
  if (has('C')) ask.push('IC');
  ask.push('I', 'Z', 'phi', 'cosphi');
  return { ask, draw: ['IR', ...(has('L') ? ['IL'] : []), ...(has('C') ? ['IC'] : []), 'I'] };
}

/* Passende Anzeigeeinheit wählen (A oder mA) */
function autoUnit(key, value) {
  const base = Render.QTY[key].unit;
  if (base === 'A' && Math.abs(value) < 0.1) return 'mA';
  if (base === 'Ω' && Math.abs(value) >= 10000) return 'kΩ';
  return base;
}
