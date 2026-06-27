import Link from "next/link";
import { Logo } from "@/components/Logo";

const features = [
  {
    title: "Brief in, proposal out",
    body: "Paste a project brief or your discovery-call notes. Get a structured, persuasive, correctly-scoped draft in minutes.",
  },
  {
    title: "On-brand every time",
    body: "Save your services, value props, and tone once. Every proposal references your real offerings and sounds like you.",
  },
  {
    title: "Itemized pricing",
    body: "AI builds a clear investment table with realistic line items and totals you can edit before sending.",
  },
  {
    title: "Share & close",
    body: "Send a clean, mobile-friendly proposal link. Clients accept with one click — you see the status instantly.",
  },
];

const steps = [
  "Describe the project in a few sentences",
  "AI drafts a tailored, scoped proposal",
  "Tweak, then share a link your client can accept",
];

const faqs = [
  {
    q: "How is this different from Proposify or PandaDoc?",
    a: "Those are templating tools — they help you format faster but you still write everything. ProposalForge writes the first draft for you from a short brief, on-brand, with scope and pricing.",
  },
  {
    q: "Do I need to set anything up?",
    a: "Add your company profile once (services, value props, tone). After that, every proposal is generated with that context automatically.",
  },
  {
    q: "Can I edit what the AI produces?",
    a: "Yes. Every section, line item, and total is fully editable before you send.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — generate up to 3 proposals free. Upgrade to Pro for unlimited proposals and branding.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-brand">
            AI proposals for service businesses
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Win more deals. Write proposals in{" "}
            <span className="text-brand">minutes</span>, not hours.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Describe the project, and ProposalForge drafts a tailored, persuasive,
            correctly-scoped proposal — on-brand, with pricing, ready to send.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark sm:w-auto"
            >
              Start free — 3 proposals
            </Link>
            <Link
              href="/login"
              className="w-full rounded-lg border border-slate-200 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Log in
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            No credit card required.
          </p>
        </section>

        {/* How it works */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold">How it works</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-6"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-bold text-white">
                    {i + 1}
                  </div>
                  <p className="mt-4 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold">
            Everything you need to close faster
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 p-6"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-center text-2xl font-bold">Simple pricing</h2>
            <p className="mt-2 text-center text-slate-600">
              Flat pricing — not punishing per-seat fees.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-8">
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-2 text-3xl font-extrabold">$0</p>
                <ul className="mt-6 space-y-2 text-slate-600">
                  <li>✓ 3 AI-generated proposals</li>
                  <li>✓ Company profile</li>
                  <li>✓ Shareable proposal links</li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-lg border border-slate-200 px-4 py-2 text-center font-medium hover:bg-slate-50"
                >
                  Start free
                </Link>
              </div>
              <div className="rounded-2xl border-2 border-brand bg-white p-8 shadow-sm">
                <h3 className="text-lg font-semibold">
                  Pro <span className="text-brand">★</span>
                </h3>
                <p className="mt-2 text-3xl font-extrabold">
                  $39
                  <span className="text-base font-medium text-slate-500">
                    /mo
                  </span>
                </p>
                <ul className="mt-6 space-y-2 text-slate-600">
                  <li>✓ Unlimited proposals</li>
                  <li>✓ Custom branding</li>
                  <li>✓ Accept tracking</li>
                  <li>✓ Priority support</li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-lg bg-brand px-4 py-2 text-center font-medium text-white hover:bg-brand-dark"
                >
                  Start free, upgrade anytime
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-slate-100">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium">
                  {f.q}
                </summary>
                <p className="mt-2 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-brand py-16 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-3xl font-bold">
              Your next proposal could be written by the time you finish coffee.
            </h2>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand hover:bg-slate-100"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <Logo className="text-slate-700" />
          <p>© {new Date().getFullYear()} ProposalForge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
