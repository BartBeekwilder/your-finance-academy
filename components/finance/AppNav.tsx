"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, Banknote, Scale, House, KeyRound, Umbrella, Trophy, ChartLine, ChartPie, CircleDollarSign, Landmark, LayoutGrid, List, LogOut, Receipt, Pause, Play, Settings, Sparkles } from "lucide-react";
import { setBackgroundMotion, setMotionPaused, useBackgroundMotion, useMotionMode } from "@/lib/motion";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { setOrder, useOrder } from "@/lib/prefs";
import BrandMark from "./BrandMark";
import { useFinance } from "./FinanceProvider";

// The iOS tabs (Views/ContentView.swift), same order: plus Expenses and Net worth.
const TABS = [
  { href: "/app", label: "Dashboard", Icon: ChartPie },
  { href: "/app/income", label: "Income", Icon: Banknote },
  { href: "/app/expenses", label: "Expenses", Icon: Receipt },
  { href: "/app/net-worth", label: "Liquidity", Icon: Landmark },
  { href: "/app/balance", label: "Balance sheet", Icon: Scale },
  { href: "/app/real-estate", label: "Real estate", Icon: House },
  { href: "/app/rent-vs-buy", label: "Rent or buy", Icon: KeyRound },
  { href: "/app/insurance", label: "Insurance", Icon: Umbrella },
  { href: "/app/investments", label: "Investments", Icon: ChartLine },
  { href: "/app/transactions", label: "Transactions", Icon: List },
  { href: "/app/categories", label: "Categories", Icon: LayoutGrid },
  { href: "/app/budgets", label: "Budgets", Icon: CircleDollarSign },
  { href: "/app/progress", label: "Progress", Icon: Trophy },
] as const;

const NAV_ORDER = "pf-nav-order";
// Set while a tab is being dragged and just after, so letting go doesn't
// also follow the link.
let dragging = false;

/** Resets the menu to its standard order (Settings). */
export const resetNavOrder = () => setOrder(NAV_ORDER, TABS.map((x) => x.href));

/** One tab: a link you can also pick up and move. A drag doesn't follow
 *  the link (it needs a few pixels of movement first). */
function NavItem({ tab, current }: { tab: (typeof TABS)[number]; current: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.href });
  const { Icon } = tab;
  return (
    <Link
      ref={setNodeRef}
      href={tab.href}
      aria-current={current ? "page" : undefined}
      className="pf-nav-item"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClickCapture={(e) => {
        if (dragging) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...attributes}
      {...listeners}
      title={t("Drag to reorder")}
    >
      <Icon size={20} strokeWidth={2} />
      <span className="pf-nav-label">{t(tab.label)}</span>
    </Link>
  );
}

export default function AppNav() {
  const path = usePathname();
  const { source, email, signOut, data } = useFinance();
  // The tabs in the user's own order (drag to rearrange; kept per browser).
  // Tabs added later join at the end of a saved order.
  const saved = useOrder(NAV_ORDER, TABS.map((x) => x.href));
  const order = [...saved.filter((h) => TABS.some((x) => x.href === h)), ...TABS.map((x) => x.href).filter((h) => !saved.includes(h))];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    setTimeout(() => (dragging = false), 0);
    if (!over || active.id === over.id) return;
    setOrder(NAV_ORDER, arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <nav className="pf-nav" aria-label={t("App")}>
      <div className="pf-brand">
        <BrandMark size={30} currency={data.profile.currency_code} />
        <strong style={{ fontSize: "1.02rem" }}>{t("Personal Finance")}</strong>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => (dragging = true)} onDragCancel={() => setTimeout(() => (dragging = false), 0)} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          {order.map((href) => {
            const tab = TABS.find((x) => x.href === href);
            return tab ? <NavItem key={href} tab={tab} current={path === href} /> : null;
          })}
        </SortableContext>
      </DndContext>

      {/* Glossary and Settings sit apart, at the foot of the list. */}
      <Link href="/app/glossary" aria-current={path === "/app/glossary" ? "page" : undefined} className="pf-nav-settings">
        <BookOpen size={20} strokeWidth={2} />
        <span className="pf-nav-label">{t("Glossary")}</span>
      </Link>
      <Link href="/app/settings" aria-current={path === "/app/settings" ? "page" : undefined} className="pf-nav-settings">
        <Settings size={20} strokeWidth={2} />
        <span className="pf-nav-label">{t("Settings")}</span>
      </Link>

      <div className="pf-nav-foot">
        <MotionToggle />
        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {source === "demo" ? t("Demo data — nothing is saved") : source === "local" ? t("Local data — only on this Mac") : email}
        </div>
        <button className="pf-link" onClick={signOut} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, marginTop: 6 }}>
          <LogOut size={14} /> {source === "demo" ? t("Leave demo") : source === "local" ? t("Close local data") : t("Sign out")}
        </button>
      </div>
    </nav>
  );
}

/** Quick motion switches in the sidebar: pause everything (tickers, the
 *  background, CSS animations) and the background drift on its own. Also
 *  marks <html> with the motion mode for finance.css. Settings has the
 *  Light mode for slower computers. */
function MotionToggle() {
  const mode = useMotionMode();
  const background = useBackgroundMotion();
  const paused = mode === "off";
  useEffect(() => {
    const html = document.documentElement;
    if (mode === "full") html.removeAttribute("data-pf-motion");
    else html.setAttribute("data-pf-motion", mode);
  }, [mode]);
  const style = { display: "inline-flex", alignItems: "center", gap: 6, padding: 0 } as const;
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "start", marginBottom: 8 }}>
      <button className="pf-link" onClick={() => setMotionPaused(!paused)} style={style}>
        {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? t("Resume animations") : t("Pause animations")}
      </button>
      {!paused && (
        <button className="pf-link" onClick={() => setBackgroundMotion(!background)} style={style}>
          <Sparkles size={14} /> {background ? t("Background still") : t("Background moving")}
        </button>
      )}
    </div>
  );
}
