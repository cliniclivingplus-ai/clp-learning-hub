import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, PlayCircle, BookOpen, Stack } from "@phosphor-icons/react/ssr";
import { notFound } from "next/navigation";
import Link from "next/link";
import EnrollButton from "./EnrollButton";
import { categoryPillStyle, accentFor } from "@/lib/categoryColor";
import CourseReviews from "@/components/CourseReviews";
import { Stars } from "@/components/StarRating";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, description, category, thumbnail_url, avg_rating, review_count")
    .eq("slug", courseSlug)
    .eq("published", true)
    .maybeSingle();
  if (!course) notFound();

  // Curriculum comes from public_curriculum, which exposes titles and ordering
  // only. Reading the lessons table here would hand the YouTube id to anyone
  // who opens the page, enrolled or not.
  const { data: curriculum } = await supabase
    .from("public_curriculum")
    .select("module_id, module_title, module_order, lesson_id, lesson_title, lesson_order")
    .eq("course_id", course.id)
    .order("module_order")
    .order("lesson_order");

  const moduleMap = new Map<string, any>();
  for (const row of (curriculum as any[]) || []) {
    if (!moduleMap.has(row.module_id)) {
      moduleMap.set(row.module_id, {
        id: row.module_id, title: row.module_title, order: row.module_order, lessons: [],
      });
    }
    if (row.lesson_id) {
      moduleMap.get(row.module_id).lessons.push({
        id: row.lesson_id, title: row.lesson_title, order: row.lesson_order,
      });
    }
  }
  const curriculumModules = Array.from(moduleMap.values());
  const { data: { user } } = await supabase.auth.getUser();

  // Reviews are public; the write gate lives in /api/reviews.
  const { data: reviews } = await supabase
    .from("course_reviews")
    .select("id, rating, body, created_at, patient_id, patients (name)")
    .eq("course_id", course.id)
    .order("created_at", { ascending: false })
    .limit(50);

  let canReview = false;
  let myReview: { rating: number; body: string | null } | null = null;
  // Whether this viewer already has their way into the course - all_access
  // needs no request at all, and anyone with an active enrollment (granted
  // as a pass, or previously approved) is done requesting this one. Without
  // this the button offered "Request Enrollment" even to someone who
  // already had it.
  let alreadyEnrolled = false;
  if (user) {
    const { data: viewer } = await supabase
      .from("patients").select("id, access_type").eq("auth_user_id", user.id).maybeSingle();
    if (viewer) {
      const { data: enrollment } = await supabase
        .from("enrollments").select("id, status")
        .eq("course_id", course.id).eq("patient_id", viewer.id)
        .in("status", ["active", "completed"]).maybeSingle();
      canReview = Boolean(enrollment);
      alreadyEnrolled = viewer.access_type === "all_access" || enrollment?.status === "active";
      const mine = ((reviews as any[]) || []).find((r) => r.patient_id === viewer.id);
      if (mine) myReview = { rating: mine.rating, body: mine.body };
    }
  }

  const modules = curriculumModules.sort((a, b) => a.order - b.order);
  const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  const accent = accentFor(course.category);
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <Link href="/courses" className="text-sm mb-8 inline-flex items-center gap-1.5" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft size={14} weight="bold" /> All courses</Link>
      <div className="card overflow-hidden mb-8">
        <div
          className="h-48 sm:h-64 flex items-center justify-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, var(--accent-${accent}-light) 0%, var(--card-secondary) 100%)` }}
        >
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={40} weight="duotone" style={{ color: `var(--accent-${accent})`, opacity: 0.75 }} />
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            {course.category ? (
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={categoryPillStyle(course.category)}>{course.category}</span>
            ) : <span />}
            {(course.review_count ?? 0) > 0 && (
              <span className="flex items-center gap-1.5 text-sm">
                <Stars value={Number(course.avg_rating) || 0} size={13} />
                <span style={{ color: "var(--foreground-secondary)" }}>{(Number(course.avg_rating) || 0).toFixed(1)}</span>
                <span style={{ color: "var(--foreground-muted)" }}>({course.review_count})</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>{course.title}</h1>
          <p className="leading-relaxed" style={{ color: "var(--foreground-secondary)" }}>{course.description}</p>

          <div
            className="mt-6 pt-6 flex items-center justify-between gap-4 flex-wrap"
            style={{ borderTop: "1px solid var(--border-light)" }}
          >
            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
              <Stack size={15} />
              {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </span>
            <div className="w-full sm:w-auto">
              <EnrollButton courseId={course.id} courseSlug={course.slug} isLoggedIn={!!user} alreadyEnrolled={alreadyEnrolled} />
            </div>
          </div>
        </div>
      </div>
      {modules.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>What you will learn</h2>
          <div className="space-y-3">
            {modules.map((mod, i) => {
              const lessons = (mod.lessons || []).sort((a: any, b: any) => a.order - b.order);
              return (
                <div key={mod.id} className="card">
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={categoryPillStyle(course.category)}>{i + 1}</div>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>{mod.title}</span>
                    <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>{lessons.length} lesson{lessons.length !== 1 ? "s" : ""}</span>
                  </div>
                  {lessons.length > 0 && (
                    <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: "var(--border-light)" }}>
                      {lessons.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                          <PlayCircle size={15} style={{ color: "var(--foreground-muted)" }} /><span>{lesson.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-12">
        <CourseReviews
          courseId={course.id}
          reviews={(reviews as any[]) || []}
          avgRating={Number(course.avg_rating) || 0}
          reviewCount={course.review_count ?? 0}
          canReview={canReview}
          myReview={myReview}
        />
      </div>
    </div>
  );
}
