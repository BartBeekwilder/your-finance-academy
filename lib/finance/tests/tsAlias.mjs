// Lets plain-node tests import modules that use the app's "@/…" alias,
// extensionless imports and JSON (as Next resolves them). Use:
//   import { register } from "node:module";
//   register("./tsAlias.mjs", import.meta.url);
//   const { … } = await import("../calc.ts");
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../../../", import.meta.url);

export async function resolve(spec, ctx, next) {
  let s = spec;
  if (s.startsWith("@/")) s = new URL(s.slice(2), ROOT).href;
  else if (s.startsWith(".") && ctx.parentURL) s = new URL(s, ctx.parentURL).href;
  else return next(spec, ctx);
  const path = fileURLToPath(s);
  for (const p of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) if (statSync(p, { throwIfNoEntry: false })?.isFile()) return { url: pathToFileURL(p).href, shortCircuit: true };
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.endsWith(".json")) return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
  return next(url, ctx);
}
