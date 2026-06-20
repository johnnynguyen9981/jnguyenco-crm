// app/(auth)/login/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GoogleSignInButton from "./GoogleSignInButton";

export const metadata = { title: "Sign In — JNguyen Co. CRM" };

// ── Flame mark SVG (brand icon) ───────────────────────────────────────────────
function FlameMark({ color = "#a58d66", size = 48, opacity = 1 }: { color?: string; size?: number; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 1395 2048"
      aria-hidden
      style={{ height: size, width: "auto", display: "block", fill: color, opacity }}
    >
      <path d="M1394.51,1313.64c-.68-29.93-2.52-57.64-6.2-84.67l-416.08,416.08-138.14-138.05,487.67-487.67c-22.38-46.69-51.44-99.59-88.74-162.85l-524.67,524.67-138.14-138.05,559.55-559.55c-25.28-42.43-53.38-89.71-82.83-139.21l-587.74,587.74-138.05-138.14L944.04,371.05c-81.96-138.24-160.81-271.15-206.34-348.17-18.12-30.52-62.29-30.52-80.31,0-44.08,74.4-119.06,201.01-198.11,334.12-111.12,187.45-230.08,387.79-281.61,473.43-51.54,85.93-88.54,153.25-114.89,211.48C13.37,1150.89,1.07,1228.01.1,1335.05c-.1,5.04-.1,10.07-.1,15.21,0,88.45,0,283.36,207.12,490.48,66.36,66.36,135.14,111.6,199.76,142.41,136.98,65.39,254.88,65.78,289.36,64.62l2.52-.19c33.71,1.16,146.96.78,279.87-60.16,67.33-30.9,139.69-77.31,209.25-146.86,207.12-207.12,207.12-402.03,207.12-490.48,0-12.5-.1-24.61-.48-36.42Z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const error = searchParams.error;

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "#083a4f" }}
    >
      {/* ── Left panel — brand ──────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14" style={{ borderRight: "1px solid rgba(165,141,102,0.2)" }}>
        {/* Top: wordmark */}
        <div>
          <div className="flex items-center gap-4">
            <FlameMark color="#a58d66" size={48} />
            <div>
              <p className="text-white text-xl font-bold tracking-[0.15em] uppercase leading-tight">JNGUYEN</p>
              <p className="text-white text-xl font-bold tracking-[0.2em] uppercase leading-tight">CO.</p>
            </div>
          </div>
          <p className="mt-4 text-sm tracking-widest uppercase" style={{ color: "#c0d5d6", letterSpacing: "0.2em" }}>
            Canberra Wedding &amp; Event Photography
          </p>
        </div>

        {/* Middle: large icon */}
        <div className="flex items-center justify-center flex-1 py-20">
          <FlameMark color="#a58d66" size={256} opacity={0.2} />
        </div>

        {/* Bottom: tagline */}
        <div>
          <div className="h-px w-16 mb-6" style={{ background: "#a58d66" }} />
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Capturing your most meaningful moments — from intimate elopements to full wedding days.
          </p>
        </div>
      </div>

      {/* ── Right panel — sign in form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-14">

        {/* Mobile logo (hidden on lg+) */}
        <div className="lg:hidden mb-10 text-center">
          <FlameMark color="#a58d66" size={64} />
          <p className="text-white text-lg font-bold tracking-[0.15em] uppercase">JNGUYEN CO.</p>
          <p className="text-xs tracking-widest mt-1" style={{ color: "#c0d5d6" }}>
            Canberra Wedding &amp; Event Photography
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div
            className="rounded-2xl p-8"
            style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}
          >
            {/* Header */}
            <div className="mb-7">
              <div className="h-0.5 w-8 mb-5 rounded-full" style={{ background: "#a58d66" }} />
              <h1 className="text-2xl font-bold" style={{ color: "#083a4f", letterSpacing: "-0.02em" }}>
                Welcome back
              </h1>
              <p className="text-sm mt-1" style={{ color: "#407e8c" }}>
                Sign in to your CRM dashboard
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
                {error === "auth_failed"
                  ? "Authentication failed. Please try again."
                  : "Something went wrong. Please try again."}
              </div>
            )}

            {/* Google sign-in */}
            <GoogleSignInButton />

            {/* Footer note */}
            <p className="text-center text-xs mt-6" style={{ color: "#a58d66" }}>
              Private access — JNguyen Co. team only
            </p>
          </div>

          {/* Below card */}
          <p className="text-center text-xs mt-6" style={{ color: "rgba(192,213,214,0.5)" }}>
            © {new Date().getFullYear()} JNguyen Co. · Canberra, ACT
          </p>
        </div>
      </div>
    </div>
  );
}
