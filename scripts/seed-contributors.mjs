// Seeds the core project contributors as public directory entries using the
// supported auth admin API. Run from the project root:
//   node --env-file=.env.local scripts/seed-contributors.mjs
//
// The on_auth_user_created trigger (migrations 00003) auto-creates a profile
// for each new auth user (role "student"), then this script promotes it to a
// public "staff" profile. Idempotent: existing emails are only promoted.
//
// Do NOT seed these via raw INSERTs into auth.users — on hosted Supabase that
// produces rows GoTrue cannot see, and dashboard edits then fail with
// "User not found".

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const contributors = [
  ["contributor.derssiem@zereyakob.edu.et", "Derssie", "M."],
  ["contributor.engineerabiy@zereyakob.edu.et", "Engineer", "Abiy"],
  ["contributor.beteldbu@zereyakob.edu.et", "Dr Betel", "Dbu"],
  ["contributor.drseble@zereyakob.edu.et", "Dr Seble", ""],
  ["contributor.elfneshkg@zereyakob.edu.et", "Memhr Elfnesh", "Kg"],
  ["contributor.qtsanet@zereyakob.edu.et", "Qtsanet", ""],
  ["contributor.temketem@zereyakob.edu.et", "Temketem", "Tsige"],
  ["contributor.yettie@zereyakob.edu.et", "Yettie", "Kebede"],
];

let ok = 0;
let warn = 0;

for (const [email, first, last] of contributors) {
  const { data: existing } = await admin
    .from("profiles")
    .select("id,role,is_public")
    .eq("email", email)
    .maybeSingle();

  if (existing && existing.id) {
    const { error } = await admin
      .from("profiles")
      .update({ role: "staff", is_public: true })
      .eq("id", existing.id);
    if (error) {
      console.error(`! ${email}: promote failed: ${error.message}`);
      warn++;
    } else {
      console.log(`= ${email}: already exists, ensured public staff`);
    }
    ok++;
    continue;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: first, last_name: last },
  });

  if (error || !created) {
    console.error(`! ${email}: createUser failed: ${error?.message ?? "no data"}`);
    warn++;
    continue;
  }

  const userId = created.user?.id ?? created.id;
  const { error: promoteError } = await admin
    .from("profiles")
    .update({ role: "staff", is_public: true })
    .eq("id", userId);

  if (promoteError) {
    console.error(`! ${email}: promote failed after create: ${promoteError.message}`);
    warn++;
    continue;
  }

  console.log(`+ ${email}: created ${userId}`);
  ok++;
}

console.log(`Done: ${ok} processed, ${warn} warnings.`);