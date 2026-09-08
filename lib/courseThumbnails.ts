"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COURSE_THUMBNAILS_BUCKET = "course-thumbnails";
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function describeThumbnailError(file: File): string | null {
  if (file.size > MAX_THUMBNAIL_BYTES) return "Image is larger than 5 MB.";
  if (!ALLOWED_TYPES.has(file.type)) return "Use a JPEG, PNG, or WebP image.";
  return null;
}

/** Public bucket - shown on every course card in the catalog. */
export async function uploadCourseThumbnail(
  supabase: SupabaseClient,
  file: File,
  courseId: string
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(COURSE_THUMBNAILS_BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${COURSE_THUMBNAILS_BUCKET}/${path}`;
}
