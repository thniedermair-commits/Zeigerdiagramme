/* =========================================================
   Physik-Kern: Berechnung von R-, L-, C-Schaltungen an
   sinusförmiger Wechselspannung.
   Alle Größen in Grundeinheiten (V, A, Ω, H, F, Hz).
   Winkel φ in Grad: φ > 0 → induktiv (U eilt I voraus),
                     φ < 0 → kapazitiv (I eilt U voraus).
   ========================================================= */
const Phys = (() => {
  const TYPES = {
    R:     { name: 'Wirkwiderstand R',          short: 'R',       parts: ['R'],           mode: 'single' },
    L:     { name: 'Ideale Spule L',            short: 'L',       parts: ['L'],           mode: 'single' },
    C:     { name: 'Kondensator C',             short: 'C',       parts: ['C'],           mode: 'single' },
    RL_s:  { name: 'R-L-Reihenschaltung',       short: 'R–L',     parts: ['R', 'L'],      mode: 'series' },
    RC_s:  { name: 'R-C-Reihenschaltung',       short: 'R–C',     parts: ['R', 'C'],      mode: 'series' },
    RLC_s: { name: 'R-L-C-Reihenschaltung',     short: 'R–L–C',   parts: ['R', 'L', 'C'], mode: 'series' },
    RL_p:  { name: 'R-L-Parallelschaltung',     short: 'R ∥ L',   parts: ['R', 'L'],      mode: 'parallel' },
    RC_p:  { name: 'R-C-Parallelschaltung',     short: 'R ∥ C',   parts: ['R', 'C'],      mode: 'parallel' },
    RLC_p: { name: 'R-L-C-Parallelschaltung',   short: 'R ∥ L ∥ C', parts: ['R', 'L', 'C'], mode: 'parallel' },
  };

  const deg = (rad) => (rad * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;

  function solve(type, p) {
    const t = TYPES[type];
    const has = (k) => t.parts.includes(k);
    const w = 2 * Math.PI * p.f;
    const r = {
      type, mode: t.mode, parts: t.parts,
      U: p.U, f: p.f, w,
      R: has('R') ? p.R : null,
      L: has('L') ? p.L : null,
      C: has('C') ? p.C : null,
      XL: has('L') ? w * p.L : null,
      XC: has('C') ? 1 / (w * p.C) : null,
    };

    if (t.mode === 'parallel') {
      r.IR = p.U / r.R;
      r.IL = has('L') ? p.U / r.XL : null;
      r.IC = has('C') ? p.U / r.XC : null;
      r.IB = (r.IL || 0) - (r.IC || 0); // resultierender Blindstrom
      r.I = Math.hypot(r.IR, r.IB);
      r.Z = p.U / r.I;
      r.phi = deg(Math.atan2(r.IB, r.IR));
    } else {
      const Rv = has('R') ? r.R : 0;
      r.X = (r.XL || 0) - (r.XC || 0);
      r.Z = Math.hypot(Rv, r.X);
      r.I = p.U / r.Z;
      r.UR = has('R') ? r.I * r.R : null;
      r.UL = has('L') ? r.I * r.XL : null;
      r.UC = has('C') ? r.I * r.XC : null;
      r.phi = deg(Math.atan2(r.X, Rv));
    }
    if (Math.abs(r.phi) < 1e-9) r.phi = 0;
    r.phiAbs = Math.abs(r.phi);
    r.cosphi = Math.cos(rad(r.phi));
    r.character = r.phi > 0.05 ? 'induktiv' : r.phi < -0.05 ? 'kapazitiv' : 'ohmsch';
    r.phasors = buildPhasors(r);
    return r;
  }

  /* Zeiger für das Zeigerdiagramm (physikalische Einheiten).
     kind: 'U' (Spannung) oder 'I' (Strom), x0/y0 → x1/y1 */
  function buildPhasors(r) {
    const list = [];
    const polar = (m, a) => [m * Math.cos(rad(a)), m * Math.sin(rad(a))];
    if (r.mode === 'series') {
      // Bezugszeiger: Strom I (fließt durch alle Bauteile)
      list.push({ key: 'I', kind: 'I', x0: 0, y0: 0, x1: r.I, y1: 0, ref: true });
      let x = 0, y = 0;
      const chain = [];
      if (r.UR != null) chain.push(['UR', r.UR, 0]);
      if (r.UL != null) chain.push(['UL', r.UL, 90]);
      if (r.UC != null) chain.push(['UC', r.UC, -90]);
      chain.forEach(([key, m, a]) => {
        const [dx, dy] = polar(m, a);
        list.push({ key, kind: 'U', x0: x, y0: y, x1: x + dx, y1: y + dy });
        x += dx; y += dy;
      });
      if (r.parts.length > 1) list.push({ key: 'U', kind: 'U', x0: 0, y0: 0, x1: x, y1: y, total: true });
    } else if (r.mode === 'parallel') {
      // Bezugszeiger: Spannung U (liegt an allen Bauteilen)
      list.push({ key: 'U', kind: 'U', x0: 0, y0: 0, x1: r.U, y1: 0, ref: true });
      let x = 0, y = 0;
      const chain = [['IR', r.IR, 0]];
      if (r.IL != null) chain.push(['IL', r.IL, -90]);
      if (r.IC != null) chain.push(['IC', r.IC, 90]);
      chain.forEach(([key, m, a]) => {
        const [dx, dy] = polar(m, a);
        list.push({ key, kind: 'I', x0: x, y0: y, x1: x + dx, y1: y + dy });
        x += dx; y += dy;
      });
      list.push({ key: 'I', kind: 'I', x0: 0, y0: 0, x1: x, y1: y, total: true });
    } else {
      // Einzelbauteil: U als Bezug, I um -φ gedreht
      list.push({ key: 'U', kind: 'U', x0: 0, y0: 0, x1: r.U, y1: 0, ref: true });
      const [ix, iy] = polar(r.I, -r.phi);
      list.push({ key: 'I', kind: 'I', x0: 0, y0: 0, x1: ix, y1: iy });
    }
    return list;
  }

  /* ---------- Zahlen- und Einheitenformatierung ---------- */
  function fmt(v, sig = 4) {
    if (v == null || !isFinite(v)) return '–';
    if (v === 0) return '0';
    const n = Number(v.toPrecision(sig));
    return n.toLocaleString('de-DE', { maximumFractionDigits: 10, useGrouping: Math.abs(n) >= 10000 });
  }

  const PREFIXES = [
    [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
  ];
  function fmtUnit(v, unit, sig = 4) {
    if (v == null || !isFinite(v)) return '–';
    if (unit === '°' || unit === '') return fmt(v, sig) + (unit ? ' ' + unit : '');
    const a = Math.abs(v);
    if (a === 0) return '0 ' + unit;
    for (const [f, p] of PREFIXES) {
      if (a >= f * 0.9995) return fmt(v / f, sig) + ' ' + p + unit;
    }
    return fmt(v, sig) + ' ' + unit;
  }

  /* Eingabe parsen: akzeptiert Komma und Punkt */
  function parse(str) {
    if (typeof str === 'number') return str;
    if (str == null) return NaN;
    const s = String(str).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    return Number(s);
  }

  /* „Schöne“ Maßstabszahlen 1, 2, 2,5, 5 × 10^k */
  function niceNumbers(min, max) {
    const out = [];
    for (let e = -4; e <= 4; e++) {
      for (const m of [1, 2, 2.5, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= min * 0.999 && v <= max * 1.001) out.push(Number(v.toPrecision(3)));
      }
    }
    return out;
  }
  function niceStep(raw) {
    const e = Math.floor(Math.log10(raw));
    const b = raw / Math.pow(10, e);
    const m = b <= 1 ? 1 : b <= 2 ? 2 : b <= 2.5 ? 2.5 : b <= 5 ? 5 : 10;
    return m * Math.pow(10, e);
  }

  return { TYPES, solve, fmt, fmtUnit, parse, niceNumbers, niceStep, deg, rad };
})();
