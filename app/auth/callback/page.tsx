"use client";

// /auth/callback — fallback only. OAuth flow uses /api/auth/callback.
import { useEffect } from "react";

export default function AuthCallbackPage() {
  useEffect(() => {
    window.location.href = "/";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-navy mb-4">
          <span className="text-brand-pale-blue text-xl font-bold">JN</span>
        </div>
        <div className="flex justify-center mb-3">
          <div className="w-5 h-5 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-brand-teal text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
