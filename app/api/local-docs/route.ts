import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { readPayslip } from "@/lib/finance/payslip";

// Private documents (payslips…) for the local dev site: kept next to the
// private data in .private/docs (git-ignored, owner-only), never on the
// deployed site — like /api/local-data, this only answers under `next dev`
// for requests to this machine. A PDF is read on upload (pdf.js, text layer)
// for its payslip figures.
//
//   POST   form-data { file }      → { id, name, mime, size, extracted }
//   GET    ?id=…                   → the file itself
//   DELETE ?id=…                   → removes it

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), ".private", "docs");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/heic": "heic", "image/webp": "webp" };
const MAX = 15 * 1024 * 1024;
const ID = /^[0-9a-f-]{36}$/;

function allowed(req: Request) {
  if (process.env.NODE_ENV !== "development") return false;
  return LOCAL_HOSTS.has((req.headers.get("host") ?? "").replace(/:\d+$/, ""));
}
const notFound = () => new Response("Not found", { status: 404 });

async function fileFor(id: string) {
  const names = await fs.readdir(DIR).catch(() => [] as string[]);
  const name = names.find((n) => n.startsWith(`${id}.`));
  return name ? path.join(DIR, name) : null;
}

/** The text lines of a PDF, top to bottom, left to right. */
async function pdfLines(data: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data, disableFontFace: true, useSystemFonts: false });
  const doc = await task.promise;
  const lines: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 5); p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str?: string; transform?: number[] }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = Math.round(it.transform[5] / 2) * 2;
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join("   "));
  }
  await task.destroy();
  return lines;
}

export async function POST(req: Request) {
  if (!allowed(req)) return notFound();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Use a PDF or an image (PNG, JPEG, HEIC, WebP)." }, { status: 415 });
  if (file.size > MAX) return Response.json({ error: "Files up to 15 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = randomUUID();
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(DIR, `${id}.${ext}`), bytes, { mode: 0o600 });
  let extracted = null;
  if (ext === "pdf") {
    try {
      extracted = readPayslip(await pdfLines(bytes.slice()));
    } catch {
      extracted = null; // scanned PDF without text, or unreadable: stored anyway
    }
  }
  return Response.json({ id, name: file.name, mime: file.type, size: file.size, extracted });
}

export async function GET(req: Request) {
  if (!allowed(req)) return notFound();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return notFound();
  const f = await fileFor(id);
  if (!f) return notFound();
  const ext = path.extname(f).slice(1);
  const mime = Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return new Response(new Uint8Array(await fs.readFile(f)), { headers: { "content-type": mime, "content-disposition": "inline", "cache-control": "no-store" } });
}

export async function DELETE(req: Request) {
  if (!allowed(req)) return notFound();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return notFound();
  const f = await fileFor(id);
  if (f) await fs.unlink(f);
  return new Response(null, { status: 204 });
}
