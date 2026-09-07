"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeSlash } from "@phosphor-icons/react";
export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) { setError("Incorrect email or password. Please try again."); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: patient } = await supabase
      .from("patients")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    // router.push, not a full window.location reload - the whole app's JS
    // is already loaded, no reason to throw it away and re-download it just
    // to land on the next page.
    const destination = patient?.role === "admin" ? "/admin" : patient?.role === "instructor" ? "/instructor" : "/my-learning";
    router.push(destination);
    router.refresh();
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center  font-bold text-lg mx-auto mb-3" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>CL</div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>CLP Learning Hub</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>Sign in to your account</p>
        </div>
        <div className="card p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="your@email.com" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Password</label>
            {/* The reveal button sits inside the field, so the input keeps room
                for it on the right rather than running under the icon. */}
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••" className="w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                style={{ color: "var(--foreground-muted)" }}>
                {showPassword ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm primary-gradient disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "var(--foreground-muted)" }}>Don&apos;t have credentials? Contact your CLP care team.</p>
      </div>
    </div>
  );
}
