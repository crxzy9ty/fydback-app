// One-off manual bootstrap/testing script. Not part of the app runtime.
//
// Usage:
//   npx tsx scripts/invite-owner.ts --email=anna@kavezoaroma.hu --role=owner --partner=<partnerId1>,<partnerId2>
//   npx tsx scripts/invite-owner.ts --email=you@fydback.hu --role=admin
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
// Sends a real Supabase invite email (subject to the project's SMTP rate
// limits — see the note in .env.example) that lands the recipient on
// /auth/callback -> /set-password to choose their own password.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
import type { Database } from "../src/lib/supabase/database.types";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const email = args.get("email");
  const role = args.get("role") ?? "owner";
  const partnerIds = (args.get("partner") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!email) {
    console.error("Missing --email=<address>");
    process.exit(1);
  }
  if (role !== "owner" && role !== "admin") {
    console.error("--role must be 'owner' or 'admin'");
    process.exit(1);
  }
  if (role === "owner" && partnerIds.length === 0) {
    console.warn(
      "Warning: no --partner=<id,...> given — this owner will have zero partner_members rows and see an empty dashboard until an admin assigns a venue.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!url || !secretKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role },
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    console.error("Invite failed:", error?.message);
    process.exit(1);
  }

  console.log(`Invited ${email} as '${role}' (user id: ${data.user.id}).`);

  if (role === "owner" && partnerIds.length > 0) {
    const rows = partnerIds.map((partner_id) => ({ partner_id, user_id: data.user!.id }));
    const { error: linkError } = await supabase.from("partner_members").insert(rows);
    if (linkError) {
      console.error("Invite succeeded, but linking partners failed:", linkError.message);
      process.exit(1);
    }
    console.log(`Linked to ${partnerIds.length} partner(s): ${partnerIds.join(", ")}`);
  }
}

main();
