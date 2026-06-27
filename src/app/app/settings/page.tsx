import { getCurrentUser } from "@/lib/auth";
import { CompanyForm } from "@/components/CompanyForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Company profile</h1>
      <p className="mt-1 text-slate-600">
        Saved once and used to make every proposal on-brand and accurate.
      </p>
      <CompanyForm
        initial={{
          name: user.company?.name ?? "",
          website: user.company?.website ?? "",
          industry: user.company?.industry ?? "",
          services: user.company?.services ?? "",
          tone: user.company?.tone ?? "",
          valueProps: user.company?.valueProps ?? "",
          defaultCurrency: user.company?.defaultCurrency ?? "USD",
        }}
      />
    </div>
  );
}
