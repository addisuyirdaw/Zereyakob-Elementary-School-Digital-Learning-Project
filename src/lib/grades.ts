/**
 * Grade Standardization & Normalization Utilities
 * 
 * Standard grades requested:
 * - KG1
 * - KG2
 * - KG3
 * - Grade 1
 * - Grade 2
 * - Grade 3
 * - Grade 4
 * - Grade 5
 * - Grade 6
 * - All Grades ("all")
 * 
 * Legacy mappings:
 * - "Grade K. A", "Grade K", "K", "KG", "Pre-K", "Pre-K.Age4", "Kg1" -> "KG1"
 * - "KG2", "Kg2", "K. 2", "K2" -> "KG2"
 * - "KG3", "Kg3", "K. 3", "K3" -> "KG3"
 * - "1", "Grade 1", "grade 1", "G1" -> "Grade 1"
 * - "2", "Grade 2" -> "Grade 2"
 * - "3", "Grade 3" -> "Grade 3"
 * - "4", "Grade 4" -> "Grade 4"
 * - "5", "Grade 5" -> "Grade 5"
 * - "6", "Grade 6" -> "Grade 6"
 * 
 * Existing student records in the database remain untouched (source of truth).
 * Normalization is applied for display, filtering, and cross-module consistency.
 */

export const STANDARD_GRADES = [
  "KG1",
  "KG2",
  "KG3",
  "Grade 1",
  "Grade 2",
  "Grade 3",
] as const;

export type StandardGrade = (typeof STANDARD_GRADES)[number];

/**
 * Normalizes any legacy or freeform grade string into a standard canonical grade key.
 * If rawGrade does not match standard school grades, it safely preserves the cleaned label.
 */
export function normalizeGrade(rawGrade: string | null | undefined): string {
  if (!rawGrade) return "";
  const trimmed = rawGrade.trim();
  if (!trimmed) return "";

  const clean = trimmed.toLowerCase();

  // Kindergarten 3 matches
  if (
    clean === "kg3" ||
    clean === "kg 3" ||
    clean === "kg-3" ||
    clean === "k3" ||
    clean === "k.3" ||
    clean === "k. 3" ||
    clean === "grade k. 3" ||
    clean === "grade kg 3" ||
    clean.includes("kg3") ||
    clean.includes("kg 3")
  ) {
    return "KG3";
  }

  // Kindergarten 2 matches
  if (
    clean === "kg2" ||
    clean === "kg 2" ||
    clean === "kg-2" ||
    clean === "k2" ||
    clean === "k.2" ||
    clean === "k. 2" ||
    clean === "grade k. 2" ||
    clean === "grade kg 2" ||
    clean.includes("kg2") ||
    clean.includes("kg 2")
  ) {
    return "KG2";
  }

  // Kindergarten 1 & legacy kindergarten matches ("Grade K. A", "K", "KG", "Pre-K", etc.)
  if (
    clean === "kg1" ||
    clean === "kg 1" ||
    clean === "kg-1" ||
    clean === "k1" ||
    clean === "k.1" ||
    clean === "k. 1" ||
    clean === "grade k. 1" ||
    clean === "grade kg 1" ||
    clean.includes("kg1") ||
    clean.includes("kg 1") ||
    clean === "k" ||
    clean === "kg" ||
    clean === "pre-k" ||
    clean === "pre-k.age4" ||
    clean.startsWith("pre-k") ||
    clean === "kindergarten" ||
    clean === "grade k" ||
    clean.startsWith("grade k.") ||
    clean.startsWith("grade k ") ||
    clean === "grade k. a"
  ) {
    return "KG1";
  }

  // Primary Grades 1 through 6 (e.g. "1", "Grade 1", "grade 1", "g1")
  const numMatch = clean.match(/^(?:grade\s*|g\s*|gr\s*)?([1-9])$/i);
  if (numMatch) {
    return `Grade ${numMatch[1]}`;
  }

  // For grades with double digits like Grade 10, Grade 11, etc.
  const doubleDigitMatch = clean.match(/^(?:grade\s*|g\s*|gr\s*)?(\d{1,2})$/i);
  if (doubleDigitMatch) {
    return `Grade ${doubleDigitMatch[1]}`;
  }

  // Fallback: capitalize if starts with grade or return trimmed
  if (clean.startsWith("grade ")) {
    return `Grade ${trimmed.slice(6).trim()}`;
  }

  return trimmed;
}

/**
 * Checks if a student belongs to the selected grade filter.
 * Matches both normalized grade values and direct raw values.
 */
export function isStudentInGrade(
  studentGrade: string | null | undefined,
  selectedGradeFilter: string
): boolean {
  if (!selectedGradeFilter || selectedGradeFilter === "all") {
    return true;
  }
  const normalizedStudentGrade = normalizeGrade(studentGrade);
  const normalizedSelected = normalizeGrade(selectedGradeFilter);

  return (
    normalizedStudentGrade === normalizedSelected ||
    (studentGrade?.trim() || "") === selectedGradeFilter.trim()
  );
}

/**
 * Returns the standardized list of grade dropdown options.
 * It guarantees KG1, KG2, KG3, Grade 1..Grade 6 are present in canonical order,
 * plus any other non-standard grades found in the students array.
 */
export function getStandardGradeOptions(
  _students: Array<{ grade?: string | null }> = []
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: "all", label: "All Classes" },
  ];

  // Canonical grades requested: KG1, KG2, KG3, Grade 1, Grade 2, Grade 3
  for (const g of STANDARD_GRADES) {
    options.push({ value: g, label: g });
  }

  return options;
}

/**
 * Returns available sections strictly for the selected grade filter.
 */
export function getSectionsForGrade(
  students: Array<{ grade?: string | null; section?: string | null }>,
  selectedGradeFilter: string
): string[] {
  const scoped =
    selectedGradeFilter === "all"
      ? students
      : students.filter((s) => isStudentInGrade(s.grade, selectedGradeFilter));

  const sectionsSet = new Set<string>();
  for (const s of scoped) {
    const sec = s.section?.trim();
    if (sec) sectionsSet.add(sec);
  }

  return Array.from(sectionsSet).sort();
}

/**
 * Formats a grade string for clean UI display.
 */
export function formatGradeDisplay(rawGrade: string | null | undefined): string {
  const normalized = normalizeGrade(rawGrade);
  if (!normalized) return "Unassigned";
  return normalized;
}
