import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseProposalContent } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { AcceptBox } from "@/components/AcceptBox";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ shareId: string }> };

export default async function PublicProposalPage({ params }: Params) {
  const { shareId } = await params;
  const proposal = await db.proposals.findByShareId(shareId);
  if (!proposal) notFound();
  const owner = await db.users.findById(proposal.userId);
  const ownerCompany = await db.companies.findByUser(proposal.userId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(proposal.contentJson);
  } catch {
    parsed = {};
  }
  const content = parseProposalContent(parsed);
  const total = content.pricing.reduce((s, i) => s + (i.amount || 0), 0);
  const fromName = ownerCompany?.name || owner?.name || "Your partner";
  const accepted = proposal.status === "accepted";

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <AnalyticsBeacon type="proposal_viewed" proposalId={proposal.id} />
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <header className="border-b border-slate-100 pb-6">
          <p className="text-sm font-medium text-brand">Proposal</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            {proposal.title}
          </h1>
          <p className="mt-2 text-slate-500">
            Prepared by {fromName}
            {proposal.clientCompany ? ` for ${proposal.clientCompany}` : ""}
          </p>
        </header>

        {content.summary && (
          <p className="mt-6 text-lg leading-relaxed text-slate-700">
            {content.summary}
          </p>
        )}

        <div className="mt-8 space-y-8">
          {content.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-bold">{s.heading}</h2>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {content.pricing.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Investment</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {content.pricing.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-slate-500">{item.description}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {formatCurrency(item.amount, content.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-bold">Total</td>
                    <td className="px-4 py-3 text-right text-lg font-bold">
                      {formatCurrency(total, content.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="mt-10 border-t border-slate-100 pt-8">
          {accepted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="text-lg font-semibold text-green-900">
                Accepted ✓
              </p>
              {proposal.acceptedBy && (
                <p className="text-sm text-green-700">
                  Accepted by {proposal.acceptedBy}
                </p>
              )}
            </div>
          ) : (
            <AcceptBox shareId={shareId} />
          )}
        </footer>
      </article>
      <p className="mt-6 text-center text-xs text-slate-400">
        Powered by ProposalForge
      </p>
    </div>
  );
}
