/**
 * Seed an admin user into Supabase Auth (+ profiles if the table exists).
 *
 * Usage:  npx tsx scripts/seed-admin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local / .env (no dotenv dependency needed)
function loadEnv(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // file not found — skip silently
  }
}

const projectRoot = resolve(import.meta.dirname, "..");
loadEnv(resolve(projectRoot, ".env.local"));
loadEnv(resolve(projectRoot, ".env"));

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_FULL_NAME = "Administrator";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ----- 1. Check if user already exists -----
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("❌  Failed to list users:", listError.message);
    process.exit(1);
  }

  const existing = existingUsers.users.find((u) => u.email === ADMIN_EMAIL);
  let userId: string;

  if (existing) {
    console.log(`ℹ️  User ${ADMIN_EMAIL} already exists (id: ${existing.id}).`);
    userId = existing.id;
  } else {
    // ----- 2. Create auth user -----
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // skip email verification
      user_metadata: { full_name: ADMIN_FULL_NAME },
    });

    if (createError) {
      console.error("❌  Failed to create user:", createError.message);
      process.exit(1);
    }

    console.log(`✅  Created auth user: ${newUser.user.email} (id: ${newUser.user.id})`);
    userId = newUser.user.id;
  }

  // ----- 3. Try to set profile role to admin (if profiles table exists) -----
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      full_name: ADMIN_FULL_NAME,
      role: "admin",
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    if (upsertError.message.includes("Could not find the table")) {
      console.log("ℹ️  Profiles table not found — skipping role assignment.");
      console.log("   Apply the profiles migration first, then re-run this script.");
    } else {
      console.error("⚠️  Failed to set admin profile:", upsertError.message);
    }
  } else {
    console.log("✅  Profile role set to 'admin'.");
  }

  console.log(`\n🔑  Login credentials:\n   Email:    ${ADMIN_EMAIL}\n   Password: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
