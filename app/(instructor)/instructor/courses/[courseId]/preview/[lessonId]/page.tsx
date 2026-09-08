import { getActor, canManageCourse } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import LessonPreview from "@/app/(admin)/admin/courses/[courseId]/preview/[lessonId]/page";

export const metadata = { title: "Preview" };

export default async function InstructorLessonPreviewPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!(await canManageCourse(actor, courseId))) notFound();

  return <LessonPreview params={Promise.resolve({ courseId, lessonId })} />;
}
