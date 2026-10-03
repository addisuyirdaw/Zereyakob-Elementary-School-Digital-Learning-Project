"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileCode, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import Link from "next/link";
import { parseKhanUpload, saveKhanImport } from "./actions";
import type { ParseResult } from "@/lib/khan-parser";

export default function KhanDataPage() {
  const { lang } = useLang();
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      const type = selected.type;
      const isZip = type === "application/zip" || type === "application/x-zip-compressed" || selected.name.toLowerCase().endsWith(".zip");
      const isHtml = type === "text/html" || selected.name.toLowerCase().endsWith(".html");
      
      if (!isZip && !isHtml) {
        toast.error("Invalid file type. Please select an HTML or ZIP file.");
        return;
      }
      setFile(selected);
      setResult(null); // reset
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await parseKhanUpload(formData);
    
    if (res.success && res.result) {
      setResult(res.result);
      toast.success("File parsed successfully!");
    } else {
      toast.error(res.error || "Failed to parse file.");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!file || saving) return;
    
    setSaving(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await saveKhanImport(formData);
    
    if (res.success) {
      toast.success(`Success! Imported ${res.records_inserted || 0} learning records.`);
      setResult(null);
      setFile(null);
    } else {
      switch (res.status) {
        case "duplicate":
          toast.error("This exact Khan report has already been imported.");
          break;
        case "validation_error":
          toast.error(res.message || "Import validation failed.");
          break;
        case "unauthorized":
          toast.error("You must be authenticated to perform this action.");
          break;
        case "storage_error":
          toast.error("The file could not be securely stored. Import was aborted.");
          break;
        case "unexpected_error":
          toast.error("Import status is uncertain due to a network or server issue. Do not retry immediately.");
          break;
        default:
          toast.error("An unknown error occurred.");
      }
    }
    setSaving(false);
  };

  const filteredRecords = result?.records.filter(r => {
    const matchStudent = r.student.toLowerCase().includes(filterStudent.toLowerCase());
    const matchStatus = filterStatus === "all" ? true : r.status === filterStatus;
    return matchStudent && matchStatus;
  }) || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <PageHeader
          title={lang === "en" ? "Khan Academy Import" : "የካን አካዳሚ ማስገቢያ"}
          subtitle={lang === "en" ? "Upload and parse Khan Academy Kids HTML exports safely." : "የካን አካዳሚ ሪፖርቶችን ያስገቡ እና ያረጋግጡ።"}
        />
        <Link href="/dashboard/khan-data/mappings">
          <Button variant="outline">
            {lang === "en" ? "Student Mappings" : "የተማሪ ማገናኛ"}
          </Button>
        </Link>
      </div>

      {!result ? (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4 rounded-full bg-royal-50 p-4">
              <Upload className="h-8 w-8 text-royal-600" />
            </div>
            <CardTitle className="mb-2">Upload HTML Report</CardTitle>
            <CardDescription className="mb-6 max-w-md">
              Select an HTML or ZIP export from Khan Academy Kids. The file will be securely validated and parsed without saving it to the database yet.
            </CardDescription>

            <div className="flex flex-col items-center gap-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-8 py-4 transition hover:bg-slate-100">
                <FileCode className="h-5 w-5 text-slate-500" />
                <span className="font-medium text-slate-700">
                  {file ? file.name : "Choose HTML File"}
                </span>
                <input 
                  type="file" 
                  accept=".html,text/html,.zip,application/zip,application/x-zip-compressed"  
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>

              <Button 
                onClick={handleUpload} 
                disabled={!file || loading}
                className="w-full max-w-xs"
              >
                {loading ? "Parsing..." : "Parse & Preview"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">Valid Import Metadata</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block">File:</span>
                    <span className="font-medium text-slate-900">{file?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date:</span>
                    <span className="font-medium text-slate-900">{result.metadata.reportDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Subject:</span>
                    <span className="font-medium text-slate-900">{result.metadata.subject || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Grade:</span>
                    <span className="font-medium text-slate-900">{result.metadata.grade}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Class:</span>
                    <span className="font-medium text-slate-900">{result.metadata.className}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Students:</span>
                    <span className="font-medium text-slate-900">{result.students.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex flex-col justify-center h-full text-center">
                <div className="mb-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900">{result.totalParsedRecords}</div>
                <div className="text-sm font-medium text-slate-500">Learning Records Generated</div>
                <div className="text-xs text-slate-400 mt-1">from {result.totalParsedRows} activities</div>
              </CardContent>
            </Card>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
                <AlertTriangle className="h-5 w-5" />
                Parser Warnings ({result.warnings.length})
              </div>
              <ul className="text-sm text-amber-700 list-disc pl-5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-slate-100 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 rounded-t-xl">
                <h3 className="font-semibold text-slate-800">Record Preview (Not Saved)</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input 
                    type="text" 
                    placeholder="Filter by student..."
                    value={filterStudent}
                    onChange={e => setFilterStudent(e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-royal-500"
                  />
                  <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-royal-500"
                  >
                    <option value="all">All Status</option>
                    <option value="viewed">Viewed</option>
                    <option value="attempted">Attempted</option>
                    <option value="unattempted">Unattempted</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm">
                    <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Activity / Skill</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-2 font-medium text-slate-800">{r.student}</td>
                          <td className="px-4 py-2 text-slate-500">{r.level}</td>
                          <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]" title={r.activitySkill}>{r.activitySkill}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {r.progressCurrent !== null ? `${r.progressCurrent}/${r.progressTotal}` : '-'}
                          </td>
                          <td className="px-4 py-2">
                            {r.scorePercentage !== null ? (
                              <span className={`font-semibold ${r.scorePercentage >= 80 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {r.scorePercentage}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2">
                            {r.status === 'viewed' && <span className="inline-flex rounded-full bg-royal-100 px-2 py-0.5 text-xs font-semibold text-royal-700">Viewed</span>}
                            {r.status === 'attempted' && <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Attempted</span>}
                            {r.status === 'unattempted' && <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Unattempted</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => { setResult(null); setFile(null); }} disabled={saving}>
              Cancel & Start Over
            </Button>
            <Button onClick={handleSave} disabled={saving || !file}>
              {saving ? "Saving..." : "Confirm & Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
