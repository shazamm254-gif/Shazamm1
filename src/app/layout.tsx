import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProposalForge — Win more deals. Write proposals in minutes.",
    template: "%s · ProposalForge",
  },
  description:
    "ProposalForge is the AI-native proposal tool for agencies, consultants, and service businesses. Describe the project; get a client-ready proposal in minutes.",
  openGraph: {
    title: "ProposalForge",
    description:
      "Write winning proposals in minutes, not hours. AI-native proposal software for service businesses.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
