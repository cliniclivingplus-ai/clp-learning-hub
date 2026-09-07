import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ArrowLeft, ArrowRight, Check, PlayCircle } from "@phosphor-icons/react/ssr";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ModuleAssessmentWrapper from "./ModuleAssessmentWrapper";

export default async function LearnCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patient } = await supabase.from("patients").select("id, access_type").eq("auth_user_id", user.id).single();

  // Lightweight lookup first - modules/lessons are gated by RLS on having an
  // enrollment, so they can't be fetched in the same query as resolving one.
  const { data: courseRef } = await supabase.from("courses")
    .select("id").eq("slug", courseSlug).eq("published", true).single();
  if (!courseRef) notFound();

  // Active or completed: finishing a course must not lock a learner out of the
  // material they worked through. An active enrollment wins when both exist, so
  // progress keeps landing on the one still in flight.
  const { data: enrollments } = await supabase.from("enrollments")
    .select("id, status")
    .eq("patient_id", patient?.id).eq("course_id", courseRef.id)
    .in("status", ["active", "completed"])
    .order("enrolled_at", { ascending: true });

  let enrollment: { id: string; status: string } | null =
    (enrollments || []).find((e) => e.status === "active") ?? (enrollments || [])[0] ?? null;

  // all_access means exactly that - there is nothing to request or be granted,
  // so the enrollment row a lesson needs has to be created the first time they
  // actually show up. RLS only lets an admin insert one, hence the admin client.
  // It has to exist before the modules/lessons query below, or RLS hides them.
  if (!enrollment && patient?.access_type === "all_access") {
    const admin = await createAdminClient();
    const { data: created } = await admin
      .from("enrollments").insert({ patient_id: patient!.id, course_id: courseRef.id, status: "active" })
      .select("id, status").single();
    enrollment = created ?? null;
  }

  if (!enrollment) redirect("/my-learning");
  const isReviewing = enrollment.status === "completed";

  // Independent once the enrollment exists - no reason to pay for two round
  // trips in series when neither query needs the other's result.
  const [{ data: course }, { data: progress }] = await Promise.all([
    supabase.from("courses")
      .select(`id, title, slug, modules (id, title, order, lessons!lessons_module_id_fkey (id, title, slug, order, youtube_video_id))`)
      .eq("id", courseRef.id).single(),
    supabase.from("lesson_progress").select("lesson_id, completed").eq("enrollment_id", enrollment.id),
  ]);
  if (!course) notFound();
  const completedIds = new Set((progress || []).filter(p => p.completed).map(p => p.lesson_id));

  const modules = ((course.modules as any[]) || []).sort((a, b) => a.order - b.order).map(m => ({
    ...m, lessons: (m.lessons || []).sort((a: any, b: any) => a.order - b.order),
  }));

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = completedIds.size;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  let firstIncomplete: any = null;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (!completedIds.has(lesson.id)) { firstIncomplete = lesson; break; }
    }
    if (firstIncomplete) break;
  }

  // Module quizzes, assessments and this learner's attempts - three
  // independent lookups, run together instead of one after another.
  const moduleIds = modules.map(m => m.id);
  const [{ data: moduleQuizzes }, { data: assessments }, { data: assessmentAttempts }] = await Promise.all([
    supabase.from("quizzes")
      .select("id, title, module_id, quiz_questions(id, question, question_type, options, correct_answer, image_path)")
      .in("module_id", moduleIds),
    supabase.from("assessments")
      .select("id, title, instructions, pass_threshold, module_id, assessment_questions(id, question, question_type, options, correct_answer, order)")
      .in("module_id", moduleIds),
    supabase.from("assessment_attempts")
      .select("assessment_id, score, passed, attempted_at")
      .eq("patient_id", patient?.id)
      .order("attempted_at", { ascending: false }),
  ]);

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <Link href="/my-learning" className="text-sm mb-6 inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft size={14} weight="bold" /> My Learning</Link>
      {isReviewing && (
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-6 text-sm"
          style={{ background: "var(--success-light)", color: "var(--success)" }}
        >
          <Check size={16} weight="bold" className="flex-shrink-0" />
          <span>Course complete. Everything stays open - revisit any lesson whenever you need it.</span>
        </div>
      )}
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--foreground)" }}>{course.title}</h1>
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
            <span>{completedCount} of {totalLessons} lessons completed</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--primary-light)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isReviewing ? "var(--success)" : "var(--primary)" }} />
          </div>
        </div>
        {firstIncomplete && (
          <Link href={`/learn/${courseSlug}/${firstIncomplete.slug}`}
            className="inline-block mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold primary-gradient">
            <span className="inline-flex items-center gap-1.5">{isReviewing ? "Review course" : completedCount === 0 ? "Start course" : "Continue"}<ArrowRight size={14} weight="bold" /></span>
          </Link>
        )}
        {pct === 100 && <div className="mt-4 px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--success-light)", color: "var(--success)" }}>Course Complete! Well done.</div>}
      </div>

      <div className="space-y-3">
        {modules.map((mod, mi) => {
          const modQuiz = moduleQuizzes?.find(q => q.module_id === mod.id);
          const modAssessment = assessments?.find(a => a.module_id === mod.id);
          const lastAttempt = assessmentAttempts?.find(a => a.assessment_id === modAssessment?.id) || null;
          const allModLessonsComplete = mod.lessons.length > 0 && mod.lessons.every((l: any) => completedIds.has(l.id));

          return (
            <div key={mod.id} className="card overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-secondary)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{mi + 1}</div>
                <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{mod.title}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {mod.lessons.filter((l: any) => completedIds.has(l.id)).length}/{mod.lessons.length}
                </span>
              </div>
              {mod.lessons.map((lesson: any, li: number) => {
                const done = completedIds.has(lesson.id);
                return (
                  <Link key={lesson.id} href={`/learn/${courseSlug}/${lesson.slug}`}
                    className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0 transition-colors"
                    style={{ borderColor: "var(--border-light)", background: done ? "rgba(46,125,50,0.04)" : "transparent" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                      style={{ background: done ? "var(--success-light)" : "var(--beige-light)", color: done ? "var(--success)" : "var(--foreground-muted)" }}>
                      {done ? <Check size={12} weight="bold" /> : li + 1}
                    </div>
                    <span className="text-sm flex-1" style={{ color: done ? "var(--foreground-secondary)" : "var(--foreground)" }}>{lesson.title}</span>
                    {lesson.youtube_video_id && <PlayCircle size={14} style={{ color: "var(--foreground-muted)" }} />}
                  </Link>
                );
              })}

              {/* Module quiz */}
              {modQuiz && allModLessonsComplete && (
                <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <ModuleAssessmentWrapper
                    type="quiz"
                    quizId={modQuiz.id}
                    quizTitle={modQuiz.title}
                    questions={(modQuiz.quiz_questions as any[]) || []}
                    patientId={patient?.id || ""}
                  />
                </div>
              )}

              {/* Module assessment */}
              {modAssessment && allModLessonsComplete && (
                <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <ModuleAssessmentWrapper
                    type="assessment"
                    assessmentId={modAssessment.id}
                    assessmentTitle={modAssessment.title}
                    instructions={modAssessment.instructions}
                    passThreshold={modAssessment.pass_threshold}
                    questions={(modAssessment.assessment_questions as any[]) || []}
                    enrollmentId={enrollment.id}
                    lastAttempt={lastAttempt}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
