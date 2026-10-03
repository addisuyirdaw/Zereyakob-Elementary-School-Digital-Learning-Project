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

export function parseKhanHtml(html: string): ParseResult {
  // 1. Extract Metadata
  const h3Match = html.match(/<h3>(.*?)<\/h3>/);
  if (!h3Match) throw new Error("Metadata <h3> not found. Is this a valid Khan Academy export?");
  
  const rawMetadata = h3Match[1];
  const metaParts = rawMetadata.split(',').map(p => p.trim());
  if (metaParts.length < 5) {
      throw new Error("Invalid metadata format in the HTML file.");
  }

  const reportType = metaParts[0];
  const gradeSubject = metaParts[1].split(':').map(p => p.trim());
  const grade = gradeSubject[0];
  const subject = gradeSubject[1] || "";
  const reportDate = metaParts[2];
  const className = unescapeHtml(metaParts[3]);
  const source = metaParts[4];

  // 2. Extract Students
  const theadMatch = html.match(/<thead>\s*<tr>([\s\S]*?)<\/tr>\s*<\/thead>/);
  if (!theadMatch) throw new Error("Student headers (thead) not found");
  
  const thRegex = /<th>(.*?)<span/g;
  const students: string[] = [];
  let match;
  while ((match = thRegex.exec(theadMatch[1])) !== null) {
    let name = unescapeHtml(match[1]).trim();
    if (name) {
      students.push(name);
    }
  }

  // 3. Extract dataRows
  const dataRowsMatch = html.match(/const\s+dataRows\s*=\s*(\[[\s\S]*?\]);/);
  if (!dataRowsMatch) throw new Error("dataRows array not found in script tags");
  
  let dataRows: string[];
  try {
    const jsonStr = dataRowsMatch[1].replace(/\t/g, '\\t');
    dataRows = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Failed to parse dataRows safely: " + e);
  }

  const records: KhanRecord[] = [];
  let warnings: string[] = [];

  for (const row of dataRows) {
    const parts = row.split('\t');
    if (parts.length < 2) continue;

    const level = parts[0];
    const activitySkill = unescapeHtml(parts[1]);
    const scoresStr = parts[2] || '';

    // If completely blank, scores is an array of empty strings
    let scores = scoresStr.length === 0 ? [] : scoresStr.split(',');

    // Pad if shorter than numStudents
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
      } else if (scoreRaw === 'V') {
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
        scorePercentage = parseInt(scoreRaw, 10);
        status = 'attempted';
        if (isNaN(scorePercentage)) {
          warnings.push(`Invalid percentage: ${scoreRaw} for ${studentName}`);
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
