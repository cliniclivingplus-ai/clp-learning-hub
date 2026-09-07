import { createAdminClient } from "@/lib/supabase/server";
import { getActor, isStaff } from "@/lib/auth";
import { fetchDriveFile, driveConfigured } from "@/lib/googleDrive";
import { NextResponse } from "next/server";

// Streams bytes, so it cannot run on the edge runtime.
export const runtime = "nodejs";
// The response depends on who is asking; caching it would serve one learner's
// video to the next request from anyone.
export const dynamic = "force-dynamic";

/**
 * Serves a lesson's Drive video to people entitled to it.
 *
 * This is the whole access gate. The Drive file is shared with nobody, so the
 * only way to the bytes is through this route, and this route refuses anyone
 * without an enrollment. A learner who copies the URL out of devtools gets a
 * link that only works while they are signed in and enrolled - forwarding it
 * to someone else gives them a 403.
 */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  if (!driveConfigured()) {
    return NextResponse.json({ message: "Video hosting is not configured" }, { status: 501 });
  }

  const actor = await getActor();
  if (!actor) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Service role: the entitlement decision is made here explicitly rather than
  // leaning on RLS, so the rule is visible in one place.
  const admin = await createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("drive_file_id, modules!lessons_module_id_fkey (course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  const driveFileId = lesson?.drive_file_id;
  const courseId = (lesson?.modules as any)?.course_id;
  if (!driveFileId || !courseId) {
    return NextResponse.json({ message: "No video for this lesson" }, { status: 404 });
  }

  if (!isStaff(actor)) {
    // Completed counts: finishing a course must not take the material away.
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
  const upstream = await fetchDriveFile(driveFileId, range);

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { message: "Could not load the video" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  // Pass through the headers the video element needs to seek. Everything else
  // from Drive is dropped so no Google identifiers reach the browser.
  const headers = new Headers();
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  // private, not no-store: seeking/replaying within the same session should
  // hit the browser's own cache instead of round-tripping through Drive
  // again for bytes it already has. Never shared/CDN-cached either way.
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
