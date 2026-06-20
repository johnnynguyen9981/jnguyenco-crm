"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, FileText, FileImage, File, Trash2, Download, FolderOpen, Loader2 } from "lucide-react";

type Doc = {
  name: string;
  metadata?: { size?: number };
  updated_at?: string;
  created_at?: string;
  id: string;
};

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext ?? "")) return FileImage;
  if (["pdf","doc","docx","txt","md"].includes(ext ?? "")) return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function DocumentsClient({ userId: _userId }: { userId: string }) {
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dragging,  setDragging]  = useState(false);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected   = docs.length > 0 && selected.size === docs.length;
  const someSelected  = selected.size > 0;

  function toggleOne(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(docs.map(d => d.name)));
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/documents");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setDocs(json.files ?? []);
      setSelected(new Set()); // clear selection on reload
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res  = await fetch("/api/documents", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setUploading(false);
    load();
  }

  // ── Download ───────────────────────────────────────────────────────────────
  async function download(name: string) {
    try {
      const res  = await fetch(`/api/documents/url?file=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get download link");
      const a = document.createElement("a");
      a.href = json.url; a.download = name; a.target = "_blank"; a.click();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────
  async function deleteFiles(names: string[]) {
    setDeleting(true);
    setError(null);
    try {
      await Promise.all(
        names.map(name =>
          fetch(`/api/documents?file=${encodeURIComponent(name)}`, { method: "DELETE" })
            .then(r => r.json())
            .then(json => { if (!json.ok) throw new Error(json.error ?? "Delete failed"); })
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
      load();
    }
  }

  async function remove(name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteFiles([name]);
  }

  async function deleteSelected() {
    if (!selected.size) return;
    const names = Array.from(selected);
    if (!confirm(`Delete ${names.length} selected document${names.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    await deleteFiles(names);
  }

  async function deleteAll() {
    if (!docs.length) return;
    if (!confirm(`Delete ALL ${docs.length} document${docs.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    await deleteFiles(docs.map(d => d.name));
  }

  function onDragOver(e: React.DragEvent)  { e.preventDefault(); setDragging(true); }
  function onDragLeave()                   { setDragging(false); }
  function onDrop(e: React.DragEvent)      { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }

  return (
    <div className="max-w-4xl space-y-5">

      {/* Upload zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragging
            ? "border-brand-teal bg-brand-teal/5"
            : "border-brand-pale-blue hover:border-brand-teal/60 hover:bg-brand-teal/[0.03]"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => upload(e.target.files)}
          accept="*/*"
        />
        <Upload size={32} className="mx-auto mb-3 text-brand-teal/60" />
        <p className="text-sm font-medium text-brand-navy">
          {uploading ? "Uploading…" : "Drop files here or click to upload"}
        </p>
        <p className="text-xs text-gray-400 mt-1">PDFs, Word docs, images — any file type</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* File list */}
      {loading ? (
        <div className="card text-center py-12 text-sm text-gray-400">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen size={40} className="mx-auto mb-3 text-brand-pale-blue" />
          <p className="text-sm font-medium text-brand-navy">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload your first template above</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">

          {/* List header */}
          <div className="px-5 py-3 border-b border-brand-pale-blue flex items-center gap-3">
            {/* Select-all checkbox */}
            <button
              type="button"
              onClick={toggleAll}
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allSelected
                  ? "bg-brand-teal border-brand-teal"
                  : someSelected
                  ? "bg-brand-teal/30 border-brand-teal"
                  : "border-gray-300 hover:border-brand-teal"
              }`}
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {(allSelected || someSelected) && (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-current">
                  {allSelected
                    ? <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    : <rect x="1.5" y="4" width="7" height="1.5" rx="0.75"/>
                  }
                </svg>
              )}
            </button>

            <span className="text-sm font-semibold text-brand-navy flex-1">
              {someSelected
                ? `${selected.size} of ${docs.length} selected`
                : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
            </span>

            <div className="flex items-center gap-2">
              {/* Delete Selected — only shown when items are checked */}
              {someSelected && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {deleting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />}
                  Delete {selected.size} selected
                </button>
              )}

              {/* Delete All */}
              <button
                type="button"
                onClick={deleteAll}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting && !someSelected
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
                Delete all
              </button>
            </div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-brand-pale-blue/50">
            {docs.map(doc => {
              const Icon    = fileIcon(doc.name);
              const size    = doc.metadata?.size ?? 0;
              const date    = doc.updated_at ?? doc.created_at ?? "";
              const isChecked = selected.has(doc.name);

              return (
                <li
                  key={doc.id ?? doc.name}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    isChecked ? "bg-brand-teal/5" : "hover:bg-gray-50/60"
                  }`}
                >
                  {/* Row checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleOne(doc.name)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? "bg-brand-teal border-brand-teal"
                        : "border-gray-300 hover:border-brand-teal"
                    }`}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>

                  {/* File icon */}
                  <div className="w-9 h-9 rounded-lg bg-brand-pale-blue/40 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-brand-teal" />
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-navy truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatSize(size)}{size && date ? " · " : ""}{formatDate(date)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => download(doc.name)}
                      className="p-2 rounded-lg text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => remove(doc.name)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
