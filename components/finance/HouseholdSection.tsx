"use client";

import { t } from "@/lib/i18n";
import { Plus, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import { newHousehold, PERSON_COLORS } from "@/lib/finance/household";
import type { HouseholdMember } from "@/lib/finance/types";
import { useFinance } from "./FinanceProvider";

// Settings › Household: just me, or two (up to four) people keeping the books
// together. With two or more, incomes get a "from", expenses a "paid by",
// and Income / Expenses can show everything per person.

export default function HouseholdSection() {
  const { data, updateProfile } = useFinance();
  const members = data.profile.household ?? [];
  const [error, setError] = useState<string | null>(null);
  const save = (household: HouseholdMember[]) => updateProfile({ household }).then(() => setError(null)).catch((e: Error) => setError(e.message));
  const together = members.length >= 2;

  return (
    <section className="pf-card" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span className="pf-hh-icon">{together ? <Users size={18} /> : <UserRound size={18} />}</span>
        <div style={{ display: "grid", gap: 3 }}>
          <strong>{t("Household")}</strong>
          <span style={{ fontSize: "0.82rem", color: "var(--pf-ink-2)" }}>
            {together
              ? t("You keep these books together. Each income is someone's; each expense is paid by someone or shared.")
              : t("Just you. Add a partner to see income per person and who paid what.")}
          </span>
        </div>
      </div>

      {together ? (
        <div style={{ display: "grid", gap: 8 }}>
          {members.map((m, i) => (
            <div key={m.id} className="pf-hh-row">
              <span className="pf-hh-colors">
                {PERSON_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={t("Colour")} aria-pressed={m.color === c} style={{ background: c }} onClick={() => save(members.map((x) => (x.id === m.id ? { ...x, color: c } : x)))} />
                ))}
              </span>
              <input
                className="pf-input"
                defaultValue={m.name}
                aria-label={t("Name")}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== m.name) save(members.map((x) => (x.id === m.id ? { ...x, name } : x)));
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              {i > 0 && (
                <button
                  type="button"
                  className="pf-icon-button"
                  aria-label={t("Remove {name}", { name: m.name })}
                  onClick={() => {
                    if (!confirm(t("Remove {name} from the household? Their transactions stay and count as shared.", { name: m.name }))) return;
                    const rest = members.filter((x) => x.id !== m.id);
                    save(rest.length >= 2 ? rest : []);
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {members.length < 4 && (
            <button
              type="button"
              className="pf-chip"
              style={{ justifySelf: "start", display: "inline-flex", gap: 6, alignItems: "center", padding: "7px 12px" }}
              onClick={() => save([...members, { id: crypto.randomUUID(), name: t("Person {n}", { n: members.length + 1 }), color: PERSON_COLORS[members.length % PERSON_COLORS.length] }])}
            >
              <Plus size={14} /> {t("Add person")}
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="pf-chip" style={{ justifySelf: "start", display: "inline-flex", gap: 6, alignItems: "center", padding: "8px 14px" }} onClick={() => save(newHousehold(t("Me"), t("Partner"), () => crypto.randomUUID()))}>
          <Users size={15} /> {t("Keep the books together")}
        </button>
      )}
      {error && <p style={{ margin: 0, color: "var(--pf-red)", fontSize: "0.8rem" }}>{error}</p>}
    </section>
  );
}

/** A small coloured dot + name, for transaction rows. */
export function PersonTag({ member }: { member: HouseholdMember | undefined }) {
  if (!member) return null;
  return (
    <span className="pf-person-tag" style={{ ["--c" as string]: member.color }}>
      <i />
      {member.name}
    </span>
  );
}
