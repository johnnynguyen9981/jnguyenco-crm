// app/(dashboard)/documents/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { DocumentsClient } from "./DocumentsClient";

export const metadata = { title: "Documents — JNguyen Co." };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <TopBar title="Documents" subtitle="Templates & files" />
      <div className="flex-1 overflow-auto p-6">
        <DocumentsClient userId={user.id} />
      </div>
    </>
  );
}
