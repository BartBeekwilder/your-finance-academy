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

/** The Personal Finance logo: three growing bars and a minted coin on the
 *  brand's violet→teal tile. The coin carries the user's own currency symbol
 *  (€, $, £…) and flips over when it changes. Large sizes add the coin's rim
 *  and a sparkle; small sizes leave them out so the symbol stays legible. */
export default function BrandMark({ size = 28, currency = "EUR" }: { size?: number; currency?: string }) {
  const id = useId();
  const symbol = currencySymbol(currency);
  const big = size >= 40;
  // Longer symbols ("kr", "CHF") get a smaller font to fit the coin.
  const font = symbol.length === 1 ? 12.5 : symbol.length === 2 ? 8.5 : 6;
  const ink = useInkCentre(symbol, font);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Personal Finance" style={{ flex: "none", display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E5BEA" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <rect x="13" y="36" width="8" height="15" rx="2" fill="#fff" opacity=".55" />
      <rect x="25" y="29" width="8" height="22" rx="2" fill="#fff" opacity=".75" />
      <rect x="37" y="30" width="8" height="21" rx="2" fill="#fff" />
      <g key={symbol} className="pf-coin">
        <circle cx="43" cy="18" r="10" fill="#fff" />
        {big && <circle cx="43" cy="18" r="7.6" fill="none" stroke="#5A55D8" strokeWidth="1" opacity=".55" />}
        <text
          {...(ink
            ? { x: 43 + ink.dx, y: 18 + ink.dy, textAnchor: "start", dominantBaseline: "alphabetic" }
            : { x: 43, y: 18, textAnchor: "middle", dominantBaseline: "central" })}
          fontSize={font}
          fontWeight={800}
          fill="#5A55D8"
          style={{ fontFamily: FONT }}
        >
          {symbol}
        </text>
      </g>
      {big && <path d="M53 9.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#fff" className="pf-sparkle" />}
    </svg>
  );
}

