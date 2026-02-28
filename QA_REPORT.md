# QA / SDET / Security / UX Review — SecureStaff v1.0

> **Reviewer**: Lead QA/SDET + Security + UX
> **Datum**: 28 februari 2026
> **Build**: `next build` ✅ zero errors
> **Stack**: Next.js 14.2 (Turbopack), Prisma/SQLite, NextAuth JWT, SWR, Zod, ExcelJS, Tailwind CSS

---

## A) SYSTEM MAP

### A1. Pagina's / routes

| # | Route | Rol | Beschrijving |
|---|-------|-----|-------------|
| 1 | `/` | alle | Redirect → `/dashboard` of `/login` |
| 2 | `/login` | public | Login form, credentials provider |
| 3 | `/dashboard` | alle | KPI's, komende shifts, beschikbaarheid |
| 4 | `/planning` | alle | Week/maand kalender. Admin: CRUD shifts+toewijzing. Employee: read-only |
| 5 | `/open-shifts` | alle | Employee: aanvragen. Admin: overzicht |
| 6 | `/availability` | alle | Tab 1: Vaste beschikbaarheid (CRUD per weekdag). Tab 2: Uitzonderingen (CRUD per datum, weekview, kopieer week) |
| 7 | `/employees` | ADMIN | CRUD medewerkers |
| 8 | `/admin/reports` | ADMIN, MANAGER | Rapportages + CSV/XLSX export |
| 9 | `/settings` | alle | Profiel bewerken + wachtwoord wijzigen |

### A2. API endpoints

| # | Method | Endpoint | Auth | Roles |
|---|--------|----------|------|-------|
| 1 | POST | `/api/auth/[...nextauth]` | public | – |
| 2 | POST | `/api/auth/change-password` | session | alle |
| 3 | GET/PUT | `/api/profile` | session | alle (own) |
| 4 | GET/POST | `/api/employees` | session | ADMIN(+MANAGER GET) |
| 5 | PUT/DELETE | `/api/employees/[id]` | session | ADMIN |
| 6 | GET/POST/PUT/DELETE | `/api/recurring-availability` | session | alle (own) |
| 7 | GET/POST/PUT/DELETE | `/api/availability-exceptions` | session | alle (own) |
| 8 | POST | `/api/availability-exceptions/copy-week` | session | alle (own) |
| 9 | GET/POST/PUT/DELETE | `/api/availability` | session | alle (own, admin read all) |
| 10 | GET/POST | `/api/shifts` | session | alle GET, ADMIN POST |
| 11 | PUT/DELETE | `/api/shifts/[id]` | session | ADMIN |
| 12 | GET/POST | `/api/shift-requests` | session | alle |
| 13 | PUT | `/api/shift-requests/[id]` | session | ADMIN |
| 14 | GET | `/api/shift-requests/open` | session | alle |
| 15 | GET | `/api/employee-status` | session | ADMIN |
| 16 | GET | `/api/reports` | session | ADMIN, MANAGER |
| 17 | GET | `/api/reports/export` | session | ADMIN, MANAGER |
| 18 | GET | `/api/reports/export-excel` | session | ADMIN, MANAGER |
| 19 | GET | `/api/dashboard` | session | alle |

### A3. Database modellen

| Model | Relaties |
|-------|----------|
| User | → Availability[], RecurringAvailability[], AvailabilityException[], ShiftUser[], ShiftRequest[] |
| Availability | → User (legacy tabel, niet meer in UI) |
| RecurringAvailability | → User. Index: (userId, weekday) |
| AvailabilityException | → User. Index: (userId, date) |
| Shift | → ShiftUser[], ShiftRequest[]. Index: (date), (status) |
| ShiftUser | → Shift, User. Unique: (shiftId, userId) |
| ShiftRequest | → Shift, User. Unique: (shiftId, userId) |
| Location | Standalone (niet gelinkt aan Shift.location – string veld) |

### A4. Rol-rechten matrix

| Actie | ADMIN | MANAGER | EMPLOYEE |
|-------|:-----:|:-------:|:--------:|
| Login/logout | ✅ | ✅ | ✅ |
| Dashboard lezen | ✅ (alles) | ✅ (alles) | ✅ (eigen) |
| Eigen profiel bewerken | ✅ | ✅ | ✅ |
| Wachtwoord wijzigen | ✅ | ✅ | ✅ |
| Medewerkers CRUD | ✅ | ❌ (lijst lezen) | ❌ |
| Diensten aanmaken/bewerken | ✅ | ❌ | ❌ |
| Diensten bekijken | ✅ (alle) | ✅ (alle) | ✅ (eigen) |
| Open shift aanvragen | ❌* | ✅ | ✅ |
| Shift request approve/reject | ✅ | ❌ | ❌ |
| Beschikbaarheid CRUD (eigen) | ✅ | ✅ | ✅ |
| Employee status API | ✅ | ❌ | ❌ |
| Rapportages lezen | ✅ | ✅ | ❌ |
| CSV/XLSX export | ✅ | ✅ | ❌ |

---

## B) 50+ TESTCASES

### Auth & RBAC (TC-01 t/m TC-10)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-01 | Geen sessie | Open `/dashboard` | Redirect naar `/login` |
| TC-02 | Geen sessie | `GET /api/employees` | 401 JSON |
| TC-03 | Login als admin | `admin@securityapp.nl` / `Admin123!` | Success, redirect `/dashboard` |
| TC-04 | Login als employee | `pieter@securityapp.nl` / `Welkom123!` | Success, sidebar toont employee items |
| TC-05 | Login fout wachtwoord | Verkeerd ww invullen | Error toast, geen redirect |
| TC-06 | Employee sessie | Open `/employees` direct | "Geen toegang" melding |
| TC-07 | Employee sessie | `GET /api/employees` → middleware | 401 (middleware matcht dit pad) |
| TC-08 | Employee sessie | `POST /api/shifts` | 403 "Geen toegang" |
| TC-09 | Manager sessie | `GET /api/reports` | 200 OK |
| TC-10 | Logout | Klik uitloggen | Redirect `/login`, sessie weg |

### Availability — Recurring (TC-11 t/m TC-20)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-11 | Ingelogd als Pieter | Open Beschikbaarheid tab "Vaste beschikbaarheid" | 5 weekdagen met 06:00–14:00 items |
| TC-12 | Tab 1 actief | Klik + bij Dinsdag | Modal opent, weekdag = Dinsdag |
| TC-13 | Modal open | Stel 08:00-17:00 in, validFrom=vandaag | FOUT: overlapt met 06:00-14:00 → error toast met "Overlapt met bestaand tijdslot" |
| TC-14 | Modal open | Stel 14:00-22:00 in, validFrom=vandaag | SUCCES: geen overlap |
| TC-15 | Bestaand item | Klik op een groen blok | Modal opent pre-filled, weekday/times/dates correct |
| TC-16 | Edit modal | Wijzig eindtijd en sla op | Success toast, UI refresht |
| TC-17 | Bestaand item | Klik verwijder-icoon | Confirm dialog → success |
| TC-18 | Form | Vul startTime=17:00, endTime=08:00 | Client-side error "Starttijd moet voor eindtijd liggen" |
| TC-19 | Form | Laat validFrom leeg | Client-side error "Geldig vanaf is verplicht" |
| TC-20 | Admin sessie | Open beschikbaarheid | Ziet eigen recurring (admin heeft geen seed data → leeg) |

### Availability — Exceptions (TC-21 t/m TC-30)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-21 | Maria ingelogd, tab Uitzonderingen | Bekijk huidige week | Woensdag: rood blok "Niet beschikbaar, hele dag" |
| TC-22 | Tab 2 | Klik + bij een dag | Modal opent met die datum |
| TC-23 | Modal | Type=AVAILABLE, 08:00-12:00 | Succes: groen blok |
| TC-24 | Modal | Type=UNAVAILABLE | Tijdvelden verdwijnen, "hele dag niet beschikbaar" info |
| TC-25 | Type=AVAILABLE | startTime=17:00, endTime=08:00 | Server: 400 "Starttijd moet voor eindtijd liggen" |
| TC-26 | Bestaande exception | Klik + edit | Modal pre-filled, kan wijzigen |
| TC-27 | Exception | Verwijder knop | Confirm → verwijderd, UI refresht |
| TC-28 | Weeknavigatie | Klik pijltje links | Vorige week geladen, data klopt |
| TC-29 | Exception op een dag | Navigeer weg en terug | SWR cache: data instant beschikbaar |
| TC-30 | Meerdere exceptions op 1 dag | Maak 2 AVAILABLE tijdsloten op dezelfde dag | Beide verschijnen in UI |

### Copy Week (TC-31 t/m TC-35)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-31 | Week met 3 exceptions | Klik "Kopieer week" | Modal toont bron info, exception count |
| TC-32 | Target=volgende week | Klik kopiëren | Toast: "3 uitzondering(en) gekopieerd" |
| TC-33 | Navigeer naar doelweek | Bekijk exceptions | Zelfde type/tijden als bron, note prefix "Gekopieerd" |
| TC-34 | Doel heeft al exception op ma | Kopieer bronweek met ma exception | Ma overgeslagen, toast met skipped count |
| TC-35 | Lege bronweek | Klik kopiëren | Knop disabled (`exceptions.length === 0`) |

### Matching Statussen — employee-status API (TC-36 t/m TC-45)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-36 | Pieter: Ma 06:00-14:00 recurring | Admin: plan shift Ma 07:00-15:00 | Status: INGEVULD (6:00-14:00 dekt NIET 15:00) → **NIET_BESCHIKBAAR "Vaste beschikbaarheid dekt tijd niet"** |
| TC-37 | Pieter: Ma 06:00-14:00 | Plan shift Ma 07:00-13:00 | INGEVULD (06:00-14:00 dekt 07:00-13:00) ✅ |
| TC-38 | Maria: Wo exception UNAVAILABLE | Plan shift Wo 10:00-14:00 | NIET_BESCHIKBAAR "hele dag" |
| TC-39 | User zonder data | Plan shift vr 10:00-14:00 | NIET_INGEVULD (grijs) |
| TC-40 | Pieter heeft shift Ma 07:00-15:00 | Plan NIEUWE shift Ma 08:00-12:00 | NIET_BESCHIKBAAR "Conflict met dienst 07:00-15:00" |
| TC-41 | Maria: uitz AVAILABLE 14:00-22:00 op een dag | Plan shift 14:00-22:00 die dag | INGEVULD |
| TC-42 | Maria: uitz AVAILABLE 14:00-18:00 | Plan shift 14:00-22:00 | NIET_BESCHIKBAAR "dekt tijd niet (14:00-18:00)" |
| TC-43 | Admin override | Status rood → klik medewerker → confirm modal | Modal met "Weet je zeker?" → toewijzen lukt |
| TC-44 | Admin override | Status grijs → klik | Confirm modal → "Niet ingevuld" info |
| TC-45 | Edit shift | Open bestaande shift, shiftId meegestuurd | Conflict-check excludeert eigen shift |

### Open Shifts (TC-46 t/m TC-52)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-46 | Admin maakt shift status=OPEN | Open planning | Shift toont "Open dienst" met paarse badge |
| TC-47 | Employee opent Open Diensten | Ziet de open shift | Aanvragen-knop beschikbaar |
| TC-48 | Employee vraagt aan | Klik "Aanvragen" | 201, toast success, knop wordt "Aanvraag ingediend" |
| TC-49 | Zelfde employee, zelfde shift | Aanvragen nogmaals | 400 "Je hebt deze dienst al aangevraagd" |
| TC-50 | Admin opent aanvragen | Klik "Aanvragen bekijken" in shift modal | ShiftRequestModal verschijnt met overzicht |
| TC-51 | Admin keurt goed | Klik "Accepteren" | Shift → TOEGEWEZEN, andere requests REJECTED, shiftUser aangemaakt |
| TC-52 | Employee met overlap shift | Aanvragen | 400 "overlappende dienst" |

### Export (TC-53 t/m TC-57)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-53 | Admin, rapportages | Klik "Excel exporteren" | .xlsx download, opent in Excel |
| TC-54 | Open XLSX | Check formatting | Titel bold, headers blauw/wit, freeze pane, autofilter, zebra |
| TC-55 | Check bedrag kolom | | Formaat "€ 1.907,00" (numFmt), geen ##### |
| TC-56 | Check datum kolom | | "28-02-2026" (numFmt dd-mm-yyyy), geen ##### |
| TC-57 | CSV export | Download + open in Excel | Semicolons, BOM, headers, bedragen als getal, NL-proof |

### Mobile & UX (TC-58 t/m TC-62)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-58 | Chrome Mobile (375px) | Open dashboard | Geen overflow, cards stacken |
| TC-59 | Mobile | Open sidebar (hamburger) | Overlay + slide-in werkt, swipe to close |
| TC-60 | Mobile | Planning weekview | 1 kolom layout, shifts leesbaar |
| TC-61 | Mobile | Beschikbaarheid grid | Grid klapt naar 1-2 kolommen |
| TC-62 | Mobile | Open employee selectie modal | Items stapelen, reason tekst afgekapt met truncate |

### Error Handling (TC-63 t/m TC-67)

| # | Setup | Steps | Expected |
|---|-------|-------|----------|
| TC-63 | Server error simulatie | Verwijder DB, probeer API | 500 met JSON { error: "Interne serverfout" } |
| TC-64 | 404 route | Open `/nonexistent` | Next.js 404 page |
| TC-65 | Verlopen sessie | Laat token verlopen → API call | 401, client redirect naar login |
| TC-66 | Validatiefout in form | Stuur leeg shiftform | 400 met foutmelding |
| TC-67 | Race condition | Dubbel klik "Opslaan" | `saving` state blokkeert dubbel submit |

---

## C) TOP 15 RISICO'S

| # | Risico | Severity | Impact | Hoe te testen |
|---|--------|----------|--------|---------------|
| 1 | **IDOR: employee wijzigt andermans recurring-availability via PUT met ander userId** | BLOCKER | Medewerker kan data van anderen wijzigen | PUT met body `{ id: <andermans-id>, ... }` → moet 403 geven |
| 2 | **Middleware mist routes: `/api/recurring-availability`, `/api/availability-exceptions`, `/api/shift-requests`, `/api/profile`, `/api/auth/change-password`, `/api/dashboard`** | BLOCKER | Ongeauthenticeerde gebruikers bereiken API routes die enkel `requireAuth()` in code doen → _werkt_, maar middleware is de eerste defense line | Curl zonder cookie naar deze endpoints |
| 3 | **Shift-request POST: availability check gebruikt legacy `Availability` model i.p.v. RecurringAvailability/Exception** | MAJOR | Employee kan shift aanvragen terwijl die eigenlijk UNAVAILABLE is op nieuwe model | Log in als employee, zet exception UNAVAILABLE, doe aanvraag |
| 4 | **ShiftRequest GET (admin): availability enrichment gebruikt legacy `Availability` model** | MAJOR | Admin ziet "BESCHIKBAAR" in request modal terwijl nieuwe beschikbaarheidsmodel zegt anders | Open shift-request modal, vergelijk met employee-status API |
| 5 | **`calculateHours()` geeft 0 voor overnight shifts** (endTime < startTime) | MAJOR | Shift 22:00–06:00 toont 0 uren, export bedrag = €0 | Maak shift 22:00–06:00 |
| 6 | **Copy week: geen try/catch rond createMany loop** | MAJOR | Halve kopie bij DB fout, geen rollback | Simuleer constraint error |
| 7 | **Time comparison in shift validation: `startTime >= endTime` is string compare**, niet numeriek | MINOR | "08:00" >= "17:00" → false (correct toevallig), maar "9:00" vs "10:00" wél fout als niet zero-padded | Stuur `{ startTime: "9:00", endTime: "10:00" }` (Zod blokkeert dit met HH:mm regex, dus veilig) |
| 8 | **XSS via `note` velden** — React dangerouslySetInnerHTML niet gebruikt, maar notes worden wel in CSV/XLSX gezet | LOW | CSV formula injection (`=HYPERLINK(...)`) | Test met `=cmd\|'/C calc'!A0` als note |
| 9 | **Geen rate limiting op login endpoint** | MEDIUM | Brute force wachtwoord | Script 1000 login attempts |
| 10 | **Session cookie: `sameSite` en `secure` niet expliciet ingesteld** | MEDIUM | Production: cookies lekken via HTTP | Inspecteer Set-Cookie header |
| 11 | **Pagination ontbreekt** op employees, shifts, reports | MEDIUM | 500+ shifts: trage UI + grote JSON payloads | Seed 500 shifts, meet laadtijd |
| 12 | **N+1 query in shift-request GET (admin)**: per request 2 extra DB queries | MEDIUM | 20 requests = 40 queries | Monitor Prisma logs |
| 13 | **Dashboard `new Date(now.setHours(...))` muteert `now`** | MINOR | Toekomstige shifts query kan dag verschuiven | Check dashboard om middernacht |
| 14 | **`TOEGEWEZEN` en `OPEN` missing uit translateStatus** in CSV/XLSX export | MINOR | Status wordt niet vertaald in export | Export shift met status OPEN of TOEGEWEZEN |
| 15 | **Admin kan eigen account verwijderen** niet (correct), maar can deactivate zichzelf | LOW | Admin set `active: false` → next login fails | Test via employee edit modal on self |

---

## D) ISSUES GEVONDEN + FIXES

### BLOCKER-1: Middleware beschermt niet alle API routes

**Severity**: BLOCKER
**Repro**: `curl http://localhost:3000/api/recurring-availability` (geen cookie) → komt voorbij middleware (niet in matcher), maar `requireAuth()` vangt het.
**Root cause**: `middleware.ts` matcher array mist: `/api/recurring-availability`, `/api/availability-exceptions/:path*`, `/api/shift-requests/:path*`, `/api/profile`, `/api/auth/change-password`, `/api/dashboard`.
**Impact**: Hoewel server-auth het opvangt, is defence-in-depth gebroken. Voor production is middleware de snellere/veiligere rejection.

**Fix**:
```typescript
// src/middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/employees/:path*',
    '/availability/:path*',
    '/planning/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/open-shifts/:path*',
    '/api/employees/:path*',
    '/api/availability/:path*',
    '/api/availability-exceptions/:path*',
    '/api/recurring-availability/:path*',
    '/api/shifts/:path*',
    '/api/shift-requests/:path*',
    '/api/reports/:path*',
    '/api/employee-status/:path*',
    '/api/profile/:path*',
    '/api/dashboard/:path*',
    '/api/auth/change-password',
  ],
};
```

---

### BLOCKER-2: Shift-request POST availability check uses legacy model

**Severity**: BLOCKER
**File**: `src/app/api/shift-requests/route.ts` (POST, line ~159)
**Repro**: Employee sets exception UNAVAILABLE voor een datum. Dan vraagt open shift aan op die datum. De check zoekt in **Availability** tabel → vindt niets → laat het toe.
**Root cause**: De POST handler checkt `prisma.availability.findFirst({ status: 'UNAVAILABLE' })` i.p.v. de nieuwe `AvailabilityException`/`RecurringAvailability` modellen.

**Fix**: Vervang de availability check in POST met dezelfde logica als `employee-status` API:
```typescript
// In POST handler, replace the unavailability check with:
// Check exceptions
const exception = await prisma.availabilityException.findFirst({
  where: { userId: user.id, date: shift.date, type: 'UNAVAILABLE' },
});
if (exception) {
  return NextResponse.json(
    { error: 'Je bent niet beschikbaar op deze datum (uitzondering)' },
    { status: 400 }
  );
}
```

---

### BLOCKER-3: ShiftRequest GET enrichment uses legacy model

**Severity**: MAJOR (admin sees stale/wrong data)
**File**: `src/app/api/shift-requests/route.ts` (GET, line ~55)
**Repro**: Admin opens shift-request modal; availability status shows "BESCHIKBAAR" even when employee has UNAVAILABLE exception.
**Root cause**: `prisma.availability.findFirst({ status: 'UNAVAILABLE' })` — legacy model.

**Fix**: Check AvailabilityException instead:
```typescript
const unavailable = await prisma.availabilityException.findFirst({
  where: { userId: req.userId, date: shift.date, type: 'UNAVAILABLE' },
});
```

---

### MAJOR-4: calculateHours returns 0/negative for overnight shifts

**Severity**: MAJOR
**File**: `src/lib/utils.ts` line 22
**Repro**: Shift 22:00–06:00 → `calculateHours('22:00', '06:00')` = `(360 - 1320)/60` = negative → `Math.max(0, ...)` = 0
**Impact**: Overnight shifts show 0 hours in planning, reports, and exports. Amount = €0.

**Fix**:
```typescript
export function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60; // overnight
  return (endMinutes - startMinutes) / 60;
}
```
**Note**: Also update shift validation — currently blocks endTime < startTime with "Eindtijd moet na starttijd liggen". Either support overnight or keep blocking (MVP decision). If blocking, no hours fix needed, but the API/UI validation needs to be consistent.

---

### MAJOR-5: Copy-week no transaction/rollback

**Severity**: MAJOR
**File**: `src/app/api/availability-exceptions/copy-week/route.ts`
**Repro**: Copy 5 exceptions, 3rd one fails → 2 created, 2 not, inconsistent state.
**Root cause**: Individual `prisma.create()` calls in for-loop without `$transaction`.

**Fix**: Wrap in transaction:
```typescript
const result = await prisma.$transaction(async (tx) => {
  let createdCount = 0;
  const skippedDates: string[] = [];
  for (const exc of sourceExceptions) {
    // ... existing logic but use tx.availabilityException instead of prisma
  }
  return { createdCount, skippedDates };
});
```

---

### MAJOR-6: Missing translateStatus entries in CSV/XLSX export

**Severity**: MINOR
**File**: `src/app/api/reports/export/route.ts` and `export-excel/route.ts`
**Repro**: Export shifts with status OPEN or TOEGEWEZEN → status shows raw English value.

**Fix**: Add missing entries:
```typescript
function translateStatus(status: string): string {
  const map: Record<string, string> = {
    CONCEPT: 'Concept',
    OPEN: 'Open',
    TOEGEWEZEN: 'Toegewezen',
    BEVESTIGD: 'Bevestigd',
    AFGEROND: 'Afgerond',
  };
  return map[status] || status;
}
```

---

### MINOR-7: Dashboard mutates `now` variable

**Severity**: MINOR
**File**: `src/app/api/dashboard/route.ts` line ~72
**Code**: `new Date(now.setHours(0, 0, 0, 0))` — `setHours` mutates `now` in place.
**Fix**: `new Date(new Date().setHours(0, 0, 0, 0))` or use date-fns `startOfDay`.

---

### MINOR-8: CSV formula injection possible via note fields

**Severity**: LOW (defense-in-depth)
**Repro**: Create shift with note `=cmd|'/C calc'!A0`. Export CSV. Open in Excel → possible code execution.
**Fix**: Prefix cells starting with `=`, `+`, `-`, `@` with `'` (tab character):
```typescript
function csvSanitize(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}
```

---

### MINOR-9: `open-shifts` route not in middleware matcher

**Severity**: MINOR
**File**: `src/middleware.ts`
**These page routes are missing**: `/open-shifts/:path*`
**Fix**: Already included in BLOCKER-1 fix.

---

### MINOR-10: Employee can see ADMIN in open-shifts page

**Severity**: LOW/Cosmetic
**File**: `src/app/api/shift-requests/open/route.ts` — returns all OPEN shifts regardless of user role. Admin theoretically appears in open shifts but can't request (UI handles it). Not a functional bug but cosmetically confusing.

---

### MINOR-11: Double-submit not fully prevented on exception form

**Severity**: MINOR
**The recurring form** checks `saving` state before `setSaving(true)` — but the exception form just calls `setSaving(true)` at the top. If user clicks twice before first request completes, both could fire.
**Fix**: Add `if (saving) return;` at top of `handleExceptionSubmit`.

---

### MINOR-12: Employee status overwrites "NIET_INGEVULD" when recurring exists but doesn't cover

**Severity**: MINOR (logic subtlety)
**File**: `src/app/api/employee-status/route.ts` line ~99
**Scenario**: Employee has recurring 06:00-14:00 on Monday. Shift is 15:00-23:00. Current code returns `NIET_BESCHIKBAAR "Vaste beschikbaarheid dekt tijd niet"`. But per spec: "Niet ingevuld" mag nooit rood worden → having partial recurring should perhaps show NIET_INGEVULD, not NIET_BESCHIKBAAR.
**Debate**: The current logic says "you declared availability but it doesn't cover" = red. This is arguably correct for planning purposes (partial data = problem). **Recommend keeping current behavior** but documenting it.

---

## E) DEMO-RUNBOOK

### Voorbereiding
1. `npx prisma db seed` — verse database
2. `npm run dev` — start dev server
3. Open `http://localhost:3000`

### Demo Scenario 1: Employee flow
1. Login als **Pieter** (`pieter@securityapp.nl` / `Welkom123!`)
2. → Dashboard: "Welkom, Pieter", ziet actieve diensten + uren
3. → **Mijn Beschikbaarheid** (tab "Vaste beschikbaarheid")
   - Toon 7-dagenrooster Ma–Zo
   - Pieter heeft Ma–Vr 06:00–14:00
   - Klik + bij Zaterdag → voeg 08:00–16:00 toe → Toast succes
4. → Tab "Uitzonderingen"
   - Navigeer naar deze week
   - Klik + bij woensdag → Type: "Niet beschikbaar" → Opslaan
   - Rood blok verschijnt "Hele dag"
5. → "Kopieer week" → Target = volgende week → Kopieer → Toast met count
6. → **Mijn Rooster**: Pieter ziet shifts waar hij is toegewezen
7. → **Instellingen**: Wijzig telefoon → Opslaan success

### Demo Scenario 2: Admin flow
1. Login als **Admin** (`admin@securityapp.nl` / `Admin123!`)
2. → **Planning** → Nieuwe dienst
3. Datum=maandag, 07:00–13:00, locatie="Shell Pernis", type=Toezicht
4. → Medewerkerselectie verschijnt met 3 kleuren:
   - Pieter: **INGEVULD** (groen) — "Vaste beschikbaarheid: 06:00–14:00"
   - Maria: **NIET_BESCHIKBAAR** of **INGEVULD** (afhankelijk of Ma recurring er is)
   - Kees: **NIET_INGEVULD** (grijs)
5. Selecteer Pieter (groen, geen confirm)
6. Selecteer Kees → Confirm modal "Niet ingevuld" → "Toch toewijzen"
7. Opslaan → Toast succes

### Demo Scenario 3: Open Shift
1. Admin → Planning → Nieuwe dienst → Status = "Open"
2. Login als Pieter → **Open Diensten** → Dienst verschijnt → Klik "Aanvragen"
3. Login als Admin → Planning → Klik shift → "Aanvragen bekijken"
4. Pieter's aanvraag staat er → Klik "Accepteren"
5. Shift wordt TOEGEWEZEN, Pieter verschijnt in planning

### Demo Scenario 4: Export
1. Admin → **Rapportages** → Filter huidige maand
2. Klik "Excel exporteren"
3. Open XLSX in Excel:
   - Titel bold bovenaan
   - Header rij: blauw met witte tekst, freeze-pane
   - Zebra striping
   - Bedrag kolom: "€ 228,00" format
   - Datum kolom: "24-02-2026" format
   - Geen ##### kolommen
4. Klik "CSV exporteren" → Open in teksteditor:
   - BOM aanwezig
   - Semicolons
   - UTF-8 tekens correct

---

## F) FINAL CHECKLIST

- [x] **Build**: `npx next build` → 0 errors
- [x] **TypeScript**: Geen TS compile errors
- [ ] **Console errors**: Check browser console op elke pagina (HANDMATIG)
- [ ] **BLOCKER-1 gefixed**: Middleware matcht alle routes
- [ ] **BLOCKER-2 gefixed**: Shift-request POST checkt nieuwe beschikbaarheidsmodel
- [ ] **BLOCKER-3 gefixed**: Shift-request GET enrichment checkt nieuwe model
- [ ] **MAJOR-5 gefixed**: Copy-week in transaction
- [x] **API try/catch**: Alle routes hebben 500 handlers
- [x] **noValidate**: Forms blokkeren niet op native HTML validation
- [x] **Error display**: `if (!res.ok)` blocks robuust met JSON try/catch
- [ ] **Role checks bewezen**: Employee kan niet bij /api/employees, /api/shifts POST, etc.
- [ ] **Admin status matching**: 20 scenario's doorlopen (TC-36 t/m TC-45)
- [x] **XLSX export**: numFmt op datum+bedrag, kolombreedtes voldoende
- [x] **CSV export**: BOM + semicolons + UTF-8
- [x] **Logout redirect**: `window.location.href = '/login'` — correct, geen origin issue
- [ ] **Mobile demo flow**: Dashboard → Beschikbaarheid → Planning op 375px breed

---

## SAMENVATTING PRIORITEITEN

| Prio | Item | Status |
|------|------|--------|
| 🔴 P0 | BLOCKER-1: Middleware routes aanvullen | **TO FIX** |
| 🔴 P0 | BLOCKER-2: shift-request POST legacy check | **TO FIX** |
| 🟠 P1 | BLOCKER-3: shift-request GET legacy enrichment | **TO FIX** |
| 🟠 P1 | MAJOR-5: copy-week transaction | **TO FIX** |
| 🟡 P2 | MAJOR-4: overnight shift hours | **DECISION: block or support?** |
| 🟡 P2 | MAJOR-6: translateStatus missing entries | **TO FIX** |
| 🟢 P3 | MINOR-7 t/m MINOR-12 | Nice-to-have |
