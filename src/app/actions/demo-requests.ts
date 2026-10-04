"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail, escapeHtml } from "@/lib/email";

export type DemoRequestState = { ok: boolean; error: string | null };

// RLS grants INSERT on demo_requests to anon + authenticated with a
// no-restriction check(true) — see supabase/migrations/..._rls_policies_and_grants.sql.
export async function submitDemoRequest(
  _prevState: DemoRequestState,
  formData: FormData,
): Promise<DemoRequestState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("demo_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", oneHourAgo);
  const recentlySentToThisEmail = (recentCount ?? 0) > 0;

  const { error } = await supabase.from("demo_requests").insert({ name, email, business, message });

  if (error) {
    return { ok: false, error: "Hiba történt, kérjük próbáld újra." };
  }

  // Best-effort, non-blocking: the request is already saved even if either
  // email fails to send (e.g. RESEND_API_KEY not configured yet), and even
  // if we skip sending because of the throttle above.
  if (!recentlySentToThisEmail) {
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

  const notifyAddress = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (notifyAddress) {
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
