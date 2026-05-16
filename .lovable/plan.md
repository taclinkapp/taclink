
# Launch Activation System

## Strategy

Reuse the existing `platform_settings` + `usePrelaunch` plumbing (already wired into Discover, NewCourse, CourseManagement, InstructorSubscription, instructor publish enforcement, and the `_shared/prelaunch.ts` edge helper). Extend it into a single backend-truth `launch_config` row with a server-evaluated **effective mode**, instead of inventing a parallel system.

## Launch state model

Single row in `public.launch_config` (id=true singleton, like `payment_provider_settings`):

- `launch_mode` enum: `prelaunch | live | paused`
- `launch_at timestamptz`
- `manual_override boolean` — when true, `launch_mode` wins; when false, `launch_at <= now()` auto-promotes prelaunch→live
- Feature toggles: `countdown_enabled`, `bookings_enabled`, `course_creation_enabled`, `publish_enabled`, `pro_unlock_enabled`, `waitlist_enabled`
- `maintenance_message text`
- Audit: `activated_at`, `activated_by`, `last_updated_at`, `last_updated_by`

## Backend (single source of truth)

1. **Migration** creates table + `app_launch_mode` enum + RLS (world-readable, admin-write) + explicit GRANTs (per project memory rule) + seed row mirroring current `prelaunch_mode`/`launch_date`.
2. **SQL function** `public.get_effective_launch_state()` returns the resolved state:
   ```
   if manual_override or mode=paused → return mode + flags as-is
   else if mode=prelaunch and launch_at <= now() → return 'live' + flag overrides
   else → return mode + flags
   ```
   Also stamps `activated_at` once (idempotent: `UPDATE ... WHERE activated_at IS NULL AND <effective>=live`).
3. **Edge function** `launch-activate` (cron-scheduled every minute via `pg_cron`+`pg_net`) calls the activation routine so go-live happens even with zero clients open. Idempotent: no-op if already activated.
4. Update `_shared/prelaunch.ts` → `getLaunchState()` reading from `get_effective_launch_state()` (keeps backward-compat `isPrelaunchEnabled` shim).

## Frontend

- **`useLaunchState` hook** (replaces `usePrelaunch` internals; keeps the old export as a thin shim so existing imports keep working):
  - Calls the RPC, returns `{ mode, isLive, isPrelaunch, isPaused, flags, launchAtIso, maintenanceMessage }`.
  - `staleTime: 30s`, refetch on window focus + reconnect + visibility change for app-resume freshness.
  - Subscribes to Postgres changes on `launch_config` for realtime invalidation.
- **`<LaunchGate>` component** wraps actions/routes to render correct disabled/paused/live UI without scattering conditionals.

## Where it plugs in (surgical edits, no redesign)

- `CountdownClock` — when `isLive`, show "We're live" CTA instead of zeros.
- `Splash` / prelaunch screens — use `mode` instead of `enabled`.
- `Discover` (student) — booking CTA respects `flags.bookings_enabled` + paused message.
- `student/Checkout` — hard block at route level if not bookable.
- `instructor/NewCourse` + `CourseManagement` — gate create/publish on `course_creation_enabled` / `publish_enabled`.
- `InstructorSubscription` + `InstructorPlanStep` — gate pro purchase on `pro_unlock_enabled`; existing entitlement check (`has_active_subscription`) is unchanged so already-subscribed users get features when flag flips on — no accidental grants.
- DB trigger `enforce_instructor_connect_for_publish` extended to also check publish flag (defense-in-depth so client can't bypass).
- Edge functions `create-subscription-checkout` / `notify-prelaunch-unlock` switch to `getLaunchState()`.
- `App.tsx` — show paused/maintenance banner globally when `mode=paused`.
- Admin: extend `PrelaunchControlCard` into `LaunchControlCard` exposing all toggles + override switch. No new admin page.

## Safety

- Fail-safe defaults if RPC fails: `mode=prelaunch`, all transactional flags `false` → never accidentally opens checkout.
- Activation is a single UPDATE with `WHERE activated_at IS NULL` → idempotent across cron, app-open, multi-client.
- Pro entitlement remains gated by existing `subscriptions` table; flag only controls *availability*, not grants.

## Deferred

- No new admin page beyond the upgraded card.
- No analytics/event emission for launch transitions (can be added later).
- Web-push "we're live" broadcast not included (separate request).

## File plan

**New:**
- `supabase/migrations/<ts>_launch_config.sql`
- `supabase/functions/launch-activate/index.ts`
- `src/hooks/useLaunchState.ts`
- `src/components/LaunchGate.tsx`
- `src/components/MaintenanceBanner.tsx`

**Edited:**
- `src/hooks/usePrelaunch.ts` (shim over useLaunchState)
- `src/components/CountdownClock.tsx`
- `src/components/admin/PrelaunchControlCard.tsx`
- `src/pages/Splash.tsx`
- `src/pages/student/Discover.tsx`, `Checkout.tsx`, `CourseDetail.tsx`
- `src/pages/instructor/NewCourse.tsx`, `CourseManagement.tsx`, `InstructorSubscription.tsx`
- `src/pages/auth/InstructorPlanStep.tsx`
- `src/App.tsx`
- `supabase/functions/_shared/prelaunch.ts`
- `supabase/functions/create-subscription-checkout/index.ts`
- `supabase/functions/notify-prelaunch-unlock/index.ts`

Approve to proceed.
