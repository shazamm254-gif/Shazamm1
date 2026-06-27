import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseProposalContent } from "@/lib/types";
import { ProposalEditor } from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ProposalPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const proposal = await db.proposals.findById(id);
  if (!proposal || proposal.userId !== user.id) notFound();

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(proposal.contentJson);
  } catch {
    parsedContent = {};
  }
  const content = parseProposalContent(parsedContent);

  return (
    <ProposalEditor
      id={proposal.id}
      initialTitle={proposal.title}
      initialClientName={proposal.clientName ?? ""}
      initialClientCompany={proposal.clientCompany ?? ""}
      initialStatus={proposal.status}
      shareId={proposal.shareId}
      acceptedBy={proposal.acceptedBy}
      initialContent={content}
    />
  );
}
