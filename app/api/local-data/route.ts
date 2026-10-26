import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// Private, local-only data: `.private/finance.json` (git-ignored) holds the
// owner's real numbers for the dev site. This route only exists under
// `next dev` and only answers requests addressed to this machine; the
// deployed site always gets a 404, and the file never leaves the Mac.

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), ".private");
const FILE = path.join(DIR, "finance.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function allowed(req: Request) {
  if (process.env.NODE_ENV !== "development") return false;
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  return LOCAL_HOSTS.has(host);
}

const notFound = () => new Response("Not found", { status: 404 });

// Each version of the file has a fingerprint. A tab sends the one it loaded
// (or last saved) with every save; if the file changed since — another tab,
// or the file edited directly — the save is refused (409) instead of
// silently writing old data over the new.
const VERSION = "x-data-version";
const versionOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

export async function GET(req: Request) {
  if (!allowed(req)) return notFound();
  try {
    const text = await fs.readFile(FILE, "utf8");
    return new Response(text, { headers: { "content-type": "application/json", "cache-control": "no-store", [VERSION]: versionOf(text) } });
  } catch {
    return notFound();
  }
}

export async function PUT(req: Request) {
  if (!allowed(req)) return notFound();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(await req.text());
    if (!data || typeof data !== "object" || !Array.isArray(data.transactions)) throw new Error("bad shape");
  } catch {
    return new Response("Invalid data", { status: 400 });
  }
  // Keep top-level parts the page doesn't know about (e.g. added to the file
  // while a tab was open) instead of dropping them on the next save.
  const current = await fs.readFile(FILE, "utf8").catch(() => null);
  if (current !== null && req.headers.get(VERSION) !== versionOf(current)) {
    return new Response("The data changed since this page loaded it. Reload to see the latest.", { status: 409 });
  }
  const existing = current !== null ? (JSON.parse(current) as Record<string, unknown>) : {};
  const text = JSON.stringify({ ...existing, ...data }, null, 1);
  // Owner-only: the folder 700, the files 600.
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  // Keep the previous version, then swap the new one in atomically.
  await fs.copyFile(FILE, path.join(DIR, "finance.prev.json")).then(() => fs.chmod(path.join(DIR, "finance.prev.json"), 0o600)).catch(() => {});
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, text, { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, FILE);
  return new Response(null, { status: 204, headers: { [VERSION]: versionOf(text) } });
}
