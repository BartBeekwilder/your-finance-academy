"use client";

import { useId, useLayoutEffect, useState } from "react";
import { currencySymbol } from "@/lib/finance/currencies";

const FONT = "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";

// Where to put a symbol's baseline so its INK (not its font box) sits dead
// centre on the coin: fonts place "€", "$" or "kr" differently in their line
// box (Windows' font sits € low and off to one side), so a "central"
// baseline looks off. Measured once per symbol and size with a canvas
// (actualBoundingBox = the drawn shape), in the SVG's own units.
const inkCache = new Map<string, { dx: number; dy: number }>();
function inkOffset(symbol: string, font: number) {
  const key = `${symbol}|${font}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  // Measured large for precision, then scaled to the coin's font size.
  const scale = 100 / font;
  ctx.font = `800 100px ${FONT}`;
  const m = ctx.measureText(symbol);
  // From the alignment point (start, alphabetic baseline) to the ink centre.
  const cx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const cy = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  const out = { dx: -cx / scale, dy: -cy / scale };
  inkCache.set(key, out);
  return out;
}

/** The symbol's start point and baseline for its ink to centre on (x, y);
 *  null until measured (the first paint uses a central baseline). */
function useInkCentre(symbol: string, font: number) {
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    let live = true;
    const measure = () => live && setOffset(inkOffset(symbol, font));
    // In a microtask: still before the first paint.
    void Promise.resolve().then(measure);
    // A web font arriving later changes the shape: measure again then.
    void document.fonts?.ready.then(() => {
      inkCache.delete(`${symbol}|${font}`);
      measure();
    });
    return () => {
      live = false;
    };
  }, [symbol, font]);
  return offset;
}

/** The Personal Finance logo: the app icon (Neon D2, the same as the
 *  iOS app's, Bart 18 Nov). With `coin`, a minted coin in the corner carries
 *  the currency symbol (€, $, £…) and flips over when it changes — where
 *  the logo shows the chosen currency (the setup, Settings › Currency). */
export default function BrandMark({ size = 28, currency = "EUR", coin = false }: { size?: number; currency?: string; coin?: boolean }) {
  const id = useId();
  const symbol = currencySymbol(currency);
  // Longer symbols ("kr", "CHF") get a smaller font to fit the coin.
  const font = symbol.length === 1 ? 13 : symbol.length === 2 ? 9 : 6.5;
  const ink = useInkCentre(symbol, font);
  const src = size > 96 ? "/brand/icon-512.png" : size > 40 ? "/brand/icon-256.png" : "/brand/icon-64.png";

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Personal Finance" style={{ flex: "none", display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id={id}>
          <rect width="64" height="64" rx="14.3" />
        </clipPath>
      </defs>
      <image href={src} width="64" height="64" clipPath={`url(#${id})`} preserveAspectRatio="xMidYMid slice" />
      {coin && (
        <g key={symbol} className="pf-coin">
          <circle cx="52" cy="52" r="12" fill="#fff" stroke="#1b1838" strokeWidth="2" />
          <text
            {...(ink
              ? { x: 52 + ink.dx, y: 52 + ink.dy, textAnchor: "start", dominantBaseline: "alphabetic" }
              : { x: 52, y: 52, textAnchor: "middle", dominantBaseline: "central" })}
            fontSize={font}
            fontWeight={800}
            fill="#5A55D8"
            style={{ fontFamily: FONT }}
          >
            {symbol}
          </text>
        </g>
      )}
    </svg>
  );
}
