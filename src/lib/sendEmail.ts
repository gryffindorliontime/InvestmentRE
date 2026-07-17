import "server-only";

import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Sends via SMTP when configured (SMTP_HOST/PORT/USER/PASS/FROM). Without
// those, logs the email to the server console instead of failing — lets the
// forgot-password flow be exercised end-to-end (the reset link is right
// there in the log) before anyone's set up a real mail provider.
export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<void> {
  if (!smtpConfigured()) {
    console.log(
      `[email not sent — SMTP not configured] To: ${to}\nSubject: ${subject}\n\n${text}`
    );
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
