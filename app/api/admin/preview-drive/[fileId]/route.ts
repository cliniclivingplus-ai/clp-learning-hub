import { getActor, isStaff } from "@/lib/auth";
import { fetchDriveFile, driveConfigured } from "@/lib/googleDrive";
import { NextResponse } from "next/server";

// Streams bytes, so it cannot run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a Drive file straight by its file id, for the live "preview as
 * learner" panel in the lesson editor - there is no lesson row yet to check
 * an enrollment against (the id in the field may not even be saved), so this
 * is gated on being staff rather than on a specific lesson/course. Never
 * exposed to a learner - only used by the admin/instructor editing UI.
 */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;

  if (!driveConfigured()) {
    return NextResponse.json({ message: "Drive hosting is not configured" }, { status: 501 });
  }

  const actor = await getActor();
  if (!actor || !isStaff(actor)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const range = request.headers.get("range");
  const upstream = await fetchDriveFile(fileId, range);

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { message: "Could not load the file - check it's shared with the service account." },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set("Cache-Control", "private, no-store");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
