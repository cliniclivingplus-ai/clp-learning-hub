import { createClient } from "@/lib/supabase/server";
import { getActor, canManageCourse, courseIdForLesson, courseIdForModule } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { lessonId, moduleId, url, name } = await request.json();
  if (!url || !name || (!lessonId && !moduleId) || (lessonId && moduleId)) {
    return NextResponse.json({ message: "Provide url, name, and exactly one of lessonId/moduleId" }, { status: 400 });
  }

  const courseId = lessonId ? await courseIdForLesson(lessonId) : await courseIdForModule(moduleId);
  if (!courseId) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!(await canManageCourse(actor, courseId))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("resources").select("*", { count: "exact", head: true })
    .eq(lessonId ? "lesson_id" : "module_id", lessonId || moduleId);

  const { data, error } = await supabase
    .from("resources")
    .insert({ lesson_id: lessonId || null, module_id: moduleId || null, url, name, order_index: count ?? 0 })
    .select("id, url, name")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
