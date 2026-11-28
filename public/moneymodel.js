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
      extra: B.extraRepay > 0.5 ? B.extraRepay : 0, extraTo: B.extraTo || null,
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
      ".mm-lbl-ahead{font-style:italic;color:#8a90a6}",
      ".mm-lbl-block{left:0;top:0;text-align:left;font-size:11px;color:#c9cede;will-change:transform}",
      ".mm-tip{position:absolute;max-width:260px;padding:10px 12px;border-radius:12px;background:rgba(12,13,19,.94);border:1px solid #1f2330;box-shadow:0 10px 30px rgba(0,0,0,.5);font:12.5px/1.45 system-ui,sans-serif;color:#a3a9bb;pointer-events:none;z-index:3;display:grid;gap:2px}",
      ".mm-tip strong{color:#eef0f6;font-size:13.5px}",
      // [hidden] must win over the display above (24 Nov: the popover stayed over an open planet).
      ".mm-stage [hidden]{display:none!important}",
      ".mm-tip em{font:600 14px ui-monospace,Menlo,monospace;font-style:normal;color:#eef0f6}",
      ".mm-layer{position:absolute;transform:translateY(-50%);display:grid;grid-template-columns:10px auto;column-gap:8px;align-items:baseline;white-space:nowrap;font:12px/1.3 system-ui,sans-serif;color:#a3a9bb;text-shadow:0 1px 6px #000}",
      ".mm-layer i{width:10px;height:10px;border-radius:3px;align-self:center}",
      ".mm-layer b{color:#eef0f6;font:600 12.5px ui-monospace,Menlo,monospace}",
      ".mm-layer em{grid-column:2;font-style:normal;color:#6b7186;font-size:11px}",
      ".mm-layer-line{position:absolute;height:1px;background:rgba(255,255,255,.22);transform-origin:0 50%;pointer-events:none}",
      ".mm-focus-title{position:absolute;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;font:600 14px system-ui,sans-serif;color:#eef0f6;text-shadow:0 1px 8px #000}",
      ".mm-focus-title b{display:block;font:700 16px ui-monospace,Menlo,monospace}",
      ".mm-back{position:absolute;left:14px;top:14px;z-index:4;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(12,13,19,.8);color:#eef0f6;font:600 12.5px system-ui,sans-serif;cursor:pointer;animation:mm-fade .3s ease both}",
      "@keyframes mm-in{from{opacity:0;transform:translateY(-50%) translateX(-8px)}}",
      "@keyframes mm-fade{from{opacity:0}}",
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
    const back = document.createElement("button"); back.type = "button"; back.className = "mm-back"; back.hidden = true;
    back.textContent = "← " + (T.back || "Back");
    stage.append(fc, gl, labels, tip, hint, back);
    const fx = fc.getContext("2d");

    function showTip(x, y, title, value, text) {
      // A planet open (or opening): its parts speak, no popover over them (Bart, 24 Nov).
      if (focus || focusAmt > 0.05) { tip.hidden = true; return; }
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
      // The markets get what room the column has left: over a whole year a
      // market move dwarfs an average month and ran off the stage (20 Nov).
      let mktH = mktV * kM * 0.25, homeH = homeV * kM * 0.05;
      const room = top + 10 + H - y - 10 - 26;
      if (mktH + homeH > room) { const f = Math.max(room, 6) / (mktH + homeH); mktH *= f; homeH *= f; }
      mktH = Math.max(mktH, 3); homeH = Math.max(homeH, 3);
      const mktN = node("beurs", 2, y, mktH, m.marketMove >= 0 ? "#b58cff" : "#ff5a52", T.market, sgn(m.marketMove), T.tipMarket); y += mktH + 10;
      const homeN = node("markt", 2, y, homeH, m.homeMove >= 0 ? "#5b8def" : "#ff5a52", T.housing, sgn(m.homeMove), T.tipHousing);
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
      // A repayment booked this month on top of the plan (B.extraRepay): a
      // thin purple stream from your money into the debt it pays off.
      if (m.extra > 0 && debtNodes.length) {
        const to = debtNodes.find((d) => (m.extraTo === "mortgage" ? d.id === "schuld-hyp" : d.label === m.extraTo)) || debtNodes[0];
        const w = Math.max(m.extra * kS, 2);
        const ex = band(cashN, to, w, w, "#bf5af2", T.extraRepay || "Extra repayment", "−" + money(m.extra), T.tipExtraRepay || "");
        ex.reduces = true; ex.mid = true; // its "−" halfway the stream: the plan's sits at the debt
      }
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
      // Text boxes already on the canvas: labels keep clear of them (28 Nov:
      // "Geld & overig" ran into "Eigen vermogen", the small debts at the
      // bottom into each other).
      const placed = [];
      const hits = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
      // Where repayment meets the debt: a "−" with what it takes off.
      for (const b of bands) {
        if (!b.reduces || b.still || !b.b) continue;
        const end = bez(b, b.mid ? 0.55 : 1);
        fx.textAlign = b.mid ? "center" : "right"; fx.font = "600 10.5px ui-monospace, Menlo, monospace"; fx.fillStyle = b.color;
        const tx = b.mid ? end.x : end.x - 8, ty = end.y - end.w / 2 - 5, tw = fx.measureText(b.value).width;
        fx.fillText(b.value, tx, ty);
        placed.push({ x0: b.mid ? tx - tw / 2 : tx - tw, x1: b.mid ? tx + tw / 2 : tx, y0: ty - 10, y1: ty + 2 });
      }
      const items = [];
      for (const n of nodes) {
        fx.fillStyle = n.color; fx.beginPath(); if (fx.roundRect) { fx.roundRect(n.x, n.y, n.w, n.h, 3); } else { fx.rect(n.x, n.y, n.w, n.h); } fx.fill();
        if (narrow && (n.id === "maand" || n.id === "bezit")) continue;
        const right = n.id === "ev" || n.id.startsWith("schuld");
        items.push({ n, right, x: right ? n.x - 6 : n.x + n.w + 6, y: n.y + Math.min(n.h / 2, 14) + 4 });
      }
      // One column of labels at a time: top to bottom, each at least a label's
      // height below the one above; what runs off the bottom moves back up.
      const lh = narrow ? 11 : 25, bottom = FH - 4 - (narrow ? 0 : 13);
      const cols = new Map();
      for (const it of items) { const k = (it.right ? "r" : "l") + Math.round(it.x); if (!cols.has(k)) cols.set(k, []); cols.get(k).push(it); }
      for (const col of cols.values()) {
        col.sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + lh);
        if (col.length && col[col.length - 1].y > bottom) {
          col[col.length - 1].y = bottom;
          for (let i = col.length - 2; i >= 0; i--) col[i].y = Math.min(col[i].y, col[i + 1].y - lh);
        }
      }
      // The results column (equity, debts) first; a label from the column
      // before it that would run into one is shortened with "…", or left out.
      items.sort((a, b) => (a.right === b.right ? 0 : a.right ? -1 : 1));
      const fit = (text, max) => {
        if (fx.measureText(text).width <= max) return text;
        let t = text;
        while (t.length > 1 && fx.measureText(t + "…").width > max) t = t.slice(0, -1);
        return t.length > 2 ? t + "…" : null;
      };
      for (const it of items) {
        const { n, right, x, y } = it;
        const lf = `600 ${narrow ? 9.5 : 11}px system-ui, sans-serif`, vf = "10.5px ui-monospace, Menlo, monospace";
        fx.font = lf; const lw = fx.measureText(n.label).width;
        fx.font = vf; const vw = narrow ? 0 : fx.measureText(n.value).width;
        const w = Math.max(lw, vw), y0 = y - 10, y1 = y + (narrow ? 2 : 15);
        let label = n.label, value = narrow ? null : n.value;
        if (!right) {
          // Room to the right until the first box it would touch.
          const limit = placed.filter((q) => q.x1 > x && y0 < q.y1 && y1 > q.y0).reduce((m, q) => Math.min(m, q.x0 - 4), Infinity);
          if (limit < x + w) {
            fx.font = lf; label = fit(n.label, limit - x);
            fx.font = vf; value = value && fit(n.value, limit - x);
            if (!label) continue;
          }
        } else if (hits({ x0: x - w, x1: x, y0, y1 })) {
          // Still touching after the column was spread (an amount over it): shift down a line.
          it.y += lh / 2;
        }
        const ly = it.y;
        fx.textAlign = right ? "right" : "left";
        fx.font = lf; fx.fillStyle = "#eef0f6"; fx.fillText(label, x, ly);
        if (value) { fx.font = vf; fx.fillStyle = "#a3a9bb"; fx.fillText(value, x, ly + 13); }
        const ww = Math.max(fx.measureText(label).width, value ? vw : 0);
        placed.push({ x0: right ? x - ww : x, x1: right ? x : x + ww, y0: ly - 10, y1: ly + (value ? 15 : 2) });
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
        return { m, r, r0: r, ring, a: a0, dir, pts, phase: Array.from({ length: n }, () => Math.random()), speed: 0.1 / Math.sqrt(r) };
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
      // Orbits make room for their planets (big ones overlapped their
      // neighbours, 20 Nov): each lies at least both radii plus a gap out.
      let inner = w.sun.userData.s * 1.3;
      for (const p of w.P) {
        const sz = size(vals[p.m.userData.key]);
        const want = Math.max(p.r0, inner + sz + 0.35);
        p.r += (want - p.r) * ease;
        p.ring.scale.setScalar(p.r / p.r0);
        inner = p.r + sz;
      }
      for (const p of w.P) {
        const key = p.m.userData.key, v = vals[key];
        // An opened planet stands alone: the rest of the system steps away.
        p.m.visible = p.pts.visible = v > 0.5 && !(focus && (focus.obj === p.m ? focusAmt > 0.35 : focusAmt > 0.5));
        p.m.userData.size += (size(v) - p.m.userData.size) * ease; p.m.scale.setScalar(p.m.userData.size); p.m.userData.value = v;
        if (!reduce && !focus) p.a += p.speed * dt;
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
    // A tower per year along a timeline, two ways to read it:
    //   source   equity built from where it came from (where you started,
    //            work, repayment, stock market, housing market, other); a
    //            source that's below zero so far takes a red slice off the top.
    //   balance  everything you own stacked (home, investments, money), the
    //            part the bank financed wrapped in red from the ground up, the
    //            part that's yours wrapped in green above it.
    // Years ahead are glass (a forecast). A home bought in a year gets a little
    // house in front of its tower. The year picked grows into place and the
    // camera glides to it.
    const SP = 3.2, GAP = 0.03;
    let years = [], yearAt = 0, tmMode = "balance";
    const SRC = [
      ["start", 0x8a90a6, () => T.tmStart],
      ["work", 0x30d158, () => T.tmWork],
      ["repay", 0x40c8e0, () => T.tmRepay],
      ["market", 0xb58cff, () => T.tmMarket],
      ["housing", 0x5b8def, () => T.tmHousing],
      ["other", 0xa3a9bb, () => T.tmOther],
    ];
    const BAL = [
      ["home", 0x5b8def, () => T.home],
      ["invest", 0xb58cff, () => T.investments],
      ["cash", 0x40c8e0, () => T.cash],
    ];
    function buildTime() {
      const s = new THREE.Scene(); s.fog = new THREE.Fog(0x07080c, 26, 80); lights(s);
      s.add(new THREE.GridHelper(160, 160, 0x1f2a44, 0x141a2a));
      return { s, towers: [], key: "", camX: 0 };
    }
    function glass(c, forecast, extra) {
      return mat(c, Object.assign(forecast ? { transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.1, metalness: 0.3 } : {}, extra || {}));
    }
    // A little house: a box with a pitched roof, in the home's blue.
    function house() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.52), mat(0xdfe6ff, { emissive: 0x23314f }));
      body.position.y = 0.21; g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.34, 4), mat(0x5b8def, { emissive: 0x1a2d55 }));
      roof.position.y = 0.59; roof.rotation.y = Math.PI / 4; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), mat(0x2a3150));
      door.position.set(0, 0.1, 0.27); g.add(door);
      return g;
    }
    function syncTime(w) {
      const key = years.map((y) => y.year + (y.forecast ? "f" : "") + (y.events ? "e" : "")).join(",");
      if (w.key === key) return;
      w.key = key;
      w.towers.forEach((t) => w.s.remove(t.g));
      // Cumulative per source up to and including each year.
      const cum = { start: years.length ? years[0].start : 0, work: 0, repay: 0, market: 0, housing: 0, other: 0 };
      w.towers = years.map((y, i) => {
        for (const k of ["work", "repay", "market", "housing", "other"]) cum[k] += y.parts[k] || 0;
        const g = new THREE.Group(); g.position.x = i * SP; w.s.add(g);
        const f = !!y.forecast;
        const box = (wd) => new THREE.BoxGeometry(wd, 1, wd);
        const src = SRC.map(([k, c, l]) => {
          const m = new THREE.Mesh(box(1.7), glass(c, f));
          m.userData = { key: "tm", src: k, label: l(), h: 0, year: y.year, value: cum[k], add: k === "start" ? null : y.parts[k] || 0, forecast: f };
          m.visible = false; g.add(m); return m;
        });
        const cut = new THREE.Mesh(box(1.78), mat(0xff5a52, { transparent: true, opacity: 0.42, emissive: 0x3a0b0b, depthWrite: false }));
        cut.userData = { key: "tm", src: "loss", label: T.tmLoss, h: 0, year: y.year, forecast: f }; cut.visible = false; g.add(cut);
        const bal = BAL.map(([k, c, l]) => {
          const m = new THREE.Mesh(box(1.5), glass(c, f));
          m.userData = { key: "tm", src: "a-" + k, label: l(), h: 0, year: y.year, value: y.assets[k], forecast: f };
          m.visible = false; g.add(m); return m;
        });
        // The sleeves: who owns which part of the stack.
        // A frame of bright edges with only a breath of colour inside, so the
        // blocks keep their own colours (a solid tint turned the home purple).
        const edged = (m, c) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.95 }))); return m; };
        // What you owe goes below the ground, like a bar below the axis.
        const owed = edged(new THREE.Mesh(box(1.5), glass(0xff5a52, f, { emissive: 0x3a0b0b })), 0xff8a80);
        owed.userData = { key: "tm", src: "owed", label: T.tmOwed, h: 0, year: y.year, value: y.debts, forecast: f }; owed.visible = false; g.add(owed);
        // Yours: a slim solid green tower beside what you own (owned − owed).
        const mine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.7), glass(0x30d158, f, { emissive: 0x0b3a16 }));
        mine.position.x = 1.35;
        mine.userData = { key: "tm", src: "mine", label: T.tmMine, h: 0, year: y.year, value: y.equity, forecast: f }; mine.visible = false; g.add(mine);
        const marks = (y.events || []).map((e, j) => {
          const hs = house(); hs.position.set(-0.2 + j * 0.7, 0, 1.55); g.add(hs);
          hs.children.forEach((c) => { c.userData = { key: "tm", src: "event", label: T.tmBought, year: y.year, value: e.price, name: e.name, date: e.date }; });
          return hs;
        });
        return { g, src, cut, bal, owed, mine, marks, grow: 0, y, cum: Object.assign({}, cum) };
      });
    }
    function stack(list, values, k, grow, ease) {
      let y = 0;
      list.forEach((b, i) => {
        const h = Math.max(values[i], 0) * k * grow;
        b.userData.h += (h - b.userData.h) * ease;
        b.visible = b.userData.h > 0.01;
        if (!b.visible) return;
        b.scale.y = b.userData.h; b.position.y = y + b.userData.h / 2; y += b.userData.h + GAP;
      });
      return Math.max(y - GAP, 0);
    }
    // The other way of reading leaves at once; this one then grows in from zero.
    const hide = (list) => list.forEach((b) => { b.userData.h = 0; b.visible = false; });
    function updateTime(w, dt) {
      syncTime(w);
      const ease = 1 - Math.pow(0.0008, dt);
      let max = 1;
      for (const t of w.towers) {
        if (tmMode === "balance") max = Math.max(max, t.y.assets.home + t.y.assets.invest + Math.max(t.y.assets.cash, 0), t.y.debts);
        else max = Math.max(max, Object.values(t.cum).reduce((a, v) => a + Math.max(v, 0), 0));
      }
      const k = 7 / max;
      w.towers.forEach((t, i) => {
        // Years up to the one picked stand; later ones wait, flat.
        t.grow += ((i <= yearAt ? 1 : 0) - t.grow) * ease;
        const on = i === yearAt;
        const glow = (b) => {
          if (b.material.emissive && !b.userData.em) { b.material.emissive.setHex(b.material.color.getHex()); b.userData.em = 1; }
          b.material.emissiveIntensity += ((on ? 0.32 : 0.06) - b.material.emissiveIntensity) * ease;
        };
        if (tmMode === "balance") {
          hide(t.src); hide([t.cut]);
          const top = stack(t.bal, [t.y.assets.home, t.y.assets.invest, t.y.assets.cash], k, t.grow, ease);
          t.bal.forEach(glow);
          // Owed: a red bar below the ground, as deep as the debt.
          const dh = t.y.debts * k * t.grow;
          t.owed.userData.h += (dh - t.owed.userData.h) * ease;
          t.owed.visible = t.owed.userData.h > 0.02; t.owed.scale.y = Math.max(t.owed.userData.h, 0.001); t.owed.position.y = -t.owed.userData.h / 2 - 0.06;
          glow(t.owed);
          // Yours: the slim green tower beside it, as tall as what's left after the debt.
          const mh = Math.max(t.y.equity, 0) * k * t.grow;
          t.mine.userData.h += (mh - t.mine.userData.h) * ease;
          t.mine.visible = t.mine.userData.h > 0.02; t.mine.scale.y = Math.max(t.mine.userData.h, 0.001); t.mine.position.y = t.mine.userData.h / 2;
          glow(t.mine);
          t.top = top;
        } else {
          hide(t.bal); hide([t.owed, t.mine]);
          let neg = 0; const names = [];
          for (const b of t.src) { const v = t.cum[b.userData.src]; if (v < 0) { neg += -v; names.push(b.userData.label); } }
          const y = stack(t.src, t.src.map((b) => t.cum[b.userData.src]), k, t.grow, ease);
          t.src.forEach(glow);
          const ch = Math.min(neg * k * t.grow, y);
          t.cut.userData.h += (ch - t.cut.userData.h) * ease;
          // The red slice sits just proud of the stack, never in the same plane.
          t.cut.visible = t.cut.userData.h > 0.01; t.cut.scale.y = Math.max(t.cut.userData.h, 0.001) + 0.02; t.cut.position.y = y - t.cut.userData.h / 2 + 0.01;
          t.cut.userData.value = -neg; t.cut.userData.label = names.join(" · ") || T.tmLoss;
          t.top = y;
        }
        t.marks.forEach((m) => { m.visible = t.grow > 0.3; m.scale.setScalar(Math.max(t.grow, 0.001)); m.rotation.y = on ? Math.sin(performance.now() / 900) * 0.25 : 0; });
      });
      w.camX += (yearAt * SP - w.camX) * (1 - Math.pow(0.02, dt));
    }
    // Labels are made once and moved each frame (rebuilding them every frame
    // made the text flicker): the year (and, for the year in view, its equity)
    // on top of each tower, and beside the tower in view one label per block.
    const tmLbl = { years: [], blocks: [] };
    function lbl(pool, i, cls) {
      let d = pool[i];
      if (!d) { d = document.createElement("div"); d.style.left = "0"; d.style.top = "0"; d.appendChild(document.createTextNode("")); d.appendChild(document.createElement("b")); d.appendChild(document.createElement("small")); pool[i] = d; }
      d.className = cls;
      if (d.parentNode !== labels) labels.appendChild(d);
      return d;
    }
    function setLbl(d, title, value, sub) {
      if (d.firstChild.nodeValue !== title) d.firstChild.nodeValue = title;
      if (d.children[0].textContent !== value) d.children[0].textContent = value;
      d.children[0].hidden = !value;
      if (d.children[1].textContent !== (sub || "")) d.children[1].textContent = sub || "";
      d.children[1].hidden = !sub;
    }
    function timeLabels(w) {
      const r = stage.getBoundingClientRect();
      const at = (x, y, z) => { const v = new THREE.Vector3(x, y, z || 0).project(camera); return v.z > 1 ? null : { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height }; };
      let n = 0;
      const placed = [];
      w.towers.forEach((t, i) => {
        if (t.grow < 0.25) return;
        const p = at(i * SP, (t.top || 0) + 0.4); if (!p) return;
        const d = lbl(tmLbl.years, n++, "mm-lbl" + (i === yearAt ? " mm-lbl-now" : "") + (t.y.forecast ? " mm-lbl-ahead" : ""));
        placed.push({ d, x: p.x, y: p.y, i });
        // Only the year in view says "expected": next to each other the labels ran into one another (23 Nov); the others are italic.
        setLbl(d, String(t.y.year) + (t.y.forecast && i === yearAt ? " · " + T.tmExpected : ""), i === yearAt ? money(t.y.equity) : "", "");
        d.style.transform = "translate(" + p.x + "px," + p.y + "px) translate(-50%,-100%)";
      });
      for (let j = n; j < tmLbl.years.length; j++) tmLbl.years[j].remove();
      // Towers close together: a year label that would overlap one already
      // shown steps aside (the year in view first, then outwards from it).
      placed.sort((a, b) => Math.abs(a.i - yearAt) - Math.abs(b.i - yearAt));
      const shown = [];
      for (const q of placed) {
        const wd = q.d.offsetWidth, ht = q.d.offsetHeight;
        const box = { l: q.x - wd / 2 - 4, r: q.x + wd / 2 + 4, t: q.y - ht, b: q.y };
        const hit = shown.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
        q.d.style.visibility = hit ? "hidden" : "";
        if (!hit) shown.push(box);
      }
      // Beside the tower in view: its blocks, nudged apart so none overlap.
      const t = w.towers[yearAt]; let m = 0;
      if (t && t.grow > 0.6) {
        const rows = [];
        const list = tmMode === "balance" ? [...t.bal, t.owed, t.mine] : [...t.src, t.cut];
        for (const b of list) {
          if (!b.visible || b.userData.h < 0.04) continue;
          const p = at(yearAt * SP + (tmMode === "balance" ? 1.85 : 1.05), b.position.y); if (!p) continue;
          const u = b.userData, add = u.add;
          const value = u.src === "loss" ? sgn(u.value || 0) : money(u.value || 0);
          const sub = u.src === "loss" ? T.tmLossNote : add != null && Math.abs(add) >= 0.5 ? T.tmInYear.replace("{year}", t.y.year).replace("{amount}", sgn(add)) : "";
          rows.push({ p, title: u.label, value, sub });
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
    // ---- a planet opened in layers (Bart, 20 Nov): tap one, the camera flies to
    // it and it opens like a cut-away globe; each layer is a part of it (a
    // category, a holding, a loan…), as thick as its share, named beside it.
    let focus = null, focusAmt = 0, focusGroup = null, focusLayers = [];
    const FOCUS_R = 1.7;
    function shade(hex, i, n) {
      const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
      return new THREE.Color().setHSL((hsl.h + (i - (n - 1) / 2) * 0.01 + 1) % 1, Math.min(hsl.s, 0.85), 0.2 + (0.5 * (i + 1)) / n);
    }
    /** The parts of a planet: flows over the period from weights (B.layers),
     *  stands as they are. */
    function layersFor(key, m) {
      const L = B.layers || {};
      const scaled = (list, total) => { const sum = (list || []).reduce((a, x) => a + Math.max(x.value, 0), 0); return sum > 0 ? list.filter((x) => x.value > 0).map((x) => ({ label: x.label, value: (x.value / sum) * total })) : []; };
      const own = Math.max(m.st.home - m.st.mortgage, 0);
      const debts = [{ label: T.mortgage, value: m.st.mortgage }, ...((B.otherDebts && B.otherDebts.length) ? B.otherDebts : [{ label: T.otherDebt, value: m.st.other }])];
      const parts = {
        inkomen: scaled(L.income, m.inT * m.n),
        uitgaven: scaled(L.spending, (m.fixT + m.varT) * m.n),
        aflossing: scaled(L.repayment, m.repay * m.n),
        bel: L.investments && L.investments.length ? scaled(L.investments, m.st.invest) : [],
        huis: [{ label: T.homeOwn || T.equity, value: own }, { label: T.mortgage, value: m.st.mortgage }],
        schuld: debts,
        ev: [{ label: T.cash, value: m.st.cash }, { label: T.investments, value: m.st.invest }, { label: T.homeOwn || T.home, value: own }],
      }[key] || [];
      const list = parts.filter((x) => x.value > 0.5).sort((a, b) => b.value - a.value);
      if (list.length) return list;
      // No parts known: the planet as one layer, at its own amount (24 Nov: it said "€ 1").
      const whole = { inkomen: m.inT * m.n, uitgaven: (m.fixT + m.varT) * m.n, aflossing: m.repay * m.n, bel: m.st.invest, huis: m.st.home, schuld: m.st.mortgage + m.st.other, ev: m.equity }[key];
      return [{ label: key === "ev" ? T.equity : (world.grav.P.find((p) => p.m.userData.key === key) || { m: { userData: { label: "" } } }).m.userData.label, value: whole > 0 ? whole : 1 }];
    }
    function openFocus(obj) {
      closeFocus(true);
      const key = obj.userData.key, color = key === "ev" ? 0xffc94a : obj.material.color.getHex();
      focusLayers = layersFor(key, model);
      hint.hidden = true; // the parts' list takes the corner
      const total = focusLayers.reduce((a, x) => a + x.value, 0) || 1;
      focusGroup = new THREE.Group();
      // Core first (the largest part), shells around it; radius by area so thin parts still show.
      let cum = 0;
      focusLayers.forEach((x, i) => {
        cum += x.value / total;
        x.r = FOCUS_R * Math.sqrt(cum);
        x.color = shade(color, i, focusLayers.length);
        const g = new THREE.SphereGeometry(x.r, 56, 36, Math.PI * 0.75, Math.PI * 1.5);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: x.color, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide, emissive: x.color.clone().multiplyScalar(0.18) }));
        mesh.userData = { layer: i };
        focusGroup.add(mesh);
      });
      focusGroup.scale.setScalar(0.01);
      world.grav.s.add(focusGroup);
      focus = { obj, key, label: obj.userData.label, total: obj.userData.value || total };
      back.hidden = false; hideTip();
    }
    function closeFocus(now) {
      if (focusGroup && now) { world.grav.s.remove(focusGroup); focusGroup = null; }
      focus = null; back.hidden = true; hint.hidden = false;
    }
    back.addEventListener("click", () => closeFocus(false));
    function stepFocus(dt) {
      const target = focus ? 1 : 0;
      focusAmt += (target - focusAmt) * (1 - Math.pow(0.0005, dt));
      if (!focus && focusAmt < 0.01 && focusGroup) { world.grav.s.remove(focusGroup); focusGroup = null; }
      if (focusGroup) {
        const at = focus ? focus.obj.position : focusGroup.position;
        focusGroup.position.copy(at);
        focusGroup.scale.setScalar(Math.max(focusAmt, 0.01));
        // The open side faces the camera.
        focusGroup.lookAt(camera.position);
        focusGroup.rotateY(0.35);
        if (focus) { const show = focusAmt < (focus.obj === world.grav.sun ? 0.35 : 0.5); world.grav.sun.visible = show; world.grav.glow.visible = show; }
        if (!focus) { world.grav.sun.visible = true; world.grav.glow.visible = true; }
      }
    }
    function focusLabels() {
      const r = stage.getBoundingClientRect();
      // Labels are drawn every frame: they fade in with the zoom, not with CSS.
      labels.style.opacity = String(Math.min(Math.max((focusAmt - 0.5) * 2.5, 0), 1));
      const c = focusGroup.position.clone().project(camera);
      const cx = ((c.x + 1) / 2) * r.width, cy = ((1 - c.y) / 2) * r.height;
      const edge = focusGroup.position.clone().add(new THREE.Vector3(0, FOCUS_R * focusAmt, 0)).project(camera);
      const rad = Math.abs(((1 - edge.y) / 2) * r.height - cy);
      const t = document.createElement("div"); t.className = "mm-focus-title";
      t.style.left = cx + "px"; t.style.top = cy - rad - 12 + "px";
      t.textContent = focus.label;
      const tb = document.createElement("b"); tb.textContent = money(focus.total); t.appendChild(tb);
      labels.appendChild(t);
      const total = focusLayers.reduce((a, x) => a + x.value, 0) || 1;
      const rows = focusLayers.slice(0, 9), step = Math.min(38, (r.height - 60) / Math.max(rows.length, 1));
      const narrow = r.width < 560;
      const lx = narrow ? 16 : Math.min(cx + rad + 48, r.width - 210);
      // Where each line starts: on its own layer, at the rim of the cut-away
      // (Bart, 24 Nov) — the cut face that turns to the labels, the layers
      // spread top to bottom in the labels' order.
      focusGroup.updateMatrixWorld(true);
      const rim = (x, i, phi) => {
        const th = Math.PI * (0.32 + (0.36 * i) / Math.max(rows.length - 1, 1)), rr = x.r * 0.96;
        const p = focusGroup.localToWorld(new THREE.Vector3(-rr * Math.cos(phi) * Math.sin(th), rr * Math.cos(th), rr * Math.sin(phi) * Math.sin(th))).project(camera);
        return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height };
      };
      const faceA = rim(rows[0] || { r: FOCUS_R }, 0, Math.PI * 0.75), faceB = rim(rows[0] || { r: FOCUS_R }, 0, Math.PI * 0.25);
      const phi = faceA.x >= faceB.x ? Math.PI * 0.75 : Math.PI * 0.25;
      rows.forEach((x, i) => {
        const y = narrow ? cy + rad + 30 + i * 30 : cy + (i - (rows.length - 1) / 2) * step;
        if (!narrow) {
          // A thin line from the layer itself to its label.
          const a = rim(x, i, phi), ax = a.x, ay = a.y;
          const ln = document.createElement("div"); ln.className = "mm-layer-line";
          const dx = lx - 6 - ax, dy = y - ay;
          ln.style.left = ax + "px"; ln.style.top = ay + "px"; ln.style.width = Math.hypot(dx, dy) + "px";
          ln.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
          labels.appendChild(ln);
        }
        const d = document.createElement("div"); d.className = "mm-layer";
        d.style.left = lx + "px"; d.style.top = y + "px";
        const dot = document.createElement("i"); dot.style.background = "#" + x.color.getHexString();
        const name = document.createElement("span"); name.textContent = x.label + "  ";
        const b = document.createElement("b"); b.textContent = money(x.value); name.appendChild(b);
        const pc = document.createElement("em"); pc.textContent = Math.round((x.value / total) * 100) + "%";
        d.append(dot, name, pc);
        labels.appendChild(d);
      });
    }

    function pickables() {
      if (view === "time") { const w = world.time; return w.towers.flatMap((t) => [...t.src, t.cut, ...t.bal, t.owed, t.mine, ...t.marks.flatMap((m) => m.children)]).filter((o) => o.visible && (!o.parent || o.parent.visible)); }
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
      if (focus || focusGroup) closeFocus(true);
      if (v !== "flow" && !initGL()) v = "flow";
      view = v;
      fc.hidden = v !== "flow"; gl.hidden = v === "flow"; labels.textContent = ""; hideTip();
      if (v === "build" && !world.build) world.build = buildBuilding();
      if (v === "grav" && !world.grav) world.grav = buildGravity();
      if (v === "time" && !world.time) world.time = buildTime();
      if (v === "time") { yaw = 0.62; pitch = 0.32; dist = tmMode === "balance" ? (opts.compact ? 28 : 25) : (opts.compact ? 22 : 19); }
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

    let press = null;
    const onDown = (e) => { if (view !== "flow") { press = { x: e.clientX, y: e.clientY, t: performance.now() }; drag = { x: e.clientX, y: e.clientY }; try { stage.setPointerCapture(e.pointerId); } catch { /* not every browser */ } } };
    const onUp = (e) => {
      drag = null; lastInteract = performance.now();
      // A tap (no drag) in the solar system: open a planet, or close the open one.
      if (press && view === "grav" && renderer && e.target !== back && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6 && performance.now() - press.t < 600) {
        const r = stage.getBoundingClientRect();
        ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
        const hit = focus ? null : ray.intersectObjects(pickables(), false)[0];
        if (hit) openFocus(hit.object); else if (focus) closeFocus(false);
      }
      press = null;
    };
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
      if (!renderer || (view === "grav" && focus)) { if (focus) hideTip(); return; }
      ray.setFromCamera({ x: (mx / r.width) * 2 - 1, y: -(my / r.height) * 2 + 1 }, camera);
      // Only the blocks themselves, not their outline (an edge has no name: "undefined").
      const hit = ray.intersectObjects(pickables(), false)[0];
      if (hit && view === "time" && hit.object.userData.src === "event") {
        const u = hit.object.userData;
        showTip(mx, my, u.year + " · " + u.label, money(u.value || 0), u.name + " · " + new Date(u.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }));
      } else if (hit && view === "time") {
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
        if (!reduce && !drag && view !== "time" && !focus && now - lastInteract > 2500) yaw += dt * 0.12;
        if (view === "grav") stepFocus(dt);
        let tx = view === "build" ? 1.2 : view === "time" ? w.camX : 0, ty = view === "build" ? 1.4 : view === "time" ? (tmMode === "balance" ? 0.4 : 2.6) : 0, tz = 0, dd = dist;
        if (view === "grav" && focusGroup) {
          const f = focusAmt, at = focusGroup.position;
          // Aim a little right of the planet: it sits left, its labels on the right.
          const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(stage.getBoundingClientRect().width < 560 ? 0 : FOCUS_R * 1.25);
          tx += (at.x + side.x - tx) * f; ty += (at.y - ty) * f; tz += (at.z + side.z - tz) * f; dd = dist + (FOCUS_R * 6.2 - dist) * f;
        }
        camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dd, ty + Math.sin(pitch) * dd, tz + Math.cos(yaw) * Math.cos(pitch) * dd);
        camera.lookAt(tx, ty, tz);
        if (view === "build") updateBuilding(w, model, dt); else if (view === "time") updateTime(w, reduce ? 1 : dt); else updateGravity(w, model, dt);
        renderer.render(w.s, camera);
        if (view === "time") timeLabels(w);
        else if (view === "grav" && focusGroup && focus) { labels.textContent = ""; if (focusAmt > 0.5) focusLabels(); }
        else { labels.style.opacity = ""; placeLabels(pickables()); }
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
      // Owned and owed reaches above and below the ground: step back to see both.
      setTimeMode(m) { const next = m === "balance" ? "balance" : "source"; if (next !== tmMode && view === "time") dist = next === "balance" ? (opts.compact ? 28 : 25) : (opts.compact ? 22 : 19); tmMode = next; },
      onModel(f) { listeners.push(f); f(model); return () => listeners.splice(listeners.indexOf(f), 1); },
      // Open a planet by its key (inkomen, uitgaven, aflossing, bel, huis, schuld, ev), as a tap would.
      openPlanet(key) { if (view !== "grav" || !world.grav) return false; const o = key === "ev" ? world.grav.sun : (world.grav.P.find((p) => p.m.userData.key === key) || {}).m; if (o) openFocus(o); return !!o; },
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
