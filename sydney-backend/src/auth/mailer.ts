import nodemailer from "nodemailer";
import { config } from "../config.js";

export type PasswordResetEmail = {
  email: string;
  name?: string | null;
  url: string;
};

export async function sendPasswordResetEmail(
  input: PasswordResetEmail
): Promise<void> {
  const host = config.SMTP_HOST?.trim();
  const from = config.SMTP_FROM?.trim();
  const username = config.SMTP_USERNAME?.trim();
  const password = config.SMTP_PASSWORD;

  if (!host || !from) {
    throw new Error("Password reset email delivery is not configured.");
  }

  if ((username && !password) || (!username && password)) {
    throw new Error("SMTP username and password must be configured together.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(username && password
      ? { auth: { user: username, pass: password } }
      : {})
  });

  const greeting = input.name?.trim() || "there";
  await transporter.sendMail({
    from: {
      address: from,
      name: config.SMTP_FROM_NAME.trim() || "Cuppet"
    },
    to: input.email,
    subject: "Reset your Cuppet password",
    text: [
      `Hi ${greeting},`,
      "",
      "We received a request to reset your Cuppet password.",
      `Reset it here: ${input.url}`,
      "",
      "This link expires in one hour. If you did not request this, you can ignore this email.",
      "",
      "- The Cuppet team"
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f5f2;color:#25231f;font-family:Arial,sans-serif;line-height:1.5">
    <div style="max-width:560px;margin:40px auto;padding:32px;background:#fff;border:1px solid #e5e0d8;border-radius:18px">
      <h1 style="margin:0 0 20px;font-size:24px">Reset your Cuppet password</h1>
      <p>Hi ${escapeHtml(greeting)},</p>
      <p>We received a request to reset your Cuppet password.</p>
      <p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 18px;background:#25231f;color:#fff;text-decoration:none;border-radius:10px">Reset password</a></p>
      <p style="font-size:13px;color:#6f6a62">This link expires in one hour. If you did not request this, you can ignore this email.</p>
    </div>
  </body>
</html>`
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character] ?? character
  );
}
