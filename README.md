# Zereyakob Elementary School — Digital Learning Platform

A production-grade, bilingual (English & Amharic) web application for real-world
school operations: **attendance tracking, student performance analytics,
directory & CSV reports, and a global support/funding portal** — backed by
**Debre Berhan University**.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** (strict, zero errors)
- **Tailwind CSS** (Royal Blue `#1d4ed8` / `#2563eb` enterprise theme)
- **Supabase** (PostgreSQL + Row Level Security + Auth)
  - Email/password **and** Google Sign-In
- **Recharts** — performance & attendance visualisations
- Client-side **CSV export** with UTF-8 BOM (works with Amharic text in Excel)

## Getting started

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/00001_init.sql` in the **SQL Editor**.
   (Optional: run `supabase/seed/00001_pilot_students.sql` to pre-load the
   15 pilot students.)
3. **Authentication → Providers → Google** — enable and copy your
   Google OAuth Client ID and Secret.
4. **Authentication → URL Configuration** — add your site URL (e.g.
   `http://localhost:3000`) to the allowed redirect URLs.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon (public) key |
| `SUPABASE_BOOTSTRAP_ADMIN_EMAIL` | Email that becomes Super Admin on first sign-up |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # verify zero TypeScript errors
npm run build      # production build
```

## Roles & permissions (RBAC)

| Role | Access |
| --- | --- |
| `admin` (Super Admin) | Everything, incl. assigning roles & permissions |
| `engineer` | All data management + support inbox |
| `teacher` | Students, attendance, directory, reports, support |
| `student` | Personal profile page `\me` (when linked to a learner record) |

**First sign-up** automatically becomes Super Admin (or the account whose email
equals `SUPABASE_BOOTSTRAP_ADMIN_EMAIL`). Later sign-ups start as `student`
until an admin promotes them in **Dashboard → My profile → Team roles**.

> RLS policies enforce all of this at the database level — staff can only read
> what their role permits, and attendance de-duplication is guaranteed by a
> `unique (student_id, date)` constraint.

## Features

- Persistent **English ⇄ አማርኛ** toggle on every page, form and report
- **Google Sign-In** + email/password authentication
- **Attendance** — daily Present / Absent / Late / Excused, live percentages,
  duplicate prevention
- **Student profiles & performance** — Recharts radar + bar + line charts
- **Directory & reports** — CSV downloads and date-range attendance reports
- **Support & partnerships** — Debre Berhan University branding, funding
  portal, outreach contact form and staff inbox
- Responsive, mobile-first with a frosted-glass navigation

## Structure

```
src/
  app/(public)/        landing, about, sign-in, sign-up, auth callbacks
  app/dashboard/       students · attendance · directory · reports · support · settings
  app/me/              student self-service profile
  components/          navbar, footer, UI kit, module components
  lib/i18n/            bilingual dictionary + provider
  lib/supabase/        browser & server clients + middleware session
  types/database.ts    typed Supabase schema
supabase/
  migrations/00001_init.sql
  seed/00001_pilot_students.sql
```