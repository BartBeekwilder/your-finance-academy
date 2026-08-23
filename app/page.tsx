import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import HeroChart from "@/components/HeroChart";
import GrowthChart from "@/components/GrowthChart";
import TiltCard from "@/components/TiltCard";
import LockButton from "@/components/LockButton";

const appFeatures = [
  {
    title: "Every transaction, categorized",
    body: "Income and expenses land in the right category automatically, across as many accounts as you track.",
    icon: "tag",
  },
  {
    title: "Accounts in one place",
    body: "Checking, savings, cash — see them separately or together, without switching apps.",
    icon: "layers",
  },
  {
    title: "Budgets that hold",
    body: "Set a per-category limit once. The app tracks what's left, not just what you spent.",
    icon: "gauge",
  },
  {
    title: "Investments, priced live",
    body: "Stocks, crypto, and metals valued in real time, sitting next to the rest of your money.",
    icon: "trend",
  },
  {
    title: "Income, tracked monthly",
    body: "Every paycheck logged against the month it landed, so trends are visible, not guessed at.",
    icon: "calendar",
  },
  {
    title: "Scan a receipt, done",
    body: "On-device text and image recognition reads the total and category. Nothing leaves your phone.",
    icon: "scan",
  },
] as const;

function FeatureIcon({ name }: { name: (typeof appFeatures)[number]["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "tag":
      return (
        <svg {...common}>
          <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a1.5 1.5 0 0 0 .44 1.06l8 8a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-8-8A1.5 1.5 0 0 0 11.5 3.5Z" />
          <circle cx="8.25" cy="8.25" r="1.25" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
          <path d="m3.5 12 8.5 4.5 8.5-4.5" />
          <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
        </svg>
      );
    case "gauge":
      return (
        <svg {...common}>
          <path d="M4 15a8 8 0 1 1 16 0" />
          <path d="M12 15 15.5 10" />
          <path d="M12 15h.01" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="m3.5 16 5.5-6 4 4 7-8" />
          <path d="M15.5 6h4.5v4.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 9.5h17" />
          <path d="M8 3v3.5" />
          <path d="M16 3v3.5" />
          <circle cx="12" cy="14.5" r="2" />
        </svg>
      );
    case "scan":
      return (
        <svg {...common}>
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
          <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
          <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
          <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
          <path d="M7.5 9h9v7h-9z" />
        </svg>
      );
  }
}

const courses = [
  {
    num: "01 — Foundations",
    title: "Build the budget that survives contact",
    body: "A cash-flow system designed for irregular income, not a spreadsheet you abandon by February.",
  },
  {
    num: "02 — Growth",
    title: "Investing without the jargon wall",
    body: "Index funds, risk, and time horizon — explained the way you'd explain it to a friend.",
  },
  {
    num: "03 — Protection",
    title: "The debt and insurance nobody teaches",
    body: "What to pay off first, what to insure, and what to quietly ignore.",
  },
];

export default function Home() {
  return (
    <>
      <nav
        className="flex items-center justify-between border-b px-[clamp(1.25rem,4vw,3rem)] py-6"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="text-[1.1rem] font-medium" style={{ fontFamily: "var(--font-display)" }}>
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </div>
        <div className="flex items-center gap-6">
          <a href="#app" className="eyebrow hidden sm:inline" style={{ color: "var(--ink-soft)" }}>
            The App
          </a>
          <a href="#curriculum" className="eyebrow hidden sm:inline" style={{ color: "var(--ink-soft)" }}>
            Courses
          </a>
          <LockButton />
          <span
            className="eyebrow rounded-full border px-2.5 py-1.5 text-[0.68rem]"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            Members
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-[74rem] px-[clamp(1.25rem,4vw,3rem)]">
        {/* Hero */}
        <section className="grid items-center gap-[clamp(2rem,5vw,4rem)] py-[clamp(3rem,9vw,6.5rem)] pb-[clamp(2.5rem,6vw,4rem)] md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">A first look</p>
            <span
              className="mt-3 mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem]"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
            >
              Companion app coming to iOS
            </span>
            <h1
              className="mt-1 text-[clamp(2.6rem,6vw,4.4rem)] leading-[1.02] font-normal tracking-tight"
              style={{ fontWeight: 400 }}
            >
              Money, taught the way it should have been.
            </h1>
            <div
              className="my-5 h-0.5 w-18"
              style={{ background: "var(--accent)" }}
            />
            <p className="max-w-[34rem] text-[1.08rem]" style={{ color: "var(--ink-soft)" }}>
              Practical courses on budgeting, investing, and debt — built for people who want
              their money handled, not a finance degree.
            </p>
            <div className="mt-8 flex gap-3.5">
              <a
                href="#curriculum"
                className="rounded-lg px-5 py-3 text-[0.92rem] font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--accent)", color: "#1b1502" }}
              >
                See the curriculum
              </a>
              <a
                href="#growth"
                className="rounded-lg border px-5 py-3 text-[0.92rem] font-semibold transition-colors"
                style={{ borderColor: "var(--line)" }}
              >
                Watch it compound
              </a>
            </div>
          </div>
          <HeroChart />
        </section>

        {/* Stats */}
        <section
          className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4"
          style={{ borderColor: "var(--line)", background: "var(--line)" }}
        >
          <Counter target={12} suffix="k+" label="Members learning" />
          <Counter target={94} suffix="%" label="Finish their first module" />
          <Counter target={7} suffix=" min" label="Average daily lesson" />
          <Counter target={4.9} decimals={1} suffix="/5" label="Member rating" />
        </section>

      </div>

      {/* App features — full-bleed tinted band so it reads as its own moment */}
      <section
        id="app"
        className="border-y py-[clamp(3.5rem,8vw,6rem)]"
        style={{
          borderColor: "var(--line)",
          background:
            "linear-gradient(180deg, var(--bg-raised), var(--bg) 70%)",
        }}
      >
        <div className="mx-auto max-w-[74rem] px-[clamp(1.25rem,4vw,3rem)]">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">The iOS app</p>
              <h2
                className="text-[clamp(1.9rem,4vw,2.8rem)] font-normal"
                style={{ fontWeight: 400 }}
              >
                Everything you learn, one app to run it in
              </h2>
            </div>
            <span
              className="eyebrow rounded-full border px-3 py-1.5"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              Coming to iOS
            </span>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {appFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 90}>
                <TiltCard
                  className="rounded-2xl border p-6"
                  style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                >
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border"
                    style={{ borderColor: "var(--line)", background: "var(--bg-raised)" }}
                  >
                    <FeatureIcon name={f.icon} />
                  </div>
                  <h3 className="mb-2 text-[1.05rem] font-normal" style={{ fontWeight: 400 }}>
                    {f.title}
                  </h3>
                  <p className="text-[0.93rem]" style={{ color: "var(--ink-soft)" }}>
                    {f.body}
                  </p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[74rem] px-[clamp(1.25rem,4vw,3rem)]">
        {/* Curriculum */}
        <section id="curriculum" className="py-[clamp(3rem,7vw,5rem)]">
          <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-normal" style={{ fontWeight: 400 }}>
              Where members start
            </h2>
            <span className="eyebrow">03 modules shown</span>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {courses.map((c, i) => (
              <Reveal key={c.num} delay={i * 90}>
                <div
                  className="group relative overflow-hidden rounded-2xl border p-6 transition-transform hover:-translate-y-1"
                  style={{ borderColor: "var(--line)", background: "var(--bg-raised)" }}
                >
                  <span
                    className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                    style={{ background: "var(--accent)" }}
                  />
                  <div className="data text-xs" style={{ color: "var(--ink-soft)" }}>
                    {c.num}
                  </div>
                  <h3 className="mt-2 mb-2 text-[1.15rem] font-normal" style={{ fontWeight: 400 }}>
                    {c.title}
                  </h3>
                  <p className="text-[0.93rem]" style={{ color: "var(--ink-soft)" }}>
                    {c.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Growth chart */}
        <section id="growth" className="border-t py-[clamp(3rem,7vw,5rem)]" style={{ borderColor: "var(--line)" }}>
          <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-normal" style={{ fontWeight: 400 }}>
              Compounding, visualized
            </h2>
            <span className="eyebrow">Scroll-linked draw-on</span>
          </Reveal>
          <GrowthChart />
        </section>
      </div>

      <footer
        className="border-t px-[clamp(1.25rem,4vw,3rem)] py-10 text-center"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="text-[1.1rem] font-medium" style={{ fontFamily: "var(--font-display)" }}>
          Your <em style={{ color: "var(--accent)" }}>Finance</em> Academy
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--ink-soft)" }}>
          Money, taught plainly. No jargon, no upsells — just the courses you actually need.
        </p>
        <a
          href="/privacy"
          className="eyebrow mt-6 inline-block"
          style={{ color: "var(--ink-soft)" }}
        >
          Privacy Policy
        </a>
      </footer>
    </>
  );
}
