import { createClient } from "@/lib/supabase/server";
import { BookOpen, Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import CourseList from "./CourseList";

export const metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  const supabase = await createClient();

  // Independent tables, fetched together instead of one after another.
  const [{ data: courses }, { data: instructors }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, slug, title, category, published, created_at, instructor_id, created_by, " +
        "creator:patients!courses_created_by_fkey (name, email), modules(id)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("patients")
      .select("id, name, email")
      .eq("role", "instructor")
      .order("name"),
  ]);

  const total = courses?.length ?? 0;

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>Courses</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
            Every course on the hub, whoever wrote it.
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 primary-gradient"
        >
          <Plus size={16} weight="bold" /> New course
        </Link>
      </div>

      {total > 0 ? (
        <CourseList courses={(courses as any[]) || []} instructors={(instructors as any[]) || []} />
      ) : (
        <div className="text-center py-20 rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: "var(--accent-blue-light)", color: "var(--accent-blue)" }}
          >
            <BookOpen size={22} weight="duotone" />
          </div>
          <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>No courses yet</h3>
          <p className="text-sm mb-6" style={{ color: "var(--foreground-secondary)" }}>
            Create the first course, or let an instructor write one.
          </p>
          <Link href="/admin/courses/new" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold primary-gradient">
            Create first course
          </Link>
        </div>
      )}
    </div>
  );
}
