"use client";
import { useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";

export function CreateDriveFolderButton({ clientId }: { clientId: string }) {
  const [loading, setLoading]   = useState(false);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [error, setError]       = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/clients/${clientId}/create-drive-folder`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create folder."); return; }
      setFolderUrl(json.data?.folder_url ?? json.folder_url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (folderUrl) {
    return (
      <div className="flex items-center gap-2.5 text-sm">
        <FolderOpen size={14} className="text-brand-teal shrink-0" />
        <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal">
          Google Drive folder ↗
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="flex items-center gap-2 text-sm text-brand-teal hover:underline disabled:opacity-50"
      >
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Creating Drive folder…</>
          : <><FolderOpen size={14} /> Create Drive folder</>
        }
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
