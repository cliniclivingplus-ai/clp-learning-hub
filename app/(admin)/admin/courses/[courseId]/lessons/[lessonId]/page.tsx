"use client";
import { use, useState, useEffect } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import QuizBuilder from "@/components/QuizBuilder";
import AssignmentBuilder from "@/components/AssignmentBuilder";
import LessonPreview from "@/components/LessonPreview";
import ResourceUpload from "@/components/ResourceUpload";
import { parseDriveFileId } from "@/lib/driveFileId";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export default function EditLessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = use(params);
  const base = useStaffBasePath();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [driveInput, setDriveInput] = useState("");
  const [audioDriveInput, setAudioDriveInput] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceUrl, setResourceUrl] = useState<string | null>(null);
  const [resourceName, setResourceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const extractYoutubeId = (input: string) => {
    const urlMatch = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return input;
  };

  useEffect(() => {
    supabase.from("lessons").select("*").eq("id", lessonId).single().then(({ data }) => {
      if (data) {
        setTitle(data.title); setSlug(data.slug);
        setYoutubeId(data.youtube_video_id || ""); setDriveInput(data.drive_file_id || "");
        setAudioDriveInput(data.audio_file_id || ""); setNotes(data.notes || "");
        setResourceUrl(data.resource_url || null); setResourceName(data.resource_name || null);
      }
      setLoading(false);
    });
  }, [lessonId]);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess(false);
    const res = await fetch(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, slug, youtube_video_id: extractYoutubeId(youtubeId),
        drive_file_id: parseDriveFileId(driveInput),
        audio_file_id: parseDriveFileId(audioDriveInput),
        notes, resource_url: resourceUrl, resource_name: resourceName,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.message || "Failed to save."); return; }
    setSuccess(true); setTimeout(() => setSuccess(false), 3000);
  };

  const videoPreviewId = youtubeId ? extractYoutubeId(youtubeId) : "";

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--foreground-muted)" }}>Loading...</div>;

  return (
    <div className="p-5 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`${base}/courses`} className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft size={14} weight="bold" /> Courses</Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <Link href={`${base}/courses/${courseId}/lessons`} className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Lessons</Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Edit Lesson</span>
      </div>

      <h1 className="text-2xl font-bold mb-8" style={{ color: "var(--foreground)" }}>Edit Lesson</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
      <div className="space-y-6 max-w-3xl">
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Lesson Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>URL Slug</label>
            <input type="text" value={slug} onChange={e => setSlug(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
        </div>

        <div className="card p-6">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>YouTube Video</label>
          <input type="text" value={youtubeId} onChange={e => setYoutubeId(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or video ID"
            className="w-full px-4 py-2.5 rounded-xl border text-sm mb-4"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          {videoPreviewId && videoPreviewId.length >= 10 && (
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: "#000" }}>
              <iframe src={`https://www.youtube.com/embed/${videoPreviewId}`} className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>Learners will see this below the video.</p>
          <RichTextEditor value={notes} onChange={setNotes} placeholder="Type your lesson notes here..." />
        </div>

        <div className="card p-6">
          <ResourceUpload
            label="Lesson resource"
            prefix={`lessons/${lessonId}`}
            resourceUrl={resourceUrl}
            resourceName={resourceName}
            onChange={({ url, name }) => { setResourceUrl(url); setResourceName(name); }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: "var(--success)" }}>Saved successfully.</p>}

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold primary-gradient disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`${base}/courses/${courseId}/lessons`} className="px-6 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
            Back to Lessons
          </Link>
        </div>

        {/* Quiz and Assignment builders */}
        <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Lesson Activities</h2>
          <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
            Add a quiz and/or assignment for this lesson. Learners will see these after the video and notes.
          </p>
          <QuizBuilder lessonId={lessonId} label="Lesson" />
          <AssignmentBuilder lessonId={lessonId} />
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
