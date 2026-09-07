import { createClient } from "@/lib/supabase/server";
import { getActor, canManageCourse, courseIdForLesson, courseIdForModule } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: resource } = await supabase
    .from("resources").select("id, lesson_id, module_id").eq("id", resourceId).maybeSingle();
  if (!resource) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const courseId = resource.lesson_id
    ? await courseIdForLesson(resource.lesson_id)
    : await courseIdForModule(resource.module_id!);
  if (!courseId) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!(await canManageCourse(actor, courseId))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("resources").delete().eq("id", resourceId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
