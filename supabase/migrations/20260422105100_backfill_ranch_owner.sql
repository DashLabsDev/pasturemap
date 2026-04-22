update public.ranches
set owner_id = '<YOUR_AUTH_UID>'::uuid
where owner_id is null;
