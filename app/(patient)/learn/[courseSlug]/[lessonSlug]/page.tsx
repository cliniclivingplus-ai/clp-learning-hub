import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import LessonPlayer from "./LessonPlayer";
import LessonDiscussion from "@/components/LessonDiscussion";

export default async function LessonPage({ params }: { params: Promise<{ courseSlug: string; lessonSlug: string }> }) {
  const { courseSlug, lessonSlug } = await params;
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patient } = await supabase.from("patients").select("id, name, access_type").eq("auth_user_id", user.id).single();

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

  // Same as the course overview page: all_access needs its enrollment row
  // created on first visit, since nothing else ever creates one for them. It
  // has to exist before the modules/lessons query below, or RLS hides them.
  if (!enrollment && patient?.access_type === "all_access") {
    const { data: created } = await adminSupabase
      .from("enrollments").insert({ patient_id: patient!.id, course_id: courseRef.id, status: "active" })
      .select("id, status").single();
    enrollment = created ?? null;
  }

  if (!enrollment) redirect("/my-learning");
  const isReviewing = enrollment.status === "completed";

  const { data: course } = await supabase.from("courses")
    .select(`id, title, slug, modules (id, title, order, lessons!lessons_module_id_fkey (id, title, slug, order, youtube_video_id, drive_file_id, audio_file_id, notes, resource_url, resource_name))`)
    .eq("id", courseRef.id).single();
  if (!course) notFound();

  const modules = ((course.modules as any[]) || []).sort((a, b) => a.order - b.order);
  const allLessons: any[] = [];
  for (const mod of modules) {
    const sorted = (mod.lessons || []).sort((a: any, b: any) => a.order - b.order);
    for (const lesson of sorted) allLessons.push({ ...lesson, moduleName: mod.title });
  }

  const currentIndex = allLessons.findIndex(l => l.slug === lessonSlug);
  if (currentIndex === -1) notFound();

  const lesson = allLessons[currentIndex];
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Four independent lookups, all keyed off enrollment.id/lesson.id which are
  // already known - run together rather than one round trip after another.
  const [{ data: progress }, { data: quiz }, { data: assignment }, { data: comments }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, completed").eq("enrollment_id", enrollment.id),
    adminSupabase.from("quizzes")
      .select("id, title, quiz_questions(id, question, question_type, options, correct_answer, image_path)")
      .eq("lesson_id", lesson.id).maybeSingle(),
    adminSupabase.from("assignments").select("id, title, prompt").eq("lesson_id", lesson.id).maybeSingle(),
    adminSupabase
      .from("lesson_comments")
      .select("id, body, created_at, parent_id, patient_id, patients (name, role)")
      .eq("lesson_id", lesson.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const completedIds = new Set((progress || []).filter((p: any) => p.completed).map((p: any) => p.lesson_id));
  const isCompleted = completedIds.has(lesson.id);

  let existingSubmission = null;
  if (assignment) {
    const { data: sub } = await adminSupabase.from("assignment_submissions")
      .select("id, response, status, feedback, submitted_at, file_path, file_name, file_size")
      .eq("patient_id", patient?.id).eq("assignment_id", assignment.id).maybeSingle();
    existingSubmission = sub;
  }

  return (
    <div className="p-5 sm:p-6 max-w-4xl">
      <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--foreground-muted)" }}>
        <Link href="/my-learning" style={{ color: "var(--foreground-secondary)" }}>My Learning</Link>
        <span>/</span>
        <Link href={`/learn/${courseSlug}`} style={{ color: "var(--foreground-secondary)" }}>{course.title}</Link>
        <span>/</span>
        <span style={{ color: "var(--foreground)" }}>{lesson.title}</span>
      </div>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--primary)" }}>{lesson.moduleName}</p>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>{lesson.title}</h1>
      <LessonPlayer
        lessonId={lesson.id}
        enrollmentId={enrollment.id}
        patientId={patient?.id || ""}
        youtubeVideoId={lesson.youtube_video_id}
        driveFileId={lesson.drive_file_id}
        audioFileId={lesson.audio_file_id}
        notes={lesson.notes}
        resourceUrl={lesson.resource_url}
        resourceName={lesson.resource_name}
        isCompleted={isCompleted}
        prevLesson={prevLesson ? { slug: prevLesson.slug, title: prevLesson.title } : null}
        nextLesson={nextLesson ? { slug: nextLesson.slug, title: nextLesson.title } : null}
        courseSlug={courseSlug}
        totalLessons={allLessons.length}
        currentIndex={currentIndex}
        quiz={quiz ? { id: quiz.id, title: quiz.title, questions: (quiz.quiz_questions as any[]) || [] } : null}
        assignment={assignment ? { id: assignment.id, title: assignment.title, prompt: assignment.prompt } : null}
        existingSubmission={existingSubmission}
        isReviewing={isReviewing}
      />

      <div className="mt-8">
        <LessonDiscussion
          lessonId={lesson.id}
          comments={(comments as any[]) || []}
          currentPatientId={patient?.id || ""}
          canModerate={false}
        />
      </div>
    </div>
  );
}
