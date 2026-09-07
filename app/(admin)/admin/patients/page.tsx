"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, UserPlus, MagnifyingGlass, X } from "@phosphor-icons/react";
import PersonRow, { type Person } from "./PersonRow";
import { isValidEmail } from "@/lib/validateEmail";
import { categoryPillStyle } from "@/lib/categoryColor";

export default function AdminPeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient");
  const [accessType, setAccessType] = useState("single_course");
  const [courseOptions, setCourseOptions] = useState<{ id: string; title: string; category: string | null }[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const [actor, setActor] = useState<{ id: string; role: string } | null>(null);
  const [authored, setAuthored] = useState<Record<string, number>>({});
  const [categoriesByPerson, setCategoriesByPerson] = useState<Record<string, string[]>>({});
  const [roleFilter, setRoleFilter] = useState<"all" | "patient" | "instructor">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchPeople = async () => {
    setLoading(true);
    // Three independent tables - fetched together, not one after another.
    const [{ data }, { data: courseRows }, { data: enrollRows }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, name, email, access_type, role, created_at")
        .in("role", ["patient", "instructor"])
        .order("created_at", { ascending: false }),
      // How many courses each person wrote, so their credit can be protected.
      supabase.from("courses").select("created_by"),
      // Which categories each learner is actually in right now - from real
      // enrollments (pass-granted or approved), not access_type, since the
      // tier alone says nothing about which subjects someone is enrolled in.
      supabase.from("enrollments").select("patient_id, courses (category)").in("status", ["active", "completed"]),
    ]);
    setPeople((data as Person[]) || []);

    const counts: Record<string, number> = {};
    for (const row of (courseRows as any[]) || []) {
      if (row.created_by) counts[row.created_by] = (counts[row.created_by] ?? 0) + 1;
    }
    setAuthored(counts);

    const byPerson: Record<string, Set<string>> = {};
    for (const row of (enrollRows as any[]) || []) {
      const category = row.courses?.category;
      if (!category) continue;
      (byPerson[row.patient_id] ??= new Set()).add(category);
    }
    setCategoriesByPerson(
      Object.fromEntries(Object.entries(byPerson).map(([id, set]) => [id, Array.from(set)]))
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchPeople();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("patients").select("id, role").eq("auth_user_id", user.id).maybeSingle();
      if (data) setActor({ id: data.id, role: data.role });
    })();
    supabase.from("courses").select("id, title, category").order("title").then(({ data }) => {
      setCourseOptions((data as any[]) || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single Course is a pass to exactly one course - picking a second replaces
  // the first rather than adding to it, since the tier only allows one.
  const toggleSelectedCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      if (prev.includes(courseId)) return prev.filter((id) => id !== courseId);
      return accessType === "single_course" ? [courseId] : [...prev, courseId];
    });
  };

  const handleCreate = async () => {
    if (!name || !email || !password || !isValidEmail(email)) return;
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    const res = await fetch("/api/patients/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, access_type: accessType }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSubmitting(false);
      setFormError(data.message || "Something went wrong.");
      return;
    }

    // Grant any courses picked in the same form, right after the account
    // exists - one action from the admin's side, not a separate step later.
    let grantFailures = 0;
    if (role === "patient" && accessType !== "all_access" && selectedCourseIds.length > 0) {
      const results = await Promise.all(
        selectedCourseIds.map((courseId) =>
          fetch(`/api/patients/${data.patientId}/courses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId }),
          })
        )
      );
      grantFailures = results.filter((r) => !r.ok).length;
    }
    setSubmitting(false);

    const coursesGranted = selectedCourseIds.length - grantFailures;
    setFormSuccess(
      `${role === "instructor" ? "Instructor" : "Learner"} account created for ${name}. Pass the password on directly.` +
      (coursesGranted > 0 ? ` ${coursesGranted} course${coursesGranted === 1 ? "" : "s"} assigned.` : "") +
      (grantFailures > 0 ? ` ${grantFailures} course assignment${grantFailures === 1 ? "" : "s"} failed - assign from Manage instead.` : "")
    );
    setName(""); setEmail(""); setPassword(""); setRole("patient"); setAccessType("single_course"); setSelectedCourseIds([]);
    setShowForm(false);
    fetchPeople();
  };

  const inputStyle = { borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const instructors = people.filter((p) => p.role === "instructor").length;
  const learners = people.length - instructors;

  const allCategories = Array.from(new Set(Object.values(categoriesByPerson).flat())).sort();

  const term = search.trim().toLowerCase();
  const byRole = roleFilter === "all" ? people : people.filter((p) => p.role === roleFilter);
  const byCategory =
    categoryFilter === "all" ? byRole : byRole.filter((p) => (categoriesByPerson[p.id] ?? []).includes(categoryFilter));
  const visible = term
    ? byCategory.filter((p) =>
        `${p.name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(term)
      )
    : byCategory;

  const FILTERS: { value: typeof roleFilter; label: string; count: number }[] = [
    { value: "all", label: "Everyone", count: people.length },
    { value: "patient", label: "Learners", count: learners },
    { value: "instructor", label: "Instructors", count: instructors },
  ];

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>People</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
            Every account on the hub. Create sign-ins, set who is an instructor, and manage access.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(""); setFormSuccess(""); }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 primary-gradient"
        >
          <UserPlus size={16} weight="bold" /> {showForm ? "Cancel" : "Add person"}
        </button>
      </div>

      {formSuccess && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--success-light)", color: "var(--success)" }}>
          {formSuccess}
        </div>
      )}

      {showForm && (
        <div className="card p-6 mb-8">
          <h2 className="font-semibold mb-5" style={{ color: "var(--foreground)" }}>Create an account</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Ramanathan"
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com"
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={inputStyle} />
              <p className="text-[11px] mt-1" style={{ color: "var(--foreground-muted)" }}>
                This is what they'll sign in with.
              </p>
              {email.trim() && !isValidEmail(email) && (
                <p className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>That doesn't look like a valid email address.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Password</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters" autoComplete="off"
                className="w-full px-4 py-2.5 rounded-xl border text-sm font-mono" style={inputStyle} />
              <p className="text-[11px] mt-1" style={{ color: "var(--foreground-muted)" }}>
                A temporary password to hand over directly. They can change it later from their profile.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={inputStyle}>
                <option value="patient">Learner</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
            {role === "patient" && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Access tier</label>
                <select value={accessType} onChange={(e) => {
                  setAccessType(e.target.value);
                  if (e.target.value === "single_course" && selectedCourseIds.length > 1) setSelectedCourseIds(selectedCourseIds.slice(0, 1));
                  if (e.target.value === "all_access") setSelectedCourseIds([]);
                }}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={inputStyle}>
                  <option value="single_course">Single Course</option>
                  <option value="selected_courses">Selected Courses</option>
                  <option value="all_access">All Access</option>
                </select>
              </div>
            )}
          </div>

          {role === "patient" && accessType !== "all_access" && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                {accessType === "single_course" ? "Course pass" : "Courses"}
              </label>
              <p className="text-[11px] mb-2.5" style={{ color: "var(--foreground-muted)" }}>
                {accessType === "single_course"
                  ? "Pick the one course they'll be enrolled in straight away - optional, you can also do this later from Manage."
                  : "Pick any number of courses to enrol them in straight away - optional, you can also do this later from Manage."}
              </p>
              {courseOptions.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>No courses exist yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {courseOptions.map((course) => {
                    const isSelected = selectedCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggleSelectedCourse(course.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left text-sm"
                        style={{
                          borderColor: isSelected ? "var(--primary)" : "var(--border)",
                          background: isSelected ? "var(--primary-light)" : "var(--card)",
                          color: isSelected ? "var(--primary)" : "var(--foreground-secondary)",
                        }}
                      >
                        <span className="min-w-0 truncate">
                          {course.title}
                          {course.category && (
                            <span className="text-[11px] ml-2" style={{ color: "var(--foreground-muted)" }}>{course.category}</span>
                          )}
                        </span>
                        {isSelected && <span className="text-xs font-semibold flex-shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {formError && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{formError}</p>}

          <button onClick={handleCreate} disabled={submitting || !name || !email || !isValidEmail(email) || password.length < 8}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold primary-gradient disabled:opacity-60">
            {submitting ? "Creating…" : "Create account"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : people.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: "var(--accent-purple-light)", color: "var(--accent-purple)" }}>
            <Users size={22} weight="duotone" />
          </div>
          <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>No accounts yet</h3>
          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
            Add the first learner or instructor to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <MagnifyingGlass
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--foreground-muted)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search people"
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm border"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5"
                style={{ color: "var(--foreground-muted)" }}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-5">
            {FILTERS.map((f) => {
              const active = roleFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setRoleFilter(f.value)}
                  aria-pressed={active}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5"
                  style={
                    active
                      ? { background: "var(--primary)", borderColor: "var(--primary)", color: "var(--on-primary)" }
                      : { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground-secondary)" }
                  }
                >
                  {f.label}
                  <span className="font-mono" style={{ opacity: 0.7 }}>{f.count}</span>
                </button>
              );
            })}
          </div>

          {allCategories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <button
                onClick={() => setCategoryFilter("all")}
                aria-pressed={categoryFilter === "all"}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                style={
                  categoryFilter === "all"
                    ? { background: "var(--foreground)", borderColor: "var(--foreground)", color: "var(--background)" }
                    : { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground-muted)" }
                }
              >
                All categories
              </button>
              {allCategories.map((c) => {
                const active = categoryFilter === c;
                const pill = categoryPillStyle(c);
                return (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(active ? "all" : c)}
                    aria-pressed={active}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    style={active ? { ...pill, borderColor: "transparent" } : { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground-muted)" }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}

          {visible.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--foreground-muted)" }}>
              {term
                ? `Nobody matches "${search.trim()}"${roleFilter === "all" ? "" : roleFilter === "instructor" ? " among instructors" : " among learners"}.`
                : categoryFilter !== "all"
                  ? `Nobody is enrolled in a ${categoryFilter} course yet.`
                  : `No ${roleFilter === "instructor" ? "instructors" : "learners"} yet.`}
            </p>
          ) : (
          <div className="space-y-3 stagger">
            {visible.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onChanged={fetchPeople}
                actorRole={actor?.role ?? "admin"}
                actorId={actor?.id ?? ""}
                authoredCourses={authored[person.id] ?? 0}
                categories={categoriesByPerson[person.id] ?? []}
              />
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
