"use client";
import { use, useState, useEffect } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import { ArrowLeft, Eye, FilePdf, Image as ImageIcon, PlayCircle, MusicNote } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Resource = { id: string; url: string; name: string; order_index: number };
type Lesson = {
  id: string; title: string; slug: string; order: number;
  youtube_video_id: string | null; drive_file_id: string | null; audio_file_id: string | null;
};
type Module = { id: string; title: string; order: number; resources: Resource[]; lessons: Lesson[] };

/**
 * A read-only "what a learner will see" walk-through of the whole course -
 * every module, lesson and attachment in publish order - so an admin or
 * instructor can sanity-check the build before flipping it live, without
 * needing an actual enrollment (LessonPreview.tsx covers the single-lesson
 * case while it's still being edited; this is the full-course counterpart).
 */
export default function CoursePreviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const base = useStaffBasePath();
  const supabase = createClient();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: courseData }, { data: modulesData }] = await Promise.all([
        supabase.from("courses").select("id, title, description, published").eq("id", courseId).single(),
        supabase.from("modules")
          .select("id, title, order, resources(id, url, name, order_index), lessons(id, title, slug, order, youtube_video_id, drive_file_id, audio_file_id)")
          .eq("course_id", courseId).order("order"),
      ]);
      setCourse(courseData);
      const sorted = (modulesData || []).map((m: any) => ({
        ...m,
        lessons: (m.lessons || []).sort((a: any, b: any) => a.order - b.order),
        resources: (m.resources || []).sort((a: any, b: any) => a.order_index - b.order_index),
      }));
      setModules(sorted);
      setLoading(false);
    })();
  }, [courseId]);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--foreground-muted)" }}>Loading...</div>;

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`${base}/courses/${courseId}/lessons`} className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft size={14} weight="bold" /> Course content
        </Link>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-6 mt-4 text-sm" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
        <Eye size={16} weight="bold" className="flex-shrink-0" />
        <span>Preview mode - this is what an enrolled learner will see. Nothing here is tracked or graded.</span>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{course?.title}</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: course?.published ? "var(--success-light)" : "var(--warning-light)", color: course?.published ? "var(--success)" : "var(--warning)" }}>
            {course?.published ? "Published" : "Draft"}
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
          {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {modules.map((mod, mi) => (
          <div key={mod.id} className="card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-secondary)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{mi + 1}</div>
              <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{mod.title}</span>
              <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
            </div>

            {mod.resources.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener"
                className="flex items-center gap-3 px-5 py-3 border-b"
                style={{ borderColor: "var(--border-light)", color: "var(--primary)" }}>
                {/\.(jpe?g|png|webp)$/i.test(r.name) ? <ImageIcon size={16} weight="duotone" className="flex-shrink-0" /> : <FilePdf size={16} weight="duotone" className="flex-shrink-0" />}
                <span className="text-sm font-semibold">{r.name}</span>
              </a>
            ))}

            {mod.lessons.length > 0 ? (
              mod.lessons.map((lesson, li) => (
                <Link key={lesson.id} href={`${base}/courses/${courseId}/preview/${lesson.id}`}
                  className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0 transition-colors"
                  style={{ borderColor: "var(--border-light)" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: "var(--beige-light)", color: "var(--foreground-muted)" }}>
                    {li + 1}
                  </div>
                  <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>{lesson.title}</span>
                  {lesson.drive_file_id || lesson.youtube_video_id ? (
                    <PlayCircle size={14} style={{ color: "var(--foreground-muted)" }} />
                  ) : lesson.audio_file_id ? (
                    <MusicNote size={14} style={{ color: "var(--foreground-muted)" }} />
                  ) : null}
                </Link>
              ))
            ) : (
              <div className="px-5 py-4 text-sm" style={{ color: "var(--foreground-muted)" }}>No lessons yet.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
