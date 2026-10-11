-- ============================================================================
-- Migration 00018: Allow staff to delete attendance records (e.g. unmarking student)
-- Idempotent and safe to run multiple times.
-- ============================================================================

drop policy if exists "attendance_delete_admin" on public.attendance;
drop policy if exists "attendance_delete_staff" on public.attendance;

create policy "attendance_delete_staff" on public.attendance
  for delete using (public.is_staff());
