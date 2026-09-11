-- ============================================================================
-- Zereyakob: Add display_order to profiles & set Core Team hierarchy
-- ============================================================================

alter table public.profiles add column if not exists display_order int not null default 100;

comment on column public.profiles.display_order is 'Explicit display order for public directories (e.g. Core Team)';

-- 1. Explicit numeric display_order values for the 6 core team members:
-- 1: Dr. Derssie Mebratu
update public.profiles
set display_order = 1
where email = 'demebratu@gmail.com'
   or (lower(first_name) like '%derssie%' and lower(last_name) like '%mebratu%');

-- 2: Dr. Tesfaye Zeleke
update public.profiles
set display_order = 2
where email = 'tesf@gmail.com'
   or (lower(first_name) like '%tesfaye%' and lower(last_name) like '%zeleke%');

-- 3: Dr. Betelhem Getachew
update public.profiles
set display_order = 3
where email = 'ad@gmail.com'
   or (lower(first_name) like '%betel%' and lower(last_name) like '%getachew%');

-- 4: Dr. Seblewengel Eseyenew
update public.profiles
set display_order = 4
where email = 'sebess2011@gmail.com'
   or (lower(first_name) like '%seble%' and lower(last_name) like '%eseyenew%');

-- 5: Yettie Kebede
update public.profiles
set display_order = 5
where email = 'tett@gmail.com'
   or (lower(first_name) like '%yettie%' and lower(last_name) like '%kebede%' and email not like 'contributor.%');

-- 6: Abiyu Guday
update public.profiles
set display_order = 6
where email = 'abiyu.giday@datarecode.com'
   or (lower(first_name) like '%abiyu%' and (lower(last_name) like '%guday%' or lower(last_name) like '%giday%'));

-- 2. Ensure Addisu Yirdaw's personal profile has is_public set to false
update public.profiles
set is_public = false
where email in ('addisulal@gmail.com', 'addisul@gmail.com')
   or (lower(first_name) like '%addisu%' and lower(last_name) like '%yirdaw%');
