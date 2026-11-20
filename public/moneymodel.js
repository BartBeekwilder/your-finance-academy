// The money model, drawn three ways (Bart, 19 Nov 2026): how income,
// spending, repayment, the stock and housing markets move equity.
//   flow   2D: the month streams in, splits, and runs through what you own
//          into equity and debt (canvas);
//   build  3D: what you own is a building, debt the basement, equity beside it;
//   grav   3D: equity is the sun, what feeds it pulls particles in, what
//          drains it pushes them out.
// One plain script for the app (Dashboard › Money model, own books) and the
// homepage (the sun only, example numbers). Exposes window.PFMoneyModel.
//   const mm = PFMoneyModel.create({ stage, THREE, T, money, base, views })
//   mm.setLevers({ inc, sp, mkt, house, months }); mm.setView("grav");
//   mm.onModel((model) => …); mm.destroy();
// `base` (per month and as it stands now): income, fixed (without the
// repayment), repay, variable, cash (money and other assets), invest, home,
// mortgage, otherDebt. `T` holds every text; `money(x)` formats an amount.
(function (root) {
  "use strict";

  function compute(B, S) {
    const k = 1 + S.inc / 100, v = 1 + S.sp / 100, n = S.months;
    const inT = B.income * k, fixT = B.fixed, varT = B.variable * v, repay = B.repay;
    const saved = inT - fixT - repay - varT;
    // Looking back the markets' moves are what really happened (absolute);
    // looking ahead they come from the levers.
    const marketMove = B.marketMove != null ? B.marketMove : B.invest * S.mkt / 100;
    const homeMove = B.homeMove != null ? B.homeMove : B.home * S.house / 100;
    // Other debts one by one (a car loan, a student loan…), else one line.
    const others = B.otherDebts && B.otherDebts.length ? B.otherDebts : B.otherDebt > 0.5 ? [{ label: null, value: B.otherDebt }] : [];
    const sum = (l) => l.reduce((t, d) => t + d.value, 0);
    // Looking back the end is the real balance sheet of today (B.end); ahead
    // it's where the month, repeated, takes you.
    const st = B.end
      ? { cash: B.end.cash, invest: B.end.invest, home: B.end.home, mortgage: B.end.mortgage, otherList: B.end.otherDebts || [], other: sum(B.end.otherDebts || []) }
      : {
        cash: Math.max(B.cash + saved * n, 0),
        invest: B.invest + marketMove,
        home: B.home + homeMove,
        mortgage: Math.max(B.mortgage - repay * n, 0),
        otherList: others,
        other: sum(others),
      };
    const assets = st.cash + st.invest + st.home, debts = st.mortgage + st.other;
    const eqNow = B.cash + B.invest + B.home - B.mortgage - sum(others);
    const parts = [
      { key: "work", v: saved * n, c: "#30d158" },
      { key: "repay", v: B.end ? repay * n : Math.min(repay * n, B.mortgage), c: "#40c8e0" },
      { key: "market", v: marketMove, c: "#b58cff" },
      { key: "housing", v: homeMove, c: "#5b8def" },
    ];
    // Looking back: what the books don't explain by these four (revaluations,
    // a new loan, income still to receive…), so the parts add up to the change.
    if (B.end) parts.push({ key: "other", v: assets - debts - eqNow - parts.reduce((t, p) => t + p.v, 0), c: "#a3a9bb" });
    return {
      inT, fixT, varT, repay, saved, n, marketMove, homeMove, st, assets, debts,
      equity: assets - debts, eqNow, back: !!B.end,
      parts,
    };
  }

  // The stage's own look, once per page (the app and the homepage share it).
  function ensureStyles() {
    if (document.getElementById("mm-styles")) return;
    const s = document.createElement("style"); s.id = "mm-styles";
    s.textContent = [
      ".mm-stage{position:relative;overflow:hidden;touch-action:pan-y;background:radial-gradient(120% 90% at 30% 20%,#10162a 0%,#07080c 60%)}",
      ".mm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
      ".mm-labels{position:absolute;inset:0;pointer-events:none}",
      ".mm-lbl{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;font:11.5px/1.3 system-ui,sans-serif;color:#a3a9bb;text-align:center;text-shadow:0 1px 6px #000}",
      ".mm-lbl b{display:block;color:#eef0f6;font:600 12px ui-monospace,Menlo,monospace}",
      ".mm-lbl-side{transform:translate(-100%,-50%);text-align:right}",
      ".mm-lbl-now{color:#eef0f6;font-weight:600}.mm-lbl-now b{color:#7dffa5;font-size:13px}",
      ".mm-lbl small{display:block;font:500 10.5px system-ui,sans-serif;color:#8a90a6}",
      ".mm-lbl-block{left:0;top:0;text-align:left;font-size:11px;color:#c9cede;will-change:transform}",
      ".mm-tip{position:absolute;max-width:260px;padding:10px 12px;border-radius:12px;background:rgba(12,13,19,.94);border:1px solid #1f2330;box-shadow:0 10px 30px rgba(0,0,0,.5);font:12.5px/1.45 system-ui,sans-serif;color:#a3a9bb;pointer-events:none;z-index:3;display:grid;gap:2px}",
      ".mm-tip strong{color:#eef0f6;font-size:13.5px}",
      ".mm-tip em{font:600 14px ui-monospace,Menlo,monospace;font-style:normal;color:#eef0f6}",
      ".mm-hint{position:absolute;left:14px;bottom:12px;font:11.5px system-ui,sans-serif;color:#6b7186;pointer-events:none}",
    ].join("");
    document.head.appendChild(s);
  }

  function create(opts) {
    ensureStyles();
    const { stage, THREE, T } = opts;
    const money = opts.money;
    const sgn = (x) => (x >= 0 ? "+" : "−") + money(Math.abs(x));
    const reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let B = opts.base, S = { inc: 0, sp: 0, mkt: 0, house: 0, months: 12 }, model = compute(B, S);
    let view = opts.view || "flow", alive = true, raf = 0;
    const listeners = [];

    // ---- stage furniture
    stage.classList.add("mm-stage");
    const fc = document.createElement("canvas"); fc.className = "mm-canvas";
    const gl = document.createElement("canvas"); gl.className = "mm-canvas"; gl.hidden = true;
    const labels = document.createElement("div"); labels.className = "mm-labels";
    const tip = document.createElement("div"); tip.className = "mm-tip"; tip.hidden = true;
    const hint = document.createElement("div"); hint.className = "mm-hint";
    stage.append(fc, gl, labels, tip, hint);
    const fx = fc.getContext("2d");

    function showTip(x, y, title, value, text) {
      tip.innerHTML = "";
      const s = document.createElement("strong"); s.textContent = title; tip.appendChild(s);
      if (value) { const e = document.createElement("em"); e.textContent = value; tip.appendChild(e); }
      if (text) { const p = document.createElement("span"); p.textContent = text; tip.appendChild(p); }
      tip.hidden = false;
      const r = stage.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(Math.max(x + 14, 8), r.width - w - 8) + "px";
      tip.style.top = Math.min(Math.max(y - h - 10, 8), r.height - h - 8) + "px";
    }
    const hideTip = () => { tip.hidden = true; };

    // ================================================================ flow (2D)
    let FW = 0, FH = 0, nodes = [], bands = [], particles = [], hoverBand = null, pSig = "";
    const COLS = [0.03, 0.17, 0.33, 0.55, 0.72, 0.89];
    const narrow = () => FW < 720;
    function sizeFlow() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), r = stage.getBoundingClientRect();
      FW = r.width; FH = r.height; fc.width = FW * dpr; fc.height = FH * dpr; fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function layoutFlow(m) {
      const top = 46, H = FH - top - 34, nw = 12;
      // Monthly flows on one scale, standing balances on another (they differ ~100×).
      const kM = (H * 0.5) / Math.max(m.inT, 1), kS = (H * 0.78) / Math.max(m.assets, 1);
      const N = [], Bd = [];
      const node = (id, col, y, h, color, label, value, info) => { const n = { id, x: FW * COLS[col], y, h: Math.max(h, 2), w: nw, color, label, value, info, inOff: 0, outOff: 0 }; N.push(n); return n; };
      const pm = (x) => T.perMonth.replace("{amount}", money(x));
      let y = top + 10;
      const inc = node("inc", 0, y, m.inT * kM, "#30d158", T.income, pm(m.inT), T.tipIncome);
      const month = node("maand", 1, y, m.inT * kM, "#40c8e0", T.yourMonth, pm(m.inT), T.tipMonth);
      const fixedN = node("vast", 2, y, m.fixT * kM, "#ff8a65", T.fixed, pm(m.fixT), T.tipFixed); y += m.fixT * kM + 10;
      const varN = node("var", 2, y, m.varT * kM, "#ff5a52", T.variable, pm(m.varT), T.tipVariable); y += m.varT * kM + 10;
      const repN = node("afl", 2, y, m.repay * kM, "#40c8e0", T.repayment, pm(m.repay), T.tipRepay); y += m.repay * kM + 10;
      const savN = node("over", 2, y, Math.max(m.saved, 0) * kM, "#30d158", T.leftOver, pm(m.saved), T.tipLeftOver); y += Math.max(m.saved, 0) * kM + 22;
      const mktV = Math.abs(m.marketMove), homeV = Math.abs(m.homeMove);
      const mktN = node("beurs", 2, y, Math.max(mktV * kM * 0.25, 3), m.marketMove >= 0 ? "#b58cff" : "#ff5a52", T.market, sgn(m.marketMove), T.tipMarket); y += Math.max(mktV * kM * 0.25, 3) + 10;
      const homeN = node("markt", 2, y, Math.max(homeV * kM * 0.05, 3), m.homeMove >= 0 ? "#5b8def" : "#ff5a52", T.housing, sgn(m.homeMove), T.tipHousing);
      y = top + 10;
      const cashN = node("geld", 3, y, m.st.cash * kS, "#40c8e0", T.cash, money(m.st.cash), T.tipCash.replace("{n}", m.n)); y += m.st.cash * kS + 8;
      const invN = node("bel", 3, y, m.st.invest * kS, "#b58cff", T.investments, money(m.st.invest), T.tipInvest); y += m.st.invest * kS + 8;
      const homeS = node("huis", 3, y, m.st.home * kS, "#5b8def", T.home, money(m.st.home), T.tipHome);
      const assetsN = node("bezit", 4, top + 10, m.assets * kS, "#a3a9bb", T.assets, money(m.assets), T.tipAssets);
      const eqN = node("ev", 5, top + 10, Math.max(m.equity, 0) * kS, "#30d158", T.equity, money(m.equity), T.tipEquity);
      // Debts one by one: the mortgage first (repayment lands there), then each
      // other debt in its own shade — a little room between them for the names.
      const DEBT = ["#ff8a65", "#ff6b9a", "#ffb74d", "#e05d8f", "#ff9e80"];
      const debtList = [];
      if (m.st.mortgage > 0.5 || m.repay > 0.5) debtList.push({ id: "schuld-hyp", label: T.mortgage, value: m.st.mortgage, color: "#ff5a52", info: T.tipMortgageFlow || T.tipDebts });
      m.st.otherList.forEach((d, i) => { if (d.value > 0.5) debtList.push({ id: "schuld-" + i, label: d.label || T.otherDebt, value: d.value, color: DEBT[i % DEBT.length], info: T.tipOtherDebt }); });
      let dy = top + 10 + Math.max(m.equity, 0) * kS + 10;
      const debtNodes = debtList.map((d) => {
        const n = node(d.id, 5, dy, d.value * kS, d.color, d.label, money(d.value), d.info);
        dy += Math.max(d.value * kS, 2) + (narrow() ? 4 : Math.max(30 - d.value * kS, 6));
        return n;
      });
      const debtN = debtNodes[0];
      const band = (a, b, wa, wb, color, label, value, text, sink) => {
        const b0 = { a, b, y0: a.y + a.outOff, y1: b ? b.y + b.inOff : a.y + a.outOff, w0: wa, w1: wb, color, label, value, text, sink };
        a.outOff += wa; if (b) b.inOff += wb; Bd.push(b0); return b0;
      };
      band(inc, month, inc.h, inc.h, "#30d158", T.income + " → " + T.yourMonth, pm(m.inT), T.tipIncome);
      band(month, fixedN, fixedN.h, fixedN.h, "#ff8a65", T.fixed, pm(m.fixT), T.tipFixed);
      band(month, varN, varN.h, varN.h, "#ff5a52", T.variable, pm(m.varT), T.tipVariable);
      band(month, repN, repN.h, repN.h, "#40c8e0", T.repayment, pm(m.repay), T.tipRepay);
      if (m.saved > 0) band(month, savN, savN.h, savN.h, "#30d158", T.leftOver, pm(m.saved), T.tipLeftOver);
      band(fixedN, null, fixedN.h, fixedN.h * 0.2, "#ff8a65", T.spent, money(m.fixT * m.n), T.tipSpent.replace("{n}", m.n), true);
      band(varN, null, varN.h, varN.h * 0.2, "#ff5a52", T.spent, money(m.varT * m.n), T.tipSpent.replace("{n}", m.n), true);
      if (m.saved > 0) band(savN, cashN, savN.h, Math.max(m.saved * m.n * kS, 2), "#30d158", T.leftOver + " × " + m.n, money(m.saved * m.n), T.tipLeftOver);
      band(mktN, invN, mktN.h, Math.max(mktV * kS, 2), mktN.color, T.market + " → " + T.investments, sgn(m.marketMove), T.tipMarket).still = mktV < 1;
      band(homeN, homeS, homeN.h, Math.max(homeV * kS, 2), homeN.color, T.housing + " → " + T.home, sgn(m.homeMove), T.tipHousing).still = homeV < 1;
      // Repayment doesn't feed the debt, it eats it: its dots fade out as they
      // reach the debt bar, and the bar says by how much it shrinks.
      const rep = band(repN, debtN && debtN.id === "schuld-hyp" ? debtN : null, repN.h, Math.max(m.repay * m.n * kS, 2), "#40c8e0", T.repayment + " × " + m.n, "−" + money(m.repay * m.n), T.tipRepay);
      rep.still = m.repay < 1; rep.reduces = true;
      // What you own and owe are standing balances, not flows: no dots there.
      [cashN, invN, homeS].forEach((n) => { band(n, assetsN, n.h, n.h, n.color, n.label + " → " + T.assets, n.value, n.info).stock = true; });
      band(assetsN, eqN, Math.max(m.equity, 0) * kS, eqN.h, "#30d158", T.assets + " → " + T.equity, money(m.equity), T.tipEquity).stock = true;
      debtNodes.forEach((d) => { band(assetsN, d, d.h, d.h, d.color, T.assets + " → " + d.label, d.value, d.info).stock = true; });
      nodes = N; bands = Bd;
      // Dots only where money really moves: not on spending that leaves the
      // picture, not on a market at 0%, not on standing balances.
      // While a change glides in, the same streams keep their dots (they just
      // follow the bands); only a different set of streams starts them afresh.
      const sig = bands.map((b) => b.a.id + ">" + (b.b ? b.b.id : "") + (b.sink || b.still || b.stock ? "-" : "+")).join(",");
      if (sig === pSig) { for (const p of particles) p.b = bands[p.bi]; return; }
      pSig = sig;
      particles = [];
      bands.forEach((b, bi) => {
        if (b.sink || b.still || b.stock) return;
        const count = Math.min(Math.round(4 + Math.max(b.w0, b.w1) / 3), 40);
        for (let i = 0; i < count; i++) particles.push({ b, bi, t: Math.random(), v: 0.18 + Math.random() * 0.12, o: Math.random() - 0.5 });
      });
    }
    function bez(b, t) {
      const x0 = b.a.x + b.a.w, x1 = b.b ? b.b.x : x0 + FW * 0.09, mx = (x0 + x1) / 2, u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x1;
      const c0 = b.y0 + b.w0 / 2, c1 = b.y1 + b.w1 / 2;
      const y = u * u * u * c0 + 3 * u * u * t * c0 + 3 * u * t * t * c1 + t * t * t * c1;
      return { x, y, w: b.w0 + (b.w1 - b.w0) * (3 * t * t - 2 * t * t * t) };
    }
    function drawFlow() {
      fx.clearRect(0, 0, FW, FH);
      const narrow = FW < 720;
      fx.font = "600 10px system-ui, sans-serif"; fx.fillStyle = "#6b7186"; fx.textAlign = "left";
      fx.fillText(B.capMonth || T.capMonth, FW * 0.03, 26); fx.fillText(B.capAfter || T.capAfter, FW * 0.55, 26); fx.fillText(T.capResult, FW * 0.86, 26);
      for (const b of bands) {
        const steps = 28; fx.beginPath();
        for (let i = 0; i <= steps; i++) { const p = bez(b, i / steps); if (i) fx.lineTo(p.x, p.y - p.w / 2); else fx.moveTo(p.x, p.y - p.w / 2); }
        for (let i = steps; i >= 0; i--) { const p = bez(b, i / steps); fx.lineTo(p.x, p.y + p.w / 2); }
        fx.closePath();
        const g = fx.createLinearGradient(b.a.x, 0, b.b ? b.b.x : b.a.x + FW * 0.1, 0);
        g.addColorStop(0, b.color + (b === hoverBand ? "88" : "44")); g.addColorStop(1, b.color + (b.sink ? "00" : b === hoverBand ? "88" : "33"));
        fx.fillStyle = g; fx.fill();
      }
      if (!reduce) {
        for (const p of particles) {
          p.t += p.v * 0.016; if (p.t > 1) { p.t = 0; p.o = Math.random() - 0.5; }
          const q = bez(p.b, p.t);
          // A repayment dot dissolves into the debt instead of landing on it.
          const fade = p.b.reduces && p.t > 0.7 ? (1 - p.t) / 0.3 : 1;
          fx.globalAlpha = 0.9 * fade;
          fx.fillStyle = p.b.color; fx.beginPath(); fx.arc(q.x, q.y + p.o * q.w * 0.85, 1.5 * (0.4 + 0.6 * fade), 0, 7); fx.fill();
        }
        fx.globalAlpha = 1;
      }
      // Where repayment meets the debt: a "−" with what it takes off.
      for (const b of bands) {
        if (!b.reduces || b.still || !b.b) continue;
        const end = bez(b, 1);
        fx.textAlign = "right"; fx.font = "600 10.5px ui-monospace, Menlo, monospace"; fx.fillStyle = b.color;
        fx.fillText(b.value, end.x - 8, end.y - end.w / 2 - 5);
      }
      for (const n of nodes) {
        fx.fillStyle = n.color; fx.beginPath(); if (fx.roundRect) { fx.roundRect(n.x, n.y, n.w, n.h, 3); } else { fx.rect(n.x, n.y, n.w, n.h); } fx.fill();
        if (narrow && (n.id === "maand" || n.id === "bezit")) continue;
        const right = n.id === "ev" || n.id.startsWith("schuld");
        fx.textAlign = right ? "right" : "left";
        const lx = right ? n.x - 6 : n.x + n.w + 6, ly = n.y + Math.min(n.h / 2, 14) + 4;
        fx.font = `600 ${narrow ? 9.5 : 11}px system-ui, sans-serif`; fx.fillStyle = "#eef0f6"; fx.fillText(n.label, lx, ly);
        if (!narrow) { fx.font = "10.5px ui-monospace, Menlo, monospace"; fx.fillStyle = "#a3a9bb"; fx.fillText(n.value, lx, ly + 13); }
      }
    }
    function flowHit(mx, my) {
      for (const n of nodes) if (mx >= n.x - 3 && mx <= n.x + n.w + 3 && my >= n.y && my <= n.y + n.h) return { n };
      for (let k = bands.length - 1; k >= 0; k--) {
        const b = bands[k], x0 = b.a.x + b.a.w, x1 = b.b ? b.b.x : x0 + FW * 0.09;
        if (mx < x0 || mx > x1) continue;
        let lo = 0, hi = 1; for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (bez(b, mid).x < mx) lo = mid; else hi = mid; }
        const p = bez(b, lo); if (Math.abs(my - p.y) <= Math.max(p.w / 2, 4)) return { b };
      }
      return null;
    }

    // ================================================================ 3D
    let renderer = null, camera = null, ray = null;
    const world = {};
    let yaw = 0.6, pitch = 0.32, dist = 15, drag = null, lastInteract = 0;
    function initGL() {
      if (renderer) return true;
      if (!THREE) return false;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
      } catch {
        return false;
      }
      renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
      ray = new THREE.Raycaster();
      return true;
    }
    function sizeGL() {
      if (!renderer) return; const r = stage.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(r.height, 1); camera.updateProjectionMatrix();
    }
    function lights(s) {
      s.add(new THREE.AmbientLight(0x8890b0, 0.55));
      const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(6, 12, 8); s.add(d);
      const p = new THREE.PointLight(0x40c8e0, 0.8, 40); p.position.set(-8, 4, -6); s.add(p);
    }
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.35, metalness: 0.15 }, o || {}));

    function buildBuilding() {
      const s = new THREE.Scene(); s.fog = new THREE.Fog(0x07080c, 18, 46); lights(s);
      s.add(new THREE.GridHelper(30, 30, 0x1f2a44, 0x141a2a));
      const floors = {}, debt = {};
      [["huis", 0x5b8def, T.home], ["bel", 0xb58cff, T.investments], ["geld", 0x40c8e0, T.cash]].forEach(([k, c, l]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), mat(c)); m.userData = { key: k, label: l, h: 0.1 }; s.add(m); floors[k] = m;
      });
      [["hyp", 0xff5a52, T.mortgage], ["duo", 0xff8a65, T.otherDebt]].forEach(([k, c, l]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), mat(c, { transparent: true, opacity: 0.55 })); m.userData = { key: k, label: l, h: 0.1 }; s.add(m); debt[k] = m;
      });
      const eq = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), mat(0x30d158, { emissive: 0x0e4a1e, transparent: true, opacity: 0.9 }));
      eq.position.x = 3.2; eq.userData = { key: "ev", label: T.equity, h: 0.1 }; s.add(eq);
      const pool = [];
      for (let i = 0; i < 26; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat(0x30d158, { emissive: 0x0b3a16 })); c.visible = false; s.add(c); pool.push({ m: c, live: false }); }
      return { s, floors, debt, eq, pool, spawn: 0, roof: 0, scale: 7 / Math.max(model.assets, model.debts, 1) };
    }
    function updateBuilding(w, m, dt) {
      // One linear scale (honest): the home dominates, the rest are thin floors.
      const k = w.scale, min = 0.08, ease = 1 - Math.pow(0.001, dt);
      const target = { huis: m.st.home * k, bel: m.st.invest * k, geld: m.st.cash * k, hyp: m.st.mortgage * k, duo: m.st.other * k, ev: Math.max(m.equity, 0) * k };
      const value = { huis: m.st.home, bel: m.st.invest, geld: m.st.cash, hyp: m.st.mortgage, duo: m.st.other };
      let y = 0;
      for (const key of ["huis", "bel", "geld"]) { const f = w.floors[key]; f.userData.h += (Math.max(target[key], min) - f.userData.h) * ease; f.scale.y = f.userData.h; f.position.y = y + f.userData.h / 2; y += f.userData.h + 0.04; f.userData.value = value[key]; f.visible = value[key] > 0.5; }
      w.roof = y;
      let d = 0;
      for (const key of ["hyp", "duo"]) { const f = w.debt[key]; f.userData.h += (Math.max(target[key], min) - f.userData.h) * ease; f.scale.y = f.userData.h; f.position.y = -(d + f.userData.h / 2) - 0.04; d += f.userData.h + 0.04; f.userData.value = value[key]; f.visible = value[key] > 0.5; }
      w.eq.userData.h += (Math.max(target.ev, min) - w.eq.userData.h) * ease; w.eq.scale.y = w.eq.userData.h; w.eq.position.y = w.eq.userData.h / 2; w.eq.userData.value = m.equity;
      // What you keep falls onto the roof; spending lifts off it.
      if (reduce) return;
      w.spawn -= dt;
      if (w.spawn <= 0) {
        w.spawn = 0.18;
        const keep = Math.random() < (Math.max(m.saved, 0) / Math.max(m.inT, 1)) * 2.2;
        const free = w.pool.find((p) => !p.live);
        if (free) {
          free.live = true; free.keep = keep; free.m.visible = true;
          free.m.material.color.setHex(keep ? 0x30d158 : 0xff5a52); free.m.material.emissive.setHex(keep ? 0x0b3a16 : 0x3a0b0b);
          free.m.position.set((Math.random() - 0.5) * 2.4, keep ? w.roof + 5 : w.roof + 0.1, (Math.random() - 0.5) * 2.4); free.vy = keep ? -2 : 2.4;
        }
      }
      for (const p of w.pool) if (p.live) {
        p.vy += (p.keep ? -9 : 1.5) * dt; p.m.position.y += p.vy * dt; p.m.rotation.x += dt * 2; p.m.rotation.y += dt;
        if ((p.keep && p.m.position.y <= w.roof + 0.11) || (!p.keep && p.m.position.y > w.roof + 6)) { p.live = false; p.m.visible = false; }
      }
    }

    function buildGravity() {
      const s = new THREE.Scene(); lights(s);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat(0xffc94a, { emissive: 0x7a5200, roughness: 0.6 }));
      sun.userData = { key: "ev", label: T.equity }; s.add(sun);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.12 })); s.add(glow);
      const sg = new THREE.BufferGeometry(), sp = [];
      for (let i = 0; i < 600; i++) { const r = 40 + Math.random() * 30, a = Math.random() * 6.28, b = Math.acos(2 * Math.random() - 1); sp.push(r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)); }
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8890b0, size: 0.12 })));
      const P = [
        ["inkomen", T.income, 0x30d158, 4.2, 0.0, 1],
        ["uitgaven", T.spending, 0xff5a52, 5.0, 1.3, -1],
        ["aflossing", T.repayment, 0x40c8e0, 5.8, 2.4, 1],
        ["bel", T.investments, 0xb58cff, 6.8, 3.4, 1],
        ["huis", T.home, 0x5b8def, 8.0, 4.5, 1],
        ["schuld", T.debts, 0xff5a52, 9.0, 5.6, -1],
      ].map(([key, label, c, r, a0, dir]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat(c, { emissive: new THREE.Color(c).multiplyScalar(0.25) }));
        m.userData = { key, label, size: 0.3 }; s.add(m);
        const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.01, r + 0.01, 96), new THREE.MeshBasicMaterial({ color: 0x2a3150, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        ring.rotation.x = Math.PI / 2; s.add(ring);
        const n = 40, g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: c, size: 0.09, transparent: true, opacity: 0.9 })); s.add(pts);
        return { m, r, a: a0, dir, pts, phase: Array.from({ length: n }, () => Math.random()), speed: 0.1 / Math.sqrt(r) };
      });
      return { s, sun, glow, P };
    }
    function updateGravity(w, m, dt) {
      const ease = 1 - Math.pow(0.001, dt);
      const vals = { inkomen: m.inT * m.n, uitgaven: (m.fixT + m.varT) * m.n, aflossing: m.repay * m.n, bel: m.st.invest, huis: m.st.home, schuld: m.debts };
      const size = (v) => 0.25 + Math.cbrt(Math.max(v, 0)) / 90;
      const sunT = 0.6 + Math.cbrt(Math.max(m.equity, 0)) / 60;
      w.sun.userData.s = w.sun.userData.s == null ? sunT : w.sun.userData.s + (sunT - w.sun.userData.s) * ease;
      w.sun.scale.setScalar(w.sun.userData.s);
      w.glow.scale.setScalar(w.sun.userData.s * (1 + (reduce ? 0 : Math.sin(performance.now() / 700) * 0.04)));
      w.sun.userData.value = m.equity;
      for (const p of w.P) {
        const key = p.m.userData.key, v = vals[key];
        p.m.visible = p.pts.visible = v > 0.5;
        p.m.userData.size += (size(v) - p.m.userData.size) * ease; p.m.scale.setScalar(p.m.userData.size); p.m.userData.value = v;
        if (!reduce) p.a += p.speed * dt;
        p.m.position.set(Math.cos(p.a) * p.r, Math.sin(p.a * 2) * 0.25, Math.sin(p.a) * p.r);
        // Particles stream inwards (feeds equity) or outwards (drains it).
        const pos = p.pts.geometry.attributes.position, flow = Math.min(0.25 + v / 400000, 1.2);
        for (let i = 0; i < p.phase.length; i++) {
          if (!reduce) p.phase[i] = (p.phase[i] + dt * 0.35 * flow) % 1;
          const f = p.dir > 0 ? 1 - p.phase[i] : p.phase[i];
          const rr = w.sun.userData.s + (p.r - w.sun.userData.s) * f, wob = Math.sin(i * 12.9 + p.phase[i] * 6) * 0.12;
          pos.setXYZ(i, Math.cos(p.a + wob * 0.2) * rr, Math.sin(p.a * 2) * 0.25 * f + wob, Math.sin(p.a + wob * 0.2) * rr);
        }
        pos.needsUpdate = true; p.pts.material.opacity = 0.3 + Math.min(flow, 1) * 0.6;
      }
    }
    // ============================================================ time machine
    // A tower per year along a timeline: equity built from blocks by where it
    // came from (where you started, work, repayment, the stock market, the
    // housing market, other), every year adding to the last; losses cut a red
    // slice off the top; the debts are a basement under each tower. A year
    // picked (or played) grows into place and the camera glides to it.
    const SP = 3.2;
    let years = [], yearAt = 0;
    const SRC = [
      ["start", 0x8a90a6, () => T.tmStart],
      ["work", 0x30d158, () => T.tmWork],
      ["repay", 0x40c8e0, () => T.tmRepay],
      ["market", 0xb58cff, () => T.tmMarket],
      ["housing", 0x5b8def, () => T.tmHousing],
      ["other", 0xa3a9bb, () => T.tmOther],
    ];
    function buildTime() {
      const s = new THREE.Scene(); s.fog = new THREE.Fog(0x07080c, 26, 70); lights(s);
      const grid = new THREE.GridHelper(120, 120, 0x1f2a44, 0x141a2a); s.add(grid);
      return { s, grid, towers: [], key: "", camX: 0 };
    }
    function syncTime(w) {
      const key = years.map((y) => y.year).join(",");
      if (w.key === key) return;
      w.key = key;
      w.towers.forEach((t) => w.s.remove(t.g));
      // Cumulative per source up to and including each year.
      const cum = { start: years.length ? years[0].start : 0, work: 0, repay: 0, market: 0, housing: 0, other: 0 };
      w.towers = years.map((y, i) => {
        for (const k of ["work", "repay", "market", "housing", "other"]) cum[k] += y.parts[k] || 0;
        const g = new THREE.Group(); g.position.x = i * SP; w.s.add(g);
        const blocks = SRC.map(([k, c, l]) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1, 1.7), mat(c));
          m.userData = { key: "tm", src: k, label: l(), h: 0.001, year: y.year, value: cum[k], add: k === "start" ? null : y.parts[k] || 0 };
          m.visible = false; g.add(m); return m;
        });
        const cut = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1, 1.78), mat(0xff5a52, { transparent: true, opacity: 0.42, emissive: 0x3a0b0b }));
        cut.userData = { key: "tm", src: "loss", label: T.tmLoss, h: 0.001, year: y.year }; cut.visible = false; g.add(cut);
        const debt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1, 1.7), mat(0xff5a52, { transparent: true, opacity: 0.14, depthWrite: false }));
        debt.userData = { key: "tm", src: "debt", label: T.debts, h: 0.001, year: y.year, value: y.debts }; debt.visible = false; g.add(debt);
        return { g, blocks, cut, debt, grow: 0, y, cum: Object.assign({}, cum) };
      });
    }
    function updateTime(w, dt) {
      syncTime(w);
      const ease = 1 - Math.pow(0.0008, dt);
      let max = 1;
      for (const t of w.towers) {
        const pos = Object.values(t.cum).reduce((a, v) => a + Math.max(v, 0), 0);
        max = Math.max(max, pos, t.y.debts);
      }
      const k = 7 / max, GAP = 0.03;
      w.towers.forEach((t, i) => {
        // Years up to the one picked stand; later ones wait, flat.
        t.grow += ((i <= yearAt ? 1 : 0) - t.grow) * ease;
        const on = i === yearAt;
        let y = 0, neg = 0;
        const negNames = [];
        t.blocks.forEach((b) => {
          const v = t.cum[b.userData.src];
          if (v < 0) { neg += -v; negNames.push(b.userData.label); }
          const h = Math.max(v, 0) * k * t.grow;
          b.userData.h += (h - b.userData.h) * ease;
          b.visible = b.userData.h > 0.01;
          if (!b.visible) return;
          // A hair of space between blocks: no two faces share a plane (that
          // is what made the seams and the top shimmer).
          b.scale.y = b.userData.h; b.position.y = y + b.userData.h / 2; y += b.userData.h + GAP;
          if (b.material.emissive && !b.userData.em) { b.material.emissive.setHex(b.material.color.getHex()); b.userData.em = 1; }
          b.material.emissiveIntensity += ((on ? 0.32 : 0.06) - b.material.emissiveIntensity) * ease;
        });
        y = Math.max(y - GAP, 0);
        const ch = Math.min(neg * k * t.grow, y);
        t.cut.userData.h += (ch - t.cut.userData.h) * ease;
        // The loss slice sits just proud of the stack, never in the same plane.
        t.cut.visible = t.cut.userData.h > 0.01; t.cut.scale.y = Math.max(t.cut.userData.h, 0.001) + 0.02; t.cut.position.y = y - t.cut.userData.h / 2 + 0.01;
        t.cut.userData.value = -neg;
        // The red slice is named after what made it: e.g. "From the stock market".
        t.cut.userData.label = negNames.join(" · ") || T.tmLoss;
        const dh = t.y.debts * k * t.grow;
        t.debt.userData.h += (dh - t.debt.userData.h) * ease;
        t.debt.visible = t.debt.userData.h > 0.01; t.debt.scale.y = Math.max(t.debt.userData.h, 0.001); t.debt.position.y = -t.debt.userData.h / 2 - 0.06;
        t.top = y;
      });
      w.camX += (yearAt * SP - w.camX) * (1 - Math.pow(0.02, dt));
    }
    // Labels are made once and moved each frame (rebuilding them every frame
    // made the text flicker): the year (and, for the year in view, its equity)
    // on top of each tower, and beside the tower in view one label per block —
    // what it is, how much it is up to that year, and what that year added.
    const tmLbl = { years: [], blocks: [] };
    function lbl(pool, i, cls) {
      let d = pool[i];
      if (!d) { d = document.createElement("div"); d.style.left = "0"; d.style.top = "0"; d.appendChild(document.createTextNode("")); d.appendChild(document.createElement("b")); const s2 = document.createElement("small"); d.appendChild(s2); pool[i] = d; }
      d.className = cls;
      if (d.parentNode !== labels) labels.appendChild(d);
      return d;
    }
    function setLbl(d, title, value, sub) {
      if (d.firstChild.nodeValue !== title) d.firstChild.nodeValue = title;
      if (d.children[0].textContent !== value) d.children[0].textContent = value;
      if (d.children[1].textContent !== (sub || "")) d.children[1].textContent = sub || "";
      d.children[1].hidden = !sub;
    }
    function timeLabels(w) {
      const r = stage.getBoundingClientRect();
      const at = (x, y) => { const v = new THREE.Vector3(x, y, 0).project(camera); return v.z > 1 ? null : { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height }; };
      let n = 0;
      w.towers.forEach((t, i) => {
        if (t.grow < 0.25) return;
        const p = at(i * SP, (t.top || 0) + 0.4); if (!p) return;
        const d = lbl(tmLbl.years, n++, "mm-lbl" + (i === yearAt ? " mm-lbl-now" : ""));
        setLbl(d, String(t.y.year), i === yearAt ? money(t.y.equity) : "", "");
        if (i !== yearAt) d.children[0].hidden = true; else d.children[0].hidden = false;
        d.style.transform = "translate(" + p.x + "px," + p.y + "px) translate(-50%,-100%)";
      });
      for (let j = n; j < tmLbl.years.length; j++) tmLbl.years[j].remove();
      // Beside the tower in view: its blocks, nudged apart so none overlap.
      const t = w.towers[yearAt]; let m = 0;
      if (t && t.grow > 0.6) {
        const rows = [];
        for (const b of [...t.blocks, t.cut, t.debt]) {
          if (!b.visible || b.userData.h < 0.04) continue;
          const p = at(yearAt * SP + 1.05, b.position.y); if (!p) continue;
          const add = b.userData.add;
          rows.push({ p, title: b.userData.label, value: b.userData.src === "loss" ? sgn(b.userData.value || 0) : money(b.userData.value || 0), sub: b.userData.src === "loss" ? T.tmLossNote : add != null && Math.abs(add) >= 0.5 ? T.tmInYear.replace("{year}", t.y.year).replace("{amount}", sgn(add)) : "" });
        }
        rows.sort((a, b) => a.p.y - b.p.y);
        // Room for each label (two or three lines), pushed down where they'd touch.
        const room = (row) => (row.sub ? 46 : 32);
        for (let q = 1; q < rows.length; q++) { const need = (room(rows[q - 1]) + room(rows[q])) / 2 + 4; if (rows[q].p.y - rows[q - 1].p.y < need) rows[q].p.y = rows[q - 1].p.y + need; }
        for (const row of rows) {
          const d = lbl(tmLbl.blocks, m++, "mm-lbl mm-lbl-block");
          setLbl(d, row.title, row.value, row.sub);
          d.style.transform = "translate(" + row.p.x + "px," + row.p.y + "px) translate(0,-50%)";
        }
      }
      for (let j = m; j < tmLbl.blocks.length; j++) tmLbl.blocks[j].remove();
    }

    const INFO = () => ({
      huis: T.tipHome, bel: T.tipInvest, geld: T.tipCash.replace("{n}", model.n), hyp: T.tipMortgage, duo: T.tipOtherDebt, ev: T.tipEquity,
      inkomen: T.tipIncomePull, uitgaven: T.tipSpendingPush, aflossing: T.tipRepayPull, schuld: T.tipDebtsPush,
    });
    function pickables() {
      if (view === "time") { const w = world.time; return w.towers.flatMap((t) => [...t.blocks, t.cut, t.debt]).filter((o) => o.visible); }
      if (view === "build") { const w = world.build; return [...Object.values(w.floors), ...Object.values(w.debt), w.eq].filter((o) => o.visible); }
      const w = world.grav; return [w.sun, ...w.P.map((p) => p.m)].filter((o) => o.visible);
    }
    function placeLabels(objs) {
      labels.textContent = "";
      const r = stage.getBoundingClientRect();
      // The building's floors are labelled beside it, nudged apart so none overlap.
      const placed = objs.map((o) => {
        const v = o.position.clone(), side = view === "build" && o.userData.key !== "ev";
        if (side) v.x -= 1.8; else v.y += (o.userData.h != null ? o.userData.h : o.userData.size != null ? o.userData.size : o.scale.y) / 2 + (view === "grav" ? 0.35 : 0.25);
        v.project(camera);
        return { o, side, x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, z: v.z };
      }).filter((p) => p.z <= 1);
      const side = placed.filter((p) => p.side).sort((a, b) => a.y - b.y);
      for (let i = 1; i < side.length; i++) if (side[i].y - side[i - 1].y < 32) side[i].y = side[i - 1].y + 32;
      for (const p of placed) {
        const d = document.createElement("div"); d.className = "mm-lbl" + (p.side ? " mm-lbl-side" : "");
        d.style.left = p.x + "px"; d.style.top = p.y + "px";
        d.textContent = p.o.userData.label;
        const b = document.createElement("b"); b.textContent = money(p.o.userData.value || 0); d.appendChild(b);
        labels.appendChild(d);
      }
    }

    // ================================================================ wiring
    function setView(v) {
      if (v !== "flow" && !initGL()) v = "flow";
      view = v;
      fc.hidden = v !== "flow"; gl.hidden = v === "flow"; labels.textContent = ""; hideTip();
      if (v === "build" && !world.build) world.build = buildBuilding();
      if (v === "grav" && !world.grav) world.grav = buildGravity();
      if (v === "time" && !world.time) world.time = buildTime();
      if (v === "time") { yaw = 0.62; pitch = 0.32; dist = opts.compact ? 22 : 19; }
      if (v === "build") { yaw = 0.7; pitch = 0.22; dist = 25; }
      if (v === "grav") { yaw = 0.4; pitch = 0.55; dist = opts.compact ? 25 : 22; }
      hint.textContent = v === "flow" ? T.hintFlow : T.hint3d;
      resize();
      return v;
    }
    function resize() { sizeFlow(); if (view === "flow") layoutFlow(model); sizeGL(); }
    // Every change glides: the model's numbers travel from where they were to
    // where they're going (bars grow and shrink, streams widen, amounts count),
    // never a jump. A lever being dragged just follows the hand.
    let tween = null;
    function update(instant) {
      const to = compute(B, S);
      if (reduce || instant || !model) { model = to; tween = null; if (view === "flow") layoutFlow(model); listeners.forEach((f) => f(model)); return; }
      tween = { from: model, to, start: performance.now(), dur: 820 };
    }
    // Ease out with a whisper of overshoot, like a spring settling.
    const spring = (t) => (t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
    function lerp(a, b, k) {
      if (typeof b === "number") return (typeof a === "number" ? a : 0) + (b - (typeof a === "number" ? a : 0)) * k;
      if (Array.isArray(b)) return b.map((x, i) => {
        const match = Array.isArray(a) ? (x && x.key != null ? a.find((y) => y && y.key === x.key) : x && x.label !== undefined ? a.find((y) => y && y.label === x.label) : a[i]) : undefined;
        return lerp(match, x, k);
      });
      if (b && typeof b === "object") { const o = {}; for (const key in b) o[key] = lerp(a ? a[key] : undefined, b[key], k); return o; }
      return b;
    }
    function stepTween(now) {
      if (!tween) return;
      const t = Math.min((now - tween.start) / tween.dur, 1);
      model = t >= 1 ? tween.to : lerp(tween.from, tween.to, spring(t));
      if (t >= 1) tween = null;
      if (view === "flow") layoutFlow(model);
      listeners.forEach((f) => f(model));
    }
    const ro = new ResizeObserver(resize); ro.observe(stage);

    const onDown = (e) => { if (view !== "flow") { drag = { x: e.clientX, y: e.clientY }; try { stage.setPointerCapture(e.pointerId); } catch { /* not every browser */ } } };
    const onUp = () => { drag = null; lastInteract = performance.now(); };
    const onLeave = () => { hoverBand = null; hideTip(); };
    const onMove = (e) => {
      const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) { yaw -= (e.clientX - drag.x) * 0.006; pitch = Math.min(Math.max(pitch + (e.clientY - drag.y) * 0.004, -0.2), 1.3); drag = { x: e.clientX, y: e.clientY }; lastInteract = performance.now(); hideTip(); return; }
      if (view === "flow") {
        const h = flowHit(mx, my); hoverBand = h && h.b ? h.b : null;
        if (h && h.n) showTip(mx, my, h.n.label, h.n.value, h.n.info);
        else if (h && h.b) showTip(mx, my, h.b.label, h.b.value, h.b.text);
        else hideTip();
        return;
      }
      if (!renderer) return;
      ray.setFromCamera({ x: (mx / r.width) * 2 - 1, y: -(my / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObjects(pickables())[0];
      if (hit && view === "time") {
        const u = hit.object.userData;
        const add = u.add != null ? T.tmInYear.replace("{year}", u.year).replace("{amount}", sgn(u.add)) : "";
        const note = u.src === "loss" ? T.tmLossNote : u.src === "debt" || u.src === "start" ? "" : T.tmSoFar;
        showTip(mx, my, u.year + " · " + u.label, u.src === "loss" ? sgn(u.value || 0) : money(u.value || 0), [note, add].filter(Boolean).join(" "));
      } else if (hit) { const u = hit.object.userData; showTip(mx, my, u.label, money(u.value || 0), INFO()[u.key] || ""); } else hideTip();
    };
    const onWheel = (e) => { if (view === "flow" || opts.noZoom) return; e.preventDefault(); dist = Math.min(Math.max(dist + e.deltaY * 0.01, 8), 40); };
    stage.addEventListener("pointerdown", onDown); stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointerleave", onLeave); stage.addEventListener("pointermove", onMove);
    stage.addEventListener("wheel", onWheel, { passive: false });

    let last = performance.now();
    function frame(now) {
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      stepTween(now);
      if (view === "flow") drawFlow();
      else if (renderer) {
        const w = view === "build" ? world.build : view === "time" ? world.time : world.grav;
        // The time machine holds still (it moves along the years); the others turn slowly.
        if (!reduce && !drag && view !== "time" && now - lastInteract > 2500) yaw += dt * 0.12;
        const tx = view === "build" ? 1.2 : view === "time" ? w.camX : 0, ty = view === "build" ? 1.4 : view === "time" ? 2.6 : 0;
        camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
        camera.lookAt(tx, ty, 0);
        if (view === "build") updateBuilding(w, model, dt); else if (view === "time") updateTime(w, reduce ? 1 : dt); else updateGravity(w, model, dt);
        renderer.render(w.s, camera);
        if (view === "time") timeLabels(w); else placeLabels(pickables());
      }
      raf = requestAnimationFrame(frame);
    }

    view = setView(view);
    update(true);
    raf = requestAnimationFrame(frame);

    return {
      setLevers(next) { S = Object.assign({}, S, next); update(); },
      setBase(next) { B = next; if (world.build) world.build.scale = 7 / Math.max(compute(B, S).assets, compute(B, S).debts, 1); update(); },
      setView(v) { const got = setView(v); update(true); return got; },
      // The time machine: the years (oldest first) and the one to show.
      setYears(list) { years = list || []; yearAt = Math.min(yearAt, Math.max(years.length - 1, 0)); },
      setYear(i) { yearAt = Math.max(0, Math.min(i, years.length - 1)); },
      onModel(f) { listeners.push(f); f(model); return () => listeners.splice(listeners.indexOf(f), 1); },
      destroy() {
        alive = false; cancelAnimationFrame(raf); ro.disconnect();
        stage.removeEventListener("pointerdown", onDown); stage.removeEventListener("pointerup", onUp);
        stage.removeEventListener("pointerleave", onLeave); stage.removeEventListener("pointermove", onMove); stage.removeEventListener("wheel", onWheel);
        if (renderer) renderer.dispose();
        [fc, gl, labels, tip, hint].forEach((el) => el.remove());
      },
    };
  }

  root.PFMoneyModel = { create, compute };
})(window);
