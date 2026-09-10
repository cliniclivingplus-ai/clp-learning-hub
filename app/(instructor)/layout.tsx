import { getActor } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { type NavItem } from "@/components/ui/SidebarNav";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "instructor" && actor.role !== "admin") redirect("/my-learning");

  const navItems: NavItem[] = [
    { href: "/instructor", label: "Dashboard", icon: "dashboard" },
    { href: "/instructor/courses", label: "My Courses", icon: "courses" },
    { href: "/instructor/guide", label: "Add a Course", icon: "guide" },
    { href: "/instructor/learners", label: "Learners", icon: "people" },
    { href: "/instructor/assignments", label: "Grading", icon: "grading" },
    { href: "/instructor/training", label: "Staff Training", icon: "training" },
    { href: "/instructor/profile", label: "Profile", icon: "profile" },
  ];

  return (
    <AppShell
      brandHref="/instructor"
      roleLabel="Instructor"
      navItems={navItems}
      userName={actor.name || "Instructor"}
      userEmail={actor.email || ""}
    >
      {children}
    </AppShell>
  );
}
