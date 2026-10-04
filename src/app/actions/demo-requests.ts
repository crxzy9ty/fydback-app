"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";

export type DemoRequestState = { ok: boolean; error: string | null };

// Site-wide ceiling on demo-request emails per hour. The per-address cap below
// stops one inbox being flooded, but rotating through addresses would still
// let a script mail a stream of strangers from our domain. Real demo requests
// arrive a few per day, so this only ever trips under abuse — the requests
// are still saved, just not mailed.
const MAX_DEMO_EMAILS_PER_HOUR = 20;

// RLS grants INSERT on demo_requests to anon + authenticated with a
// no-restriction check(true) — see supabase/migrations/..._rls_policies_and_grants.sql.
export async function submitDemoRequest(
  _prevState: DemoRequestState,
  formData: FormData,
): Promise<DemoRequestState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const business = String(formData.get("business") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!name || !email || !business) {
    return { ok: false, error: "Kérjük, töltsd ki a kötelező mezőket." };
  }

  // The checkbox is marked `required` in the markup, but that is a client-side
  // affordance only — a direct POST skips it entirely, and consent that can be
  // bypassed is not consent. Checked here so the record is never written
  // without it.
  if (!formData.get("consent")) {
    return { ok: false, error: "Az adatkezelési hozzájárulás megadása kötelező." };
  }

  const supabase = await createClient();

  // This form has no auth and no CAPTCHA, so it's a plausible target for
  // "send arbitrary HTML mail from our verified domain to an address I
  // don't own" abuse. Capping confirmation emails per target address to
  // one per hour doesn't stop the request being recorded, just the spam.
  //
  // The count MUST use the admin client: RLS lets only admins read
  // demo_requests, so this query run as the anonymous visitor always came back
  // empty and the cap never applied. The email is lowercased above so
  // "A@x.hu" and "a@x.hu" count as the same address.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const [{ count: recentCount }, { count: hourlyTotal }] = await Promise.all([
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo),
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo),
  ]);
  const recentlySentToThisEmail = (recentCount ?? 0) > 0;
  const skipEmails = recentlySentToThisEmail || (hourlyTotal ?? 0) >= MAX_DEMO_EMAILS_PER_HOUR;

  const { error } = await supabase.from("demo_requests").insert({ name, email, business, message });

  if (error) {
    return { ok: false, error: "Hiba történt, kérjük próbáld újra." };
  }

  // Best-effort, non-blocking: the request is already saved even if either
  // email fails to send (e.g. RESEND_API_KEY not configured yet), and even
  // if we skip sending because of the throttle above.
  if (!skipEmails) {
    const firstName = name.split(" ")[0];
    await sendEmail({
      to: email,
      subject: `Megkaptuk a demó-kérésed — ${business}`,
      text: [
        `Szia ${firstName}!`,
        ``,
        `Köszönjük a jelentkezést a(z) ${business} nevében. Hamarosan felvesszük veled a kapcsolatot, hogy egyeztessünk egy 15 perces bemutatót.`,
        ``,
        `Ezt a levelet azért kaptad, mert demót kértél a fydback.hu oldalon.`,
        `Fydback`,
      ].join("\n"),
      html: `
        <p>Szia ${escapeHtml(firstName)}!</p>
        <p>Köszönjük a jelentkezést a(z) <strong>${escapeHtml(business)}</strong> nevében — hamarosan felvesszük veled a kapcsolatot,
        hogy egyeztessünk egy 15 perces bemutatót.</p>
        <hr style="border:none;border-top:1px solid #e6e4ee;margin:24px 0">
        <p style="font-size:12px;color:#6b6880">
          Ezt a levelet azért kaptad, mert demót kértél a Fydback oldalán.
        </p>
      `,
    });
  }

  // Same throttle for the admin's own notification: a repeat from the same
  // address is already in the inbox, and a flood should not bury real ones.
  const notifyAddress = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (notifyAddress && !skipEmails) {
    await sendEmail({
      to: notifyAddress,
      subject: `Új demó-kérés: ${business}`,
      html: `
        <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) demót kért a(z) <strong>${escapeHtml(business)}</strong> nevében.</p>
        ${message ? `<p>Üzenet: ${escapeHtml(message)}</p>` : ""}
      `,
    });
  }

  return { ok: true, error: null };
}
