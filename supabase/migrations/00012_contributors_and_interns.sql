-- ============================================================================
-- Zereyakob: Contributors, Teachers, and Interns hierarchy
-- ============================================================================

-- 10: Memhr Elfnesh (Lead Teacher & Instructor)
update public.profiles
set display_order = 10,
    profession = 'Lead Teacher & Instructor',
    is_public = true
where email = 'contributor.elfneshkg@zereyakob.edu.et'
   or (lower(first_name) like '%elfnesh%' and lower(last_name) like '%kg%');

-- Hide duplicate Elfnesh account
update public.profiles
set is_public = false
where email = 'han@gmail.com';

-- 11: Addisu Yirdaw (Project Lead & Developer)
update public.profiles
set display_order = 11,
    profession = 'Project Lead & Developer',
    is_public = true
where email = 'addisulal@gmail.com';

-- Hide duplicate Addisu account
update public.profiles
set is_public = false
where email = 'addisulal2@gmail.com';

-- 12: Qtsanet (Former Intern Student)
update public.profiles
set display_order = 12,
    profession = 'Former Intern Student',
    is_public = true
where email = 'contributor.qtsanet@zereyakob.edu.et'
   or lower(first_name) like '%qtsanet%';

-- 13: Yabsira (Former Intern Student)
update public.profiles
set display_order = 13,
    profession = 'Former Intern Student',
    is_public = true
where email = 'contributor.yabsira@zereyakob.edu.et'
   or lower(first_name) like '%yabsira%';

-- 14: Engineer Abiy (HPC & Infrastructure Contributor)
update public.profiles
set display_order = 14,
    profession = 'HPC & Infrastructure Contributor',
    is_public = true
where email = 'contributor.engineerabiy@zereyakob.edu.et';

-- 7: Temketem Tsige (Education Lead & Advisor - Core Team)
update public.profiles
set display_order = 7,
    profession = 'Education Lead & Curriculum Advisor',
    is_public = true
where email = 'contributor.temketem@zereyakob.edu.et'
   or lower(first_name) like '%temketem%';

-- Hide duplicate Yettie contributor (since core profile tett@gmail.com is in Core Team)
update public.profiles
set is_public = false
where email = 'contributor.yettie@zereyakob.edu.et';
