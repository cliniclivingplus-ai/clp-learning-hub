"use client";
import { use, useState, useEffect } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import { ArrowLeft, ArrowRight, Eye, FilePdf, Image as ImageIcon, ClipboardText } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import QuizBlock from "@/components/QuizBlock";

/**
 * The "what a learner sees" view of a single lesson, reached from the
 * full-course preview - video/audio through the staff-only Drive proxy (no
 * enrollment exists to check), notes as saved, and the actual quiz UI
 * (answerable, scored locally) rather than an answer key - the point is to
 * see what a learner experiences, not to read the answers off a sheet.
 */
export default function LessonPreviewPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = use(params);
  const base = useStaffBasePath();
  const supabase = createClient();
  const [lesson, setLesson] = useState<any>(null);
  const [siblings, setSiblings] = useState<{ id: string; title: string; order: number }[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: lessonData } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
      if (!lessonData) { setLoading(false); return; }
      setLesson(lessonData);

      const [{ data: moduleLessons }, { data: res }, { data: quizData }, { data: assignmentData }] = await Promise.all([
        supabase.from("lessons").select("id, title, order").eq("module_id", lessonData.module_id).order("order"),
        supabase.from("resources").select("id, url, name").eq("lesson_id", lessonId).order("order_index"),
        supabase.from("quizzes")
          .select("id, title, quiz_questions(id, question, question_type, options, correct_answer, image_path)")
          .eq("lesson_id", lessonId).maybeSingle(),
        supabase.from("assignments").select("id, title, prompt").eq("lesson_id", lessonId).maybeSingle(),
      ]);
      setSiblings(moduleLessons || []);
      setResources(res || []);
      setQuiz(quizData);
      setAssignment(assignmentData);
      setLoading(false);
    })();
  }, [lessonId]);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--foreground-muted)" }}>Loading...</div>;
  if (!lesson) return <div className="p-8 text-sm" style={{ color: "var(--foreground-muted)" }}>Lesson not found.</div>;

  const currentIndex = siblings.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`${base}/courses/${courseId}/preview`} className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft size={14} weight="bold" /> Course preview
        </Link>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-6 mt-4 text-sm" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
        <Eye size={16} weight="bold" className="flex-shrink-0" />
        <span>Preview mode - nothing here is tracked, graded, or saved.</span>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>{lesson.title}</h1>

      {lesson.drive_file_id ? (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: "16/9", background: "#000" }}>
          <video key={lesson.drive_file_id} src={`/api/admin/preview-drive/${lesson.drive_file_id}`} controls className="w-full h-full" />
        </div>
      ) : lesson.youtube_video_id ? (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe src={`https://www.youtube.com/embed/${lesson.youtube_video_id}`} className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : lesson.audio_file_id ? (
        <div className="rounded-2xl mb-6 p-6 flex flex-col items-center justify-center gap-3" style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Audio Lesson</p>
          <audio key={lesson.audio_file_id} src={`/api/admin/preview-drive/${lesson.audio_file_id}`} controls className="w-full" />
        </div>
      ) : (
        <div className="rounded-2xl mb-6 flex items-center justify-center" style={{ aspectRatio: "16/9", background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No video for this lesson</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          {prevLesson && (
            <Link href={`${base}/courses/${courseId}/preview/${prevLesson.id}`} className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
              <span className="inline-flex items-center gap-1.5"><ArrowLeft size={14} weight="bold" /> Previous</span>
            </Link>
          )}
          {nextLesson && (
            <Link href={`${base}/courses/${courseId}/preview/${nextLesson.id}`} className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
              <span className="inline-flex items-center gap-1.5">Next <ArrowRight size={14} weight="bold" /></span>
            </Link>
          )}
        </div>
      </div>

      {lesson.notes && (
        <div className="card p-6 mb-4">
          <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Lesson Notes</h2>
          <div className="preview-lesson-notes text-sm leading-relaxed" style={{ color: "var(--foreground-secondary)" }}
            dangerouslySetInnerHTML={{ __html: lesson.notes }} />
        </div>
      )}

      {resources.length > 0 && (
        <div className="card p-4 mb-4 space-y-2">
          {resources.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener" className="flex items-center gap-3" style={{ color: "var(--primary)" }}>
              {/\.(jpe?g|png|webp)$/i.test(r.name) ? <ImageIcon size={20} weight="duotone" className="flex-shrink-0" /> : <FilePdf size={20} weight="duotone" className="flex-shrink-0" />}
              <span className="text-sm font-semibold">{r.name}</span>
            </a>
          ))}
        </div>
      )}

      {quiz && quiz.quiz_questions?.length > 0 && (
        <QuizBlock
          quizId={quiz.id}
          title={quiz.title}
          questions={quiz.quiz_questions}
          patientId=""
          mode="preview"
        />
      )}

      {assignment && (
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardText size={16} weight="duotone" />
            <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{assignment.title}</h2>
          </div>
          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{assignment.prompt}</p>
        </div>
      )}

      <style>{`
        .preview-lesson-notes h2 { font-size: 17px; font-weight: 700; margin: 16px 0 8px; color: var(--foreground); }
        .preview-lesson-notes h3 { font-size: 15px; font-weight: 600; margin: 14px 0 6px; color: var(--foreground); }
        .preview-lesson-notes p { margin: 6px 0; }
        .preview-lesson-notes ul { padding-left: 20px; list-style-type: disc; margin: 8px 0; }
        .preview-lesson-notes ol { padding-left: 20px; list-style-type: decimal; margin: 8px 0; }
        .preview-lesson-notes li { margin: 4px 0; }
        .preview-lesson-notes strong { font-weight: 700; color: var(--foreground); }
        .preview-lesson-notes em { font-style: italic; }
        .preview-lesson-notes hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
        .preview-lesson-notes a { color: var(--accent-blue); text-decoration: underline; }
      `}</style>
    </div>
  );
}
