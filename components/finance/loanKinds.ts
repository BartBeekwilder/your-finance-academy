import { Car, CreditCard, GraduationCap, HandCoins, Landmark, type LucideIcon } from "lucide-react";
import type { LoanKind } from "@/lib/finance/types";

/** The kinds of other loans, with their label (English key for t()), icon
 *  and colour — the Loans page and the onboarding share them. */
export const LOAN_STYLE: Record<LoanKind, { label: string; Icon: LucideIcon; color: string }> = {
  student: { label: "Student loan", Icon: GraduationCap, color: "#64d2ff" },
  car: { label: "Car loan", Icon: Car, color: "#ff9f0a" },
  personal: { label: "Personal loan", Icon: HandCoins, color: "#bf5af2" },
  credit: { label: "Credit card", Icon: CreditCard, color: "#ff375f" },
  other: { label: "Other loan", Icon: Landmark, color: "#8e8e93" },
};

export const LOAN_KINDS = Object.keys(LOAN_STYLE) as LoanKind[];
