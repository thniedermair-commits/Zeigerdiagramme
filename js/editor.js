/* =========================================================
   Interaktiver Zeigerdiagramm-Editor
   Koordinaten in „Kästchen“ (1 Kästchen = 20 px im SVG).
   ========================================================= */
class PhasorEditor {
  constructor(root, opts) {
    this.root = root;
    this.keys = opts.draw;              // zu zeichnende Zeiger
    this.r = opts.solution;             // Lösung (Phys.solve)
    this.kind = this.r.mode === 'parallel' ? 'I' : 'U';
    this.unit = this.kind === 'U' ? 'V' : 'A';
    this.refKey = this.kind === 'U' ? 'I' : 'U';
    this.onChange = opts.onChange || (() => {});
    this.scale = opts.scale || null;
    this.ph = opts.state || {};         // key -> {x0,y0,x1,y1}
    this.tool = this.keys.find((k) => !this.ph[k]) || this.keys[0];
    this.showRef = !!opts.showRef;
    this.showSolution = false;
    this.feedback = null;
    this.X0 = -3; this.X1 = 33; this.Y0 = -15; this.Y1 = 15; this.PX = 20;
    this.drag = null;
    this.build();
    this.render();
  }

  /* ----- Koordinaten ----- */
  toPx(x, y) { return [(x - this.X0) * this.PX, (this.Y1 - y) * this.PX]; }
  fromEvent(ev) {
    const pt = this.svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    return [p.x / this.PX + this.X0, this.Y1 - p.y / this.PX];
  }
  snap([x, y], exceptKey) {
    // Magnet: Ursprung und Enden der anderen Zeiger
    const targets = [[0, 0]];
    for (const [k, p] of Object.entries(this.ph)) {
      if (k !== exceptKey) targets.push([p.x0, p.y0], [p.x1, p.y1]);
    }
    let best = null, bd = 0.45;
    for (const t of targets) {
      const d = Math.hypot(t[0] - x, t[1] - y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) return [...best];
    const r1 = (v) => Math.round(v * 10) / 10;
    return [
      Math.min(this.X1, Math.max(this.X0, r1(x))),
      Math.min(this.Y1, Math.max(this.Y0, r1(y))),
    ];
  }

  /* ----- Aufbau ----- */
  build() {
    this.root.innerHTML = `
      <div class="ed-toolbar">
        <div class="ed-tools" role="toolbar" aria-label="Zeiger auswählen"></div>
        <div class="ed-actions">
          <button class="btn ghost sm" data-act="del" title="Ausgewählten Zeiger löschen">🗑 Löschen</button>
          <button class="btn ghost sm" data-act="reset" title="Alle Zeiger löschen">↺ Neu</button>
          <label class="switch sm"><input type="checkbox" data-act="sol"><span></span> Musterlösung</label>
        </div>
      </div>
      <div class="ed-canvas-wrap">
        <svg class="ed-svg" viewBox="0 0 ${(this.X1 - this.X0) * this.PX} ${(this.Y1 - this.Y0) * this.PX}" aria-label="Zeichenfläche für das Zeigerdiagramm"></svg>
        <div class="ed-hint"></div>
      </div>
      <div class="ed-readout"></div>`;
    this.svg = this.root.querySelector('svg');
    this.toolsEl = this.root.querySelector('.ed-tools');
    this.readoutEl = this.root.querySelector('.ed-readout');
    this.hintEl = this.root.querySelector('.ed-hint');

    this.toolsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]');
      if (!b) return;
      this.tool = b.dataset.key;
      this.render();
    });
    this.root.querySelector('[data-act=del]').onclick = () => { delete this.ph[this.tool]; this.changed(); };
    this.root.querySelector('[data-act=reset]').onclick = () => { this.ph = {}; this.tool = this.keys[0]; this.changed(); };
    this.root.querySelector('[data-act=sol]').onchange = (e) => { this.showSolution = e.target.checked; this.render(); };

    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.move(e));
    this.svg.addEventListener('pointerup', (e) => this.up(e));
    this.svg.addEventListener('pointercancel', (e) => this.up(e));
  }

  down(e) {
    e.preventDefault();
    const pos = this.fromEvent(e);
    const h = e.target.closest('[data-handle]');
    const body = e.target.closest('[data-body]');
    if (h) {
      const [key, end] = h.dataset.handle.split(':');
      this.tool = key;
      this.drag = { key, end: Number(end) };
    } else if (body && (body.dataset.body === this.tool || this.ph[this.tool])) {
      // vorhandenen Zeiger auswählen/verschieben (nur wenn gerade kein neuer gezeichnet wird)
      const key = body.dataset.body;
      const p = this.ph[key];
      this.tool = key;
      this.drag = { key, move: true, start: pos, orig: { ...p } };
    } else {
      const key = this.tool;
      const s = this.snap(pos, key);
      this.ph[key] = { x0: s[0], y0: s[1], x1: s[0], y1: s[1] };
      this.drag = { key, end: 1, fresh: true };
    }
    this.svg.setPointerCapture(e.pointerId);
    this.feedback = null;
    this.render();
  }
  move(e) {
    if (!this.drag) return;
    const pos = this.fromEvent(e);
    const d = this.drag, p = this.ph[d.key];
    if (!p) return;
    if (d.move) {
      let dx = Math.round((pos[0] - d.start[0]) * 10) / 10, dy = Math.round((pos[1] - d.start[1]) * 10) / 10;
      // Fußpunkt magnetisch einrasten lassen
      const s = this.snap([d.orig.x0 + dx, d.orig.y0 + dy], d.key);
      dx = s[0] - d.orig.x0; dy = s[1] - d.orig.y0;
      Object.assign(p, { x0: d.orig.x0 + dx, y0: d.orig.y0 + dy, x1: d.orig.x1 + dx, y1: d.orig.y1 + dy });
    } else {
      const s = this.snap(pos, d.key);
      if (d.end === 0) { p.x0 = s[0]; p.y0 = s[1]; } else { p.x1 = s[0]; p.y1 = s[1]; }
    }
    this.render();
  }
  up() {
    if (!this.drag) return;
    const d = this.drag, p = this.ph[d.key];
    this.drag = null;
    if (p && Math.hypot(p.x1 - p.x0, p.y1 - p.y0) < 0.2) delete this.ph[d.key];
    else if (d.fresh) {
      const next = this.keys.find((k) => !this.ph[k]);
      if (next) this.tool = next;
    }
    this.changed();
  }
  changed() { this.feedback = null; this.render(); this.onChange(this.getState()); }
  getState() { return JSON.parse(JSON.stringify(this.ph)); }
  setScale(s) { this.scale = s; this.feedback = null; this.render(); }
  setShowRef(v) { this.showRef = v; this.render(); }

  /* ----- Lösung in Kästchen ----- */
  solutionVectors() {
    if (!this.scale) return {};
    const out = {};
    this.r.phasors.filter((p) => p.kind === this.kind && !p.ref).forEach((p) => {
      out[p.key] = { x0: p.x0 / this.scale, y0: p.y0 / this.scale, x1: p.x1 / this.scale, y1: p.y1 / this.scale };
    });
    return out;
  }

  /* ----- Prüfen ----- */
  check() {
    const sol = this.solutionVectors();
    const res = [];
    if (!this.scale) return { ok: false, msg: 'Wähle zuerst einen Maßstab.', items: [] };
    let allOk = true;
    for (const k of this.keys) {
      const p = this.ph[k], s = sol[k];
      const item = { key: k, ok: false, msgs: [] };
      if (!p) { item.msgs.push('noch nicht gezeichnet'); allOk = false; res.push(item); continue; }
      const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
      const sl = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const ang = Phys.deg(Math.atan2(p.y1 - p.y0, p.x1 - p.x0));
      const sa = Phys.deg(Math.atan2(s.y1 - s.y0, s.x1 - s.x0));
      let da = ((ang - sa + 540) % 360) - 180;
      const lenOk = Math.abs(len - sl) <= Math.max(0.04 * sl, 0.15);
      const angOk = Math.abs(da) <= 3;
      if (!lenOk) item.msgs.push(len > sl ? 'zu lang' : 'zu kurz');
      if (!angOk) item.msgs.push(Math.abs(da) > 150 ? 'Richtung umgekehrt' : 'Richtung/Winkel stimmt nicht');
      item.ok = lenOk && angOk;
      if (item.ok) item.msgs.push(`Länge ${Phys.fmt(len, 3)} K. ≙ ${Phys.fmt(len * this.scale, 3)} ${this.unit}`);
      if (!item.ok) allOk = false;
      res.push(item);
    }
    // Konstruktionshinweise: Zeigerkette Spitze an Fuß
    const hints = [];
    const chain = this.keys.slice(0, -1);
    for (let i = 1; i < chain.length; i++) {
      const a = this.ph[chain[i - 1]], b = this.ph[chain[i]];
      if (a && b && Math.hypot(a.x1 - b.x0, a.y1 - b.y0) > 0.15)
        hints.push(`Tipp: Hänge ${Render.QTY[chain[i]].html} an die Spitze von ${Render.QTY[chain[i - 1]].html} an (geometrische Addition: „Fuß an Spitze“).`);
    }
    const tot = this.ph[this.keys[this.keys.length - 1]];
    if (tot && Math.hypot(tot.x0, tot.y0) > 0.15) hints.push(`Tipp: Der Gesamtzeiger ${Render.QTY[this.keys[this.keys.length - 1]].html} beginnt im Ursprung.`);
    this.feedback = { ok: allOk, items: res, hints };
    this.render();
    return this.feedback;
  }

  /* ----- Zeichnen ----- */
  render() {
    const W = (this.X1 - this.X0) * this.PX, H = (this.Y1 - this.Y0) * this.PX;
    let g = '';
    // Gitter: dünn jede 1 Kästchen, kräftiger alle 5
    for (let x = this.X0; x <= this.X1; x++) {
      const [px] = this.toPx(x, 0);
      g += `<line x1="${px}" y1="0" x2="${px}" y2="${H}" class="${x % 5 ? 'grid-line faint' : 'grid-line'}"/>`;
    }
    for (let y = this.Y0; y <= this.Y1; y++) {
      const [, py] = this.toPx(0, y);
      g += `<line x1="0" y1="${py}" x2="${W}" y2="${py}" class="${y % 5 ? 'grid-line faint' : 'grid-line'}"/>`;
    }
    const [ox, oy] = this.toPx(0, 0);
    g += `<line x1="0" y1="${oy}" x2="${W}" y2="${oy}" class="axis-line"/><line x1="${ox}" y1="0" x2="${ox}" y2="${H}" class="axis-line"/>`;
    g += `<circle cx="${ox}" cy="${oy}" r="4" class="origin"/>`;
    // Bezugsachse
    if (this.showRef) {
      const [rx, ry] = this.toPx(3, 0);
      g += Render.arrow(ox, oy, rx, ry, Render.COLOR[this.refKey], { width: 3, dash: '7 5' });
      g += Render.svgLabel(this.refKey, (ox + rx) / 2, ry + 18, { size: 15 });
      g += `<text x="${(ox + rx) / 2 + 12}" y="${ry + 18}" class="legend-text" dominant-baseline="middle">(Bezug)</text>`;
    }
    // Musterlösung
    if (this.showSolution && this.scale) {
      const sol = this.solutionVectors();
      for (const k of this.keys) {
        const s = sol[k];
        if (!s) continue;
        const [a, b] = this.toPx(s.x0, s.y0), [c, d] = this.toPx(s.x1, s.y1);
        g += Render.arrow(a, b, c, d, Render.COLOR[k], { width: 7, opacity: 0.25 });
      }
    }
    // gezeichnete Zeiger
    for (const k of this.keys) {
      const p = this.ph[k];
      if (!p) continue;
      const [a, b] = this.toPx(p.x0, p.y0), [c, d] = this.toPx(p.x1, p.y1);
      const sel = k === this.tool;
      const fb = this.feedback?.items.find((i) => i.key === k);
      g += `<g data-body="${k}" class="ed-ph ${sel ? 'sel' : ''}">
        <line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="transparent" stroke-width="18"/>
        ${Render.arrow(a, b, c, d, Render.COLOR[k], { width: sel ? 4 : 3 })}</g>`;
      const len = Math.hypot(c - a, d - b) || 1;
      const nx = -(d - b) / len, ny = (c - a) / len;
      g += Render.svgLabel(k, (a + c) / 2 - nx * 16, (b + d) / 2 - ny * 16, { size: 16 });
      if (fb) g += `<text x="${c + 10}" y="${d - 10}" class="fb-mark ${fb.ok ? 'ok' : 'bad'}">${fb.ok ? '✓' : '✗'}</text>`;
      if (sel) {
        g += `<circle data-handle="${k}:0" cx="${a}" cy="${b}" r="8" class="handle"/>`;
        g += `<circle data-handle="${k}:1" cx="${c}" cy="${d}" r="9" class="handle tip"/>`;
      }
    }
    this.svg.innerHTML = g;

    // Werkzeugleiste
    this.toolsEl.innerHTML = this.keys.map((k) => `
      <button class="tool ${k === this.tool ? 'active' : ''} ${this.ph[k] ? 'done' : ''}" data-key="${k}" style="--tc:${Render.COLOR[k]}">
        <span class="dot"></span>${Render.QTY[k].html}${this.ph[k] ? ' ✓' : ''}</button>`).join('');

    this.hintEl.innerHTML = this.ph[this.tool]
      ? `Ziehe an der Spitze ● oder am Fuß ○ von ${Render.QTY[this.tool].html}, oder verschiebe den ganzen Zeiger.`
      : `Zeichne ${Render.QTY[this.tool].html}: Auf das Gitter drücken (Fußpunkt) und bis zur Spitze ziehen.`;

    // Ablesewerte (grafische Lösung)
    const rows = this.keys.map((k) => {
      const p = this.ph[k];
      if (!p) return `<tr><td>${Render.QTY[k].html}</td><td colspan="3" class="muted">–</td></tr>`;
      const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
      const ang = Phys.deg(Math.atan2(p.y1 - p.y0, p.x1 - p.x0));
      return `<tr><td style="color:${Render.COLOR[k]}"><b>${Render.QTY[k].html}</b></td>
        <td>${Phys.fmt(len, 3)} K.</td>
        <td>${this.scale ? '≙ ' + Phys.fmt(len * this.scale, 3) + ' ' + this.unit : '<span class="muted">Maßstab?</span>'}</td>
        <td>${Phys.fmt(ang, 3)}°</td></tr>`;
    }).join('');
    this.readoutEl.innerHTML = `<table class="readout"><thead><tr><th>Zeiger</th><th>Länge</th><th>Wert</th><th>Winkel zur Bezugsachse</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
}
