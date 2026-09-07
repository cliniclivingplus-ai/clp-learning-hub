"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LESSON_RESOURCES_BUCKET = "lesson-resources";

// Supabase's own project-wide upload cap is 50 MB regardless of what the
// bucket's own file_size_limit says (hit this for real with an 86.9 MB
// cookbook - see migration 019's Drive fallback). Stay under it here.
export const MAX_RESOURCE_BYTES = 45 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

export function describeResourceError(file: File): string | null {
  if (file.size > MAX_RESOURCE_BYTES) {
    return "File is larger than 45 MB - too big for direct upload. Put it on Google Drive instead and link it in the notes.";
  }
  if (!ALLOWED_TYPES[file.type]) return "Use a PDF, JPEG, PNG, or WebP file.";
  return null;
}

/**
 * Public bucket (migration 019) - these are shared teaching materials, not
 * personal documents, same reasoning as quiz-images. Path is prefixed so
 * files from different lessons/modules never collide.
 */
export async function uploadLessonResource(
  supabase: SupabaseClient,
  file: File,
  prefix: string
): Promise<{ url: string; name: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(LESSON_RESOURCES_BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return { url: `${base}/storage/v1/object/public/${LESSON_RESOURCES_BUCKET}/${path}`, name: file.name };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
