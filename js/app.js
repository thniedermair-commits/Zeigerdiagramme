/* =========================================================
   ZeigerLab – Hauptanwendung
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { fmt, fmtUnit, parse, rad } = Phys;
  const Q = Render.QTY, COL = Render.COLOR;

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignorieren */ } },
  };

  function toast(msg) {
    const t = $('#toast');
    t.innerHTML = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- Farbschema ---------------- */
  const themeBtn = $('#themeBtn');
  const savedTheme = store.get('zd-theme', null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  themeBtn.onclick = () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('zd-theme', next);
  };

  /* ---------------- Tabs ---------------- */
  const TABS = ['basics', 'sim', 'tasks', 'formulas'];
  function activate(tab) {
    if (!TABS.includes(tab)) tab = 'basics';
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab);
    basics.visible = tab === 'basics';
    window.scrollTo({ top: 0 });
  }
  $$('.tab').forEach((b) => (b.onclick = () => activate(b.dataset.tab)));

  /* ---------------- Gemeinsame Bausteine ---------------- */
  const PARAMS = {
    U: { label: 'Spannung U', unit: 'V', factor: 1, min: 1, max: 400, step: 1 },
    f: { label: 'Frequenz f', unit: 'Hz', factor: 1, min: 1, max: 1000, step: 1 },
    R: { label: 'Widerstand R', unit: 'Ω', factor: 1, min: 1, max: 2000, step: 1, color: 'var(--c-r)' },
    L: { label: 'Induktivität L', unit: 'mH', factor: 1e-3, min: 1, max: 2000, step: 1, color: 'var(--c-l)' },
    C: { label: 'Kapazität C', unit: 'µF', factor: 1e-6, min: 0.1, max: 200, step: 0.1, color: 'var(--c-c)' },
  };
  const disp = (k, v) => Number((v / PARAMS[k].factor).toPrecision(6));

  function sliderRow(k, v, opts = {}) {
    const p = { ...PARAMS[k], ...opts };
    return `<div class="ctrl" data-param="${k}" style="--accent-c:${p.color || 'var(--accent)'}">
      <div class="ctrl-head"><label for="n-${opts.prefix || ''}${k}">${p.label}</label>
        <span class="num-wrap"><input id="n-${opts.prefix || ''}${k}" type="number" class="num" min="${p.min}" max="${p.max * 10}" step="any" value="${disp(k, v)}"><span class="u">${p.unit}</span></span></div>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${Math.min(p.max, disp(k, v))}" aria-label="${p.label}">
    </div>`;
  }
  function bindSliders(root, onChange) {
    $$('.ctrl', root).forEach((c) => {
      const k = c.dataset.param, num = $('.num', c), rng = $('input[type=range]', c);
      rng.oninput = () => { num.value = rng.value; onChange(k, Number(rng.value) * PARAMS[k].factor); };
      num.oninput = () => {
        const v = parse(num.value);
        if (!(v > 0)) return;
        rng.value = Math.min(Number(rng.max), v);
        onChange(k, v * PARAMS[k].factor);
      };
    });
  }

  const givenChip = (k, v) => `<span class="chip" style="--cc:${PARAMS[k].color || 'var(--accent)'}">${k === 'f' ? 'f' : k} = ${fmtUnit(v, k === 'U' ? 'V' : k === 'f' ? 'Hz' : k === 'R' ? 'Ω' : k === 'L' ? 'H' : 'F')}</span>`;

  /* =====================================================
     1) GRUNDLAGEN – rotierender Zeiger & Liniendiagramm
     ===================================================== */
  const basics = { comp: 'L', U: 230, f: 50, R: 100, L: 0.5, C: 20e-6, theta: 0, playing: true, speed: 1, visible: true };
  const INFO = {
    R: { title: 'Wirkwiderstand R', icon: '▭', phi: 0,
      text: 'Strom und Spannung sind <b>in Phase</b> – sie erreichen ihre Maximalwerte und Nulldurchgänge gleichzeitig (φ = 0°).',
      memo: 'R ist unabhängig von der Frequenz.' },
    L: { title: 'Spule (Induktivität L)', icon: '∿', phi: 90,
      text: 'Bei der idealen Spule <b>eilt der Strom der Spannung um 90° nach</b>. Die Selbstinduktionsspannung bremst jede Stromänderung.',
      memo: '„Bei Induktivitäten die Ströme sich verspäten.“' },
    C: { title: 'Kondensator (Kapazität C)', icon: '⊣⊢', phi: -90,
      text: 'Beim Kondensator <b>eilt der Strom der Spannung um 90° voraus</b>. Erst muss Ladung fließen, bevor sich Spannung aufbaut.',
      memo: '„Beim Kondensator eilt der Strom vor.“' },
  };

  function renderBasics() {
    const el = $('#tab-basics');
    el.innerHTML = `
      <div class="hero card">
        <div>
          <h1>Wie verhalten sich <span class="hl-r">R</span>, <span class="hl-l">L</span> und <span class="hl-c">C</span> an Wechselspannung?</h1>
          <p>Ein Zeiger, der sich gegen den Uhrzeigersinn dreht, erzeugt durch seine Projektion eine Sinuskurve. Wähle ein Bauteil und beobachte, wie Strom und Spannung zueinander verschoben sind.</p>
        </div>
      </div>
      <div class="layout-aside">
        <aside class="card stack">
          <div class="seg" role="radiogroup" aria-label="Bauteil">
            ${['R', 'L', 'C'].map((c) => `<button data-comp="${c}" class="seg-btn seg-${c.toLowerCase()}">${c === 'R' ? 'Widerstand' : c === 'L' ? 'Spule' : 'Kondensator'}</button>`).join('')}
          </div>
          <div id="b-sliders"></div>
          <div id="b-info"></div>
        </aside>
        <div class="stack">
          <div class="card">
            <div class="card-head">
              <h2>Rotierender Zeiger &amp; Liniendiagramm</h2>
              <div class="row gap-s">
                <button class="btn ghost sm" id="b-play">⏸ Pause</button>
                <label class="mini-range">Tempo <input type="range" id="b-speed" min="0.2" max="3" step="0.1" value="1"></label>
              </div>
            </div>
            <div id="b-rot" class="rot-wrap"></div>
            <p class="caption">Die Länge des Zeigers entspricht dem Scheitelwert (û, î). Die Höhe der Zeigerspitze ist der Augenblickswert – genau das zeigt die Kurve rechts.</p>
          </div>
          <div class="card">
            <div class="card-head"><h2>Blindwiderstand in Abhängigkeit von der Frequenz</h2></div>
            <div id="b-xf"></div>
          </div>
        </div>
      </div>`;
    $$('[data-comp]', el).forEach((b) => (b.onclick = () => { basics.comp = b.dataset.comp; updateBasicsControls(); }));
    $('#b-play').onclick = () => {
      basics.playing = !basics.playing;
      $('#b-play').textContent = basics.playing ? '⏸ Pause' : '▶ Abspielen';
    };
    $('#b-speed').oninput = (e) => (basics.speed = Number(e.target.value));
    updateBasicsControls();
    requestAnimationFrame(loop);
  }

  function updateBasicsControls() {
    $$('[data-comp]').forEach((b) => b.setAttribute('aria-checked', b.dataset.comp === basics.comp));
    const c = basics.comp;
    $('#b-sliders').innerHTML = sliderRow('f', basics.f, { prefix: 'b', max: 200 }) + sliderRow(c, basics[c], { prefix: 'b', max: c === 'R' ? 500 : c === 'L' ? 1000 : 100 });
    bindSliders($('#b-sliders'), (k, v) => { basics[k] = v; updateBasicsInfo(); });
    updateBasicsInfo();
  }

  function basicsResult() {
    return Phys.solve(basics.comp, basics);
  }

  function updateBasicsInfo() {
    const c = basics.comp, r = basicsResult(), inf = INFO[c];
    const xHtml = c === 'R' ? `R = ${fmtUnit(r.R, 'Ω')}`
      : c === 'L' ? `X<sub>L</sub> = 2π·f·L = <b>${fmtUnit(r.XL, 'Ω')}</b>`
      : `X<sub>C</sub> = 1/(2π·f·C) = <b>${fmtUnit(r.XC, 'Ω')}</b>`;
    $('#b-info').innerHTML = `
      <div class="info-box info-${c.toLowerCase()}">
        <h3>${inf.title}</h3>
        <p>${inf.text}</p>
        <p class="memo">💡 ${inf.memo}</p>
      </div>
      <div class="kv">
        <div><span>${c === 'R' ? 'Widerstand' : 'Blindwiderstand'}</span><strong>${xHtml}</strong></div>
        <div><span>Strom bei U = 230 V</span><strong>I = ${fmtUnit(r.I, 'A')}</strong></div>
        <div><span>Phasenverschiebung</span><strong>φ = ${fmt(r.phi, 3)}°</strong></div>
      </div>`;
    $('#b-xf').innerHTML = xfChart(c, basics);
  }

  function rotSVG(phi, theta) {
    const W = 780, H = 300, cx = 150, cy = 150, R = 115, x0 = 310, x1 = 760;
    const X = (d) => x0 + (d / 360) * (x1 - x0);
    let s = '';
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" class="rot-circle"/><circle cx="${cx}" cy="${cy}" r="${R * 0.7}" class="rot-circle faint"/>`;
    s += `<line x1="${cx - R - 10}" y1="${cy}" x2="${cx + R + 10}" y2="${cy}" class="axis-line"/><line x1="${cx}" y1="${cy - R - 10}" x2="${cx}" y2="${cy + R + 10}" class="axis-line"/>`;
    for (let d = 0; d <= 360; d += 90) {
      s += `<line x1="${X(d)}" y1="${cy - R - 8}" x2="${X(d)}" y2="${cy + R + 8}" class="grid-line"/><text x="${X(d)}" y="${H - 6}" text-anchor="middle" class="tick-text">${d}°</text>`;
    }
    s += `<line x1="${x0}" y1="${cy}" x2="${x1 + 10}" y2="${cy}" class="axis-line"/><text x="${x1 + 12}" y="${cy - 8}" text-anchor="end" class="tick-text">ωt</text>`;
    const curve = (a, sh) => {
      let d = '';
      for (let i = 0; i <= 120; i++) { const x = i * 3; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + (cy - a * R * Math.sin(rad(x - sh))).toFixed(1); }
      return d;
    };
    s += `<path d="${curve(1, 0)}" class="curve" style="stroke:var(--c-u)"/><path d="${curve(0.7, phi)}" class="curve" style="stroke:var(--c-i)"/>`;
    const th = ((theta % 360) + 360) % 360;
    const ux = cx + R * Math.cos(rad(th)), uy = cy - R * Math.sin(rad(th));
    const ix = cx + 0.7 * R * Math.cos(rad(th - phi)), iy = cy - 0.7 * R * Math.sin(rad(th - phi));
    const cxr = X(th);
    s += `<line x1="${cxr}" y1="${cy - R - 8}" x2="${cxr}" y2="${cy + R + 8}" class="cursor-line"/>`;
    s += `<line x1="${ux}" y1="${uy}" x2="${cxr}" y2="${uy}" class="proj" style="stroke:var(--c-u)"/><line x1="${ix}" y1="${iy}" x2="${cxr}" y2="${iy}" class="proj" style="stroke:var(--c-i)"/>`;
    if (Math.abs(phi) > 1) {
      const a0 = th - phi, a1 = th, rr = 34;
      const p0 = [cx + rr * Math.cos(rad(a0)), cy - rr * Math.sin(rad(a0))], p1 = [cx + rr * Math.cos(rad(a1)), cy - rr * Math.sin(rad(a1))];
      s += `<path d="M${p0[0]} ${p0[1]}A${rr} ${rr} 0 0 ${phi > 0 ? 0 : 1} ${p1[0]} ${p1[1]}" class="phi-arc"/>`;
    }
    s += Render.arrow(cx, cy, ux, uy, 'var(--c-u)', { width: 4, head: 14 });
    s += Render.arrow(cx, cy, ix, iy, 'var(--c-i)', { width: 4, head: 14 });
    s += `<circle cx="${cxr}" cy="${uy}" r="5" fill="var(--c-u)"/><circle cx="${cxr}" cy="${iy}" r="5" fill="var(--c-i)"/>`;
    s += `<text x="${ux + 10 * Math.cos(rad(th))}" y="${uy - 12 * Math.sin(rad(th))}" class="ph-label" style="fill:var(--c-u)" text-anchor="middle" dominant-baseline="middle">û</text>`;
    s += `<text x="${ix + 10 * Math.cos(rad(th - phi))}" y="${iy - 12 * Math.sin(rad(th - phi))}" class="ph-label" style="fill:var(--c-i)" text-anchor="middle" dominant-baseline="middle">î</text>`;
    s += `<g class="legend"><rect x="8" y="8" width="12" height="4" rx="2" fill="var(--c-u)"/><text x="26" y="13" class="legend-text">Spannung u</text>
          <rect x="8" y="24" width="12" height="4" rx="2" fill="var(--c-i)"/><text x="26" y="29" class="legend-text">Strom i</text></g>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Rotierende Zeiger mit Liniendiagramm">${s}</svg>`;
  }

  function xfChart(c, p) {
    const W = 720, H = 250, L = 58, Rm = 20, T = 30, B = 36;
    const fMax = 200, f = p.f;
    const xval = (ff) => (c === 'R' ? p.R : c === 'L' ? 2 * Math.PI * ff * p.L : 1 / (2 * Math.PI * ff * p.C));
    const yMax = Phys.niceStep(Math.max(xval(f) * 2, c === 'C' ? xval(50) * 1.5 : 1)) ;
    const X = (ff) => L + (ff / fMax) * (W - L - Rm), Y = (v) => H - B - (Math.min(v, yMax * 1.05) / yMax) * (H - T - B);
    let s = '';
    for (let i = 0; i <= 4; i++) {
      const v = (yMax * i) / 4;
      s += `<line x1="${L}" y1="${Y(v)}" x2="${W - Rm}" y2="${Y(v)}" class="grid-line"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick-text">${fmt(v, 3)}</text>`;
    }
    for (let ff = 0; ff <= fMax; ff += 50) s += `<text x="${X(ff)}" y="${H - B + 18}" text-anchor="middle" class="tick-text">${ff}</text>`;
    s += `<text x="${W - Rm}" y="${H - 4}" text-anchor="end" class="tick-text">f in Hz</text>`;
    s += `<text x="${L - 6}" y="${T - 16}" text-anchor="end" class="tick-text">${c === 'R' ? 'R' : 'X'} in Ω</text>`;
    let d = '';
    for (let i = 0; i <= 200; i++) { const ff = Math.max(0.5, (i / 200) * fMax); d += (i ? 'L' : 'M') + X(ff).toFixed(1) + ' ' + Y(xval(ff)).toFixed(1); }
    const col = c === 'R' ? 'var(--c-r)' : c === 'L' ? 'var(--c-l)' : 'var(--c-c)';
    s += `<path d="${d}" class="curve" style="stroke:${col}" clip-path="url(#xfclip)"/>`;
    s = `<defs><clipPath id="xfclip"><rect x="${L}" y="${T - 2}" width="${W - L - Rm}" height="${H - T - B + 2}"/></clipPath></defs>` + s;
    const fx = Math.min(f, fMax);
    s += `<line x1="${X(fx)}" y1="${T}" x2="${X(fx)}" y2="${H - B}" class="cursor-line"/><circle cx="${X(fx)}" cy="${Y(xval(f))}" r="6" fill="${col}" stroke="var(--card)" stroke-width="2"/>`;
    s += `<text x="${X(fx) + 10}" y="${Math.max(T + 12, Y(xval(f)) - 10)}" class="legend-text strong">${fmtUnit(xval(f), 'Ω', 3)} bei ${fmt(f, 3)} Hz</text>`;
    const note = c === 'R' ? 'konstant – unabhängig von f' : c === 'L' ? 'X_L ~ f: doppelte Frequenz → doppelter Blindwiderstand' : 'X_C ~ 1/f: doppelte Frequenz → halber Blindwiderstand';

    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Frequenzverhalten">${s}</svg><p class="caption">${note.replace('X_L', 'X<sub>L</sub>').replace('X_C', 'X<sub>C</sub>')}</p>`;
  }

  let lastT = null;
  function loop(t) {
    if (lastT == null) lastT = t;
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (basics.playing) basics.theta += dt * 70 * basics.speed;
    if (basics.visible) {
      const el = $('#b-rot');
      if (el) el.innerHTML = rotSVG(INFO[basics.comp].phi, basics.theta);
    }
    requestAnimationFrame(loop);
  }

  /* =====================================================
     2) SIMULATOR
     ===================================================== */
  const sim = store.get('zd-sim', { type: 'RL_s', U: 230, f: 50, R: 100, L: 0.4, C: 47e-6 });

  function renderSim() {
    const el = $('#tab-sim');
    const groups = [
      ['Einzelbauteil', ['R', 'L', 'C']],
      ['Reihenschaltung', ['RL_s', 'RC_s', 'RLC_s']],
      ['Parallelschaltung', ['RL_p', 'RC_p', 'RLC_p']],
    ];
    el.innerHTML = `
      <div class="layout-aside">
        <aside class="card stack">
          <h2>Schaltung wählen</h2>
          ${groups.map(([g, ts]) => `<div class="type-group"><div class="type-group-name">${g}</div>
            <div class="type-chips">${ts.map((t) => `<button class="type-chip" data-type="${t}">${Phys.TYPES[t].short}</button>`).join('')}</div></div>`).join('')}
          <hr>
          <h2>Werte einstellen</h2>
          <div id="s-sliders"></div>
          <div id="s-extra"></div>
          <button class="btn primary block" id="s-totask">🎯 Als Übungsaufgabe speichern</button>
          <p class="caption">Tipp: Gib die Werte einer Aufgabe aus dem Buch ein und vergleiche mit deinem eigenen Rechenweg.</p>
        </aside>
        <div class="stack">
          <div class="grid-2">
            <div class="card"><div class="card-head"><h2 id="s-title"></h2></div><div id="s-sch" class="sch-wrap"></div><div id="s-results" class="results"></div></div>
            <div class="card"><div class="card-head"><h2>Zeigerdiagramm</h2></div><div id="s-ph"></div></div>
          </div>
          <div class="grid-2">
            <div class="card"><div class="card-head"><h2>Liniendiagramm</h2></div><div id="s-line"></div></div>
            <div class="card" id="s-tri-card"><div class="card-head"><h2 id="s-tri-title">Widerstandsdreieck</h2></div><div id="s-tri"></div></div>
          </div>
          <div class="card"><div class="card-head"><h2>Rechenweg</h2></div><div id="s-steps"></div></div>
        </div>
      </div>`;
    $$('.type-chip', el).forEach((b) => (b.onclick = () => { sim.type = b.dataset.type; simControls(); }));
    $('#s-totask').onclick = () => {
      if (Phys.TYPES[sim.type].mode === 'single') { toast('Für Übungsaufgaben bitte eine Reihen- oder Parallelschaltung wählen.'); return; }
      const t = createCustomTask(sim.type, { ...sim });
      activate('tasks');
      openTask(t.id);
      toast('Aufgabe gespeichert ✓');
    };
    simControls();
  }

  function simControls() {
    $$('.type-chip').forEach((b) => b.classList.toggle('active', b.dataset.type === sim.type));
    const parts = Phys.TYPES[sim.type].parts;
    $('#s-sliders').innerHTML = ['U', 'f', ...parts].map((k) => sliderRow(k, sim[k], { prefix: 's' })).join('');
    bindSliders($('#s-sliders'), (k, v) => { sim[k] = v; updateSim(); });
    updateSim();
  }

  function updateSim() {
    store.set('zd-sim', sim);
    const r = Phys.solve(sim.type, sim);
    const t = Phys.TYPES[sim.type];
    $('#s-title').textContent = t.name;
    $('#s-sch').innerHTML = Render.schematic(sim.type);
    const res = [];
    if (r.XL != null) res.push(['XL', r.XL]);
    if (r.XC != null) res.push(['XC', r.XC]);
    res.push(['Z', r.Z], ['I', r.I]);
    ['UR', 'UL', 'UC', 'IR', 'IL', 'IC'].forEach((k) => r[k] != null && res.push([k, r[k]]));
    $('#s-results').innerHTML = res.map(([k, v]) => `<div class="res" style="--rc:${COL[k] || 'var(--text)'}"><span>${Q[k].html}</span><b>${fmtUnit(v, Q[k].unit)}</b></div>`).join('')
      + `<div class="res"><span>φ</span><b>${fmt(r.phi, 4)}°</b></div><div class="res"><span>cos φ</span><b>${fmt(r.cosphi, 3)}</b></div>`
      + `<div class="res wide"><span>Verhalten</span><b><span class="tag tag-${r.character}">${r.character}</span></b></div>`;
    $('#s-ph').innerHTML = Render.phasorDiagram(r);
    $('#s-line').innerHTML = Render.lineDiagram(r);
    $('#s-steps').innerHTML = Render.stepsTable(r);
    const triCard = $('#s-tri-card');
    if (r.mode === 'series') {
      triCard.hidden = false;
      $('#s-tri').innerHTML = Render.resistanceTriangle(r, { width: 420, height: 230 }) +
        `<p class="caption">Das Widerstandsdreieck ist dem Spannungsdreieck ähnlich: Alle Spannungen sind I-mal größer.</p>`;
    } else triCard.hidden = true;
    // Resonanz
    const extra = $('#s-extra');
    if (t.parts.includes('L') && t.parts.includes('C')) {
      const f0 = 1 / (2 * Math.PI * Math.sqrt(sim.L * sim.C));
      extra.innerHTML = `<div class="info-box"><b>Resonanzfrequenz</b> f<sub>0</sub> = 1 / (2π·√(L·C)) = <b>${fmtUnit(f0, 'Hz')}</b><br>
        <span class="caption">Bei f<sub>0</sub> ist X<sub>L</sub> = X<sub>C</sub>.</span>
        <button class="btn ghost sm" id="s-res">f auf f₀ setzen</button></div>`;
      $('#s-res').onclick = () => { sim.f = Number(f0.toPrecision(4)); simControls(); };
    } else extra.innerHTML = '';
  }

  /* =====================================================
     3) AUFGABEN
     ===================================================== */
  let custom = store.get('zd-custom', []);
  const progress = store.get('zd-progress', {});
  const answers = store.get('zd-answers', {});
  let currentId = store.get('zd-current', TASKS[0].id);
  let editor = null;

  const allTasks = () => [...TASKS, ...custom];
  const getTask = (id) => allTasks().find((t) => t.id === id) || TASKS[0];

  function createCustomTask(type, v, title) {
    const t = Phys.TYPES[type];
    const given = { U: v.U, f: v.f };
    t.parts.forEach((k) => (given[k] = v[k]));
    const parts = t.parts.map((k) => `<b>${k} = ${fmtUnit(given[k], k === 'R' ? 'Ω' : k === 'L' ? 'H' : 'F')}</b>`);
    const task = {
      id: 'c' + Date.now(),
      custom: true,
      title: title || t.name,
      level: t.parts.length > 2 ? 2 : 1,
      type, given,
      story: `${t.mode === 'series' ? 'In Reihe' : 'Parallel'} geschaltet sind ${parts.join(', ').replace(/, ([^,]*)$/, ' und $1')}. Die Schaltung liegt an <b>U = ${fmtUnit(v.U, 'V')}</b> mit <b>f = ${fmtUnit(v.f, 'Hz')}</b>.`,
      ...defaultTaskFields(type),
    };
    custom.push(task);
    store.set('zd-custom', custom);
    renderTaskList();
    return task;
  }

  function stars(id) {
    const p = progress[id];
    if (!p) return 0;
    let s = 0;
    if (p.calc >= 0.5) s++;
    if (p.calc >= 1) s++;
    if (p.draw) s++;
    return s;
  }

  function renderTasks() {
    $('#tab-tasks').innerHTML = `
      <div class="layout-aside">
        <aside class="card stack">
          <h2>Aufgaben</h2>
          <div id="t-list" class="task-list"></div>
          <button class="btn ghost block" id="t-new">＋ Eigene Aufgabe erstellen</button>
        </aside>
        <div id="t-main" class="stack"></div>
      </div>`;
    $('#t-new').onclick = openCustomDialog;
    renderTaskList();
    openTask(currentId);
  }

  function renderTaskList() {
    const el = $('#t-list');
    if (!el) return;
    el.innerHTML = allTasks().map((t, i) => {
      const s = stars(t.id);
      return `<button class="task-item ${t.id === currentId ? 'active' : ''}" data-id="${t.id}">
        <span class="task-num">${t.custom ? '✎' : i + 1}</span>
        <span class="task-txt"><b>${t.title}</b><small>${Phys.TYPES[t.type].name} · ${'●'.repeat(t.level)}${'○'.repeat(3 - t.level)}</small></span>
        <span class="stars" aria-label="${s} von 3 Sternen">${'★'.repeat(s)}<span class="off">${'★'.repeat(3 - s)}</span></span>
      </button>`;
    }).join('');
    $$('.task-item', el).forEach((b) => (b.onclick = () => openTask(b.dataset.id)));
  }

  function saveAnswers() { store.set('zd-answers', answers); }

  function openTask(id) {
    const task = getTask(id);
    currentId = task.id;
    store.set('zd-current', currentId);
    renderTaskList();
    const r = Phys.solve(task.type, task.given);
    const A = (answers[task.id] = answers[task.id] || { fields: {}, char: '', scale: null, ref: null, drawing: {} });
    const t = Phys.TYPES[task.type];
    const series = t.mode === 'series';
    const stepMap = Object.fromEntries(Render.steps(r).map((s) => [s.key, s]));

    const fieldRow = (k) => {
      const unit = task.unitOverride?.[k] || autoUnit(k, r[k]);
      return `<div class="calc-row" data-key="${k}">
        <label class="calc-label" for="f-${k}"><span class="sym" style="color:${COL[k] || 'inherit'}">${Q[k].html}</span><small>${Q[k].name}</small></label>
        <div class="calc-input">
          <input id="f-${k}" inputmode="decimal" autocomplete="off" placeholder="?" value="${A.fields[k] ?? ''}">
          <span class="u">${unit || '&nbsp;'}</span>
          ${k === 'phi' ? `<select id="f-char" aria-label="induktiv oder kapazitiv"><option value="">Verhalten?</option><option value="induktiv" ${A.char === 'induktiv' ? 'selected' : ''}>induktiv</option><option value="kapazitiv" ${A.char === 'kapazitiv' ? 'selected' : ''}>kapazitiv</option></select>` : ''}
        </div>
        <span class="calc-state" aria-live="polite"></span>
        <button class="btn ghost xs tip-btn" title="Tipp anzeigen">💡</button>
        <div class="calc-tip" hidden>Formel: <span>${stepMap[k]?.formula || ''}</span></div>
      </div>`;
    };

    const maxMag = Math.max(...r.phasors.filter((p) => p.kind === (series ? 'U' : 'I')).flatMap((p) => [Math.abs(p.x1), Math.abs(p.y1), Math.hypot(p.x1, p.y1)]));
    const scales = Phys.niceNumbers(maxMag / 28, maxMag / 3);
    const unitD = series ? 'V' : 'A';

    $('#t-main').innerHTML = `
      <div class="card task-head">
        <div class="task-meta"><span class="pill">${t.name}</span><span class="pill soft">Niveau ${'●'.repeat(task.level)}${'○'.repeat(3 - task.level)}</span>
          ${task.custom ? '<button class="btn ghost xs" id="t-del">Aufgabe löschen</button>' : ''}</div>
        <h1>${task.title}</h1>
        <div class="task-body">
          <div>
            <p class="story">${task.story}</p>
            <div class="chips">${['U', 'f', ...t.parts].map((k) => givenChip(k, task.given[k])).join('')}</div>
            <p class="caption">Gesucht: ${task.ask.map((k) => Q[k].html).join(', ')} – und das maßstäbliche Zeigerdiagramm.</p>
          </div>
          <div class="sch-wrap">${Render.schematic(task.type)}</div>
        </div>
        <div class="progress-line"><div class="bar"><i id="t-bar"></i></div><span id="t-score"></span></div>
      </div>

      <div class="card">
        <div class="card-head"><h2><span class="stepno">1</span> Berechnen</h2>
          <div class="row gap-s"><button class="btn primary sm" id="t-check">Ergebnisse prüfen</button>
          <button class="btn ghost sm" id="t-sol">Lösungsweg</button></div></div>
        <p class="caption">Dezimalzahlen mit Komma oder Punkt. Runde sinnvoll (3–4 gültige Ziffern) – Abweichungen bis 2 % werden akzeptiert. Beim Winkel φ den Betrag eingeben und das Verhalten wählen.</p>
        <div class="calc-grid">${task.ask.map(fieldRow).join('')}</div>
        <div id="t-steps" hidden></div>
      </div>

      <div class="card">
        <div class="card-head"><h2><span class="stepno">2</span> Zeigerdiagramm zeichnen</h2></div>
        <div class="draw-prep">
          <div class="q-box">
            <div class="q">a) Welche Größe ist bei dieser Schaltung der <b>Bezugszeiger</b> (waagerecht nach rechts)?</div>
            <div class="row gap-s">
              <button class="btn choice" data-ref="I">Strom I</button>
              <button class="btn choice" data-ref="U">Spannung U</button>
            </div>
            <div id="t-ref-fb" class="fb"></div>
          </div>
          <div class="q-box">
            <div class="q">b) Wähle einen geeigneten <b>Maßstab</b>:</div>
            <div class="row gap-s"><span>1 Kästchen ≙</span>
              <select id="t-scale"><option value="">–</option>${scales.map((s) => `<option value="${s}" ${A.scale == s ? 'selected' : ''}>${fmt(s, 3)} ${unitD}</option>`).join('')}</select></div>
            <div id="t-scale-fb" class="fb"></div>
          </div>
        </div>
        <div class="q">c) Zeichne die Zeiger ${task.draw.map((k) => Q[k].html).join(', ')} – geometrische Addition: „Fuß an Spitze“.</div>
        <div id="t-editor" class="editor"></div>
        <div class="row gap-s wrap">
          <button class="btn primary" id="t-dcheck">Zeichnung prüfen</button>
          <span class="caption">Die Tabelle zeigt deine Zeichnung zurückgerechnet – so kannst du die Aufgabe auch <b>grafisch lösen</b> und mit deiner Rechnung vergleichen.</span>
        </div>
        <div id="t-dfb" class="draw-fb"></div>
      </div>

      <div class="card" id="t-compare" hidden>
        <div class="card-head"><h2><span class="stepno">3</span> Vergleich mit der Musterlösung</h2></div>
        <div class="grid-2"><div>${Render.phasorDiagram(r, { width: 520, height: 380 })}</div><div>${Render.lineDiagram(r, { width: 560, height: 260 })}</div></div>
      </div>`;

    // Rechnen
    const main = $('#t-main');
    $$('.calc-row input, #f-char', main).forEach((inp) => inp.addEventListener('input', () => {
      $$('.calc-row', main).forEach((row) => {
        const k = row.dataset.key;
        A.fields[k] = $('input', row).value;
      });
      A.char = $('#f-char')?.value || '';
      saveAnswers();
      inp.closest('.calc-row')?.classList.remove('ok', 'bad');
    }));
    $$('.tip-btn', main).forEach((b) => (b.onclick = () => { const tip = $('.calc-tip', b.closest('.calc-row')); tip.hidden = !tip.hidden; }));
    $('#t-check').onclick = () => checkFields(task, r, A);
    $('#t-sol').onclick = () => {
      const s = $('#t-steps');
      s.hidden = !s.hidden;
      if (!s.hidden) s.innerHTML = '<h3>Lösungsweg</h3>' + Render.stepsTable(r);
      $('#t-sol').textContent = s.hidden ? 'Lösungsweg' : 'Lösungsweg ausblenden';
    };
    if (task.custom) $('#t-del').onclick = () => {
      if (!confirm('Diese eigene Aufgabe wirklich löschen?')) return;
      custom = custom.filter((c) => c.id !== task.id);
      store.set('zd-custom', custom);
      delete answers[task.id]; saveAnswers();
      openTask(TASKS[0].id);
    };

    // Zeichnen
    editor = new PhasorEditor($('#t-editor'), {
      draw: task.draw, solution: r, scale: A.scale ? Number(A.scale) : null,
      state: A.drawing, showRef: A.ref === (series ? 'I' : 'U'),
      onChange: (st) => { A.drawing = st; saveAnswers(); },
    });
    const refCorrect = series ? 'I' : 'U';
    const setRef = (v, silent) => {
      A.ref = v; saveAnswers();
      $$('[data-ref]').forEach((b) => b.classList.toggle('picked', b.dataset.ref === v));
      const fb = $('#t-ref-fb');
      if (!v) return;
      if (v === refCorrect) {
        fb.className = 'fb ok';
        fb.innerHTML = series
          ? '✓ Richtig! In der Reihenschaltung fließt durch alle Bauteile <b>derselbe Strom I</b> – er ist der Bezugszeiger.'
          : '✓ Richtig! In der Parallelschaltung liegt an allen Bauteilen <b>dieselbe Spannung U</b> – sie ist der Bezugszeiger.';
        editor.setShowRef(true);
      } else {
        fb.className = 'fb bad';
        fb.innerHTML = '✗ Überlege: Welche Größe ist für <b>alle</b> Bauteile gleich? ' + (series ? 'In der Reihenschaltung teilt sich die Spannung auf …' : 'In der Parallelschaltung teilt sich der Strom auf …');
        editor.setShowRef(false);
      }
    };
    $$('[data-ref]').forEach((b) => (b.onclick = () => setRef(b.dataset.ref)));
    if (A.ref) setRef(A.ref, true);

    const scaleSel = $('#t-scale');
    const scaleFb = () => {
      const s = Number(scaleSel.value), fb = $('#t-scale-fb');
      if (!s) { fb.innerHTML = ''; return; }
      const pts = r.phasors.filter((p) => p.kind === (series ? 'U' : 'I')).flatMap((p) => [[p.x1 / s, p.y1 / s], [p.x0 / s, p.y0 / s]]);
      const fits = pts.every(([x, y]) => x >= -3 && x <= 33 && y >= -15 && y <= 15);
      const big = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
      if (!fits) { fb.className = 'fb bad'; fb.textContent = '✗ Mit diesem Maßstab passt das Diagramm nicht auf das Blatt. Wähle einen größeren Wert pro Kästchen.'; }
      else if (big < 7) { fb.className = 'fb warn'; fb.textContent = '⚠ Das Diagramm wird recht klein und ungenau. Ein kleinerer Wert pro Kästchen ist besser.'; }
      else { fb.className = 'fb ok'; fb.textContent = `✓ Gute Wahl – der längste Zeiger wird ca. ${fmt(big, 2)} Kästchen lang.`; }
    };
    scaleSel.onchange = () => { A.scale = scaleSel.value || null; saveAnswers(); editor.setScale(A.scale ? Number(A.scale) : null); scaleFb(); };
    scaleFb();

    $('#t-dcheck').onclick = () => {
      const fb = $('#t-dfb');
      if (A.ref !== refCorrect) { fb.innerHTML = `<div class="fb bad">Beantworte zuerst Frage a) zum Bezugszeiger.</div>`; return; }
      if (!A.scale) { fb.innerHTML = `<div class="fb bad">Wähle zuerst einen Maßstab (Frage b).</div>`; return; }
      const res = editor.check();
      fb.innerHTML = `<div class="fb-list">${res.items.map((i) => `<div class="fb ${i.ok ? 'ok' : 'bad'}"><b style="color:${COL[i.key]}">${Q[i.key].html}</b> ${i.ok ? '✓' : '✗'} ${i.msgs.join(', ')}</div>`).join('')}</div>
        ${res.hints.map((h) => `<div class="fb warn">${h}</div>`).join('')}
        ${res.ok ? `<div class="fb ok big">🎉 Klasse! Dein Zeigerdiagramm ist korrekt. Lies den Winkel φ ab und vergleiche mit deiner Rechnung.</div>` : ''}`;
      const p = (progress[task.id] = progress[task.id] || {});
      if (res.ok) { p.draw = true; $('#t-compare').hidden = false; confetti(); }
      store.set('zd-progress', progress);
      updateScore(task);
    };
    if (progress[task.id]?.draw) $('#t-compare').hidden = false;
    updateScore(task);
  }

  function checkFields(task, r, A) {
    let ok = 0;
    task.ask.forEach((k) => {
      const row = $(`.calc-row[data-key="${k}"]`);
      const unit = task.unitOverride?.[k] || autoUnit(k, r[k]);
      const raw = parse(A.fields[k]);
      const state = $('.calc-state', row);
      row.classList.remove('ok', 'bad');
      if (!isFinite(raw)) { state.textContent = ''; return; }
      const v = raw * (UNIT_FACTOR[unit] ?? 1);
      const exp = k === 'phi' ? r.phiAbs : r[k];
      let good;
      if (k === 'phi') good = Math.abs(Math.abs(v) - exp) <= Math.max(1, exp * 0.02);
      else if (k === 'cosphi') good = Math.abs(v - exp) <= 0.012;
      else good = Math.abs(v - exp) <= Math.abs(exp) * 0.02;
      let msg = '';
      if (k === 'phi' && good && A.char !== r.character && r.character !== 'ohmsch') {
        good = false; msg = 'Betrag stimmt – aber induktiv oder kapazitiv?';
      }
      if (!good && !msg) {
        const ratio = v / exp;
        if (Math.abs(ratio - 1000) < 20 || Math.abs(ratio - 0.001) < 0.00002) msg = 'Faktor 1000 – Einheit/Vorsatz prüfen!';
        else if (k === 'phi' && Math.abs(v - (90 - exp)) < 1) msg = 'Komplementwinkel? Prüfe Gegen- und Ankathete.';
        else msg = 'Noch nicht richtig';
      }
      row.classList.add(good ? 'ok' : 'bad');
      state.innerHTML = good ? '✓' : `<span title="${msg}">✗</span><small>${msg}</small>`;
      if (good) ok++;
    });
    const p = (progress[task.id] = progress[task.id] || {});
    p.calc = Math.max(p.calc || 0, ok / task.ask.length);
    store.set('zd-progress', progress);
    updateScore(task);
    if (ok === task.ask.length) { toast('🎉 Alle Ergebnisse richtig! Jetzt das Zeigerdiagramm zeichnen.'); confetti(); }
    else toast(`${ok} von ${task.ask.length} Ergebnissen richtig`);
  }

  function updateScore(task) {
    const p = progress[task.id] || {};
    const s = stars(task.id);
    const pct = ((p.calc || 0) * 0.66 + (p.draw ? 0.34 : 0)) * 100;
    $('#t-bar').style.width = pct + '%';
    $('#t-score').innerHTML = `<span class="stars">${'★'.repeat(s)}<span class="off">${'★'.repeat(3 - s)}</span></span>`;
    renderTaskList();
  }

  function openCustomDialog() {
    const d = $('#customDialog');
    const opts = ['RL_s', 'RC_s', 'RLC_s', 'RL_p', 'RC_p', 'RLC_p'];
    const v = { type: 'RL_s', U: 230, f: 50, R: 100, L: 0.5, C: 22e-6 };
    d.innerHTML = `<form method="dialog" class="stack">
      <h2>Eigene Aufgabe erstellen</h2>
      <p class="caption">Zum Beispiel eine Aufgabe aus dem Arbeitsbuch oder von der Lehrkraft. Die App berechnet die Lösung und prüft deine Eingaben.</p>
      <label class="field">Titel <input id="cd-title" placeholder="z. B. Aufgabe 3, S. 112"></label>
      <label class="field">Schaltung <select id="cd-type">${opts.map((o) => `<option value="${o}">${Phys.TYPES[o].name}</option>`).join('')}</select></label>
      <div id="cd-vals" class="cd-grid"></div>
      <div class="row gap-s end"><button value="cancel" class="btn ghost">Abbrechen</button><button value="ok" class="btn primary" id="cd-ok">Erstellen</button></div>
    </form>`;
    const vals = () => {
      const parts = Phys.TYPES[v.type].parts;
      $('#cd-vals').innerHTML = ['U', 'f', ...parts].map((k) => `<label class="field">${PARAMS[k].label}<span class="num-wrap"><input data-k="${k}" class="num" inputmode="decimal" value="${String(disp(k, v[k])).replace('.', ',')}"><span class="u">${PARAMS[k].unit}</span></span></label>`).join('');
    };
    $('#cd-type').onchange = (e) => { v.type = e.target.value; vals(); };
    vals();
    $('#cd-ok').onclick = (e) => {
      const parts = ['U', 'f', ...Phys.TYPES[v.type].parts];
      for (const k of parts) {
        const x = parse($(`[data-k="${k}"]`, d).value);
        if (!(x > 0)) { e.preventDefault(); toast(`Bitte einen gültigen Wert für ${k} eingeben.`); return; }
        v[k] = x * PARAMS[k].factor;
      }
      const t = createCustomTask(v.type, v, $('#cd-title').value.trim() || undefined);
      openTask(t.id);
      toast('Aufgabe erstellt ✓');
    };
    d.showModal();
  }

  /* kleines Konfetti als Belohnung */
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('div');
    c.className = 'confetti';
    const cols = ['#f97316', '#3b82f6', '#10b981', '#ec4899', '#eab308', '#8b5cf6'];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + 'vw';
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = Math.random() * 0.4 + 's';
      s.style.setProperty('--dx', (Math.random() * 2 - 1) * 120 + 'px');
      s.style.setProperty('--rot', Math.random() * 720 + 'deg');
      c.appendChild(s);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2600);
  }

  /* =====================================================
     4) FORMELN
     ===================================================== */
  function renderFormulas() {
    $('#tab-formulas').innerHTML = `
      <div class="formula-grid">
        <div class="card f-card">
          <h2>Blindwiderstände</h2>
          <div class="f-row"><span class="f-big" style="color:var(--c-l)">X<sub>L</sub> = 2π · f · L</span><span>Spule: steigt mit der Frequenz</span></div>
          <div class="f-row"><span class="f-big" style="color:var(--c-c)">X<sub>C</sub> = 1 / (2π · f · C)</span><span>Kondensator: sinkt mit der Frequenz</span></div>
          <div class="f-row"><span class="f-big">ω = 2π · f</span><span>Kreisfrequenz in 1/s</span></div>
        </div>
        <div class="card f-card">
          <h2>Phasenlage</h2>
          <table class="f-table"><thead><tr><th>Bauteil</th><th>φ</th><th>Merksatz</th></tr></thead><tbody>
            <tr><td style="color:var(--c-r)"><b>R</b></td><td>0°</td><td>U und I in Phase</td></tr>
            <tr><td style="color:var(--c-l)"><b>L</b></td><td>+90°</td><td>Strom eilt 90° <b>nach</b> – „Bei Induktivitäten die Ströme sich verspäten“</td></tr>
            <tr><td style="color:var(--c-c)"><b>C</b></td><td>−90°</td><td>Strom eilt 90° <b>vor</b> – „Beim Kondensator eilt der Strom vor“</td></tr>
          </tbody></table>
        </div>
        <div class="card f-card">
          <h2>Reihenschaltung</h2>
          <p class="caption">Bezugszeiger: <b style="color:var(--c-i)">Strom I</b> (gleich in allen Bauteilen)</p>
          <div class="f-row"><span class="f-big">U = √(U<sub>R</sub>² + (U<sub>L</sub> − U<sub>C</sub>)²)</span></div>
          <div class="f-row"><span class="f-big">Z = √(R² + (X<sub>L</sub> − X<sub>C</sub>)²)</span></div>
          <div class="f-row"><span class="f-big">I = U / Z</span><span>U<sub>R</sub> = I·R, U<sub>L</sub> = I·X<sub>L</sub>, U<sub>C</sub> = I·X<sub>C</sub></span></div>
          <div class="f-row"><span class="f-big">tan φ = (X<sub>L</sub> − X<sub>C</sub>) / R</span><span>cos φ = R / Z = U<sub>R</sub> / U</span></div>
        </div>
        <div class="card f-card">
          <h2>Parallelschaltung</h2>
          <p class="caption">Bezugszeiger: <b style="color:var(--c-u)">Spannung U</b> (gleich an allen Bauteilen)</p>
          <div class="f-row"><span class="f-big">I = √(I<sub>R</sub>² + (I<sub>L</sub> − I<sub>C</sub>)²)</span></div>
          <div class="f-row"><span class="f-big">I<sub>R</sub> = U / R</span><span>I<sub>L</sub> = U / X<sub>L</sub>, I<sub>C</sub> = U / X<sub>C</sub></span></div>
          <div class="f-row"><span class="f-big">Z = U / I</span></div>
          <div class="f-row"><span class="f-big">tan φ = (I<sub>L</sub> − I<sub>C</sub>) / I<sub>R</sub></span><span>cos φ = I<sub>R</sub> / I</span></div>
        </div>
        <div class="card f-card wide">
          <h2>So zeichnest du ein Zeigerdiagramm</h2>
          <ol class="howto">
            <li><b>Bezugszeiger festlegen:</b> Reihe → Strom I, Parallel → Spannung U. Er zeigt waagerecht nach rechts.</li>
            <li><b>Maßstab wählen:</b> z. B. 1 Kästchen ≙ 20 V. Der längste Zeiger sollte gut aufs Blatt passen.</li>
            <li><b>Wirkgröße zeichnen:</b> U<sub>R</sub> bzw. I<sub>R</sub> liegt <b>in Phase</b> zum Bezugszeiger (waagerecht).</li>
            <li><b>Blindgrößen anhängen</b> („Fuß an Spitze“): U<sub>L</sub> senkrecht nach <b>oben</b>, U<sub>C</sub> nach <b>unten</b>. Bei Parallelschaltung: I<sub>L</sub> nach <b>unten</b>, I<sub>C</sub> nach <b>oben</b>.</li>
            <li><b>Gesamtzeiger:</b> vom Ursprung zur letzten Spitze. Länge messen, mit dem Maßstab umrechnen.</li>
            <li><b>Winkel φ</b> zwischen Bezugszeiger und Gesamtzeiger mit dem Geodreieck messen.</li>
          </ol>
        </div>
        <div class="card f-card">
          <h2>Vorsätze</h2>
          <table class="f-table"><tbody>
            <tr><td>k (Kilo)</td><td>10³</td><td>1 kΩ = 1000 Ω</td></tr>
            <tr><td>m (Milli)</td><td>10⁻³</td><td>1 mH = 0,001 H</td></tr>
            <tr><td>µ (Mikro)</td><td>10⁻⁶</td><td>1 µF = 0,000001 F</td></tr>
            <tr><td>n (Nano)</td><td>10⁻⁹</td><td>1 nF = 0,001 µF</td></tr>
          </tbody></table>
        </div>
        <div class="card f-card">
          <h2>Farben in dieser App</h2>
          <div class="legend-list">
            <span><i style="background:var(--c-r)"></i>Widerstand R · U<sub>R</sub> · I<sub>R</sub></span>
            <span><i style="background:var(--c-l)"></i>Spule L · U<sub>L</sub> · I<sub>L</sub></span>
            <span><i style="background:var(--c-c)"></i>Kondensator C · U<sub>C</sub> · I<sub>C</sub></span>
            <span><i style="background:var(--c-u)"></i>Gesamtspannung U</span>
            <span><i style="background:var(--c-i)"></i>Gesamtstrom I</span>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- Start ---------------- */
  renderBasics();
  renderSim();
  renderTasks();
  renderFormulas();
  activate(location.hash.slice(1) || 'basics');
  window.addEventListener('hashchange', () => activate(location.hash.slice(1)));
})();
