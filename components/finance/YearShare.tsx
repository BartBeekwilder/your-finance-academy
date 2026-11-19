"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { money, monthName, shortMonth } from "@/lib/finance/format";
import type { YearWrap } from "@/lib/finance/yearWrapped";

// Year Wrapped as a picture to share (Bart's marketing plan: the year's
// biggest moment). A story-sized card, 1080 × 1920, drawn on a canvas: the
// savings rate, months in the plus, equity's growth and the year month by
// month — with the app's name and a link that says where people came from
// (?ref=wrapped). Only percentages unless you switch amounts on: what you
// earn is yours to share or not.

const SITE = "https://www.yourfinanceacademy.com/?ref=wrapped";
const W = 1080, H = 1920;

function loadIcon(): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = "/brand/icon-512.png";
  });
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function draw(canvas: HTMLCanvasElement, w: YearWrap, currency: string, amounts: boolean) {
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const f = (weight: number, size: number) => `${weight} ${size}px ${font}`;
  canvas.width = W;
  canvas.height = H;

  // Background: the Wrapped's deep purple into night, two soft glows.
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#4a1d8f");
  bg.addColorStop(0.55, "#1d1240");
  bg.addColorStop(1, "#0b0b12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[900, 260, 520, "rgba(64,200,224,0.22)"], [120, 1500, 600, "rgba(110,91,234,0.25)"]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The app.
  const icon = await loadIcon();
  if (icon) {
    ctx.save();
    round(ctx, 90, 110, 120, 120, 28);
    ctx.clip();
    ctx.drawImage(icon, 90, 110, 120, 120);
    ctx.restore();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = f(700, 46);
  ctx.fillText("Personal Finance", 236, 162);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = f(500, 32);
  ctx.fillText("yourfinanceacademy.com", 236, 208);

  // The year.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = f(700, 40);
  ctx.fillText(t("My year in money").toUpperCase(), 90, 400);
  ctx.fillStyle = "#ffffff";
  ctx.font = f(800, 200);
  ctx.fillText(String(w.year), 80, 590);

  // The headline: the savings rate (or what was kept aside).
  const rate = Math.round(Math.max(w.savingsRate, 0) * 100);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = f(600, 40);
  ctx.fillText(t("Savings rate"), 90, 720);
  const grad = ctx.createLinearGradient(90, 0, 700, 0);
  grad.addColorStop(0, "#7dffa5");
  grad.addColorStop(1, "#40c8e0");
  ctx.fillStyle = grad;
  ctx.font = f(800, 230);
  ctx.fillText(`${rate}%`, 80, 930);
  if (amounts) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = f(600, 46);
    ctx.fillText(t("{amount} kept aside", { amount: money(w.saved, currency) }), 90, 1010);
  }

  // Two facts side by side.
  const eqPct = Math.abs(w.equityStart) > 0.5 ? (w.equityEnd - w.equityStart) / Math.abs(w.equityStart) : null;
  const tiles: [string, string][] = [
    [t("Months in the plus"), t("{n} of {total}", { n: w.plusMonths, total: w.activeMonths })],
    [t("Equity"), amounts ? money(w.equityChange, currency, { signed: true }) : eqPct == null ? "—" : `${eqPct >= 0 ? "+" : "−"}${Math.round(Math.abs(eqPct) * 100)}%`],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 90 + i * 460, y = 1080;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    round(ctx, x, y, 430, 210, 36);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = f(600, 34);
    ctx.fillText(label, x + 36, y + 70);
    ctx.fillStyle = "#ffffff";
    ctx.font = f(800, value.length > 9 ? 58 : 72);
    ctx.fillText(value, x + 36, y + 160);
  });

  // The year month by month: up green, down red — no amounts, just the shape.
  const by = w.savedByMonth;
  const max = Math.max(...by.map(Math.abs), 1);
  const top = 1380, base = 1560, depth = 90, slot = 900 / 12;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = f(600, 34);
  ctx.fillText(t("Month by month"), 90, top - 20);
  by.forEach((v, i) => {
    const x = 90 + i * slot + slot * 0.18, bw = slot * 0.64;
    // A month with nothing booked (one still to come) gets no bar.
    if (Math.abs(v) >= 0.5) {
      const h = Math.max((Math.abs(v) / max) * (v >= 0 ? base - top - 10 : depth), 6);
      ctx.fillStyle = w.best?.i === i ? "#7dffa5" : v >= 0 ? "#4ade80" : "#ff6b6b";
      round(ctx, x, v >= 0 ? base - h : base, bw, h, 8);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = f(600, 24);
    ctx.textAlign = "center";
    ctx.fillText(shortMonth(new Date(w.year, i, 1)).slice(0, 3), x + bw / 2, base + depth + 40);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(90, base, 900, 2);
  if (w.best) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = f(600, 34);
    ctx.fillText(t("Best month: {month}", { month: monthName(new Date(w.year, w.best.i, 1)) }), 90, base + depth + 100);
  }

  // The invitation.
  ctx.fillStyle = "#ffffff";
  ctx.font = f(700, 44);
  ctx.fillText(t("Make your own Year Wrapped"), 90, 1830);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = f(500, 34);
  ctx.fillText("yourfinanceacademy.com", 90, 1878);
}

export default function YearShare({ w, currency }: { w: YearWrap; currency: string }) {
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const c = canvas.current ?? document.createElement("canvas");
    canvas.current = c;
    void draw(c, w, currency, amounts).then(() => live && setUrl(c.toDataURL("image/png")));
    return () => {
      live = false;
    };
  }, [open, amounts, w, currency]);

  const blob = () => new Promise<Blob | null>((ok) => canvas.current?.toBlob(ok, "image/png") ?? ok(null));
  const name = `personal-finance-${w.year}.png`;

  async function share() {
    setBusy(true);
    try {
      const b = await blob();
      if (!b) return;
      const file = new File([b], name, { type: "image/png" });
      const text = t("My {year} in money — make your own Year Wrapped:", { year: String(w.year) });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${SITE}` });
      else download(b);
    } catch {
      // Closing the share sheet is not an error.
    } finally {
      setBusy(false);
    }
  }
  function download(b?: Blob | null) {
    const go = (x: Blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(x);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    if (b) go(b);
    else void blob().then((x) => x && go(x));
  }

  return (
    <>
      <button type="button" className="pf-button pf-share-open" onClick={() => setOpen(true)}>
        <Share2 size={16} /> {t("Share your year")}
      </button>
      {open && (
        <div className="pf-share" role="dialog" aria-label={t("Share your year")} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="pf-share-card">
            <button type="button" className="pf-icon-button pf-share-close" aria-label={t("Close")} onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
            <div className="pf-share-preview">{url ? <img src={url} alt={t("Share your year")} /> : <span className="pf-slip-spin" aria-hidden />}</div>
            <div className="pf-share-side">
              <h2>{t("Share your year")}</h2>
              <p>{t("A picture for your story or a chat. Only percentages are on it, unless you add the amounts.")}</p>
              <label className="pf-share-toggle">
                <input type="checkbox" checked={amounts} onChange={(e) => setAmounts(e.target.checked)} />
                <span>{t("Show amounts")}</span>
              </label>
              <div className="pf-share-actions">
                <button type="button" className="pf-button" onClick={share} disabled={!url || busy}>
                  <Share2 size={16} /> {t("Share")}
                </button>
                <button type="button" className="pf-chip" onClick={() => download()} disabled={!url}>
                  <Download size={15} /> {t("Download")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
