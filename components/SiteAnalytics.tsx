"use client";

import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics (no cookies, nothing personal stored). Not inside the
// homepage's device frames: those load the app (/app?demo=1) five times per
// visit and would count as page views of their own. The static homepage and
// /updates load the same tracker with a script tag.
export default function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (window.self !== window.top ? null : event)} />;
}
