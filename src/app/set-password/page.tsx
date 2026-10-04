"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword, type AuthActionState } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/Logo";

const initialState: AuthActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-11 w-full rounded-lg bg-ink text-sm font-bold text-white transition-opacity disabled:opacity-60"
    >
      {pending ? "Mentés…" : "Jelszó beállítása"}
    </button>
  );
}

// Reached two different ways, which need two different fixes here:
//   1. A PKCE link goes through /auth/callback, a server route that exchanges
//      a `?code=` for a session and sets the cookie itself — this page just
//      renders the form, session already set. Password reset no longer uses
//      this (it needs the requesting browser, see requestPasswordReset).
//   2. A password reset or admin/owner invite email is an IMPLICIT-flow link: Supabase
//      generates it via the admin API on OUR server, so there is no browser
//      anywhere holding the PKCE code_verifier a `?code=` exchange would
//      need. Supabase's only option is to hand back the session as a
//      `#access_token=…` URL FRAGMENT — which a server route can never see
//      (fragments never leave the browser). Without the effect below, that
//      left invited users on a page with no session, `updatePassword` failing
//      silently, and no working way forward except "Elfelejtett jelszó".
// The effect below reads that fragment itself and calls setSession()
// explicitly — NOT the browser client's automatic detectSessionInUrl, which
// only recognizes a `?code=` (see the effect's own comment for why) — turning
// it into the same session cookie case 1 already has, so covering case 2 here
// doesn't touch case 1 at all.
export default function SetPasswordPage() {
  const [state, formAction] = useActionState(updatePassword, initialState);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.slice(1));
      // The fragment only exists in the browser, so it can only be read after
      // mount; this runs once, so there is no render cascade to worry about.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkError(
        params.get("error_code") === "otp_expired"
          ? "Ez a link már lejárt — kérj egy újat."
          : "Ez a link már nem érvényes — kérj egy újat.",
      );
      setReady(true);
      return;
    }
    const supabase = createClient();

    const finish = () => {
      // Drops the spent #access_token=… from the address bar so a refresh
      // or an accidentally-reshared URL can't resubmit it.
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setReady(true);
    };

    // @supabase/ssr's browser client hardcodes flowType: "pkce" (see its own
    // createBrowserClient.js) — its automatic detectSessionInUrl only ever
    // looks for a `?code=` query param, never a `#access_token=` fragment.
    // It silently finds nothing here and resolves getSession() to null,
    // which an earlier version of this effect treated as "done" regardless
    // — rendering the form with no session ever established, so submitting
    // it always failed server-side with "Auth session missing!". Reading
    // the fragment ourselves and calling setSession() explicitly sidesteps
    // that detection path entirely; it isn't heuristic, so flowType doesn't
    // matter.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(finish);
    } else {
      // No fragment tokens — either the PKCE `?code=` path already set the
      // session server-side (password reset), or this is a stray visit with
      // no session at all. Either way there's nothing for us to extract.
      supabase.auth.getSession().then(finish);
    }
  }, []);

  if (!ready) {
    return <div className="min-h-full bg-mist" />;
  }

  if (linkError) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-mist px-6 py-16 text-center">
        <div className="mb-7 flex items-center gap-2">
          <Logo size={18} />
        </div>
        <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-[0_20px_50px_rgba(21,19,28,0.08)]">
          <p className="text-sm text-slate">{linkError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-mist px-6 py-16">
      <div className="mb-7 flex items-center gap-2">
        <Logo size={18} />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-[0_20px_50px_rgba(21,19,28,0.08)]">
        <h1 className="mb-1 text-xl font-bold tracking-tight text-ink">Jelszó beállítása</h1>
        <p className="mb-6 text-sm text-slate">Add meg az új jelszavadat a fiókodhoz.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-ink">
              Új jelszó
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-bold text-ink">
              Új jelszó megerősítése
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none"
            />
          </div>

          {state.error && <p className="text-sm font-medium text-magenta">{state.error}</p>}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
