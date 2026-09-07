import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require a signed-in user, whatever their role. */
const PATIENT_ROUTES = ["/my-learning", "/learn", "/certificates", "/profile"];

const isProtected = (pathname: string) =>
  pathname.startsWith("/admin") ||
  pathname.startsWith("/instructor") ||
  PATIENT_ROUTES.some((r) => pathname.startsWith(r));

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // The catalog, course pages, /about, /verify and so on need no session at
  // all - every one of them was paying for a Supabase auth round trip on
  // every load regardless. Skip the network call entirely when nothing here
  // needs it.
  const needsAuthCheck = isProtected(pathname) || pathname === "/login" || pathname === "/signup";
  if (!needsAuthCheck) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without these the Supabase client throws, and since the matcher covers
  // every route that took the whole site down - public catalog included. Fail
  // closed on anything that needs a session, and let public pages through.
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing; auth gating is unavailable.");
    if (isProtected(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        // @ts-ignore
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: any) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  const getRole = async () => {
    if (!user) return null;
    const { data } = await supabase.from("patients").select("role").eq("auth_user_id", user.id).maybeSingle();
    return data?.role ?? null;
  };

  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const role = await getRole();
    if (role !== "admin") {
      return NextResponse.redirect(new URL(role === "instructor" ? "/instructor" : "/my-learning", request.url));
    }
  }

  if (pathname.startsWith("/instructor")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const role = await getRole();
    // Admins can view instructor screens; patients cannot.
    if (role !== "instructor" && role !== "admin") {
      return NextResponse.redirect(new URL("/my-learning", request.url));
    }
  }

  if (PATIENT_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const role = await getRole();
    if (role === "admin") return NextResponse.redirect(new URL("/admin", request.url));
    if (role === "instructor") return NextResponse.redirect(new URL("/instructor", request.url));
    return NextResponse.redirect(new URL("/my-learning", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
