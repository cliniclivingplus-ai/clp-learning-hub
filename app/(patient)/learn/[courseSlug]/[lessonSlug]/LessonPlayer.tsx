"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, FilePdf } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import LessonProgress from "@/components/motion/LessonProgress";
import CourseCompleteDialog from "@/components/motion/CourseCompleteDialog";

const QuizBlock = dynamic(() => import("@/components/QuizBlock"), { ssr: false });
const AssignmentBlock = dynamic(() => import("@/components/AssignmentBlock"), { ssr: false });

interface LessonPlayerProps {
  lessonId: string;
  enrollmentId: string;
  patientId: string;
  youtubeVideoId: string | null;
  /** When set, the video comes from Drive through our own route and wins over YouTube. */
  driveFileId: string | null;
  /** An audio-only recording, served the same way. Shown only when there is no video. */
  audioFileId: string | null;
  notes: string | null;
  resourceUrl: string | null;
  resourceName: string | null;
  isCompleted: boolean;
  prevLesson: { slug: string; title: string } | null;
  nextLesson: { slug: string; title: string } | null;
  courseSlug: string;
  totalLessons: number;
  currentIndex: number;
  quiz: { id: string; title: string; questions: any[] } | null;
  assignment: { id: string; title: string; prompt: string } | null;
  existingSubmission: any | null;
  /** The course is already finished; this is a re-read, not a first pass. */
  isReviewing?: boolean;
}

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

export default function LessonPlayer({
  lessonId, enrollmentId, patientId, youtubeVideoId, driveFileId, audioFileId, notes, resourceUrl, resourceName, isCompleted,
  prevLesson, nextLesson, courseSlug, totalLessons, currentIndex,
  quiz, assignment, existingSubmission, isReviewing = false,
}: LessonPlayerProps) {
  const router = useRouter();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [completed, setCompleted] = useState(isCompleted);
  const [marking, setMarking] = useState(false);
  const [courseDone, setCourseDone] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  useEffect(() => { setCompleted(isCompleted); }, [lessonId, isCompleted]);

  useEffect(() => {
    if (driveFileId || !youtubeVideoId) return;
    const initPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeVideoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: { onStateChange: (event: any) => { if (event.data === window.YT.PlayerState.ENDED) handleMarkComplete(); } },
      });
    };
    if (window.YT && window.YT.Player) { initPlayer(); }
    else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-api-script")) {
        const script = document.createElement("script");
        script.id = "yt-api-script"; script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }
    return () => { if (playerRef.current?.destroy) playerRef.current.destroy(); };
  }, [youtubeVideoId, driveFileId, lessonId]);

  const handleMarkComplete = async () => {
    if (completed || marking) return;
    setMarking(true);
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, lessonId }),
    });
    const data = await res.json().catch(() => ({}));
    setCompleted(true);
    setMarking(false);

    // The API marks the enrollment complete and issues the certificate when the
    // last lesson lands, so this is the only moment we can announce it.
    if (!isReviewing && data?.totalLessons > 0 && data.totalCompleted >= data.totalLessons) {
      setCertificateId(data.certificateId ?? null);
      setCourseDone(true);
    }
    router.refresh();
  };

  return (
    <div>
      {isReviewing && (
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-4 text-sm"
          style={{ background: "var(--success-light)", color: "var(--success)" }}
        >
          <CheckCircle size={16} weight="fill" className="flex-shrink-0" />
          <span>You have completed this course. Revisit any lesson as often as you like.</span>
        </div>
      )}
      {driveFileId ? (
        // Served from our own route, which checks the enrollment on every
        // request. controlsList hides the browser's download button - a
        // courtesy, not a control; the route is the actual gate.
        <div className="rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: "16/9", background: "#000" }}>
          <video
            key={lessonId}
            src={`/api/lessons/${lessonId}/video`}
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={handleMarkComplete}
            className="w-full h-full"
          />
        </div>
      ) : youtubeVideoId ? (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: "16/9", background: "#000" }}>
          <div ref={containerRef} className="w-full h-full" />
        </div>
      ) : audioFileId ? (
        // This lesson is an audio recording rather than a video - same private
        // Drive proxy, just an <audio> element instead of <video>.
        <div className="rounded-2xl mb-6 p-6 flex flex-col items-center justify-center gap-3"
          style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Audio Lesson</p>
          <audio
            key={lessonId}
            src={`/api/lessons/${lessonId}/audio`}
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={handleMarkComplete}
            className="w-full"
          />
        </div>
      ) : (
        <div className="rounded-2xl mb-6 flex items-center justify-center" style={{ aspectRatio: "16/9", background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No video for this lesson</p>
        </div>
      )}

      <LessonProgress currentIndex={currentIndex} totalLessons={totalLessons} completed={completed} />

      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          {prevLesson && (
            <Link href={`/learn/${courseSlug}/${prevLesson.slug}`} className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}><span className="inline-flex items-center gap-1.5"><ArrowLeft size={14} weight="bold" /> Previous</span></Link>
          )}
          {nextLesson && (
            <Link href={`/learn/${courseSlug}/${nextLesson.slug}`} className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}><span className="inline-flex items-center gap-1.5">Next <ArrowRight size={14} weight="bold" /></span></Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!completed && (
            <button onClick={handleMarkComplete} disabled={marking}
              className="px-5 py-2 rounded-xl text-white text-sm font-semibold primary-gradient disabled:opacity-60">
              {marking ? "Saving..." : "Mark as Complete"}
            </button>
          )}
          {completed && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--success-light)", color: "var(--success)" }}>
              <CheckCircle size={16} weight="fill" /><span>Completed</span>
            </div>
          )}
          {completed && nextLesson && (
            <Link href={`/learn/${courseSlug}/${nextLesson.slug}`} className="px-5 py-2 rounded-xl text-white text-sm font-semibold primary-gradient">
              <span className="inline-flex items-center gap-1.5">Next lesson <ArrowRight size={14} weight="bold" /></span>
            </Link>
          )}
          {completed && !nextLesson && (
            <Link href={`/learn/${courseSlug}`} className="px-5 py-2 rounded-xl text-white text-sm font-semibold primary-gradient">
              <span className="inline-flex items-center gap-1.5">Finish course <ArrowRight size={14} weight="bold" /></span>
            </Link>
          )}
        </div>
      </div>

      {notes && (
        <div className="card p-6 mb-4">
          <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Lesson Notes</h2>
          <div className="prose-content text-sm leading-relaxed" style={{ color: "var(--foreground-secondary)" }}
            dangerouslySetInnerHTML={{ __html: notes }} />
        </div>
      )}

      {resourceUrl && (
        <a href={resourceUrl} target="_blank" rel="noopener"
          className="card p-4 mb-4 flex items-center gap-3"
          style={{ color: "var(--primary)" }}>
          <FilePdf size={22} weight="duotone" className="flex-shrink-0" />
          <span className="text-sm font-semibold">{resourceName || "Download lesson resource"}</span>
        </a>
      )}

      {quiz && quiz.questions.length > 0 && (
        <QuizBlock quizId={quiz.id} title={quiz.title} questions={quiz.questions} patientId={patientId} />
      )}

      {assignment && (
        <AssignmentBlock
          assignmentId={assignment.id}
          enrollmentId={enrollmentId}
          title={assignment.title}
          prompt={assignment.prompt}
          existingSubmission={existingSubmission}
        />
      )}

      <style>{`
        .prose-content h2 { font-size: 17px; font-weight: 700; margin: 16px 0 8px; color: var(--foreground); }
        .prose-content h3 { font-size: 15px; font-weight: 600; margin: 14px 0 6px; color: var(--foreground); }
        .prose-content p { margin: 6px 0; }
        .prose-content ul { padding-left: 20px; list-style-type: disc; margin: 8px 0; }
        .prose-content ol { padding-left: 20px; list-style-type: decimal; margin: 8px 0; }
        .prose-content li { margin: 4px 0; }
        .prose-content strong { font-weight: 700; color: var(--foreground); }
        .prose-content em { font-style: italic; }
        .prose-content hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
      `}</style>
      <CourseCompleteDialog
        open={courseDone}
        certificateId={certificateId}
        courseSlug={courseSlug}
        onClose={() => setCourseDone(false)}
      />
    </div>
  );
}
