# Navigation Audit – Manthan MVP

Scope: Next.js App Router pages, components, links, and navigation intents in this repo.

## Summary
- Primary flow: Sign up → Dashboard → Create Project → View Projects. Most routes exist and render.
- One broken/internal link pattern detected: missing founder project detail route.
- Several dev/test routes are public; consider gating or removing in production.

## Broken Links / Dangling Routes

| Location (file:path:line) | Text/Intent | Href/Target | Status | Root Cause |
| --- | --- | --- | --- | --- |
| app/founder/dashboard/page.tsx:256 | View Founder Project | `/founder/projects/${project.id}` | 404 (route missing) | No route implemented under `app/founder/projects/[id]` |

## Placeholder/No-op Elements

| Location | Element | Notes |
| --- | --- | --- |
| app/admin/ingestions/page.tsx:42 | `<button formAction="#">Retry</button>` | Prevents default and calls fetch; formAction is inert but harmless. Consider removing `form` wrapper or using `type="button"`. |

## External Links

- components/deploy-button.tsx → Vercel deploy URL (opens in new tab) – OK
- components/hero.tsx → Next.js/Supabase external links – OK

## Public Dev/Test Routes (review before production)

- `/test-auth`, `/test-auth-debug`, `/test-simple-login`, `/test-parsers`, `/test-ingestion`, `/debug-production` – useful in development; consider behind admin flag or remove in prod.

## Confirmed Core Routes

- `/` (Home)
- `/auth/login`, `/auth/sign-up`, `/auth/confirm` (route handler), `/auth/forgot-password`, `/auth/update-password`, `/auth/error`, `/auth/signout` (route handler)
- `/dashboard`
- `/projects/new`
- `/upload`
- `/protected` (example area)
- `/founder/dashboard`, `/founder/mandates/new`
- `/admin/ingestions`

## Information Architecture (current vs intended)

Intended (creator-first India flow):
- Sign Up → Dashboard → Create Project → View Project(s) → Upload Script → Track Packaging → Download Package → Settings

Gaps/Missing:
- Creator Project Detail page (`/projects/[id]`) referenced in dashboard links; implement if absent.
- Founder Project Detail page (`/founder/projects/[id]`) missing; linked in Founder dashboard.
- Settings/Profile route absent (`/settings`), but implied by IA.

## Recommended Fixes
- Add `app/projects/[id]/page.tsx` to show project details (scripts, generated assets, status).
- Add `app/founder/projects/[id]/page.tsx` for founder review details.
- Add `app/settings/page.tsx` for profile, preferences (languages/platforms), data export/delete.
- Gate dev/test routes behind environment or role checks.

