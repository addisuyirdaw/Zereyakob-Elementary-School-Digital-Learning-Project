"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Unlink } from "lucide-react";
import { updateStudentMapping } from "./actions";
import { useLang } from "@/lib/i18n/LanguageProvider";

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
};

export function MappingClient({
  mappings,
  students,
  classes
}: {
  mappings: KhanMapping[];
  students: OfficialStudent[];
  classes: string[];
}) {
  const { lang } = useLang();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0] || "");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredMappings = mappings.filter(m => m.school_class_name === selectedClass);

  const handleMap = async (khanName: string, className: string, studentId: string) => {
    setSavingId(khanName);
    const res = await updateStudentMapping(khanName, className, studentId || null);
    if (res.success) {
      toast.success(studentId ? "Student mapped successfully!" : "Mapping removed.");
    } else {
      toast.error(res.error || "Failed to map student.");
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {lang === "en" ? "Filter by Class" : "በክፍል አጣራ"}
          </h2>
          <p className="text-sm text-slate-500">
            {lang === "en" ? "Select an imported Khan class to map its students." : "የተማሪዎቹን ክፍል ይምረጡ።"}
          </p>
        </div>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-64 rounded-md border border-slate-300 px-4 py-2 bg-slate-50 focus:border-royal-500 focus:ring-1 focus:ring-royal-500 outline-none"
        >
          {classes.length === 0 && <option value="">No classes found</option>}
          {classes.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-600 font-semibold">
                    <th className="px-6 py-4">Khan Student Name</th>
                    <th className="px-6 py-4">Mapping Status (Optional)</th>
                    <th className="px-6 py-4 w-1/2">Official Student Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMappings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                        No students found in this class.
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map(m => {
                      const isMapped = m.student_id !== null;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {m.khan_student_name}
                          </td>
                          <td className="px-6 py-4">
                            {isMapped ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <Link2 className="h-3 w-3" />
                                Mapped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                <Unlink className="h-3 w-3" />
                                Unmapped
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              disabled={savingId === m.khan_student_name}
                              value={m.student_id || ""}
                              onChange={(e) => handleMap(m.khan_student_name, m.school_class_name, e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500 outline-none disabled:opacity-50"
                            >
                              <option value="">-- Select Official Student --</option>
                              {students.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.first_name} {s.last_name} ({s.student_code})
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
      )}
    </div>
  );
}
