-- Run this after the first real user signs in through the new auth flow.
-- Replace <THOMAS_USER_UUID> with the UUID from auth.users for the ranch owner.

update public.ranches
set owner_id = '<THOMAS_USER_UUID>'
where owner_id is null;
