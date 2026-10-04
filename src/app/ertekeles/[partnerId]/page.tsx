import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mintReviewToken } from "@/lib/review-token";
import { resolveContent } from "@/lib/content";
import { resolvePrizeText, prizeConfirmedBody } from "@/lib/prize-copy";
import { GuestReviewFlow } from "./GuestReviewFlow";

// Rendered per request so every visitor gets a fresh, single-use token; a
// cached page would hand the same spent token to everyone after the first.
export const dynamic = "force-dynamic";

export default async function GuestReviewPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const supabase = await createClient();

  const [{ data: partner }, { data: contentRow }] = await Promise.all([
    supabase
      .from("partners")
      .select("id, name, question_set_id, alert_threshold, prize_frequency, prize_description")
      .eq("id", partnerId)
      .maybeSingle(),
    supabase.from("content_settings").select("content").eq("id", 1).maybeSingle(),
  ]);

  if (!partner) {
    return (
      <Centered>
        <h1 className="mb-2 text-xl font-bold text-ink">Ez a link nem érvényes</h1>
        <p className="text-sm text-slate">
          Ez a QR-kód vagy link nem tartozik aktív egységhez. Kérdezd meg a pultosnál a helyes kódot.
        </p>
      </Centered>
    );
  }

  const { data: aspects } = await supabase
    .from("question_aspects")
    .select("key, label, icon")
    .eq("question_set_id", partner.question_set_id ?? "")
    .order("sort_order").order("id");

  if (!aspects || aspects.length === 0) {
    return (
      <Centered>
        <h1 className="mb-2 text-xl font-bold text-ink">Egy pillanat…</h1>
        <p className="text-sm text-slate">
          Ehhez az egységhez még nincs beállítva kérdéssor — szólj a pultosnak.
        </p>
      </Centered>
    );
  }

  const frequency = partner.prize_frequency === "monthly" ? "monthly" : "weekly";
  const prizeText = resolvePrizeText(partner.prize_description, resolveContent(contentRow?.content).defaultPrizeDescription);

  const cookieStore = await cookies();
  const dedupCookie = cookieStore.get(`gst_rev_${partnerId}`)?.value;

  if (dedupCookie) {
    // Submitting sets this cookie, and setting a cookie in a Server Action
    // re-renders the route — so without this window the guest's confirmation
    // was instantly replaced by the returning-visitor message, right after
    // they handed over an email address for the draw. Within a few minutes of
    // submitting, show what they actually just did.
    const [state, submittedAtRaw] = dedupCookie.split(".");
    const submittedAt = Number(submittedAtRaw);
    // A Server Component rendered fresh per request (force-dynamic), so reading
    // the clock here is the intent, not an impurity that could go stale.
    // eslint-disable-next-line react-hooks/purity
    const justSubmitted = Number.isFinite(submittedAt) && Date.now() - submittedAt < 5 * 60 * 1000;

    if (justSubmitted && state === "prize") {
      return (
        <Centered dark>
          <div className="mb-2 text-4xl">✓</div>
          <h1 className="mb-2 text-xl font-bold text-white">Sikeres jelentkezés!</h1>
          <p className="text-sm text-white/70">{prizeConfirmedBody(frequency)}</p>
        </Centered>
      );
    }

    if (justSubmitted) {
      return (
        <Centered dark>
          <div className="mb-2 text-4xl">☕</div>
          <h1 className="mb-2 text-xl font-bold text-white">Köszönjük az időt!</h1>
          <p className="text-sm text-white/70">Az értékelésed megérkezett.</p>
        </Centered>
      );
    }

    return (
      <Centered dark>
        <div className="mb-3 text-4xl">☕</div>
        <h1 className="mb-2 text-xl font-bold text-white">Már értékeltél ma</h1>
        <p className="text-sm text-white/70">
          Köszönjük, hogy megosztottad velünk a véleményed — legközelebbi látogatásodkor újra
          várjuk az értékelésed.
        </p>
      </Centered>
    );
  }

  return (
    <GuestReviewFlow
      partnerId={partner.id}
      partnerName={partner.name}
      prizeFrequency={frequency}
      prizeText={prizeText}
      aspects={aspects}
      token={mintReviewToken(partner.id)}
    />
  );
}

function Centered({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-full flex-1 flex-col items-center justify-center px-8 py-16 text-center ${
        dark ? "bg-ink" : "bg-paper"
      }`}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
