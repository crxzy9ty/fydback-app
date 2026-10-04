# Fydback

QR-kód alapú vendégelégedettség-mérés vendéglátóhelyeknek. A vendég az asztalon
lévő kódot beolvasva 30 másodperc alatt értékel öt szempontot; a tulajdonos
óránkénti bontásban látja, mikor és hol csúszik el a kiszolgálás.

**Next.js 16 + Supabase + Vercel.** Éles: https://fydback.hu

> ⚠️ Ez a Next.js verzió eltér a megszokottól — a `middleware.ts` konvenció
> neve `proxy.ts`, és az exportált függvény `proxy`, nem `middleware`. Kód
> írása előtt olvasd el a vonatkozó leírást a `node_modules/next/dist/docs/`
> alatt (lásd `AGENTS.md`).

## Indulás

```bash
npm install
cp .env.example .env.local   # töltsd ki a valódi értékekkel
npm run dev                  # http://localhost:3000
```

Minden környezeti változó szerepe a `.env.example`-ben van dokumentálva. A
`SUPABASE_SECRET_KEY` és az `ADMIN_ROUTE_SECRET` nélkül az admin felület és a
vendég-beküldés nem működik.

## Felületek

| Útvonal | Ki éri el | Mit lát |
|---|---|---|
| `/` | bárki | marketing oldal (a szövege az adatbázisból jön, adminból szerkeszthető) |
| `/demo` | bárki | demó-kérés űrlap |
| `/ertekeles/<partnerId>` | vendég, QR-ból | az értékelő folyamat |
| `/login` → `/dashboard` | partner (`role = 'owner'`) | csak a saját egysége, vendég-e-mail nélkül |
| `/<ADMIN_ROUTE_SECRET>/…` | Fydback csapat (`role = 'admin'`) | minden partner, e-mail címekkel és sorsolással |

Az admin felület egy **titkos, sehonnan nem linkelt URL-en** van: ha a szegmens
nem egyezik az `ADMIN_ROUTE_SECRET`-tel, valódi 404 jön (nem átirányítás — az
elárulná, hogy az útvonal létezik). Ez önmagában nem védelem, csak zajcsökkentés;
a valódi kaput a `role = 'admin'` ellenőrzés jelenti a védett layoutban.

## Adatbázis

A séma a `supabase/migrations/` alatt van, időrendben. **Nincs automatizált
telepítés**: a migrációkat kézzel kell bemásolni a
[Supabase SQL Editorba](https://supabase.com/dashboard/project/cjulxrpikzznfixguejb/sql/new)
és lefuttatni. A CLI-s út (`supabase link` + `supabase db push`) járható lenne,
de a projekt jelenleg nincs linkelve.

**A migrációk sorrendje számít, és a kód gyakran feltételezi a legfrissebbet** —
deploy előtt futtasd le az újakat, különben a Vercel a hiányzó függvényekre
fut hibára.

### Amit tudni érdemes a jogosultságokról

- Minden táblán van RLS, és minden szerepkörnek explicit `revoke`/`grant`.
- **Az `anon` nem tud beszúrni sehova.** A vendég-értékelés egyetlen útja a
  `submit_guest_review()` függvény, amit csak a `service_role` hívhat — a
  szerver pedig egy aláírt, egyszer használatos tokent ellenőriz előtte
  (`src/lib/review-token.ts`).
- A partner (`owner`) **soha nem látja** a vendégek e-mail címét és sorsolási
  azonosítóját: nincs `select` policy-je a `submissions` táblán, csak maszkolt
  nézeteken keresztül ér el adatot.
- A dashboard-statisztikák SQL-ben aggregálódnak. Ez nem teljesítmény-kérdés:
  a PostgREST 1000 sornál **némán** vág, így a JS-oldali összegzés egy idő után
  csendben hibás számokat adott volna.

## Napi sorsolás

Minden éjjel 02:00 UTC-kor fut (`vercel.json`), és **az előző, már lezárt
budapesti napra** sorsol minden partnernél. Azért az előzőre, mert a Vercel
UTC-ben ütemez, a jogosultság viszont budapesti naptári nap — nyáron és télen
más dátumra esne ugyanaz az esti időpont, ráadásul a késő este értékelők
kimaradnának.

A végpont `CRON_SECRET`-tel védett, és **hiányzó titok esetén nem fut le**,
ahelyett hogy védtelenül futna.

## Parancsok

```bash
npm run dev      # fejlesztői szerver
npm run build    # production build (deploy előtt mindig)
npm run lint
npm run invite   # egyszeri meghívó szkript; a felületen is megy: Partnerek → Meghívás
npx tsc --noEmit # típusellenőrzés
```

## Dokumentáció

- `reference/fydback-termek-brief.md` — **önálló termékleírás**: mit tud, kinek,
  milyen döntések születtek. Bemásolható egy AI-beszélgetésbe ötleteléshez.
- `reference/audit-2026-07-30.md` — kódaudit, a talált hibák és a státuszuk
- `reference/fydback-attekintes-eredeti.md` — az eredeti tervezési napló. Üzleti
  része (árazás, csomagok, partnerszerzés) érvényes; a technikai állításai
  elavultak, és szándékosan a régi „Guestly" nevet használja.
- `AGENTS.md` / `CLAUDE.md` — utasítások AI-asszisztensnek
