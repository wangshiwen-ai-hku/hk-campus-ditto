# Database Migration Notes

The backend now uses entity tables when `DB_PROVIDER=postgres`.

## Tables

- `campus_ditto_universities`
- `campus_ditto_students`
- `campus_ditto_matches`
- `campus_ditto_verification_codes`
- `campus_ditto_invite_codes`
- `campus_ditto_surveys`

Each table has:

- `id text primary key`
- `data jsonb not null`
- `updated_at timestamptz not null default now()`

The old `campus_ditto_state` table is still created and preserved only as a legacy import source.

## Automatic Migration

On backend startup, Postgres mode runs this sequence:

1. Create the new entity tables and indexes if they do not exist.
2. Count rows across the new entity tables.
3. If the new tables are empty and `campus_ditto_state(id = 'main')` exists, import that JSON state into the new tables.
4. If both the new tables and legacy state are empty, seed the database.

The legacy `campus_ditto_state` row is not deleted automatically.

## Safety Behavior

Regular `saveDb()` performs upserts into entity tables. It does not delete rows that are missing from an in-memory snapshot. This avoids data loss from stale snapshots or background jobs.

`resetDb()` is the explicit destructive path. In Postgres mode it truncates the entity tables and writes seed data.

## Hot Paths

The user-facing hot paths use direct entity queries in Postgres mode:

- `GET /api/profile/:userId` reads one student row.
- `GET /api/matches/current` and `GET /api/matches/all` read matches by user id, then read partner student/university rows.
- `POST /api/auth/request-code` reads one university set and one verification row, then upserts one verification row.
- `POST /api/auth/verify-code` reads one verification row, one user row, and optionally one invite row, then upserts only the changed rows.
- `POST /api/onboarding/profile` reads and upserts one student row.
- `POST /api/onboarding/survey` reads one student row, upserts one student row, and inserts one survey row.
- `POST /api/onboarding/preferred-locale` upserts one student row.
- `POST /api/memory/preferences` and `POST /api/memory/block` upsert one student row.

Admin views, seed/reset, invite batch generation, matching runs, and dev tooling can still assemble the full database because they are lower-frequency operational paths.

## Deployment Checklist

1. Back up the current Supabase/Postgres database before deploying.
2. Deploy the backend.
3. Hit `/api/meta` or any backend endpoint once to trigger schema creation and migration.
4. Confirm row counts in the new entity tables.
5. Keep `campus_ditto_state` until the new deployment has been stable.
