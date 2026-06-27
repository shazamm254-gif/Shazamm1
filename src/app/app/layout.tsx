import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/app" className="text-slate-600 hover:text-slate-900">
              Proposals
            </Link>
            <Link
              href="/app/settings"
              className="text-slate-600 hover:text-slate-900"
            >
              Company
            </Link>
            <Link
              href="/app/billing"
              className="text-slate-600 hover:text-slate-900"
            >
              {user.plan === "pro" ? "Pro ★" : "Upgrade"}
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
