import { createClient } from "@/lib/supabase/server";
import { getActor, canManageCourse, courseIdForLesson } from "@/lib/auth";
import { NextResponse } from "next/server";

// Whitelisted so a caller cannot rewrite module_id, order, or anything else by
// spreading the request body into the update.
const EDITABLE_FIELDS = ["title", "slug", "youtube_video_id", "drive_file_id", "audio_file_id", "notes", "order"] as const;

/** Confirms the actor may manage the course this lesson belongs to. */
async function authorize(lessonId: string) {
  const actor = await getActor();
  if (!actor) return { ok: false as const, status: 401, message: "Unauthorized" };

  const courseId = await courseIdForLesson(lessonId);
  if (!courseId) return { ok: false as const, status: 404, message: "Lesson not found" };
  if (!(await canManageCourse(actor, courseId))) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const auth = await authorize(lessonId);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update(update).eq("id", lessonId);
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "A lesson with this slug already exists in this module." }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const auth = await authorize(lessonId);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
