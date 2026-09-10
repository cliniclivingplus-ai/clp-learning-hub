"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartPieSlice, BookOpen, GraduationCap, Certificate, UserCircle,
  ClipboardText, Users, PencilLine, Globe, ChalkboardTeacher, Question,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = {
  dashboard: ChartPieSlice,
  courses: BookOpen,
  learning: GraduationCap,
  certificates: Certificate,
  profile: UserCircle,
  enrollments: ClipboardText,
  people: Users,
  grading: PencilLine,
  published: Globe,
  training: ChalkboardTeacher,
  guide: Question,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export default function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {items.map((item) => {
        // Exact match for index routes, prefix match for their children.
        const isIndex = item.href.split("/").length <= 2;
        const active = isIndex ? pathname === item.href : pathname.startsWith(item.href);
        const IconComponent = ICONS[item.icon];

        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: "var(--foreground-secondary)" }}
          >
            <IconComponent size={18} weight={active ? "fill" : "regular"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
