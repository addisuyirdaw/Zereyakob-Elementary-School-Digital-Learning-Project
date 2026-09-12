-- ============================================================================
-- Zereyakob: Staff Section Selector (Core Team vs Contributors & Interns)
-- Adds explicit 'section' column ('core' | 'contributor') to profiles.
-- ============================================================================

alter table public.profiles
  add column if not exists section text not null default 'core';

comment on column public.profiles.section is 'Public directory section: core (Core Team) or contributor (Project Contributors & Interns)';

-- Ensure valid section values
alter table public.profiles
  drop constraint if exists profiles_section_check;

alter table public.profiles
  add constraint profiles_section_check
  check (section in ('core', 'contributor'));

-- Initialize section based on display_order:
update public.profiles
set section = 'contributor'
where display_order >= 10;

update public.profiles
set section = 'core'
where display_order < 10;

-- Explicitly set Core Team members:
update public.profiles
set section = 'core'
where email in (
  'demebratu@gmail.com',
  'tesf@gmail.com',
  'ad@gmail.com',
  'sebess2011@gmail.com',
  'tett@gmail.com',
  'abiyu.giday@datarecode.com',
  'contributor.temketem@zereyakob.edu.et'
)
or lower(first_name) like '%temketem%'
or (lower(first_name) like '%yettie%' and email not like 'contributor.%');

-- Explicitly set Contributors & Interns:
update public.profiles
set section = 'contributor'
where email in (
  'contributor.elfneshkg@zereyakob.edu.et',
  'addisulal@gmail.com',
  'contributor.qtsanet@zereyakob.edu.et',
  'contributor.yabsira@zereyakob.edu.et',
  'contributor.engineerabiy@zereyakob.edu.et'
);
