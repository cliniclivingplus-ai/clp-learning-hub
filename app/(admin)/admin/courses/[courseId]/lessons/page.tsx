"use client";
import { use, useState, useEffect } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import {
  ArrowLeft, ArrowRight, Plus, Stack, PlayCircle, Notebook,
  CaretDown, CaretRight, Trash, CheckCircle, Eye,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import AssessmentBuilder from "@/components/AssessmentBuilder";
import ResourceList, { type Resource } from "@/components/ResourceList";

type Lesson = { id: string; title: string; slug: string; order: number; youtube_video_id: string; drive_file_id: string | null };
type Module = { id: string; title: string; order: number; resources: Resource[]; lessons: Lesson[] };

export default function LessonsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const base = useStaffBasePath();
  const supabase = createClient();

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Module quizzes stay closed until deliberately opened - they are the last
  // step, and an always-open builder drowns out adding lessons.
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: courseData } = await supabase
      .from("courses").select("id, title, published").eq("id", courseId).single();
    setCourse(courseData);
    const { data: modulesData } = await supabase
      .from("modules")
      .select("id, title, order, resources(id, url, name, order_index), lessons(id, title, slug, order, youtube_video_id, drive_file_id)")
      .eq("course_id", courseId).order("order");
    const sorted = (modulesData || []).map((m: any) => ({
      ...m,
      lessons: (m.lessons || []).sort((a: any, b: any) => a.order - b.order),
      resources: (m.resources || []).sort((a: any, b: any) => a.order_index - b.order_index),
    }));
    setModules(sorted);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseId]);

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    await supabase.from("modules").insert({
      course_id: courseId, title: newModuleTitle.trim(), order: modules.length + 1,
    });
    setNewModuleTitle(""); setAddingModule(false); setShowModuleForm(false); fetchData();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    await supabase.from("modules").delete().eq("id", moduleId); fetchData();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("Delete this lesson?")) return;
    await supabase.from("lessons").delete().eq("id", lessonId); fetchData();
  };

  const handleTogglePublish = async () => {
    if (!course) return;
    const nextPublished = !course.published;
    setPublishing(true);
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: nextPublished }),
    });
    setPublishing(false);
    if (!res.ok) { const data = await res.json().catch(() => ({})); alert(data.message || "Could not update the course."); return; }
    setCourse((prev: any) => ({ ...prev, published: nextPublished }));
  };

  const handleModuleResourcesChange = (moduleId: string, resources: Resource[]) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, resources } : m));
  };

  const inputStyle = { borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  // Where the course is in the build: module -> lessons -> ready.
  const step = modules.length === 0 ? 1 : totalLessons === 0 ? 2 : 3;

  const moduleForm = (autoFocus = false) => (
    <div className="flex gap-2 flex-wrap">
      <input
        type="text"
        value={newModuleTitle}
        autoFocus={autoFocus}
        onChange={(e) => setNewModuleTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
        placeholder="e.g. Understanding Your Gut"
        aria-label="Module title"
        className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border text-sm"
        style={inputStyle}
      />
      <button
        onClick={handleAddModule}
        disabled={addingModule || !newModuleTitle.trim()}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--primary)", color: "var(--on-primary)" }}
      >
        {addingModule ? "Adding…" : "Add module"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="p-5 sm:p-8 max-w-3xl space-y-4">
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`${base}/courses`} className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft size={14} weight="bold" /> Courses
        </Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{course?.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            Course content
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
            {modules.length === 0
              ? "Build the course by adding modules, then lessons inside them."
              : `${modules.length} module${modules.length !== 1 ? "s" : ""} · ${totalLessons} lesson${totalLessons !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {totalLessons > 0 && (
            <Link
              href={`${base}/courses/${courseId}/preview`}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white primary-gradient inline-flex items-center gap-1.5"
            >
              <Eye size={15} weight="bold" /> Preview course
            </Link>
          )}
          <Link
            href={`${base}/courses/${courseId}`}
            className="px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}
          >
            Course details
          </Link>
        </div>
      </div>

      {/* Where you are in the build. Drops away once the course has content. */}
      {step < 3 && (
        <ol className="flex items-center gap-2 flex-wrap mb-6 text-xs" aria-label="Progress">
          {[
            { n: 1, label: "Add a module" },
            { n: 2, label: "Add lessons" },
            { n: 3, label: "Module quiz (optional)" },
          ].map((s) => {
            const done = step > s.n;
            const current = step === s.n;
            return (
              <li key={s.n} className="inline-flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold"
                  style={
                    done
                      ? { background: "var(--success-light)", color: "var(--success)" }
                      : current
                        ? { background: "var(--primary)", color: "var(--on-primary)" }
                        : { background: "var(--card-secondary)", color: "var(--foreground-muted)" }
                  }
                >
                  {done ? <CheckCircle size={12} weight="fill" /> : s.n}
                </span>
                <span style={{ color: current ? "var(--foreground)" : "var(--foreground-muted)", fontWeight: current ? 600 : 400 }}>
                  {s.label}
                </span>
                {s.n < 3 && <CaretRight size={11} className="ml-1" style={{ color: "var(--foreground-muted)" }} />}
              </li>
            );
          })}
        </ol>
      )}

      {/* Step 1: no modules yet. One clear thing to do. */}
      {modules.length === 0 ? (
        <div className="card p-8 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: "var(--accent-blue-light)", color: "var(--accent-blue)" }}
          >
            <Stack size={22} weight="duotone" />
          </div>
          <h2 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>Add your first module</h2>
          <p className="text-sm max-w-[46ch] mx-auto mb-6" style={{ color: "var(--foreground-secondary)" }}>
            A module is a group of related lessons, like a chapter. Every course needs at least one
            before you can add lessons.
          </p>
          <div className="max-w-md mx-auto text-left">{moduleForm()}</div>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-5">
            {modules.map((mod, mi) => {
              const hasLessons = mod.lessons.length > 0;
              const quizOpen = openQuiz === mod.id;

              return (
                <div key={mod.id} className="card overflow-hidden">
                  <div
                    className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
                    style={{ borderBottom: "1px solid var(--border)", background: "var(--card-secondary)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
                        {mi + 1}
                      </div>
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                        {mod.title}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--foreground-muted)" }}>
                        <span className="font-mono">{mod.lessons.length}</span> lesson{mod.lessons.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteModule(mod.id)}
                      aria-label={`Delete module ${mod.title}`}
                      className="text-xs px-2 py-1.5 rounded-lg inline-flex items-center gap-1"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash size={13} /> Delete
                    </button>
                  </div>

                  {hasLessons ? (
                    <div>
                      {mod.lessons.map((lesson, li) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between gap-3 px-5 py-3"
                          style={{ borderBottom: "1px solid var(--border-light)" }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--foreground-muted)" }}>
                              {li + 1}
                            </span>
                            <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                              {lesson.title}
                            </span>
                            {lesson.drive_file_id || lesson.youtube_video_id ? (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1"
                                style={{ background: "var(--success-light)", color: "var(--success)" }}
                              >
                                <PlayCircle size={11} weight="fill" /> Video
                              </span>
                            ) : (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: "var(--warning-light)", color: "var(--warning)" }}
                              >
                                No video
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Link
                              href={`${base}/courses/${courseId}/lessons/${lesson.id}`}
                              className="text-xs font-semibold"
                              style={{ color: "var(--primary)" }}
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-xs"
                              style={{ color: "var(--foreground-muted)" }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="px-5 py-3">
                        <Link
                          href={`${base}/courses/${courseId}/lessons/new?moduleId=${mod.id}`}
                          className="text-sm font-semibold inline-flex items-center gap-1.5"
                          style={{ color: "var(--primary)" }}
                        >
                          <Plus size={14} weight="bold" /> Add lesson
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* Step 2: the module exists but is empty. The lesson is the only thing to do. */
                    <div className="px-5 py-7 text-center">
                      <p className="text-sm mb-4" style={{ color: "var(--foreground-secondary)" }}>
                        This module has no lessons yet.
                      </p>
                      <Link
                        href={`${base}/courses/${courseId}/lessons/new?moduleId=${mod.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                      >
                        <Plus size={15} weight="bold" /> Add the first lesson
                      </Link>
                    </div>
                  )}

                  <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                    <ResourceList
                      label="Module resources"
                      prefix={`modules/${mod.id}`}
                      moduleId={mod.id}
                      resources={mod.resources}
                      onChange={(resources) => handleModuleResourcesChange(mod.id, resources)}
                    />
                  </div>

                  {/* Step 3: only once the module has something to test. */}
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {hasLessons ? (
                      <>
                        <button
                          onClick={() => setOpenQuiz(quizOpen ? null : mod.id)}
                          aria-expanded={quizOpen}
                          className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
                          style={{ color: "var(--foreground-secondary)" }}
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium">
                            <Notebook size={15} weight="duotone" />
                            Module quiz
                            <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>optional</span>
                          </span>
                          {quizOpen
                            ? <CaretDown size={14} weight="bold" />
                            : <CaretRight size={14} weight="bold" />}
                        </button>
                        {quizOpen && (
                          <div className="px-5 pb-5">
                            <AssessmentBuilder moduleId={mod.id} moduleTitle={mod.title} />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="px-5 py-3 text-xs" style={{ color: "var(--foreground-muted)" }}>
                        Module quiz becomes available once this module has a lesson.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Adding more modules is secondary once one exists. */}
          {showModuleForm ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>New module</h3>
                <button
                  onClick={() => { setShowModuleForm(false); setNewModuleTitle(""); }}
                  className="text-xs"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Cancel
                </button>
              </div>
              {moduleForm(true)}
            </div>
          ) : (
            <button
              onClick={() => setShowModuleForm(true)}
              className="w-full py-3 rounded-xl border border-dashed text-sm font-semibold inline-flex items-center justify-center gap-2"
              style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}
            >
              <Plus size={15} weight="bold" /> Add another module
            </button>
          )}

          {totalLessons > 0 && (
            <div
              className="mt-8 pt-6 flex items-center justify-between gap-4 flex-wrap"
              style={{ borderTop: "1px solid var(--border-light)" }}
            >
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                {course?.published
                  ? "This course is live for learners."
                  : "This course is still a draft - learners can't see it yet."}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleTogglePublish}
                  disabled={publishing}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={course?.published
                    ? { border: "1px solid var(--border)", color: "var(--foreground-secondary)" }
                    : { background: "var(--primary)", color: "var(--on-primary)" }}
                >
                  {publishing ? "Saving..." : course?.published ? "Unpublish" : "Publish course"}
                </button>
                <Link
                  href={`${base}/courses/${courseId}`}
                  className="text-sm font-semibold inline-flex items-center gap-1.5"
                  style={{ color: "var(--primary)" }}
                >
                  Course details <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
