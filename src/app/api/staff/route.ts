import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

const STAFF_ROLES = ["admin", "teacher", "staff"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  if (!supabase) return { admin: null, error: json({ code: "not_configured" }, 503) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admin: null, error: json({ code: "unauthorized" }, 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "super_admin") {
    return { admin: null, error: json({ code: "forbidden" }, 403) };
  }
  return { admin: null, error: null, user };
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  if (!admin) return json({ code: "missing_secret" }, 503);

  let body: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    profession?: string;
    title?: string;
    bio?: string;
    avatar_url?: string;
    is_public?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json({ code: "invalid_body" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const firstName = (body.first_name ?? "").trim();
  const lastName = (body.last_name ?? "").trim();
  const role = body.role as StaffRole;

  if (!email || !STAFF_ROLES.includes(role)) {
    return json({ code: "invalid_fields" }, 400);
  }
  if (!firstName || !lastName) {
    return json({ code: "invalid_fields" }, 400);
  }

  const details: Record<string, string | boolean> = {
    profession: (body.profession ?? "").trim(),
    title: (body.title ?? "").trim(),
    bio: (body.bio ?? "").trim(),
    avatar_url: (body.avatar_url ?? "").trim(),
    is_public: body.is_public === true,
  };

  // If an account already exists for this email, link it to the staff role
  // instead of creating a duplicate.
  const { data: linked } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (linked?.id) {
    const { error } = await admin
      .from("profiles")
      .update({
        role,
        first_name: firstName,
        last_name: lastName,
        ...details,
      })
      .eq("id", linked.id);
    if (error) return json({ code: "db_error", message: error.message }, 500);
    return json({ ok: true, created: false, id: linked.id });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });
  if (error) return json({ code: "create_failed", message: error.message }, 400);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, first_name: firstName, last_name: lastName, ...details })
    .eq("id", data.user.id);
  if (profileError) return json({ code: "db_error", message: profileError.message }, 500);

  return json({ ok: true, created: true, id: data.user.id });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  if (!admin) return json({ code: "missing_secret" }, 503);

  let body: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    profession?: string;
    title?: string;
    bio?: string;
    avatar_url?: string;
    is_public?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json({ code: "invalid_body" }, 400);
  }

  const id = body.id ?? "";
  if (!id) return json({ code: "invalid_fields" }, 400);

  const profilePatch: Record<string, string | boolean> = {};
  if (body.role !== undefined) {
    if (!STAFF_ROLES.includes(body.role as StaffRole)) {
      return json({ code: "invalid_fields" }, 400);
    }
    profilePatch.role = body.role;
  }
  if (body.first_name !== undefined) profilePatch.first_name = body.first_name.trim();
  if (body.last_name !== undefined) profilePatch.last_name = body.last_name.trim();
  if (body.profession !== undefined) profilePatch.profession = body.profession.trim();
  if (body.title !== undefined) profilePatch.title = body.title.trim();
  if (body.bio !== undefined) profilePatch.bio = body.bio.trim();
  if (body.avatar_url !== undefined) profilePatch.avatar_url = body.avatar_url.trim();
  if (body.is_public !== undefined) profilePatch.is_public = body.is_public === true;

  if (body.email !== undefined && (body.email ?? "").trim().toLowerCase() !== "") {
    const { error: emailError } = await admin.auth.admin.updateUserById(id, {
      email: body.email.trim().toLowerCase(),
      email_confirm: true,
    });
    if (emailError) return json({ code: "update_failed", message: emailError.message }, 400);
    profilePatch.email = body.email.trim().toLowerCase();
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", id);
    if (error) return json({ code: "db_error", message: error.message }, 500);
  }

  return json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  if (!admin) return json({ code: "missing_secret" }, 503);

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // fall through — deletion may also come via query param
  }
  const id = body.id ?? new URL(request.url).searchParams.get("id") ?? "";

  if (!id) return json({ code: "invalid_fields" }, 400);
  if (id === auth.user?.id) return json({ code: "self_delete" }, 400);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return json({ code: "delete_failed", message: error.message }, 400);

  return json({ ok: true });
}