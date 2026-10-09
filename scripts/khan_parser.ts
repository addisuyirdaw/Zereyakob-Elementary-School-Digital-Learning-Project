import * as fs from 'fs';

interface KhanRecord {
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

function parseKhanHtml(html: string): any {
  // 1. Extract Metadata
  const h3Match = html.match(/<h3>(.*?)<\/h3>/);
  if (!h3Match) throw new Error("Metadata <h3> not found");
  
  const rawMetadata = h3Match[1];
  const metaParts = rawMetadata.split(',').map(p => p.trim());
  const reportType = metaParts[0];
  const gradeSubject = metaParts[1].split(':').map(p => p.trim());
  const grade = gradeSubject[0];
  const subject = gradeSubject[1];
  const reportDate = metaParts[2];
  const className = unescapeHtml(metaParts[3]);
  const source = metaParts[4];

  // 2. Extract Students
  // Find the thead tr
  const theadMatch = html.match(/<thead>\s*<tr>([\s\S]*?)<\/tr>\s*<\/thead>/);
  if (!theadMatch) throw new Error("thead not found");
  
  const thRegex = /<th>(.*?)<span/g;
  const students: string[] = [];
  let match;
  while ((match = thRegex.exec(theadMatch[1])) !== null) {
    let name = unescapeHtml(match[1]).trim();
    // skip the first empty th which has just <span class="resize-handle"></span>
    // wait, the first one is <th><span class="resize-handle"></span></th>
    // so `match[1]` would be empty.
    if (name) {
      students.push(name);
    }
  }

  // 3. Extract dataRows
  // const dataRows = [ ... ];
  const dataRowsMatch = html.match(/const\s+dataRows\s*=\s*(\[[\s\S]*?\]);/);
  if (!dataRowsMatch) throw new Error("dataRows not found");
  
  // Parse the array
  // Since it's just strings, we can safely JSON.parse it if it's formatted like a JSON array.
  // The provided HTML uses double quotes and no trailing commas, so JSON.parse should work.
  let dataRows: string[];
  try {
    const jsonStr = dataRowsMatch[1].replace(/\t/g, '\\t');
    dataRows = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Failed to parse dataRows as JSON: " + e);
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

export function test() {
  const filePaths = process.argv.slice(2);
  for (const filePath of filePaths) {
    console.log(`\n--- Parsing ${filePath} ---`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const result = parseKhanHtml(html);
    
    console.log("1. Metadata:", result.metadata);
    console.log("2. Detected Students:", result.students);
    console.log(`3. Total Parsed Rows (Khan activities): ${result.totalParsedRows}`);
    console.log(`   Total Records Generated: ${result.totalParsedRecords}`);
    
    const numScorePercentage = result.records.filter((r: KhanRecord) => r.scorePercentage !== null).length;
    const numProgress = result.records.filter((r: KhanRecord) => r.progressCurrent !== null).length;
    const numViewed = result.records.filter((r: KhanRecord) => r.status === 'viewed').length;
    const numUnattempted = result.records.filter((r: KhanRecord) => r.status === 'unattempted').length;
    const numNullStatus = result.records.filter((r: KhanRecord) => !r.status && r.progressCurrent === null && r.scorePercentage === null).length;

    console.log("QA 1. Total records generated:", result.totalParsedRecords);
    console.log("QA 2. Number of records with scorePercentage:", numScorePercentage);
    console.log("QA 3. Number of records with progressCurrent/progressTotal:", numProgress);
    console.log("QA 4. Number of records with status = 'viewed':", numViewed);
    console.log("QA 5. Number of records with status = 'unattempted':", numUnattempted);
    console.log("QA 6. Number of records where all score/progress/status fields are null/empty:", numNullStatus);
    
    const mixedRows = result.records.reduce((acc: Record<string, KhanRecord[]>, r: KhanRecord) => {
      if (!acc[r.activitySkill]) acc[r.activitySkill] = [];
      acc[r.activitySkill].push(r);
      return acc;
    }, {});
    
    // targeted checks for specific row conditions
    const findRowExample = (predicate: (recs: KhanRecord[]) => boolean): { skill: string; records: KhanRecord[] } | null => {
      for (const [skill, recs] of Object.entries(mixedRows)) {
        const castRecs = recs as KhanRecord[];
        if (predicate(castRecs)) {
          return { skill, records: castRecs };
        }
      }
      return null;
    };

    const blankRow = findRowExample(recs => recs.every(r => r.status === 'unattempted'));
    const pctRow = findRowExample(recs => recs.some(r => r.scorePercentage !== null));
    const fracRow = findRowExample(recs => recs.some(r => r.progressCurrent !== null));
    const vRow = findRowExample(recs => recs.some(r => r.status === 'viewed'));
    const emptyStudentRow = findRowExample(recs => recs.some(r => r.status === 'unattempted') && recs.some(r => r.status !== 'unattempted'));

    console.log("\n--- Row Examples ---");
    console.log("1. Completely blank score string row exists:", !!blankRow);
    if (blankRow) console.log("   Example:", blankRow.skill, "->", blankRow.records.map((r: KhanRecord) => r.status));

    console.log("2. Row with a percentage exists:", !!pctRow);
    if (pctRow) console.log("   Example:", pctRow.skill, "->", pctRow.records.map((r: KhanRecord) => r.scorePercentage || r.status));

    console.log("3. Row with a fraction exists:", !!fracRow);
    if (fracRow) console.log("   Example:", fracRow.skill, "->", fracRow.records.map((r: KhanRecord) => r.progressCurrent ? `${r.progressCurrent}/${r.progressTotal}` : r.status));

    console.log("4. Row with 'V' exists:", !!vRow);
    if (vRow) console.log("   Example:", vRow.skill, "->", vRow.records.map((r: KhanRecord) => r.status));

    console.log("5. Row with mixed empty/attempted values exists:", !!emptyStudentRow);
    if (emptyStudentRow) console.log("   Example:", emptyStudentRow.skill, "->", emptyStudentRow.records.map((r: KhanRecord) => r.scorePercentage || r.status));

  }
}

if (require.main === module) {
  test();
}
