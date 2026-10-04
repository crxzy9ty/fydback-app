-- Product renamed Guestly -> Fydback; rename the leftover helper function.
-- Dependent views/functions reference it by OID, so they keep working.
alter function public.guestly_hour_bucket(integer) rename to fydback_hour_bucket;
