import { getActor, isStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchDriveFile, driveConfigured } from "@/lib/googleDrive";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves a staff training video. Same Drive-proxy shape as the patient lesson
 * video route, but the gate is simply "is this person staff" - there is no
 * enrollment concept for training.
 */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  if (!driveConfigured()) {
    return NextResponse.json({ message: "Video hosting is not configured" }, { status: 501 });
  }

  const actor = await getActor();
  if (!actor || !isStaff(actor)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const admin = await createAdminClient();
  const { data: lesson } = await admin
    .from("training_lessons")
    .select("drive_file_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson?.drive_file_id) {
    return NextResponse.json({ message: "No video for this lesson" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const upstream = await fetchDriveFile(lesson.drive_file_id, range);

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { message: "Could not load the video" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  // Same reasoning as the patient-facing video route: cache in the browser
  // for replay/seek, never shared/CDN-cached.
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
