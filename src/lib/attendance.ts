/**
 * Unified Attendance Calculation & Calendar Utilities
 * 
 * Formal Definitions:
 * 1. Attendance Rate (%) = (Present + Late) / (Present + Late + Absent) * 100
 *    - Excused days are formally exempted from the penalty denominator.
 *    - Unrecorded days do not penalize rate, but reduce completeness.
 * 2. Presence Rate (%) = Present / Total Expected School Days * 100
 * 3. Completeness (%) = Total Recorded Days / Total Expected School Days * 100
 */

import { toLocalDateInput } from "./utils";
import type { Database } from "@/types/database";

export type AttendanceRecord = Database["public"]["Tables"]["attendance"]["Row"];
export type SchoolCalendarDay = Database["public"]["Tables"]["school_calendar"]["Row"];
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalRecorded: number;
  expectedSchoolDays: number;
  unrecordedDays: number;
  /** (Present + Late) / (Present + Late + Absent) * 100 */
  rate: number | null;
  /** Present / Expected School Days * 100 */
  presenceRate: number | null;
  /** Total Recorded / Expected School Days * 100 */
  completeness: number;
  isComplete: boolean;
}

/**
 * Returns true if a given Date or YYYY-MM-DD string is a standard weekday (Monday - Friday).
 */
export function isWeekday(dateInput: string | Date): boolean {
  const d = typeof dateInput === "string" ? new Date(`${dateInput}T00:00:00`) : dateInput;
  const day = d.getDay();
  // 0 = Sunday, 6 = Saturday
  return day !== 0 && day !== 6;
}

/**
 * Calculates the number of expected school days between from and to (inclusive).
 * Uses Monday-Friday as default instructional days, and factors in any explicit
 * calendar overrides from the `school_calendar` table.
 */
export function getExpectedSchoolDays(
  fromIso: string,
  toIso: string,
  calendarDays: SchoolCalendarDay[] = []
): number {
  if (!fromIso || !toIso || fromIso > toIso) return 0;

  const calendarMap = new Map<string, boolean>();
  for (const c of calendarDays) {
    calendarMap.set(c.date, c.is_school_day);
  }

  const start = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const iso = toLocalDateInput(current);
    if (calendarMap.has(iso)) {
      if (calendarMap.get(iso)) count++;
    } else if (isWeekday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculates standardized attendance metrics from a list of attendance records.
 */
export function calculateAttendanceSummary(
  records: AttendanceRecord[],
  expectedSchoolDays = 0
): AttendanceSummary {
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
    else if (r.status === "late") late++;
    else if (r.status === "excused") excused++;
  }

  const totalRecorded = present + absent + late + excused;
  const denominator = present + late + absent;
  const rate = denominator > 0 ? Math.round(((present + late) / denominator) * 100) : null;

  const effectiveExpected = Math.max(expectedSchoolDays, totalRecorded);
  const unrecordedDays = Math.max(0, effectiveExpected - totalRecorded);
  const presenceRate = effectiveExpected > 0 ? Math.round((present / effectiveExpected) * 100) : null;
  const completeness = effectiveExpected > 0 ? Math.round((totalRecorded / effectiveExpected) * 100) : 100;
  const isComplete = effectiveExpected === 0 || totalRecorded >= effectiveExpected;

  return {
    present,
    absent,
    late,
    excused,
    totalRecorded,
    expectedSchoolDays: effectiveExpected,
    unrecordedDays,
    rate,
    presenceRate,
    completeness,
    isComplete,
  };
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_30_days"
  | "custom";

export function getDateRangeFromPreset(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  const today = toLocalDateInput(now);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toLocalDateInput(y);
      return { from: yStr, to: yStr };
    }
    case "this_week": {
      const d = new Date(now);
      const day = d.getDay(); // 0 is Sun, 1 is Mon
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return { from: toLocalDateInput(monday), to: today };
    }
    case "last_week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day - 6; // Last Monday
      const lastMonday = new Date(d.setDate(diff));
      const lastFriday = new Date(lastMonday);
      lastFriday.setDate(lastMonday.getDate() + 4);
      return { from: toLocalDateInput(lastMonday), to: toLocalDateInput(lastFriday) };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalDateInput(firstDay), to: today };
    }
    case "last_30_days": {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      return { from: toLocalDateInput(past), to: today };
    }
    case "custom":
    default:
      return { from: today, to: today };
  }
}
