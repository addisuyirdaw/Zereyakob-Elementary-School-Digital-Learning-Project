import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout";
import { MappingClient } from "./client";

export const dynamic = "force-dynamic";

export default async function KhanMappingsPage() {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/signin?configured=0");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/signin");
  }

  // Authorization: Only staff can map students.
  // The layout.tsx already prevents 'student' role from accessing /dashboard,
  // but let's be explicit and fetch role if we want, or just rely on RLS.
  // RLS on khan_student_mappings will just return empty array if unauthorized.

  // Fetch mappings
  const { data: mappingsData, error: mappingsError } = await supabase
    .from("khan_student_mappings")
    .select("id, khan_student_name, school_class_name, student_id")
    .order("khan_student_name", { ascending: true });

  if (mappingsError) {
    console.error("Error fetching mappings:", mappingsError);
  }

  const mappings = mappingsData || [];

  // Get unique classes for the filter dropdown
  const classes = Array.from(new Set(mappings.map(m => m.school_class_name))).sort();

  // Fetch official students for the dropdowns
  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select("id, first_name, last_name, student_code")
    .order("first_name", { ascending: true });
    
  if (studentsError) {
    console.error("Error fetching students:", studentsError);
  }

  const students = studentsData || [];

  return (
    <div>
        <PageHeader
          title="Student Mapping"
          subtitle="Link Khan Academy student profiles to official Zereyakob School students. (Optional for historical records)"
        />
      <MappingClient mappings={mappings} students={students} classes={classes} />
    </div>
  );
}
