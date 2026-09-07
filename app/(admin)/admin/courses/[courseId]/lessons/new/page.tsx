"use client";
import { use, useState, useEffect } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { parseDriveFileId } from "@/lib/driveFileId";
import LessonPreview from "@/components/LessonPreview";
import ResourceUpload from "@/components/ResourceUpload";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export default function NewLessonPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const base = useStaffBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get("moduleId") || "";
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [driveInput, setDriveInput] = useState("");
  const [audioDriveInput, setAudioDriveInput] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceUrl, setResourceUrl] = useState<string | null>(null);
  const [resourceName, setResourceName] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  // No lesson id exists yet to scope the upload path to - a stable per-draft
  // id keeps re-uploads from colliding without needing one.
  const [draftId] = useState(() => crypto.randomUUID());

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const extractYoutubeId = (input: string) => {
    const urlMatch = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return input;
  };

  useEffect(() => {
    if (moduleId) {
      supabase.from("modules").select("title").eq("id", moduleId).single()
        .then(({ data }) => { if (data) setModuleTitle(data.title); });
    }
  }, [moduleId]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManuallyEdited) setSlug(generateSlug(val));
  };

  const handleCreate = async () => {
    if (!title || !slug || !moduleId) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId, title, slug, youtube_video_id: extractYoutubeId(youtubeId),
        drive_file_id: parseDriveFileId(driveInput),
        audio_file_id: parseDriveFileId(audioDriveInput),
        notes, resource_url: resourceUrl, resource_name: resourceName,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.message || "Failed to create lesson."); return; }
    router.push(`${base}/courses/${courseId}/lessons`);
    router.refresh();
  };

  const videoPreviewId = youtubeId ? extractYoutubeId(youtubeId) : "";

  return (
    <div className="p-5 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`${base}/courses`} className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft size={14} weight="bold" /> Courses</Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <Link href={`${base}/courses/${courseId}/lessons`} className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Lessons</Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>New Lesson</span>
      </div>

      {moduleTitle && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
          Adding to module: <strong>{moduleTitle}</strong>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-8" style={{ color: "var(--foreground)" }}>Add New Lesson</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
      <div className="space-y-6 max-w-3xl">
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Lesson Title *</label>
            <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. What is the Gut Microbiome?"
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>URL Slug</label>
            <input type="text" value={slug} onChange={(e) => { setSlugManuallyEdited(true); setSlug(generateSlug(e.target.value)); }}
              placeholder="what-is-gut-microbiome"
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>YouTube Video</label>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            Paste the full YouTube URL or just the video ID. Video must be Unlisted on YouTube.
          </p>
          <input type="text" value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
            className="w-full px-4 py-2.5 rounded-xl border text-sm mb-4"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          {videoPreviewId && videoPreviewId.length >= 10 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Preview:</p>
              <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: "#000" }}>
                <iframe src={`https://www.youtube.com/embed/${videoPreviewId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen />
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Google Drive video</label>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            Paste the Drive share link or the file id. The file stays private in Drive - the hub
            serves it only to learners enrolled in this course. Set this and it replaces YouTube for this lesson.
          </p>
          <input type="text" value={driveInput} onChange={(e) => setDriveInput(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          {driveInput.trim() && (
            <p className="text-xs mt-2" style={{ color: parseDriveFileId(driveInput) ? "var(--success)" : "var(--danger)" }}>
              {parseDriveFileId(driveInput)
                ? `File id: ${parseDriveFileId(driveInput)}`
                : "That does not look like a Drive link or file id."}
            </p>
          )}
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Google Drive audio</label>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            For lessons that are an audio recording instead of a video. Same private Drive proxy.
            Only shown to learners when there is no YouTube or Drive video set above.
          </p>
          <input type="text" value={audioDriveInput} onChange={(e) => setAudioDriveInput(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          {audioDriveInput.trim() && (
            <p className="text-xs mt-2" style={{ color: parseDriveFileId(audioDriveInput) ? "var(--success)" : "var(--danger)" }}>
              {parseDriveFileId(audioDriveInput)
                ? `File id: ${parseDriveFileId(audioDriveInput)}`
                : "That does not look like a Drive link or file id."}
            </p>
          )}
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Lesson Notes</label>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            Use the toolbar to format content. Learners see this below the video.
          </p>
          <RichTextEditor value={notes} onChange={setNotes} placeholder="Type your lesson notes here. Use the toolbar above to add headings, bullet points, and more..." />
        </div>

        <div className="card p-6">
          <ResourceUpload
            label="Lesson resource"
            prefix={`lessons/${draftId}`}
            resourceUrl={resourceUrl}
            resourceName={resourceName}
            onChange={({ url, name }) => { setResourceUrl(url); setResourceName(name); }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={handleCreate} disabled={loading || !title || !slug || !moduleId}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold primary-gradient disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? "Saving..." : "Save Lesson"}
          </button>
          <Link href={`${base}/courses/${courseId}/lessons`} className="px-6 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
            Cancel
          </Link>
        </div>
      </div>

      <LessonPreview
        title={title}
        youtubeVideoId={videoPreviewId}
        driveFileId={parseDriveFileId(driveInput)}
        audioFileId={parseDriveFileId(audioDriveInput)}
        notes={notes}
      />
      </div>
    </div>
  );
}
