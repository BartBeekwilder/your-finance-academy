import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project lives in iCloud Drive; a dev build folder whose name ends in
  // ".nosync" is skipped by iCloud, so a running dev server doesn't keep
  // syncing a gigabyte of build cache. Production builds (Vercel) keep .next.
  distDir: process.env.NODE_ENV === "development" ? ".next.nosync" : ".next",
};

export default nextConfig;
