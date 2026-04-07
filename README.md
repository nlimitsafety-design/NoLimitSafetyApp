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
