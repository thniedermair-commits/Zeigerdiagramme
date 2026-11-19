/* =========================================================
   Darstellung: Schaltpläne, Zeigerdiagramme, Liniendiagramme,
   Rechenweg. Erzeugt SVG-/HTML-Strings.
   ========================================================= */
const Render = (() => {
  const { fmt, fmtUnit, rad, deg } = Phys;

  /* ---------- Größen ---------- */
  const QTY = {
    U:      { html: 'U',              svg: ['U', ''],  unit: 'V', name: 'Gesamtspannung' },
    UR:     { html: 'U<sub>R</sub>',  svg: ['U', 'R'], unit: 'V', name: 'Spannung am Widerstand (Wirkspannung)' },
    UL:     { html: 'U<sub>L</sub>',  svg: ['U', 'L'], unit: 'V', name: 'Spannung an der Spule' },
    UC:     { html: 'U<sub>C</sub>',  svg: ['U', 'C'], unit: 'V', name: 'Spannung am Kondensator' },
    I:      { html: 'I',              svg: ['I', ''],  unit: 'A', name: 'Gesamtstrom' },
    IR:     { html: 'I<sub>R</sub>',  svg: ['I', 'R'], unit: 'A', name: 'Strom durch den Widerstand (Wirkstrom)' },
    IL:     { html: 'I<sub>L</sub>',  svg: ['I', 'L'], unit: 'A', name: 'Strom durch die Spule' },
    IC:     { html: 'I<sub>C</sub>',  svg: ['I', 'C'], unit: 'A', name: 'Strom durch den Kondensator' },
    XL:     { html: 'X<sub>L</sub>',  unit: 'Ω', name: 'Induktiver Blindwiderstand' },
    XC:     { html: 'X<sub>C</sub>',  unit: 'Ω', name: 'Kapazitiver Blindwiderstand' },
    X:      { html: 'X',              unit: 'Ω', name: 'Resultierender Blindwiderstand' },
    Z:      { html: 'Z',              unit: 'Ω', name: 'Scheinwiderstand' },
    phi:    { html: 'φ',              unit: '°', name: 'Phasenverschiebungswinkel (Betrag)' },
    cosphi: { html: 'cos φ',          unit: '',  name: 'Leistungsfaktor' },
  };
  const COLOR = {
    U: 'var(--c-u)', I: 'var(--c-i)',
    UR: 'var(--c-r)', IR: 'var(--c-r)',
    UL: 'var(--c-l)', IL: 'var(--c-l)',
    UC: 'var(--c-c)', IC: 'var(--c-c)',
  };

  function svgLabel(key, x, y, opts = {}) {
    const [m, s] = QTY[key].svg;
    const anchor = opts.anchor || 'middle';
    const size = opts.size || 15;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
      class="ph-label" style="fill:${opts.color || COLOR[key]};font-size:${size}px">${m}${s ? `<tspan dy="4" font-size="${size * 0.7}px">${s}</tspan>` : ''}</text>`;
  }

  /* Pfeil (Linie + Spitze) in Pixelkoordinaten */
  function arrow(x0, y0, x1, y1, color, opts = {}) {
    const w = opts.width || 3;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return '';
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const head = Math.min(opts.head || 13, len * 0.6);
    const hw = head * 0.42;
    const bx = x1 - ux * head, by = y1 - uy * head;
    const dash = opts.dash ? `stroke-dasharray="${opts.dash}"` : '';
    const op = opts.opacity != null ? `opacity="${opts.opacity}"` : '';
    return `<g ${op}><line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${(bx + ux).toFixed(1)}" y2="${(by + uy).toFixed(1)}"
        stroke="${color}" stroke-width="${w}" stroke-linecap="round" ${dash}/>
      <polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${(bx - uy * hw).toFixed(1)},${(by + ux * hw).toFixed(1)} ${(bx + uy * hw).toFixed(1)},${(by - ux * hw).toFixed(1)}"
        fill="${color}"/></g>`;
  }

  /* ---------- Schaltplan ---------- */
  function symbol(part) {
    const s = 'stroke="currentColor" stroke-width="2.2" fill="none"';
    if (part === 'R')
      return `<path d="M-30 0H-20M20 0H30" ${s}/><rect x="-20" y="-8" width="40" height="16" rx="1.5" ${s} style="stroke:var(--c-r)"/>`;
    if (part === 'L')
      return `<path d="M-30 0H-20M20 0H30" ${s}/><path d="M-20 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0" ${s} style="stroke:var(--c-l)"/>`;
    if (part === 'C')
      return `<path d="M-30 0H-5M5 0H30" ${s}/><path d="M-5 -13V13M5 -13V13" ${s} stroke-width="3" style="stroke:var(--c-c)"/>`;
    return '';
  }
  const partColor = { R: 'var(--c-r)', L: 'var(--c-l)', C: 'var(--c-c)' };

  function schematic(type) {
    const t = Phys.TYPES[type];
    const n = t.parts.length;
    const s = 'stroke="currentColor" stroke-width="2.2" fill="none"';
    let out = '';
    const src = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="17" ${s}/>
        <path d="M${cx - 9} ${cy}q4.5 -8 9 0t9 0" ${s}/>`;
    if (t.mode === 'parallel') {
      const W = 110 + n * 90, top = 26, bot = 156, mid = 91;
      out += `<path d="M40 ${top}H${W - 40}M40 ${bot}H${W - 40}M40 ${top}V${mid - 17}M40 ${mid + 17}V${bot}" ${s}/>`;
      out += src(40, mid);
      out += arrowV(16, top + 20, bot - 20, 'U');
      t.parts.forEach((p, i) => {
        const x = 130 + i * 90;
        out += `<path d="M${x} ${top}V${mid - 30}M${x} ${mid + 30}V${bot}" ${s}/>`;
        out += `<g transform="translate(${x} ${mid}) rotate(90)">${symbol(p)}</g>`;
        out += `<text x="${x + 20}" y="${mid + 4}" class="sch-label" style="fill:${partColor[p]}">${p}</text>`;
        out += smallArrowV(x - 14, top + 14, top + 40, 'I' + p);
        out += `<circle cx="${x}" cy="${top}" r="3.5" fill="currentColor"/><circle cx="${x}" cy="${bot}" r="3.5" fill="currentColor"/>`;
      });
      // letzte Abzweigung ohne Punkt rechts
      out += smallArrowH(56, 96, top - 9, 'I');
      return `<svg viewBox="0 0 ${W - 20} 172" class="schematic" role="img" aria-label="Schaltplan ${t.name}">${out}</svg>`;
    }
    // Reihe / Einzel
    const W = 120 + n * 90, top = 30, bot = 140, mid = 85;
    out += `<path d="M40 ${top}V${mid - 17}M40 ${mid + 17}V${bot}H${W - 30}V${top}" ${s}/>`;
    out += src(40, mid);
    out += arrowV(16, top + 14, bot - 14, 'U');
    let x = 40;
    t.parts.forEach((p, i) => {
      const cx = 105 + i * 90;
      out += `<path d="M${x} ${top}H${cx - 30}" ${s}/>`;
      out += `<g transform="translate(${cx} ${top})">${symbol(p)}</g>`;
      out += `<text x="${cx}" y="${top - 16}" text-anchor="middle" class="sch-label" style="fill:${partColor[p]}">${p}</text>`;
      if (n > 1) out += smallArrowH(cx - 18, cx + 18, top + 22, 'U' + p);
      x = cx + 30;
    });
    out += `<path d="M${x} ${top}H${W - 30}" ${s}/>`;
    out += smallArrowH(W - 58, W - 34, top - 10, 'I', true);
    return `<svg viewBox="0 0 ${W} 160" class="schematic" role="img" aria-label="Schaltplan ${t.name}">${out}</svg>`;
  }
  function arrowV(x, y0, y1, key) {
    return arrow(x, y0, x, y1, COLOR[key], { width: 2, head: 9 }) + svgLabel(key, x - 6, (y0 + y1) / 2, { anchor: 'end', size: 14 });
  }
  function smallArrowV(x, y0, y1, key) {
    return arrow(x, y0, x, y1, COLOR[key], { width: 2, head: 8 }) + svgLabel(key, x - 6, (y0 + y1) / 2, { anchor: 'end', size: 13 });
  }
  function smallArrowH(x0, x1, y, key, labelLeft) {
    return arrow(x0, y, x1, y, COLOR[key], { width: 2, head: 8 }) +
      svgLabel(key, labelLeft ? x0 - 6 : (x0 + x1) / 2, labelLeft ? y : y + 13, { anchor: labelLeft ? 'end' : 'middle', size: 13 });
  }

  /* ---------- Gitter ---------- */
  function grid(map, xmin, xmax, ymin, ymax, step, W, H) {
    let g = '';
    const i0 = Math.ceil(xmin / step), i1 = Math.floor(xmax / step);
    const j0 = Math.ceil(ymin / step), j1 = Math.floor(ymax / step);
    for (let i = i0; i <= i1; i++) {
      const [x] = map(i * step, 0);
      g += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" class="grid-line"/>`;
    }
    for (let j = j0; j <= j1; j++) {
      const [, y] = map(0, j * step);
      g += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" class="grid-line"/>`;
    }
    const [ox, oy] = map(0, 0);
    g += `<line x1="0" y1="${oy}" x2="${W}" y2="${oy}" class="axis-line"/><line x1="${ox}" y1="0" x2="${ox}" y2="${H}" class="axis-line"/>`;
    return g;
  }

  /* ---------- Statisches Zeigerdiagramm (automatisch skaliert) ---------- */
  function phasorDiagram(r, opts = {}) {
    const W = opts.width || 520, H = opts.height || 400;
    const mainKind = r.mode === 'series' ? 'U' : r.mode === 'parallel' ? 'I' : null;
    let ph = r.phasors.map((p) => ({ ...p }));

    // Einzelbauteil: beide Zeiger normiert darstellen
    if (!mainKind) {
      ph = ph.map((p) => {
        const m = Math.hypot(p.x1, p.y1), f = (p.kind === 'U' ? 1 : 0.72) / m;
        return { ...p, x1: p.x1 * f, y1: p.y1 * f };
      });
    } else {
      // Bezugszeiger mit eigenem Maßstab
      const others = ph.filter((p) => p.kind === mainKind);
      const maxX = Math.max(...others.map((p) => Math.max(p.x0, p.x1)), 0);
      const ext = Math.max(...others.map((p) => Math.hypot(p.x1, p.y1)));
      const refLen = Math.max(maxX, ext * 0.4) * (r.mode === 'series' ? 0.55 : 1.1);
      ph = ph.map((p) => (p.ref ? { ...p, x1: refLen, refScaled: true } : p));
    }

    const xs = [0], ys = [0];
    ph.forEach((p) => { xs.push(p.x0, p.x1); ys.push(p.y0, p.y1); });
    let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const span = Math.max(xmax - xmin, ymax - ymin, 1e-12);
    const pad = span * 0.16;
    xmin -= pad; xmax += pad * 1.4; ymin -= pad; ymax += pad;
    const k = Math.min(W / (xmax - xmin), H / (ymax - ymin));
    const offX = (W - (xmax - xmin) * k) / 2, offY = (H - (ymax - ymin) * k) / 2;
    const map = (x, y) => [offX + (x - xmin) * k, H - offY - (y - ymin) * k];

    const step = mainKind ? Phys.niceStep(span / 8) : 0.25;
    let out = grid(map, xmin - (offX / k), xmax + offX / k, ymin - offY / k, ymax + offY / k, step, W, H);

    // φ-Bogen
    const total = ph.find((p) => p.total) || ph.find((p) => !p.ref);
    const refP = ph.find((p) => p.ref);
    if (total && Math.abs(r.phi) > 0.3) {
      const aRef = 0;
      const aTot = deg(Math.atan2(total.y1, total.x1));
      const mTot = Math.hypot(total.x1, total.y1) * k;
      const rad0 = Math.min(mTot, Math.hypot(refP.x1, refP.y1) * k) * 0.38;
      const [ox, oy] = map(0, 0);
      const p0 = [ox + rad0 * Math.cos(rad(aRef)), oy - rad0 * Math.sin(rad(aRef))];
      const p1 = [ox + rad0 * Math.cos(rad(aTot)), oy - rad0 * Math.sin(rad(aTot))];
      const sweep = aTot > aRef ? 0 : 1;
      out += `<path d="M${p0[0]} ${p0[1]}A${rad0} ${rad0} 0 0 ${sweep} ${p1[0]} ${p1[1]}" class="phi-arc"/>`;
      const am = rad(aTot / 2), lr = rad0 + 16;
      out += `<text x="${ox + lr * Math.cos(am)}" y="${oy - lr * Math.sin(am)}" class="phi-text" text-anchor="start" dominant-baseline="middle">φ</text>`;
    }

    // Zeiger zeichnen (Bezug zuerst, Gesamt zuletzt)
    const order = [...ph].sort((a, b) => (a.ref ? -1 : b.ref ? 1 : a.total ? 1 : b.total ? -1 : 0));
    const keys = ph.map((p) => p.key);
    order.forEach((p) => {
      let [x0, y0] = map(p.x0, p.y0), [x1, y1] = map(p.x1, p.y1);
      if ((p.key === 'UC' && keys.includes('UL')) || (p.key === 'IC' && keys.includes('IL'))) { x0 += 7; x1 += 7; }
      out += arrow(x0, y0, x1, y1, COLOR[p.key], { width: p.total ? 4 : 3, dash: p.ref && mainKind ? '7 5' : null });
      // Beschriftung neben der Zeigermitte
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      let nx = -(y1 - y0) / len, ny = (x1 - x0) / len; // Normale (links)
      if (p.key === 'UC' || p.key === 'IC') { nx = Math.abs(nx); }
      if (p.key === 'UL' || p.key === 'IL') { nx = -Math.abs(nx) || nx; }
      if (p.total) { if (ny > 0) { nx = -nx; ny = -ny; } }
      const off = 16;
      out += svgLabel(p.key, mx + nx * off, my + ny * off, { size: 16 });
    });

    // Legende Maßstab
    if (mainKind) {
      const u = mainKind === 'U' ? 'V' : 'A';
      out += `<text x="10" y="${H - 12}" class="legend-text">Gitter: 1 Kästchen ≙ ${fmtUnit(step, u, 3)}</text>`;
      out += `<text x="${W - 10}" y="${H - 12}" text-anchor="end" class="legend-text">Bezugszeiger ${refP.key} (gestrichelt) nicht maßstäblich</text>`;
    } else {
      out += `<text x="10" y="${H - 12}" class="legend-text">U und I in unterschiedlichen Maßstäben</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Zeigerdiagramm">${out}</svg>`;
  }

  /* ---------- Liniendiagramm u(t), i(t) ---------- */
  function lineDiagram(r, opts = {}) {
    const W = opts.width || 560, H = opts.height || 260;
    const L = 46, Rm = 16, T = 18, B = 34;
    const pw = W - L - Rm, phh = H - T - B, cy = T + phh / 2, amp = phh / 2 - 8;
    const maxDeg = 450;
    const X = (d) => L + (d / maxDeg) * pw;
    const phi = r.phi;
    let out = '';
    for (let d = 0; d <= maxDeg; d += 45) {
      out += `<line x1="${X(d)}" y1="${T}" x2="${X(d)}" y2="${T + phh}" class="${d % 90 ? 'grid-line faint' : 'grid-line'}"/>`;
      if (d % 90 === 0) out += `<text x="${X(d)}" y="${H - 14}" text-anchor="middle" class="tick-text">${d}°</text>`;
    }
    out += `<line x1="${L}" y1="${cy}" x2="${W - Rm}" y2="${cy}" class="axis-line"/>`;
    out += `<line x1="${L}" y1="${T - 6}" x2="${L}" y2="${T + phh + 4}" class="axis-line"/>`;
    out += `<text x="${W - Rm}" y="${cy - 8}" text-anchor="end" class="tick-text">ωt</text>`;
    const curve = (a, shift) => {
      let d = '';
      for (let i = 0; i <= 180; i++) {
        const x = (i / 180) * maxDeg;
        const y = cy - a * amp * Math.sin(rad(x - shift));
        d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + y.toFixed(1);
      }
      return d;
    };
    out += `<path d="${curve(1, 0)}" class="curve" style="stroke:var(--c-u)"/>`;
    out += `<path d="${curve(0.7, phi)}" class="curve" style="stroke:var(--c-i)"/>`;
    out += `<text x="${L - 8}" y="${cy - amp + 4}" text-anchor="end" class="curve-label" style="fill:var(--c-u)">u</text>`;
    out += `<text x="${L - 8}" y="${cy - amp * 0.7 + 18}" text-anchor="end" class="curve-label" style="fill:var(--c-i)">i</text>`;
    if (Math.abs(phi) > 0.5) {
      // Nulldurchgänge markieren
      const a = phi > 0 ? 0 : 360 + phi, b = phi > 0 ? phi : 360;
      const y = cy + 16;
      out += `<line x1="${X(a)}" y1="${cy - 6}" x2="${X(a)}" y2="${y + 6}" class="phi-mark"/><line x1="${X(b)}" y1="${cy - 6}" x2="${X(b)}" y2="${y + 6}" class="phi-mark"/>`;
      out += arrow(X(a), y, X(b), y, 'var(--muted)', { width: 1.5, head: 7 });
      out += `<text x="${(X(a) + X(b)) / 2}" y="${y + 14}" text-anchor="middle" class="phi-text small">φ = ${fmt(Math.abs(phi), 3)}°</text>`;
    }
    out += `<text x="${W - Rm}" y="${T + 4}" text-anchor="end" class="legend-text">${r.character === 'induktiv' ? 'i eilt u nach' : r.character === 'kapazitiv' ? 'i eilt u vor' : 'u und i in Phase'}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Liniendiagramm">${out}</svg>`;
  }

  /* ---------- Rechenweg ---------- */
  function steps(r) {
    const U = (v, u) => fmtUnit(v, u);
    const s = [];
    const add = (key, formula, subst) => s.push({ key, formula, subst, value: key === 'phi' ? r.phi : r[key], unit: QTY[key].unit });
    const two = '2π';
    if (r.XL != null) add('XL', `X<sub>L</sub> = ${two} · f · L`, `${two} · ${U(r.f, 'Hz')} · ${U(r.L, 'H')}`);
    if (r.XC != null) add('XC', `X<sub>C</sub> = 1 / (${two} · f · C)`, `1 / (${two} · ${U(r.f, 'Hz')} · ${U(r.C, 'F')})`);
    const has = (k) => r.parts.includes(k);
    if (r.mode === 'series' || r.mode === 'single') {
      if (r.mode === 'single') {
        if (has('R')) add('I', 'I = U / R', `${U(r.U, 'V')} / ${U(r.R, 'Ω')}`);
        else if (has('L')) add('I', 'I = U / X<sub>L</sub>', `${U(r.U, 'V')} / ${U(r.XL, 'Ω')}`);
        else add('I', 'I = U / X<sub>C</sub>', `${U(r.U, 'V')} / ${U(r.XC, 'Ω')}`);
        add('phi', 'φ', has('R') ? 'U und I in Phase' : has('L') ? 'Strom eilt um 90° nach' : 'Strom eilt um 90° vor');
        return s;
      }
      if (has('L') && has('C')) add('X', 'X = X<sub>L</sub> − X<sub>C</sub>', `${U(r.XL, 'Ω')} − ${U(r.XC, 'Ω')}`);
      const xs = has('L') && has('C') ? 'X' : has('L') ? 'X<sub>L</sub>' : 'X<sub>C</sub>';
      const xv = has('L') && has('C') ? r.X : has('L') ? r.XL : r.XC;
      add('Z', `Z = √(R² + ${xs}²)`, `√((${U(r.R, 'Ω')})² + (${U(xv, 'Ω')})²)`);
      add('I', 'I = U / Z', `${U(r.U, 'V')} / ${U(r.Z, 'Ω')}`);
      add('UR', 'U<sub>R</sub> = I · R', `${U(r.I, 'A')} · ${U(r.R, 'Ω')}`);
      if (has('L')) add('UL', 'U<sub>L</sub> = I · X<sub>L</sub>', `${U(r.I, 'A')} · ${U(r.XL, 'Ω')}`);
      if (has('C')) add('UC', 'U<sub>C</sub> = I · X<sub>C</sub>', `${U(r.I, 'A')} · ${U(r.XC, 'Ω')}`);
      add('phi', `φ = arctan(${xs} / R)`, `arctan(${U(xv, 'Ω')} / ${U(r.R, 'Ω')})`);
      add('cosphi', 'cos φ = R / Z', `${U(r.R, 'Ω')} / ${U(r.Z, 'Ω')}`);
    } else {
      add('IR', 'I<sub>R</sub> = U / R', `${U(r.U, 'V')} / ${U(r.R, 'Ω')}`);
      if (has('L')) add('IL', 'I<sub>L</sub> = U / X<sub>L</sub>', `${U(r.U, 'V')} / ${U(r.XL, 'Ω')}`);
      if (has('C')) add('IC', 'I<sub>C</sub> = U / X<sub>C</sub>', `${U(r.U, 'V')} / ${U(r.XC, 'Ω')}`);
      const ib = has('L') && has('C') ? '(I<sub>L</sub> − I<sub>C</sub>)' : has('L') ? 'I<sub>L</sub>' : 'I<sub>C</sub>';
      const ibv = has('L') && has('C') ? `(${U(r.IL, 'A')} − ${U(r.IC, 'A')})` : `(${U(has('L') ? r.IL : r.IC, 'A')})`;
      add('I', `I = √(I<sub>R</sub>² + ${ib}²)`, `√((${U(r.IR, 'A')})² + ${ibv}²)`);
      add('Z', 'Z = U / I', `${U(r.U, 'V')} / ${U(r.I, 'A')}`);
      add('phi', `φ = arctan(${ib} / I<sub>R</sub>)`, `arctan(${has('L') && has('C') ? ibv : ibv.slice(1, -1)} / ${U(r.IR, 'A')})`);
      add('cosphi', 'cos φ = I<sub>R</sub> / I', `${U(r.IR, 'A')} / ${U(r.I, 'A')}`);
    }
    return s;
  }

  function stepValue(step, r) {
    if (step.key === 'phi') {
      if (r.mode === 'single') return `${fmt(r.phi, 3)}°`;
      return `${fmt(r.phiAbs, 4)}° <span class="tag tag-${r.character}">${r.character}</span>`;
    }
    return fmtUnit(step.value, step.unit);
  }

  function stepsTable(r) {
    return `<div class="steps">${steps(r).map((st) => `
      <div class="step">
        <div class="step-name">${QTY[st.key].name}</div>
        <div class="step-math"><span class="f">${st.formula}</span>
          ${st.subst ? `<span class="eq">=</span><span class="s">${st.subst}</span>` : ''}
          <span class="eq">=</span><strong class="v" style="color:${COLOR[st.key] || 'inherit'}">${stepValue(st, r)}</strong></div>
      </div>`).join('')}</div>`;
  }

  /* ---------- Widerstandsdreieck (Reihe) ---------- */
  function resistanceTriangle(r, opts = {}) {
    const W = opts.width || 300, H = opts.height || 220;
    const X = r.X;
    const pad = 34;
    const k = Math.min((W - 2 * pad - 30) / r.R, (H - 2 * pad) / Math.max(Math.abs(X), 1e-9));
    const ox = pad, oy = X >= 0 ? H - pad : pad;
    const ax = ox + r.R * k, ay = oy, bx = ax, by = oy - X * k;
    const col = X >= 0 ? 'var(--c-l)' : 'var(--c-c)';
    let out = `<path d="M${ox} ${oy}L${ax} ${ay}L${bx} ${by}Z" class="tri-fill"/>`;
    out += `<line x1="${ox}" y1="${oy}" x2="${ax}" y2="${ay}" stroke="var(--c-r)" stroke-width="3.5" stroke-linecap="round"/>`;
    out += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`;
    out += `<line x1="${ox}" y1="${oy}" x2="${bx}" y2="${by}" stroke="var(--c-u)" stroke-width="3.5" stroke-linecap="round"/>`;
    const xl = r.parts.includes('L') && r.parts.includes('C') ? 'X' : r.parts.includes('L') ? 'X<tspan dy="4" font-size="10">L</tspan>' : 'X<tspan dy="4" font-size="10">C</tspan>';
    out += `<text x="${(ox + ax) / 2}" y="${ay + (X >= 0 ? 20 : -12)}" text-anchor="middle" class="tri-label" style="fill:var(--c-r)">R = ${fmtUnit(r.R, 'Ω', 3)}</text>`;
    out += `<text x="${ax + 8}" y="${(ay + by) / 2}" class="tri-label" style="fill:${col}">${xl}</text>`;
    out += `<text x="${(ox + bx) / 2 - 10}" y="${(oy + by) / 2 + (X >= 0 ? -10 : 14)}" text-anchor="end" class="tri-label" style="fill:var(--c-u)">Z</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram small" role="img" aria-label="Widerstandsdreieck">${out}</svg>`;
  }

  return { QTY, COLOR, svgLabel, arrow, grid, schematic, phasorDiagram, lineDiagram, steps, stepsTable, stepValue, resistanceTriangle };
})();
