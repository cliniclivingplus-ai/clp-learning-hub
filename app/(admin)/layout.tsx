import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { type NavItem } from "@/components/ui/SidebarNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: patient } = await supabase
    .from("patients").select("name, email, role").eq("auth_user_id", user.id).single();
  if (patient?.role !== "admin") redirect("/my-learning");

  const navItems: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/courses", label: "Courses", icon: "courses" },
    { href: "/admin/guide", label: "Add a Course", icon: "guide" },
    { href: "/admin/enrollments", label: "Enrollments", icon: "enrollments" },
    { href: "/admin/assignments", label: "Grading", icon: "grading" },
    { href: "/admin/certificates", label: "Certificates", icon: "certificates" },
    { href: "/admin/patients", label: "People", icon: "people" },
    { href: "/admin/training", label: "Staff Training", icon: "training" },
    { href: "/admin/profile", label: "Profile", icon: "profile" },
  ];

  return (
    <AppShell
      brandHref="/admin"
      roleLabel="Admin"
      navItems={navItems}
      userName={patient?.name || "Admin"}
      userEmail={patient?.email || ""}
    >
      {children}
    </AppShell>
  );
}
