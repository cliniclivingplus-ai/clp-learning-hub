import { createAdminClient } from "@/lib/supabase/server";
import { getActor, isStaff } from "@/lib/auth";
import { fetchDriveFile, driveConfigured } from "@/lib/googleDrive";
import { NextResponse } from "next/server";

// Streams bytes, so it cannot run on the edge runtime.
export const runtime = "nodejs";
// The response depends on who is asking; caching it would serve one learner's
// audio to the next request from anyone.
export const dynamic = "force-dynamic";

/**
 * Serves a lesson's Drive audio recording to people entitled to it. Same gate
 * and same proxy shape as the video route - see that file for why the file
 * is never shared directly.
 */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  if (!driveConfigured()) {
    return NextResponse.json({ message: "Audio hosting is not configured" }, { status: 501 });
  }

  const actor = await getActor();
  if (!actor) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = await createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("audio_file_id, modules!lessons_module_id_fkey (course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  const audioFileId = lesson?.audio_file_id;
  const courseId = (lesson?.modules as any)?.course_id;
  if (!audioFileId || !courseId) {
    return NextResponse.json({ message: "No audio for this lesson" }, { status: 404 });
  }

  if (!isStaff(actor)) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("patient_id", actor.id)
      .eq("course_id", courseId)
      .in("status", ["active", "completed"])
      .limit(1)
      .maybeSingle();

    if (!enrollment) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const range = request.headers.get("range");
  const upstream = await fetchDriveFile(audioFileId, range);

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { message: "Could not load the audio" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  // Same reasoning as the video route: cache in the browser, never shared.
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
