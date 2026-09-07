import { createClient } from "@/lib/supabase/server";
import { getActor, canManageCourse, courseIdForModule } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { moduleId, title, slug, youtube_video_id, drive_file_id, audio_file_id, notes } = await request.json();
  if (!moduleId || !title || !slug) {
    return NextResponse.json({ message: "moduleId, title and slug are required" }, { status: 400 });
  }

  // Instructors may author inside their own courses; admins anywhere.
  const courseId = await courseIdForModule(moduleId);
  if (!courseId) return NextResponse.json({ message: "Module not found" }, { status: 404 });
  if (!(await canManageCourse(actor, courseId))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("lessons").select("*", { count: "exact", head: true }).eq("module_id", moduleId);

  const { data, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title, slug, youtube_video_id, drive_file_id, audio_file_id, notes, order: (count ?? 0) + 1 })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "A lesson with this slug already exists in this module." }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
