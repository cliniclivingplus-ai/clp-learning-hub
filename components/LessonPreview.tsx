"use client";

/**
 * A live "what the learner sees" panel for the lesson editor - fed straight
 * from the form's in-memory state, not from what's saved in the database.
 * Mirrors LessonPlayer's own video/audio/YouTube priority order exactly, so
 * this is never a guess at what will render - it's the same logic, just
 * pointed at an admin-only Drive proxy that streams by raw file id instead
 * of by lesson id (there may be no saved lesson yet to check).
 */
export default function LessonPreview({
  title,
  youtubeVideoId,
  driveFileId,
  audioFileId,
  notes,
}: {
  title: string;
  youtubeVideoId: string;
  driveFileId: string | null;
  audioFileId: string | null;
  notes: string;
}) {
  return (
    <div className="card p-5 sticky top-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--foreground-muted)" }}>
        Preview - what the learner sees
      </p>

      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--primary)" }}>Lesson</p>
      <h2 className="text-lg font-bold mb-4 truncate" style={{ color: "var(--foreground)" }}>
        {title || "Untitled lesson"}
      </h2>

      {driveFileId ? (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: "16/9", background: "#000" }}>
          <video key={driveFileId} src={`/api/admin/preview-drive/${driveFileId}`} controls className="w-full h-full" />
        </div>
      ) : youtubeVideoId && youtubeVideoId.length >= 10 ? (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : audioFileId ? (
        <div className="rounded-2xl mb-4 p-5 flex flex-col items-center justify-center gap-3"
          style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Audio Lesson</p>
          <audio key={audioFileId} src={`/api/admin/preview-drive/${audioFileId}`} controls className="w-full" />
        </div>
      ) : (
        <div className="rounded-2xl mb-4 flex items-center justify-center" style={{ aspectRatio: "16/9", background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No video for this lesson</p>
        </div>
      )}

      {notes ? (
        <div>
          <h3 className="font-semibold mb-2 text-sm" style={{ color: "var(--foreground)" }}>Lesson Notes</h3>
          <div className="preview-prose text-sm leading-relaxed" style={{ color: "var(--foreground-secondary)" }}
            dangerouslySetInnerHTML={{ __html: notes }} />
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>No notes added yet.</p>
      )}

      <style>{`
        .preview-prose h2 { font-size: 15px; font-weight: 700; margin: 12px 0 6px; color: var(--foreground); }
        .preview-prose h3 { font-size: 13px; font-weight: 600; margin: 10px 0 5px; color: var(--foreground); }
        .preview-prose p { margin: 5px 0; }
        .preview-prose ul { padding-left: 18px; list-style-type: disc; margin: 6px 0; }
        .preview-prose ol { padding-left: 18px; list-style-type: decimal; margin: 6px 0; }
        .preview-prose li { margin: 3px 0; }
        .preview-prose strong { font-weight: 700; color: var(--foreground); }
        .preview-prose em { font-style: italic; }
        .preview-prose hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
      `}</style>
    </div>
  );
}
