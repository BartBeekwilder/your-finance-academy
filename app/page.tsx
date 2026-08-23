import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import HeroChart from "@/components/HeroChart";
import GrowthChart from "@/components/GrowthChart";

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
        <span
          className="eyebrow rounded-full border px-2.5 py-1.5 text-[0.68rem]"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          Members
        </span>
      </nav>

      <div className="mx-auto max-w-[74rem] px-[clamp(1.25rem,4vw,3rem)]">
        {/* Hero */}
        <section className="grid items-center gap-[clamp(2rem,5vw,4rem)] py-[clamp(3rem,9vw,6.5rem)] pb-[clamp(2.5rem,6vw,4rem)] md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">A first look</p>
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

        {/* Curriculum */}
        <section id="curriculum" className="border-t py-[clamp(3rem,7vw,5rem)]" style={{ borderColor: "var(--line)" }}>
          <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-normal" style={{ fontWeight: 400 }}>
              Where members start
            </h2>
            <span className="eyebrow">03 modules shown</span>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {courses.map((c) => (
              <Reveal key={c.num}>
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
      </footer>
    </>
  );
}
