# SecureStaff — Planning & Beheer

Een moderne, veilige webapp voor beveiligingsbedrijven. Plan diensten, beheer medewerkers, en genereer rapportages — alles in één systeem.

![Stack](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8) ![Prisma](https://img.shields.io/badge/Prisma-5.20-2D3748)

## Features

- **Planning** — Week- en maandoverzicht, diensten aanmaken/bewerken, conflictdetectie
- **Beschikbaarheid** — Medewerkers vullen zelf beschikbaarheid in per week
- **Medewerkersbeheer** — Accounts aanmaken, rollen toewijzen, tarieven instellen
- **Rapportages & Export** — Overzicht per medewerker, uren, bedragen, CSV-export
- **Role-based access** — Admin, Manager, Medewerker met aparte rechten
- **Mobile-first** — Responsief ontwerp, werkt goed op telefoon én laptop
- **Professioneel thema** — Donker thema geïnspireerd op safety/beveiliging

## Tech Stack

| Laag | Technologie |
|------|-------------|
| Framework | Next.js 14 (App Router) |
| Taal | TypeScript |
| Styling | TailwindCSS |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials) |
| Validatie | Zod |
| Tests | Jest + ts-jest |

## Installatie

### 1. Clone & installeer dependencies

```bash
cd security-app
npm install
```

### 2. Environment variabelen

Kopieer `.env.example` naar `.env` en pas de waarden aan:

```bash
cp .env.example .env
```

**SQLite (standaard voor development):**
```
DATABASE_URL="file:./dev.db"
```

**PostgreSQL (productie):**
```
DATABASE_URL="postgresql://user:password@localhost:5432/securityapp?schema=public"
```

> **Let op:** Bij PostgreSQL, wijzig `provider = "sqlite"` naar `provider = "postgresql"` in `prisma/schema.prisma`

### 3. Database setup

```bash
# Genereer Prisma client
npm run db:generate

# Push schema naar database
npm run db:push

# Vul database met testdata
npm run db:seed
```

Of in één commando:
```bash
npm run setup
```

### 4. Development server starten

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Build voor productie

```bash
npm run build
npm run start
```

## Login Accounts (na seed)

| Rol | E-mail | Wachtwoord |
|-----|--------|------------|
| Admin | admin@securityapp.nl | Admin123! |
| Medewerker | pieter@securityapp.nl | Welkom123! |
| Medewerker | maria@securityapp.nl | Welkom123! |
| Manager | kees@securityapp.nl | Welkom123! |

## Projectstructuur

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth + wachtwoord wijzigen
│   │   ├── availability/  # Beschikbaarheid CRUD
│   │   ├── dashboard/     # Dashboard data
│   │   ├── employees/     # Medewerkers CRUD
│   │   ├── reports/       # Rapportages + CSV export
│   │   └── shifts/        # Diensten CRUD
│   ├── admin/reports/     # Rapportages pagina
│   ├── availability/      # Beschikbaarheid pagina
│   ├── dashboard/         # Dashboard
│   ├── employees/         # Medewerkers beheer
│   ├── login/             # Inlogpagina
│   ├── planning/          # Planning (week/maand)
│   └── settings/          # Instellingen
├── components/
│   ├── layout/            # Sidebar, AppLayout
│   └── ui/                # Herbruikbare UI componenten
├── lib/                   # Utilities, auth, validations
└── types/                 # TypeScript types
```

## Rollen & Rechten

| Feature | Admin | Manager | Medewerker |
|---------|-------|---------|------------|
| Dashboard | ✅ | ✅ | ✅ |
| Planning bekijken | ✅ (alles) | ✅ (alles) | ✅ (eigen) |
| Diensten aanmaken | ✅ | ❌ | ❌ |
| Medewerkers beheren | ✅ | ❌ | ❌ |
| Beschikbaarheid invullen | ✅ | ✅ | ✅ |
| Beschikbaarheid overzicht | ✅ (alles) | ✅ (alles) | ✅ (eigen) |
| Rapportages & export | ✅ | ✅ | ❌ |
| Instellingen | ✅ | ❌ | ❌ |

## Tests

```bash
# Alle tests
npm test

# Watch mode
npm run test:watch
```

## TODO / Verbeteringen

1. **Notificaties** — E-mail/push bij nieuwe dienst of wijziging
2. **Drag & drop** — Planning drag & drop voor snellere scheduling
3. **PDF export** — Factuur-achtige PDF generatie
4. **Herhalende diensten** — Wekelijkse/maandelijkse templates
5. **Klanten/Opdrachtgevers** — Aparte tabel voor klanten met facturatiegegevens
6. **Dark/Light mode toggle** — Nu alleen dark mode
7. **Tijdzones** — UTC opslag + tijdzone-aware weergave
8. **Rate limiting** — Redis-based rate limiting op login endpoint
9. **Audit log** — Bijhouden wie wat wanneer heeft gewijzigd
10. **PWA** — Progressive Web App voor offline planning bekijken
