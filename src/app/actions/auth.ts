"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";

export type AuthActionState = {
  error: string | null;
  success?: boolean;
};

// The base URL password-reset links point at. Read from configuration ONLY —
// never from the request.
//
// This used to prefer the `Origin` header, which the client fully controls: a
// crafted request with `Origin: https://attacker.example` would have produced a
// reset link pointing there, handing the recovery token to whoever sent it, for
// any address they cared to name. Supabase's own redirect allow-list is a
// second line of defence, but it is configured elsewhere and easy to widen by
// accident, so this must not depend on it.
function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Owner login (email + password). The /dashboard layout independently verifies
// profiles.role === 'owner', and RLS independently restricts what an owner can
// reach, so neither depends on the role check here.
//
// The role IS checked here anyway, purely for the error message: an admin
// signing in on this form used to authenticate successfully, get redirected to
// /dashboard, be bounced straight back by that layout's role gate, and land on
// this page again with no explanation — indistinguishable from a wrong
// password, with correct credentials.
export async function signInOwner(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Hibás e-mail cím vagy jelszó." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "admin") {
    // Deliberately vague about WHERE the admin area is — this form is public,
    // and the admin route's only obscurity is that its URL isn't published.
    await supabase.auth.signOut();
    return { error: "Ez egy admin fiók — az admin felület saját bejelentkezési címen érhető el." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Admin login: same credentials check, but ALSO rejects non-admin accounts
// here (defense in depth — the [adminSlug]/(protected) layout enforces this
// independently regardless of what this action does).
export async function signInAdmin(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const adminSlug = String(formData.get("adminSlug") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Hibás e-mail cím vagy jelszó." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Ehhez a fiókhoz nincs admin jogosultság." };
  }

  revalidatePath("/", "layout");
  redirect(`/${adminSlug}`);
}

export async function signOutOwner() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function signOutAdmin(adminSlug: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${adminSlug}/login`);
}

// Minimum gap between two reset emails to the same account. The reset link is
// generated and mailed by us (see below), so unlike resetPasswordForEmail it
// has no built-in Supabase rate limit — without this, anyone could submit a
// known address in a loop and flood that person's inbox.
const RESET_COOLDOWN_MS = 60_000;

// Sends a password reset email. Used both for "forgot password" and as the
// fallback an invited owner/admin uses to set their first password.
//
// WHY WE GENERATE AND SEND THE LINK OURSELVES instead of calling
// resetPasswordForEmail from the SSR client: that route issues a PKCE `?code=`
// that can only be exchanged by the browser that requested it (the
// code_verifier lives in that browser's cookies). Anyone who requested the
// reset in an installed home-screen web app — which has its own cookie jar —
// and then tapped the email link, which opens in the phone's default browser,
// landed on /login?error=auth with no way forward. A link generated through
// the admin API carries the session in the URL fragment instead, works in any
// browser, and is already handled by /auth/callback and /set-password (the
// admin/owner invites take the same path).
//
// The response never reveals whether the address has an account, matching
// what resetPasswordForEmail did.
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Add meg az e-mail címed." };
  }

  const admin = createAdminClient();

  // profiles.email mirrors auth.users.email, and the admin client is needed
  // because this caller is anonymous and RLS hides profiles from them.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) {
    return { error: null, success: true };
  }

  const { data: existing } = await admin.auth.admin.getUserById(profile.id);
  const lastSent = existing?.user?.recovery_sent_at;
  if (lastSent && Date.now() - new Date(lastSent).getTime() < RESET_COOLDOWN_MS) {
    return { error: null, success: true };
  }

  const { data: generated, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password` },
  });

  const link = generated?.properties?.action_link;
  if (error || !link) {
    console.error("[auth] generateLink(recovery) failed:", error?.message);
    return { error: "Hiba történt, próbáld újra." };
  }

  await sendEmail({
    to: email,
    subject: "Jelszó visszaállítása – Fydback",
    text: [
      "Jelszó-visszaállítást kértél a Fydback fiókodhoz.",
      "",
      `Új jelszó beállítása: ${link}`,
      "",
      "A link rövid ideig érvényes, és egyszer használható. Bármelyik böngészőben megnyithatod.",
      "Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt az e-mailt.",
    ].join("\n"),
    html: `
      <h2 style="margin:0 0 16px;font-size:20px;color:#15131c;">Jelszó visszaállítása</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#15131c;">
        Kattints az alábbi gombra az új jelszavad beállításához. A link bármelyik böngészőben megnyitható.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#15131c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          Új jelszó beállítása
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#6b6878;">
        A link rövid ideig érvényes, és egyszer használható. Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt az e-mailt.
      </p>
    `,
  });

  return { error: null, success: true };
}

// Sets a new password for the currently-authenticated user (reached via the
// /auth/callback code-exchange redirect after clicking an invite/reset link).
export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "A jelszónak legalább 8 karakter hosszúnak kell lennie." };
  }
  if (password !== confirmPassword) {
    return { error: "A két jelszó nem egyezik." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Was previously swallowed entirely — every failure reported the same
    // generic "request a new link" regardless of cause, indistinguishable
    // from the log's point of view whether the session never existed, had
    // expired, or Supabase's own password policy rejected the value.
    console.error(`[updatePassword] failed (code=${error.code ?? "?"}):`, error.message);
    if (error.code === "weak_password") {
      return { error: "Ez a jelszó nem elég erős. Próbálj egy hosszabbat, számmal és nagybetűvel." };
    }
    return { error: "Nem sikerült frissíteni a jelszót. Kérj egy új linket." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // updateUser() above succeeding implies a session, but a token that expires
  // in between still returns null here — and a non-null assertion would turn
  // that into an unhandled TypeError instead of a recoverable error message.
  if (!user) {
    return { error: "A munkamenet lejárt. Kérj egy új linket." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  revalidatePath("/", "layout");
  redirect(profile?.role === "admin" ? `/${process.env.ADMIN_ROUTE_SECRET}` : "/dashboard");
}
