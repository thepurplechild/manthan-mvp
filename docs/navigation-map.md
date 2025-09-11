# Proposed Site Map & Route Hierarchy

## Creator
- `/` Home (marketing + CTA)
- `/auth`
  - `/auth/sign-up`
  - `/auth/login`
  - `/auth/confirm` (route handler)
  - `/auth/forgot-password`
  - `/auth/update-password`
- `/dashboard`
  - Quick actions: New Project, Upload Script
  - Widgets: Trends, Platform Status, Revenue (placeholder), Activity
- `/projects`
  - `/projects/new`
  - `/projects/[id]` (NEW) – details, uploads, generated assets, progress
- `/upload` – script upload helper
- `/settings` (NEW) – profile, preferences, data controls

## Founder (restricted)
- `/founder/dashboard`
- `/founder/mandates/new`
- `/founder/projects/[id]` (NEW) – review project detail

## Admin
- `/admin/ingestions` – monitor pipeline

## API (App Router)
- `/api/uploads` – upload to storage and queue ingestion
- `/api/ingestions/run` – run packaging pipeline
- `/api/ingestions/status` – poll status
- `/api/trends`, `/api/recommendations` – insights endpoints

## Dev/Test (gate or remove for prod)
- `/test-auth`, `/test-auth-debug`, `/test-simple-login`, `/test-parsers`, `/test-ingestion`, `/debug-production`

