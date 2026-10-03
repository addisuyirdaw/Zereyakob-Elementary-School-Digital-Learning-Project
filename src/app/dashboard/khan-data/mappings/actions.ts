"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateStudentMapping(khanName: string, className: string, studentId: string | null) {
  const supabase = await createClient();
  if (!supabase) {
    return { success: false, error: "Database configuration error" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Update existing row
  const { error } = await supabase
    .from("khan_student_mappings")
    .update({ student_id: studentId })
    .match({ khan_student_name: khanName, school_class_name: className });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/khan-data/mappings");
  return { success: true };
}
