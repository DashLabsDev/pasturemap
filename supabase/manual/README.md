# Manual post-deploy steps

These SQL files are NOT picked up by `supabase db push` — they require a
human to substitute live values and run them by hand.

## backfill_ranch_owner.sql.template

Run **after** applying the RLS migrations AND after signing up via the new
auth flow so your `auth.users` row exists.

1. Sign up at the deployed site (or preview URL) — Supabase emails a confirm
   link.
2. Grab your UUID:
   - Supabase dashboard → Authentication → Users → copy your row's `id`.
3. In `supabase/manual/backfill_ranch_owner.sql.template`, replace
   `<YOUR_AUTH_UID>` with that UUID.
4. Apply:

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/manual/backfill_ranch_owner.sql.template
   ```

   Or paste the SQL into the Supabase SQL editor.

5. Verify:

   ```sql
   select id, owner_id from public.ranches;
   ```

   Every existing ranch should now have your UUID as `owner_id`. RLS will
   then let you see your own data again.
