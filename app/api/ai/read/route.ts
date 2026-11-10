import Anthropic from "@anthropic-ai/sdk";
import { BillingError, configured, fail, status, userFrom } from "@/lib/billing/server";
import { readDocument, ReadError, type ReadFile, type ReadKind } from "@/lib/ai/reader";

// Read a bank screenshot, payslip or mortgage document with AI (Premium).
//   POST { kind, files: [{ mime, data (base64) }], today, categories? }
//     → the figures (lib/ai/reader), for the review screen to show
// The browser asks for consent first and shrinks images before sending.
// On the local dev site (next dev, this machine) no account is needed.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KINDS = new Set<ReadKind>(["bank", "payslip", "mortgage"]);
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const local = (req: Request) => process.env.NODE_ENV === "development" && LOCAL_HOSTS.has((req.headers.get("host") ?? "").replace(/:\d+$/, ""));

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Reading documents is not set up yet." }, { status: 503 });
    if (!local(req)) {
      const user = await userFrom(req);
      if (configured() && !(await status(user.id)).active) throw new BillingError(402, "Reading documents is part of Premium.");
    }
    const body = (await req.json()) as { kind?: ReadKind; files?: ReadFile[]; today?: string; categories?: string[] };
    const files = body.files ?? [];
    if (!body.kind || !KINDS.has(body.kind)) return Response.json({ error: "Unknown document type." }, { status: 400 });
    if (!files.length || files.length > 8 || files.some((f) => !TYPES.has(f.mime) || typeof f.data !== "string")) {
      return Response.json({ error: "Add one to eight images or PDFs." }, { status: 400 });
    }
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);
    const categories = (body.categories ?? []).filter((c) => typeof c === "string").slice(0, 200);
    return Response.json(await readDocument(body.kind, files, { today, categories }));
  } catch (err) {
    if (err instanceof ReadError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Busy right now — try again in a minute." }, { status: 429 });
    if (err instanceof Anthropic.BadRequestError) return Response.json({ error: "This file couldn't be read. Try a screenshot or a smaller PDF." }, { status: 400 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: "Reading failed. Try again later." }, { status: 502 });
    return fail(err);
  }
}
