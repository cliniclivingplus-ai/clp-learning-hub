"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadCourseThumbnail, describeThumbnailError } from "@/lib/courseThumbnails";
import { Image as ImageIcon, Spinner } from "@phosphor-icons/react";

/**
 * The picture shown on a course's public catalog card. Uploads straight into
 * the course-thumbnails bucket and saves the URL through the course PATCH
 * route (so the usual admin/instructor-owns-course check applies), then
 * hands the new value back so the list can update without a full refetch.
 */
export default function CourseThumbnail({
  courseId,
  thumbnailUrl,
  onChange,
}: {
  courseId: string;
  thumbnailUrl: string | null;
  onChange: (url: string) => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = describeThumbnailError(file);
    if (problem) { setError(problem); return; }

    setUploading(true);
    setError(null);
    try {
      const url = await uploadCourseThumbnail(supabase, file, courseId);
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_url: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save the picture.");
      onChange(url);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex-shrink-0">
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        aria-label={thumbnailUrl ? "Change course picture" : "Upload course picture"}
        className="relative w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center group disabled:opacity-60"
        style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={22} weight="duotone" style={{ color: "var(--foreground-muted)" }} />
        )}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-white text-center px-1"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          {uploading ? <Spinner size={16} className="animate-spin" /> : (thumbnailUrl ? "Change" : "Upload")}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-[10px] mt-1 max-w-[80px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
