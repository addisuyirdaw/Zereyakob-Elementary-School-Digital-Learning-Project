export interface KhanRecord {
  student: string;
  reportDate: string;
  grade: string;
  subject: string;
  className: string;
  level: string;
  activitySkill: string;
  progressCurrent: number | null;
  progressTotal: number | null;
  scorePercentage: number | null;
  status: 'viewed' | 'unattempted' | 'attempted';
}

export interface KhanMetadata {
  reportType: string;
  grade: string;
  subject: string;
  reportDate: string;
  className: string;
  source: string;
}

export interface ParseResult {
  metadata: KhanMetadata;
  students: string[];
  totalParsedRows: number;
  totalParsedRecords: number;
  records: KhanRecord[];
  warnings: string[];
}

function unescapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function isGradePattern(val: string): boolean {
  if (!val) return false;
  return /^(kg\s*[1-9]|grade\s*[0-9]+|pre-?k.*|kindergarten|nursery|reception|year\s*[0-9]+|[0-9]+)$/i.test(val.trim());
}

export function normalizeGradeName(val: string): string {
  if (!val) return "KG1";
  const trimmed = val.trim();
  const kgMatch = trimmed.match(/^kg\s*([0-9]+)$/i);
  if (kgMatch) return `KG${kgMatch[1]}`;
  const gradeMatch = trimmed.match(/^grade\s*([0-9]+)$/i);
  if (gradeMatch) return `Grade ${gradeMatch[1]}`;
  const preKMatch = trimmed.match(/^pre-?k(.*)$/i);
  if (preKMatch) return `Pre-K${preKMatch[1] ? preKMatch[1].trim() : ""}`;
  return trimmed;
}

export function extractGradeFromClass(className: string): string | null {
  if (!className) return null;
  const match = className.match(/(KG\s*[1-9]|Grade\s*[0-9]+|Pre-?K(\.Age\d+)?|Kindergarten|Nursery)/i);
  if (match) return normalizeGradeName(match[0]);
  return null;
}

/**
 * Parses a standard Khan Academy Kids HTML report export.
 */
export function parseKhanHtml(html: string): ParseResult {
  // 1. Extract Metadata from <h3>
  const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (!h3Match) {
    throw new Error("Metadata <h3> not found. Please ensure this is a valid Khan Academy Kids HTML export.");
  }
  
  const rawMetadata = h3Match[1].replace(/<[^>]+>/g, '').trim();
  const metaParts = rawMetadata.split(',').map(p => p.trim());
  if (metaParts.length < 4) {
    throw new Error("Invalid metadata format in HTML report. Expected [Report Type, Grade:Subject, Date, Class Name].");
  }

  const reportType = metaParts[0] || "All Progress";
  const rawGradeSubject = (metaParts[1] || "").trim();
  const reportDate = metaParts[2] || new Date().toISOString().slice(0, 10);
  const className = unescapeHtml(metaParts[3] || "Class");
  const source = metaParts[4] || "Khan Academy Kids";

  let grade = "KG1";
  let subject = "General";

  if (rawGradeSubject.includes(':')) {
    const parts = rawGradeSubject.split(':').map(p => p.trim());
    const part0 = parts[0] || "";
    const part1 = parts[1] || "";

    // Intelligently identify if parts are reversed (e.g., "Math : KG1")
    if (isGradePattern(part1) && !isGradePattern(part0)) {
      grade = normalizeGradeName(part1);
      subject = part0 || "General";
    } else {
      grade = isGradePattern(part0) ? normalizeGradeName(part0) : (part0 || "KG1");
      subject = part1 || "General";
    }
  } else if (rawGradeSubject) {
    if (isGradePattern(rawGradeSubject)) {
      grade = normalizeGradeName(rawGradeSubject);
      subject = "General";
    } else {
      // It is a subject (e.g. "Math", "ELA", "Books", "Logic", "Science", etc.)
      subject = rawGradeSubject;
      const inferredGrade = extractGradeFromClass(className);
      if (inferredGrade) {
        grade = inferredGrade;
      }
    }
  }

  // 2. Extract Students from <thead>
  const theadMatch = html.match(/<thead[^>]*>[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/i);
  if (!theadMatch) {
    throw new Error("Student table headers (<thead>) not found.");
  }
  
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  const students: string[] = [];
  let match;
  let thIndex = 0;
  while ((match = thRegex.exec(theadMatch[1])) !== null) {
    thIndex++;
    if (thIndex === 1) {
      // First column is the row header / empty handle
      continue;
    }
    // Remove span tags and inner handles
    const rawTh = match[1].replace(/<span[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '');
    const name = unescapeHtml(rawTh).trim();
    if (name) {
      students.push(name);
    }
  }

  if (students.length === 0) {
    // Fallback: try match without skipping first th if it had text
    const spanRegex = /<th[^>]*>([^<]+)<span/gi;
    while ((match = spanRegex.exec(theadMatch[1])) !== null) {
      const name = unescapeHtml(match[1]).trim();
      if (name && !students.includes(name)) {
        students.push(name);
      }
    }
  }

  if (students.length === 0) {
    throw new Error("No student names detected in the report headers.");
  }

  // 3. Extract dataRows from JavaScript
  const dataRowsMatch = html.match(/const\s+dataRows\s*=\s*(\[[\s\S]*?\]);/);
  if (!dataRowsMatch) {
    throw new Error("Embedded dataRows array not found in script tags.");
  }
  
  let dataRows: string[];
  try {
    const jsonStr = dataRowsMatch[1].replace(/\t/g, '\\t');
    dataRows = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Failed to parse dataRows safely: " + e);
  }

  const records: KhanRecord[] = [];
  const warnings: string[] = [];

  for (const row of dataRows) {
    const parts = row.split('\t');
    if (parts.length < 2) continue;

    const level = parts[0]?.trim() || "1";
    const activitySkill = unescapeHtml(parts[1]?.trim() || "Activity");
    const scoresStr = parts[2] || '';

    let scores = scoresStr.length === 0 ? [] : scoresStr.split(',');

    while (scores.length < students.length) {
      scores.push('');
    }

    for (let i = 0; i < students.length; i++) {
      const studentName = students[i];
      const scoreRaw = scores[i] ? scores[i].trim() : '';

      let progressCurrent: number | null = null;
      let progressTotal: number | null = null;
      let scorePercentage: number | null = null;
      let status: 'viewed' | 'unattempted' | 'attempted' = 'unattempted';

      if (!scoreRaw) {
        status = 'unattempted';
      } else if (scoreRaw === 'V' || scoreRaw.toLowerCase() === 'viewed') {
        status = 'viewed';
      } else if (scoreRaw.includes('/')) {
        const p = scoreRaw.split('/');
        progressCurrent = parseInt(p[0], 10);
        progressTotal = parseInt(p[1], 10);
        status = 'attempted';
        if (isNaN(progressCurrent) || isNaN(progressTotal)) {
          warnings.push(`Invalid fraction: ${scoreRaw} for ${studentName}`);
        }
      } else {
        const cleanScore = scoreRaw.replace('%', '');
        scorePercentage = parseInt(cleanScore, 10);
        status = 'attempted';
        if (isNaN(scorePercentage)) {
          warnings.push(`Invalid percentage: ${scoreRaw} for ${studentName}`);
          scorePercentage = null;
        }
      }

      records.push({
        student: studentName,
        reportDate,
        grade,
        subject,
        className,
        level,
        activitySkill,
        progressCurrent,
        progressTotal,
        scorePercentage,
        status
      });
    }
  }

  return {
    metadata: { reportType, grade, subject, reportDate, className, source },
    students,
    totalParsedRows: dataRows.length,
    totalParsedRecords: records.length,
    records,
    warnings
  };
}

/**
 * Parses tabular activity CSV or matrix CSV exports.
 */
export function parseKhanCsv(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV file is empty or contains insufficient data.");
  }

  // Detect if normalized tabular CSV (contains header row with known column names)
  const header = lines[0].toLowerCase();
  const isTabular = header.includes("student") && (header.includes("activity") || header.includes("skill") || header.includes("status"));

  if (isTabular) {
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const studentIdx = headers.findIndex(h => h.includes("student") && !h.includes("id"));
    const dateIdx = headers.findIndex(h => h.includes("date"));
    const gradeIdx = headers.findIndex(h => h.includes("grade"));
    const subjectIdx = headers.findIndex(h => h.includes("subject"));
    const classIdx = headers.findIndex(h => h.includes("class"));
    const levelIdx = headers.findIndex(h => h.includes("level") || h.includes("category"));
    const skillIdx = headers.findIndex(h => h.includes("skill") || h.includes("activity"));
    const statusIdx = headers.findIndex(h => h.includes("status"));
    const scoreIdx = headers.findIndex(h => h.includes("score"));
    const progCurrIdx = headers.findIndex(h => h.includes("progress current") || h.includes("current"));
    const progTotIdx = headers.findIndex(h => h.includes("progress total") || h.includes("total"));

    const records: KhanRecord[] = [];
    const studentSet = new Set<string>();
    let detectedGrade = "KG1";
    let detectedSubject = "General";
    let detectedDate = new Date().toISOString().slice(0, 10);
    let detectedClass = "Class";

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV splitter handling quotes
      const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map(v => v.trim());
      if (row.length < 2) continue;

      const student = row[studentIdx] || "Student";
      studentSet.add(student);

      const reportDate = dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : detectedDate;
      const rawGrade = gradeIdx >= 0 && row[gradeIdx] ? row[gradeIdx] : detectedGrade;
      const grade = normalizeGradeName(rawGrade);
      const subject = subjectIdx >= 0 && row[subjectIdx] ? row[subjectIdx] : detectedSubject;
      const className = classIdx >= 0 && row[classIdx] ? row[classIdx] : detectedClass;
      const level = levelIdx >= 0 && row[levelIdx] ? row[levelIdx] : "1";
      const activitySkill = skillIdx >= 0 && row[skillIdx] ? row[skillIdx] : "Activity";
      
      detectedGrade = grade;
      detectedSubject = subject;
      detectedDate = reportDate;
      detectedClass = className;

      let statusRaw = (statusIdx >= 0 && row[statusIdx] ? row[statusIdx] : "").toLowerCase();
      let status: 'viewed' | 'unattempted' | 'attempted' = 'unattempted';
      if (statusRaw.includes("view")) status = 'viewed';
      else if (statusRaw.includes("attempt") || statusRaw.includes("complete")) status = 'attempted';

      const scoreRaw = scoreIdx >= 0 ? row[scoreIdx] : "";
      let scorePercentage: number | null = null;
      if (scoreRaw && scoreRaw !== "") {
        const val = parseInt(scoreRaw.replace('%', ''), 10);
        if (!isNaN(val)) {
          scorePercentage = val;
          status = 'attempted';
        }
      }

      const pCurr = progCurrIdx >= 0 && row[progCurrIdx] ? parseInt(row[progCurrIdx], 10) : null;
      const pTot = progTotIdx >= 0 && row[progTotIdx] ? parseInt(row[progTotIdx], 10) : null;

      records.push({
        student,
        reportDate,
        grade,
        subject,
        className,
        level,
        activitySkill,
        progressCurrent: isNaN(pCurr as number) ? null : pCurr,
        progressTotal: isNaN(pTot as number) ? null : pTot,
        scorePercentage,
        status
      });
    }

    const students = Array.from(studentSet);
    return {
      metadata: {
        reportType: "Tabular CSV",
        grade: detectedGrade,
        subject: detectedSubject,
        reportDate: detectedDate,
        className: detectedClass,
        source: "CSV Upload"
      },
      students,
      totalParsedRows: lines.length - 1,
      totalParsedRecords: records.length,
      records,
      warnings: []
    };
  }

  // Otherwise assume Khan Matrix CSV (Metadata in first lines, then table matrix)
  throw new Error("Unrecognized CSV format. Expected standard Khan activity export headers.");
}

/**
 * Unified parser for HTML and CSV formats.
 */
export function parseKhanExport(content: string, filename: string): ParseResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseKhanCsv(content);
  }
  return parseKhanHtml(content);
}
