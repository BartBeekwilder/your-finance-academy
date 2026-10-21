"use client";

import { useId } from "react";
import { currencySymbol } from "@/lib/finance/currencies";

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
          x="43"
          y="18"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={font}
          fontWeight={800}
          fill="#5A55D8"
          style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" }}
        >
          {symbol}
        </text>
      </g>
      {big && <path d="M53 9.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#fff" className="pf-sparkle" />}
    </svg>
  );
}

/** The logo as a standalone SVG string, for the browser tab icon
 *  (app/icon.svg holds the € version; AppNav swaps in the user's currency). */
export function brandMarkSvg(currency = "EUR") {
  const symbol = currencySymbol(currency).replace(/[<>&"]/g, "");
  const font = symbol.length === 1 ? 13 : symbol.length === 2 ? 9 : 6.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6E5BEA"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><rect x="13" y="36" width="8" height="15" rx="2" fill="#fff" opacity=".55"/><rect x="25" y="29" width="8" height="22" rx="2" fill="#fff" opacity=".75"/><rect x="37" y="30" width="8" height="21" rx="2" fill="#fff"/><circle cx="43" cy="18" r="11" fill="#fff"/><text x="43" y="18" text-anchor="middle" dominant-baseline="central" font-size="${font}" font-weight="800" fill="#5A55D8" font-family="system-ui, -apple-system, sans-serif">${symbol}</text></svg>`;
}
