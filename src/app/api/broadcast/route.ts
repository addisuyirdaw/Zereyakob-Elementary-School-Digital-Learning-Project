import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBroadcastAnnouncementEmail } from "@/lib/email";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: json({ code: "not_configured" }, 503) };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ code: "unauthorized" }, 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin") {
    return { error: json({ code: "forbidden" }, 403) };
  }
  return { error: null };
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  if (!admin) return json({ code: "missing_secret" }, 503);

  let body: {
    subject?: string;
    title?: string;
    message?: string;
    announcementType?: string;
    actionUrl?: string;
    actionLabel?: string;
    targetRoles?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return json({ code: "invalid_body" }, 400);
  }

  const subject = (body.subject ?? "").trim();
  const title = (body.title ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!subject || !title || !message) {
    return json({ code: "missing_fields", message: "subject, title and message are required" }, 400);
  }

  const targetRoles = body.targetRoles ?? ["super_admin", "admin", "teacher", "staff"];

  // Fetch all staff profiles with their email and name
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .in("role", targetRoles)
    .neq("email", "");

  if (profilesError) {
    return json({ code: "db_error", message: profilesError.message }, 500);
  }

  if (!profiles || profiles.length === 0) {
    return json({ code: "no_recipients", message: "No staff members found with matching roles" }, 404);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";

  // Send emails — one per recipient, personalized
  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
      const result = await sendBroadcastAnnouncementEmail({
        to: profile.email,
        recipientName: name,
        subject,
        title,
        message,
        announcementType: body.announcementType || "Platform Update",
        actionUrl: body.actionUrl || `${siteUrl}/dashboard`,
        actionLabel: body.actionLabel || "View in Dashboard →",
      });
      return { email: profile.email, name, ...result };
    })
  );

  const sent = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value.success)
    .map((r) => r.value);

  const failed = results
    .filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success)
    )
    .map((r) =>
      r.status === "rejected"
        ? { error: String(r.reason) }
        : r.value
    );

  return json({
    ok: true,
    totalRecipients: profiles.length,
    sent: sent.length,
    failed: failed.length,
    provider: sent[0]?.provider ?? "simulated",
    details: { sent, failed },
  });
}

// GET — return the list of staff recipients (for preview in dashboard)
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  if (!admin) return json({ code: "missing_secret" }, 503);

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .in("role", ["super_admin", "admin", "teacher", "staff"])
    .neq("email", "")
    .order("role")
    .order("first_name");

  if (error) return json({ code: "db_error", message: error.message }, 500);

  return json({ ok: true, recipients: profiles ?? [] });
}
