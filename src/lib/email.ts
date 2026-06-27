/**
 * Transactional email.
 *
 * Uses the Resend HTTP API (no SDK dependency) when RESEND_API_KEY + EMAIL_FROM
 * are configured. When they are not (local dev / preview), emails are logged to
 * the server console instead of failing — so flows remain testable end-to-end
 * without a provider. Swap `deliver()` for any provider (Postmark, SES, SMTP)
 * without touching callers.
 */

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function deliver(msg: EmailMessage): Promise<void> {
  if (!emailEnabled()) {
    // Dev fallback: log so the flow is testable without a provider.
    console.log(
      `[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`,
    );
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] delivery failed (${res.status}): ${body}`);
    }
  } catch (err) {
    // Never let an email failure break the primary request.
    console.error("[email] delivery error:", err);
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="font-weight:700;color:#4f46e5;font-size:18px;margin:0 0 16px;">ProposalForge</p>
    <h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
    ${bodyHtml}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">ProposalForge — win more deals.</p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;margin:8px 0;">${label}</a>`;
}

export async function sendVerificationEmail(
  to: string,
  name: string | null,
  token: string,
): Promise<void> {
  const url = `${appUrl()}/api/auth/verify?token=${token}`;
  await deliver({
    to,
    subject: "Verify your ProposalForge email",
    html: layout(
      `Welcome${name ? `, ${name}` : ""}!`,
      `<p>Confirm your email to secure your account.</p>${button(url, "Verify email")}<p style="color:#64748b;font-size:13px;">Or paste this link: ${url}</p>`,
    ),
    text: `Welcome${name ? `, ${name}` : ""}! Verify your email: ${url}`,
  });
}

export async function sendWelcomeEmail(
  to: string,
  name: string | null,
): Promise<void> {
  const url = `${appUrl()}/app/new`;
  await deliver({
    to,
    subject: "Your first proposal is 2 minutes away",
    html: layout(
      `You're in${name ? `, ${name}` : ""}!`,
      `<p>Describe a project and ProposalForge writes a client-ready proposal — on-brand, with pricing.</p>${button(url, "Create your first proposal")}`,
    ),
    text: `You're in! Create your first proposal: ${url}`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string | null,
  token: string,
): Promise<void> {
  const url = `${appUrl()}/reset?token=${token}`;
  await deliver({
    to,
    subject: "Reset your ProposalForge password",
    html: layout(
      "Reset your password",
      `<p>${name ? `Hi ${name}, ` : ""}click below to set a new password. This link expires in 1 hour.</p>${button(url, "Reset password")}<p style="color:#64748b;font-size:13px;">Or paste this link: ${url}</p><p style="color:#94a3b8;font-size:12px;">If you didn't request this, you can ignore this email.</p>`,
    ),
    text: `Reset your password: ${url} (expires in 1 hour)`,
  });
}

export async function sendProposalAcceptedEmail(
  to: string,
  ownerName: string | null,
  proposalTitle: string,
  acceptedBy: string,
): Promise<void> {
  const url = `${appUrl()}/app`;
  await deliver({
    to,
    subject: `🎉 "${proposalTitle}" was accepted`,
    html: layout(
      "You won the deal!",
      `<p>${ownerName ? `Hi ${ownerName}, ` : ""}<strong>${acceptedBy}</strong> just accepted your proposal <strong>"${proposalTitle}"</strong>.</p>${button(url, "View in dashboard")}`,
    ),
    text: `${acceptedBy} accepted your proposal "${proposalTitle}". View: ${url}`,
  });
}

export async function sendBillingNotification(
  to: string,
  name: string | null,
  kind: "upgraded" | "downgraded",
): Promise<void> {
  const upgraded = kind === "upgraded";
  await deliver({
    to,
    subject: upgraded
      ? "Welcome to ProposalForge Pro 🎉"
      : "Your ProposalForge subscription ended",
    html: layout(
      upgraded ? "You're on Pro!" : "Subscription ended",
      upgraded
        ? `<p>${name ? `Thanks ${name}! ` : "Thanks! "}You now have unlimited proposals and branding.</p>${button(`${appUrl()}/app`, "Go to dashboard")}`
        : `<p>${name ? `Hi ${name}, ` : ""}your Pro subscription has ended and your account is back on the Free plan. You can re-subscribe anytime.</p>${button(`${appUrl()}/app/billing`, "Manage billing")}`,
    ),
    text: upgraded
      ? "You're on ProposalForge Pro — unlimited proposals."
      : "Your ProposalForge Pro subscription ended; you're back on Free.",
  });
}
