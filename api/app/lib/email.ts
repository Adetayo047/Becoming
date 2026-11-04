import nodemailer, { type Transporter } from 'nodemailer';

// Two ways to send real email:
//   - Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (a Google "App password", not the
//     account password). Sends from that Gmail address to anyone — no domain
//     needed, good for testing with real inboxes.
//   - Resend: RESEND_API_KEY (+ RESEND_FROM_EMAIL on a verified domain).
// isEmailConfigured() gates real delivery; call sites fall back to logging
// server-side so the underlying flow (codes, expiry, verification) stays real
// even before an email provider is configured.
function gmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function isEmailConfigured(): boolean {
  return gmailConfigured() || !!process.env.RESEND_API_KEY;
}

let gmailTransport: Transporter | null = null;

async function sendViaGmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  gmailTransport ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  try {
    await gmailTransport.sendMail({
      from: `Becoming <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Send failed' };
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.log(`[email not configured] would send to ${to}: ${subject}\n${html}`);
    return { sent: false, error: 'Email provider not configured' };
  }

  if (gmailConfigured()) {
    const result = await sendViaGmail(to, subject, html);
    if (!result.sent) console.error(`[email] Gmail send to ${to} failed: ${result.error}`);
    return result;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Becoming <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { sent: false, error: text };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Send failed' };
  }
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
