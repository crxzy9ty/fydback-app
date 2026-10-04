"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAdmin, type AuthActionState } from "@/app/actions/auth";
import { Logo } from "@/app/Logo";

const initialState: AuthActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #22E5EA 0%, #5B21B6 55%, #E619C8 100%)" }}
    >
      {pending ? "Belépés…" : "Belépés"}
    </button>
  );
}

export default function AdminLoginPage() {
  const [state, formAction] = useActionState(signInAdmin, initialState);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-ink px-6 py-16">
      <div className="mb-7 flex items-center gap-2">
        <Logo size={18} variant="dark" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#201D29] p-8">
        <div className="mb-2.5 text-[10px] font-bold tracking-[0.1em] text-cyan uppercase">
          Belső hozzáférés
        </div>
        <h1 className="mb-1 text-xl font-bold tracking-tight text-white">Admin bejelentkezés</h1>
        <p className="mb-6 text-sm text-white/55">Csak a Fydback csapata számára.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-white">
              E-mail cím
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="te@fydback.hu"
              className="h-11 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-white">
              Jelszó
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm text-white outline-none"
            />
          </div>

          {state.error && <p className="text-sm font-medium text-magenta">{state.error}</p>}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
