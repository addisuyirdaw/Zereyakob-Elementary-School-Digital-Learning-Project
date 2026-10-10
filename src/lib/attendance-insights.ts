/**
 * Attendance Insights & Absence Analytics
 *
 * Provides analytical calculations for:
 * 1. Students with highest number of absences
 * 2. Students with repeated absences (>= configurable threshold, default 2)
 * 3. Students with consecutive absences (>= configurable threshold, default 2)
 * 4. Students with low attendance rates (< configurable monitoring threshold, default 80%)
 *
 * Critical requirements:
 * - Calculations are strictly based on actual recorded attendance.
 * - Missing or unmarked school days are NEVER treated as absences.
 * - Thresholds are clearly labeled as monitoring/support thresholds, not official punitive policy.
 */

import type { AttendanceRecord } from "./attendance";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

export interface StudentAbsenceInsight {
  student: Student;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalRecorded: number;
  attendanceRate: number | null;
  maxConsecutiveAbsences: number;
  hasLowRate: boolean;
  hasRepeatedAbsences: boolean;
  hasConsecutiveAbsences: boolean;
  isFlagged: boolean;
  flagReasons: string[];
}

export interface AttendanceInsightsConfig {
  /** Warning threshold in percent (default 80) */
  rateThreshold?: number;
  /** Minimum absences to flag repeated absences (default 2) */
  minRepeatedAbsences?: number;
  /** Minimum consecutive absences to flag (default 2) */
  minConsecutiveAbsences?: number;
}

export interface AttendanceInsightsSummary {
  totalAnalyzedStudents: number;
  totalFlaggedStudents: number;
  highAbsenceCount: number;
  consecutiveAbsenceCount: number;
  lowRateCount: number;
  averageRate: number | null;
  studentInsights: StudentAbsenceInsight[];
  rankedByAbsences: StudentAbsenceInsight[];
  repeatedAbsencesList: StudentAbsenceInsight[];
  consecutiveAbsencesList: StudentAbsenceInsight[];
  lowRateList: StudentAbsenceInsight[];
}

/**
 * Calculates absence and attendance insights for a group of students based on actual records.
 */
export function calculateAttendanceInsights(
  students: Student[],
  records: AttendanceRecord[],
  config: AttendanceInsightsConfig = {}
): AttendanceInsightsSummary {
  const rateThreshold = config.rateThreshold ?? 80;
  const minRepeatedAbsences = config.minRepeatedAbsences ?? 2;
  const minConsecutiveAbsences = config.minConsecutiveAbsences ?? 2;

  // Group records by student_id
  const recordsByStudent = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const list = recordsByStudent.get(r.student_id) ?? [];
    list.push(r);
    recordsByStudent.set(r.student_id, list);
  }

  const studentInsights: StudentAbsenceInsight[] = [];
  let sumRates = 0;
  let countWithRate = 0;

  for (const student of students) {
    const studentRecords = recordsByStudent.get(student.id) ?? [];

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    for (const r of studentRecords) {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "excused") excused++;
    }

    const totalRecorded = present + absent + late + excused;
    const denominator = present + late + absent;
    const attendanceRate =
      denominator > 0 ? Math.round(((present + late) / denominator) * 100) : null;

    if (attendanceRate !== null) {
      sumRates += attendanceRate;
      countWithRate++;
    }

    // Calculate maximum consecutive recorded absences
    // Chronological order: oldest to newest
    const sorted = [...studentRecords].sort((a, b) => a.date.localeCompare(b.date));
    let maxConsecutiveAbsences = 0;
    let currentStreak = 0;

    for (const r of sorted) {
      if (r.status === "absent") {
        currentStreak++;
        if (currentStreak > maxConsecutiveAbsences) {
          maxConsecutiveAbsences = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    }

    const flagReasons: string[] = [];

    const hasLowRate = attendanceRate !== null && attendanceRate < rateThreshold;
    if (hasLowRate) {
      flagReasons.push(`Attendance rate below ${rateThreshold}% (${attendanceRate}%)`);
    }

    const hasRepeatedAbsences = absent >= minRepeatedAbsences;
    if (hasRepeatedAbsences) {
      flagReasons.push(`${absent} recorded absences`);
    }

    const hasConsecutiveAbsences = maxConsecutiveAbsences >= minConsecutiveAbsences;
    if (hasConsecutiveAbsences) {
      flagReasons.push(`${maxConsecutiveAbsences} consecutive absences`);
    }

    const isFlagged = hasLowRate || hasRepeatedAbsences || hasConsecutiveAbsences;

    studentInsights.push({
      student,
      present,
      absent,
      late,
      excused,
      totalRecorded,
      attendanceRate,
      maxConsecutiveAbsences,
      hasLowRate,
      hasRepeatedAbsences,
      hasConsecutiveAbsences,
      isFlagged,
      flagReasons,
    });
  }

  // Sorted views
  const rankedByAbsences = [...studentInsights]
    .filter((s) => s.absent > 0)
    .sort((a, b) => b.absent - a.absent || (a.attendanceRate ?? 100) - (b.attendanceRate ?? 100));

  const repeatedAbsencesList = [...studentInsights]
    .filter((s) => s.hasRepeatedAbsences)
    .sort((a, b) => b.absent - a.absent);

  const consecutiveAbsencesList = [...studentInsights]
    .filter((s) => s.hasConsecutiveAbsences)
    .sort((a, b) => b.maxConsecutiveAbsences - a.maxConsecutiveAbsences);

  const lowRateList = [...studentInsights]
    .filter((s) => s.hasLowRate)
    .sort((a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0));

  const flaggedList = studentInsights.filter((s) => s.isFlagged);

  return {
    totalAnalyzedStudents: students.length,
    totalFlaggedStudents: flaggedList.length,
    highAbsenceCount: rankedByAbsences.length,
    consecutiveAbsenceCount: consecutiveAbsencesList.length,
    lowRateCount: lowRateList.length,
    averageRate: countWithRate > 0 ? Math.round(sumRates / countWithRate) : null,
    studentInsights,
    rankedByAbsences,
    repeatedAbsencesList,
    consecutiveAbsencesList,
    lowRateList,
  };
}
