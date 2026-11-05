"use client";

import { t } from "@/lib/i18n";
import { Bug, Check, Heart, Lightbulb, MessageCircle, MessageSquareText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useFinance } from "./FinanceProvider";
import Sheet from "./Sheet";

// "Send feedback" for testers: a small pill beside the + that opens a sheet
// — what kind (something broken, an idea, something you love, other), a
// message, and it goes to the feedback table (migration 0013) with the page
// it was sent from and the screen size. Signed in only (the demo has no
// account to send it from).

const KINDS = [
  { value: "bug", label: "Something's broken", Icon: Bug, color: "#ff6961" },
  { value: "idea", label: "An idea", Icon: Lightbulb, color: "#ffd60a" },
  { value: "love", label: "I love this", Icon: Heart, color: "#ff375f" },
  { value: "other", label: "Something else", Icon: MessageCircle, color: "#64d2ff" },
] as const;

export default function FeedbackButton() {
  const { source, email } = useFinance();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Element | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("idea");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  if (source !== "vault" && source !== "supabase") return null;

  async function send() {
    const supabase = getSupabase();
    if (!supabase || !message.trim()) return;
    setState("sending");
    const { error: e } = await supabase.from("feedback").insert({
      kind,
      message: message.trim().slice(0, 5000),
      email,
      page: path,
      context: { width: window.innerWidth, height: window.innerHeight, agent: navigator.userAgent, lang: document.documentElement.lang },
    });
    if (e) {
      setError(e.message);
      setState("error");
      return;
    }
    setState("sent");
    setMessage("");
    setTimeout(() => setOpen(false), 1600);
  }

  return (
    <>
      <button
        type="button"
        className="pf-feedback-pill"
        onClick={(e) => {
          setFrom(e.currentTarget);
          setState("idle");
          setOpen(true);
        }}
      >
        <MessageSquareText size={15} /> {t("Feedback")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} origin={from} focus="textarea" label={t("Send feedback")}>
        <div className="pf-fb">
          <button type="button" className="pf-icon-button pf-fb-close" aria-label={t("Close")} onClick={() => setOpen(false)}><X size={16} /></button>
          {state === "sent" ? (
            <div className="pf-fb-sent">
              <span><Check size={26} /></span>
              <b>{t("Thank you!")}</b>
              <small>{t("Your feedback is in. It helps make this better for everyone.")}</small>
            </div>
          ) : (
            <>
              <h2>{t("Send feedback")}</h2>
              <p>{t("What did you notice? Anything goes — a bug, an idea, or what you like.")}</p>
              <div className="pf-fb-kinds" role="radiogroup" aria-label={t("Kind")}>
                {KINDS.map((k) => (
                  <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} style={{ ["--c" as string]: k.color }} onClick={() => setKind(k.value)}>
                    <k.Icon size={18} />
                    <span>{t(k.label)}</span>
                  </button>
                ))}
              </div>
              <textarea
                className="pf-input pf-fb-text"
                rows={5}
                maxLength={5000}
                placeholder={kind === "bug" ? t("What happened, and what did you expect?") : t("Tell us…")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <small className="pf-fb-note">{t("Sent with the page you're on ({page}) and your screen size, so we can find it.", { page: path ?? "/" })}</small>
              {state === "error" && <p className="pf-unlock-error" role="alert">{error}</p>}
              <button type="button" className="pf-button" disabled={!message.trim() || state === "sending"} onClick={() => void send()}>
                {state === "sending" ? t("Working…") : t("Send")}
              </button>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
