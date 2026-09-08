import { getActor, canManageCourse } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import CoursePreview from "@/app/(admin)/admin/courses/[courseId]/preview/page";

export const metadata = { title: "Preview" };

export default async function InstructorCoursePreviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!(await canManageCourse(actor, courseId))) notFound();

  return <CoursePreview params={Promise.resolve({ courseId })} />;
}
