"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadLessonResource, describeResourceError } from "@/lib/lessonResources";
import { FilePdf, UploadSimple, X, Spinner } from "@phosphor-icons/react";

/**
 * Upload a PDF or image straight into the public lesson-resources bucket and
 * hand back its URL/name - the direct replacement for hand-running an
 * upload script and pasting a link into notes HTML.
 */
export default function ResourceUpload({
  label,
  prefix,
  resourceUrl,
  resourceName,
  onChange,
}: {
  label: string;
  /** Storage path prefix, e.g. `lessons/{lessonId}` or `modules/{moduleId}`. */
  prefix: string;
  resourceUrl: string | null | undefined;
  resourceName: string | null | undefined;
  onChange: (resource: { url: string | null; name: string | null }) => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = describeResourceError(file);
    if (problem) { setError(problem); return; }

    setUploading(true);
    setError(null);
    try {
      const { url, name } = await uploadLessonResource(supabase, file, prefix);
      onChange({ url, name });
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>{label}</label>
      <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
        Upload a PDF or image directly - no need to put it on Drive unless it's over 45 MB.
      </p>

      {resourceUrl ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card-secondary)" }}>
          <FilePdf size={20} weight="duotone" style={{ color: "var(--primary)" }} className="flex-shrink-0" />
          <a href={resourceUrl} target="_blank" rel="noopener" className="text-sm font-medium truncate flex-1" style={{ color: "var(--primary)" }}>
            {resourceName || "Attached file"}
          </a>
          <button type="button" onClick={() => onChange({ url: null, name: null })}
            className="p-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--foreground-muted)" }} aria-label="Remove attachment">
            <X size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={handlePick} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed text-sm font-medium disabled:opacity-60"
          style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
          {uploading ? (
            <><Spinner size={16} className="animate-spin" /> Uploading...</>
          ) : (
            <><UploadSimple size={16} weight="bold" /> Upload PDF or image</>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
      {resourceUrl && !uploading && (
        <button type="button" onClick={handlePick} className="text-xs mt-2 font-semibold" style={{ color: "var(--primary)" }}>
          Replace file
        </button>
      )}
    </div>
  );
}
