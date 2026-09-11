-- ============================================================================
-- Zereyakob: Lock bootstrap admin (addisulal@gmail.com) as permanent super_admin
-- ============================================================================

-- 1) Prevent role demotion via a BEFORE UPDATE trigger on profiles
create or replace function public.prevent_bootstrap_demotion()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.email = 'addisulal@gmail.com' and new.role <> 'super_admin' then
    raise exception 'Bootstrap admin (addisulal@gmail.com) cannot be demoted from super_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_bootstrap_demotion on public.profiles;
create trigger trg_prevent_bootstrap_demotion
before update of role on public.profiles
for each row execute function public.prevent_bootstrap_demotion();

-- 2) Also protect the bootstrap admin setting email (addisul@gmail.com) if it exists
--    This covers both hardcoded emails in the original trigger
create or replace function public.prevent_any_bootstrap_demotion()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.email in ('addisulal@gmail.com', 'addisul@gmail.com') and new.role <> 'super_admin' then
    raise exception 'Bootstrap admin cannot be demoted from super_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_any_bootstrap_demotion on public.profiles;
create trigger trg_prevent_any_bootstrap_demotion
before update of role on public.profiles
for each row execute function public.prevent_any_bootstrap_demotion();