"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadLessonResource, describeResourceError } from "@/lib/lessonResources";
import { FilePdf, Image as ImageIcon, UploadSimple, X, Spinner } from "@phosphor-icons/react";

export type Resource = { id: string; url: string; name: string };

/**
 * Upload any number of PDFs/images straight into the public lesson-resources
 * bucket - one lesson or module can carry several attachments (a handout AND
 * a worksheet AND a diagram), each removable on its own.
 */
export default function ResourceList({
  label,
  prefix,
  lessonId,
  moduleId,
  resources,
  onChange,
}: {
  label: string;
  /** Storage path prefix, e.g. `lessons/{lessonId}` or `modules/{moduleId}`. */
  prefix: string;
  lessonId?: string;
  moduleId?: string;
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    for (const file of files) {
      const problem = describeResourceError(file);
      if (problem) { setError(`${file.name}: ${problem}`); continue; }

      setUploading(true);
      setError(null);
      try {
        const { url, name } = await uploadLessonResource(supabase, file, prefix);
        const res = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, moduleId, url, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to save attachment.");
        onChange([...resources, { id: data.id, url: data.url, name: data.name }]);
      } catch (err: any) {
        setError(err?.message || "Upload failed.");
      } finally {
        setUploading(false);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = async (resourceId: string) => {
    onChange(resources.filter(r => r.id !== resourceId));
    await fetch(`/api/resources/${resourceId}`, { method: "DELETE" });
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>{label}</label>
      <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
        Upload one or more PDFs or images directly - no need to put them on Drive unless a file is over 45 MB.
      </p>

      {resources.length > 0 && (
        <div className="space-y-2 mb-3">
          {resources.map((r) => {
            const isImage = /\.(jpe?g|png|webp)$/i.test(r.name);
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card-secondary)" }}>
                {isImage
                  ? <ImageIcon size={20} weight="duotone" style={{ color: "var(--primary)" }} className="flex-shrink-0" />
                  : <FilePdf size={20} weight="duotone" style={{ color: "var(--primary)" }} className="flex-shrink-0" />}
                <a href={r.url} target="_blank" rel="noopener" className="text-sm font-medium truncate flex-1" style={{ color: "var(--primary)" }}>
                  {r.name}
                </a>
                <button type="button" onClick={() => handleRemove(r.id)}
                  className="p-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--foreground-muted)" }} aria-label={`Remove ${r.name}`}>
                  <X size={14} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={handlePick} disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed text-sm font-medium disabled:opacity-60"
        style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
        {uploading ? (
          <><Spinner size={16} className="animate-spin" /> Uploading...</>
        ) : (
          <><UploadSimple size={16} weight="bold" /> {resources.length > 0 ? "Add another file" : "Upload PDF or image"}</>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
