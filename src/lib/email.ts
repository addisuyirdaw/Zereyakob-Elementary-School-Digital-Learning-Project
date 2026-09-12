/**
 * Zereyakob Elementary School Digital Learning Platform
 * Automated Email Service (Resend & SendGrid REST Integration)
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  provider?: "resend" | "sendgrid" | "simulated";
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend (primary) or SendGrid (fallback),
 * or simulate in development when no API key is present.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendEmailOptions): Promise<EmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
  const defaultFrom =
    process.env.EMAIL_FROM?.trim() || "Zereyakob Initiative <onboarding@resend.dev>";
  const sender = from || defaultFrom;

  // 1. Resend REST API (preferred)
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[Email:Resend Error]", data);
        return {
          success: false,
          provider: "resend",
          error: data?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        provider: "resend",
        messageId: data?.id,
      };
    } catch (err: any) {
      console.error("[Email:Resend Network Error]", err);
      return { success: false, provider: "resend", error: err?.message };
    }
  }

  // 2. SendGrid REST API (alternative)
  if (sendgridKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: {
            email: sender.includes("<")
              ? sender.split("<")[1].replace(">", "").trim()
              : sender,
            name: sender.includes("<") ? sender.split("<")[0].trim() : "Zereyakob",
          },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Email:SendGrid Error]", errorText);
        return { success: false, provider: "sendgrid", error: errorText };
      }

      return {
        success: true,
        provider: "sendgrid",
      };
    } catch (err: any) {
      console.error("[Email:SendGrid Network Error]", err);
      return { success: false, provider: "sendgrid", error: err?.message };
    }
  }

  // 3. Fallback: Log email in development / unconfigured mode
  console.log("--------------------------------------------------");
  console.log("[Email Service] No RESEND_API_KEY or SENDGRID_API_KEY configured.");
  console.log(`[Email Simulation] To: ${to}`);
  console.log(`[Email Simulation] Subject: ${subject}`);
  console.log(`[Email Simulation] Text preview: ${text.slice(0, 200)}...`);
  console.log("--------------------------------------------------");

  return {
    success: true,
    provider: "simulated",
    messageId: `sim_${Date.now()}`,
  };
}

/**
 * Send automated Admin Welcome Email to new staff or administrator
 */
export async function sendAdminWelcomeEmail({
  to,
  name,
  role = "admin",
  loginUrl,
}: {
  to: string;
  name: string;
  role?: string;
  loginUrl?: string;
}): Promise<EmailResult> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";
  const destinationUrl = loginUrl || `${siteUrl}/login`;
  const formattedRole = role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const subject = "Welcome to Zereyakob — You are now an Admin!";

  const textBody = `Hello ${name},

Congratulations! You have been assigned as an administrator (${formattedRole}) for the Zereyakob Non-Profit Kids Learning Initiative in Debre Berhan, Ethiopia.

You can now access the school administration dashboard to manage students, staff, directory profiles, and media galleries.

Access your account here:
${destinationUrl}

Login Email: ${to}

If you have any questions or need assistance, please reply to this email or reach out to the Zereyakob administration.

Warm regards,
Zereyakob Elementary School Team
Debre Berhan University Digital Learning Partnership`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%); padding: 36px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="background-color: #ffffff; border-radius: 12px; padding: 8px 14px; font-weight: 800; font-size: 18px; color: #1e3a8a; letter-spacing: -0.5px;">
                    🎓 Zereyakob
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; line-height: 1.3;">
                Welcome to Zereyakob
              </h1>
              <p style="color: #93c5fd; font-size: 14px; margin: 8px 0 0 0; font-weight: 500;">
                Non-Profit Kids Learning Initiative · Debre Berhan
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                Hello ${name}, congratulations!
              </h2>

              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                You have been assigned as an administrator for the <strong>Zereyakob Non-Profit Kids Learning Initiative</strong>. We are thrilled to welcome you to our mission of bringing digital learning tools and mentorship to children in Debre Berhan.
              </p>

              <!-- Role Callout Box -->
              <table role="presentation" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1d4ed8; margin-bottom: 4px;">
                      Your Assigned Role
                    </div>
                    <div style="font-size: 16px; font-weight: 800; color: #1e3a8a;">
                      ${formattedRole}
                    </div>
                    <div style="font-size: 13px; color: #475569; margin-top: 4px;">
                      Registered Email: <span style="font-family: monospace; color: #0f172a; font-weight: 600;">${to}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 28px 0;">
                With this role, you have administrative access to manage student records, attendance, staff directories, and our digital media library.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #1d4ed8;">
                    <a href="${destinationUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; background-color: #1d4ed8; letter-spacing: -0.2px;">
                      Access Admin Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 8px 0;">
                Or copy and paste this login URL into your browser:
              </p>
              <p style="font-size: 12px; color: #1d4ed8; word-break: break-all; margin: 0 0 24px 0; font-family: monospace;">
                ${destinationUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

              <p style="font-size: 13px; line-height: 1.5; color: #94a3b8; margin: 0;">
                If you did not expect to receive this invitation, please notify our team at <a href="mailto:support@zereyakob.edu.et" style="color: #64748b; text-decoration: underline;">support@zereyakob.edu.et</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0; font-weight: 600;">
                Zereyakob Elementary School &amp; Debre Berhan University
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                Empowering the next generation with digital education and community care.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

/**
 * Send Platform Update & Feature Announcement Broadcast Email
 */
export async function sendBroadcastAnnouncementEmail({
  to,
  recipientName,
  subject,
  title,
  message,
  announcementType = "Platform Update",
  actionUrl,
  actionLabel = "View Updates in Dashboard →",
}: {
  to: string;
  recipientName?: string;
  subject: string;
  title: string;
  message: string;
  announcementType?: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";
  const targetUrl = actionUrl || `${siteUrl}/dashboard`;
  const name = recipientName?.trim() || "Team Member";

  const textBody = `Hello ${name},

[${announcementType}]
${title}

${message}

Access the platform:
${targetUrl}

Warm regards,
Zereyakob Elementary School Administration
Debre Berhan University Digital Learning Partnership`;

  // Format message paragraphs for HTML
  const formattedHtmlParagraphs = message
    .split("\n\n")
    .map(
      (p) =>
        `<p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%); padding: 36px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="background-color: #ffffff; border-radius: 12px; padding: 6px 14px; font-weight: 800; font-size: 14px; color: #1e3a8a; letter-spacing: -0.3px;">
                    📢 ${announcementType}
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; line-height: 1.3;">
                ${title}
              </h1>
              <p style="color: #cbd5e1; font-size: 13px; margin: 8px 0 0 0; font-weight: 500;">
                Zereyakob Elementary School &amp; Debre Berhan University
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                Hello ${name},
              </h2>

              ${formattedHtmlParagraphs}

              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #1d4ed8;">
                    <a href="${targetUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; background-color: #1d4ed8; letter-spacing: -0.2px;">
                      ${actionLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

              <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
                You received this announcement because you are a registered administrator or team member of the Zereyakob digital learning platform.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px 32px; text-align: center;">
              <p style="font-size: 12px; color: #64748b; margin: 0; font-weight: 600;">
                Zereyakob Elementary School · Debre Berhan, Ethiopia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

