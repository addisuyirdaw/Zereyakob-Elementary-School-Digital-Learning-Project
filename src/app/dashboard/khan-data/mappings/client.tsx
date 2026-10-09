"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { Check, Filter, Link2, Search, Sparkles, Unlink } from "lucide-react";
import { updateStudentMapping } from "./actions";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

type KhanMapping = {
  id: string;
  khan_student_name: string;
  school_class_name: string;
  student_id: string | null;
};

type OfficialStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  grade?: string;
  section?: string;
};

export function MappingClient({
  mappings: initialMappings,
  students,
  classes,
}: {
  mappings: KhanMapping[];
  students: OfficialStudent[];
  classes: string[];
}) {
  const { lang } = useLang();
  const [mappings, setMappings] = useState<KhanMapping[]>(initialMappings);
  const [selectedClass, setSelectedClass] = useState<string>(classes[0] || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unmapped" | "mapped">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);

  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      const matchClass = selectedClass === "all" || m.school_class_name === selectedClass;
      const isMapped = m.student_id !== null;
      let matchStatus = true;
      if (statusFilter === "unmapped") matchStatus = !isMapped;
      if (statusFilter === "mapped") matchStatus = isMapped;

      const needle = searchQuery.trim().toLowerCase();
      const matchSearch =
        !needle ||
        m.khan_student_name.toLowerCase().includes(needle) ||
        m.school_class_name.toLowerCase().includes(needle);

      return matchClass && matchStatus && matchSearch;
    });
  }, [mappings, selectedClass, statusFilter, searchQuery]);

  const handleMap = async (khanName: string, className: string, studentId: string) => {
    setSavingId(khanName);
    const res = await updateStudentMapping(khanName, className, studentId || null);
    if (res.success) {
      setMappings((prev) =>
        prev.map((m) =>
          m.khan_student_name === khanName && m.school_class_name === className
            ? { ...m, student_id: studentId || null }
            : m
        )
      );
      toast.success(studentId ? "Student mapped successfully!" : "Mapping removed.");
    } else {
      toast.error(res.error || "Failed to map student.");
    }
    setSavingId(null);
  };

  // Auto-Match heuristic for identical / high-confidence names
  const handleAutoMatch = async () => {
    setAutoMatching(true);
    let matchedCount = 0;

    for (const m of mappings) {
      if (m.student_id) continue; // Already mapped

      const kName = m.khan_student_name.trim().toLowerCase();

      // Look for exact match on "first_name last_name" or exact single first_name match
      const matched = students.find((s) => {
        const full = `${s.first_name} ${s.last_name}`.trim().toLowerCase();
        const first = s.first_name.trim().toLowerCase();
        return full === kName || first === kName;
      });

      if (matched) {
        const res = await updateStudentMapping(m.khan_student_name, m.school_class_name, matched.id);
        if (res.success) {
          matchedCount++;
          setMappings((prev) =>
            prev.map((item) =>
              item.id === m.id ? { ...item, student_id: matched.id } : item
            )
          );
        }
      }
    }

    setAutoMatching(false);
    if (matchedCount > 0) {
      toast.success(`Auto-matched ${matchedCount} student(s) based on matching names!`);
    } else {
      toast.info("No unmapped students had exact matching names.");
    }
  };

  const totalUnmapped = mappings.filter((m) => !m.student_id).length;

  return (
    <div className="space-y-6">
      {/* Top Filter Controls Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto flex-1">
              {/* Class Filter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {lang === "en" ? "Filter by Class" : "በክፍል አጣራ"}
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Classes ({classes.length})</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {lang === "en" ? "Status" : "ሁኔታ"}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Records ({mappings.length})</option>
                  <option value="unmapped">Unmapped Only ({totalUnmapped})</option>
                  <option value="mapped">Mapped Only ({mappings.length - totalUnmapped})</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {lang === "en" ? "Search Student" : "ተማሪ ፈልግ"}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Button
                variant="outline"
                size="sm"
                loading={autoMatching}
                onClick={handleAutoMatch}
                className="gap-2 text-royal-700 border-royal-200 hover:bg-royal-50 text-xs w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4 text-royal-600" />
                {lang === "en" ? "Auto-Match Names" : "በራስ-ሰር አዛምድ"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mappings Table Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">{lang === "en" ? "Khan Student Name" : "የካን ስም"}</th>
                  <th className="px-6 py-4">{lang === "en" ? "Class Name" : "የክፍል ስም"}</th>
                  <th className="px-6 py-4">{lang === "en" ? "Status" : "ሁኔታ"}</th>
                  <th className="px-6 py-4 w-1/2">{lang === "en" ? "Official School Student" : "ዋና የተማሪ መለያ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      {lang === "en" ? "No mappings matching current filter." : "ምንም መረጃ አልተገኘም።"}
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((m) => {
                    const isMapped = m.student_id !== null;
                    const official = students.find((s) => s.id === m.student_id);

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {m.khan_student_name}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-semibold">
                          {m.school_class_name}
                        </td>
                        <td className="px-6 py-4">
                          {isMapped ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              <Link2 className="h-3 w-3" />
                              Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                              <Unlink className="h-3 w-3" />
                              Unmapped Review
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            disabled={savingId === m.khan_student_name}
                            value={m.student_id || ""}
                            onChange={(e) => handleMap(m.khan_student_name, m.school_class_name, e.target.value)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-sm bg-white focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 disabled:opacity-50",
                              isMapped ? "border-slate-300 text-slate-900" : "border-amber-300 text-amber-900 bg-amber-50/30"
                            )}
                          >
                            <option value="">-- Select Official Student to Link --</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.first_name} {s.last_name} ({s.student_code}) · {s.grade || ""} {s.section || ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
