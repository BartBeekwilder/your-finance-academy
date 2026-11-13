import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Reading a document with Claude (server only): a bank screenshot, a payslip
// or a mortgage offer / statement in, the figures out as JSON for the review
// screen. Nothing is stored here — the file goes to the API for this one
// request and the figures come back to the browser, which shows them for
// checking before anything is booked. Key: ANTHROPIC_API_KEY (Vercel).

export type ReadKind = "bank" | "payslip" | "mortgage";
export type ReadFile = { mime: string; data: string }; // base64

const BANK = z.object({
  transactions: z.array(
    z.object({
      date: z.string().nullable().describe("YYYY-MM-DD; null if the screenshot doesn't show it"),
      description: z.string().describe("The shop or counterparty as shown, without card numbers"),
      amount: z.number().describe("Always positive"),
      direction: z.enum(["out", "in"]).describe("out = money left the account, in = money came in"),
      category: z.string().nullable().describe("Exactly one of the given category names, or null if none fits"),
      transfer: z.boolean().describe("True when money moves between the person's own accounts: to or from savings, paying off their own credit card"),
    }),
  ),
});

const PAYSLIP = z.object({
  year: z.number().nullable(),
  month: z.number().nullable().describe("1-12: the period the pay is for"),
  gross: z.number().nullable().describe("Gross pay for this period"),
  net: z.number().nullable().describe("Net amount paid out for this period"),
  tax: z.number().nullable().describe("Wage tax (loonheffing) for this period"),
  employer: z.string().nullable(),
});

const MORTGAGE = z.object({
  lender: z.string().nullable(),
  parts: z.array(
    z.object({
      name: z.string().describe("The loan part's name or number as in the document"),
      kind: z.enum(["annuity", "linear", "interest_only"]),
      principal: z.number().describe("The amount borrowed for this part (or the current debt if only that is shown)"),
      rate: z.number().describe("Annual interest rate in percent, e.g. 3.85"),
      start_date: z.string().nullable().describe("YYYY-MM-DD"),
      term_months: z.number().nullable().describe("Total term in months, usually 360"),
      fixed_until: z.string().nullable().describe("YYYY-MM-DD the fixed-rate period ends"),
      nhg: z.boolean().describe("Nationale Hypotheek Garantie"),
    }),
  ),
});

export const SCHEMAS = { bank: BANK, payslip: PAYSLIP, mortgage: MORTGAGE } as const;
export type ReadResult = { bank: z.infer<typeof BANK>; payslip: z.infer<typeof PAYSLIP>; mortgage: z.infer<typeof MORTGAGE> };

function prompt(kind: ReadKind, today: string, categories: string[]) {
  switch (kind) {
    case "bank":
      return [
        `These are screenshots of a bank app or statement. List every transaction you can read, once (screenshots may overlap). Today is ${today}: where a date lacks the year, it is the most recent such date not after today; "today" / "yesterday" / weekday headers count from today.`,
        `Skip balances, totals, pending card authorisations that are marked as such, and anything cut off so the amount can't be read.`,
        categories.length ? `For category, pick exactly one of these names when one clearly fits, else null: ${categories.join(" | ")}` : `Set category to null.`,
      ].join("\n");
    case "payslip":
      return `This is a payslip. Read this period's figures, not the year-to-date column. Use null for anything not on it.`;
    case "mortgage":
      return `This is a mortgage document (offer, contract or annual statement). List each loan part (leningdeel) with its own figures. Use null for anything not in it.`;
  }
}

/** The figures from the files, checked against the kind's schema. */
export async function readDocument<K extends ReadKind>(kind: K, files: ReadFile[], opts: { today: string; categories?: string[] }): Promise<ReadResult[K]> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = files.map((f) =>
    f.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
      : { type: "image", source: { type: "base64", media_type: f.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: f.data } },
  );
  content.push({ type: "text", text: prompt(kind, opts.today, opts.categories ?? []) });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SCHEMAS[kind]) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new ReadError(422, "This document couldn't be read.");
  if (response.stop_reason === "max_tokens") throw new ReadError(422, "Too much at once — try fewer screenshots.");
  if (!response.parsed_output) throw new ReadError(502, "Nothing could be read from this document.");
  return response.parsed_output as ReadResult[K];
}

export class ReadError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
