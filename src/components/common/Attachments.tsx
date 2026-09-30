"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, X, ExternalLink } from "lucide-react";
import { attachmentsApi, AttachmentKind, AttachmentMeta } from "@/lib/api";

// Reusable Image / Document attachments for a document form.
//  - With an entityId (editing a saved record): files upload immediately.
//  - Without one (a new, unsaved record): files are held as "pending" and
//    uploaded by flush(newId) right after the record is first saved.

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DOCUMENT_ACCEPT = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".gif",
].join(",");
const DOCUMENT_TYPES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "image/jpeg", "image/png", "image/webp", "image/gif",
]);

type Notify = (message: string, type: "success" | "error" | "warning" | "info") => void;

interface PendingFile { key: string; file: File; kind: AttachmentKind }
export type AttachmentItem =
  | { state: "saved"; meta: AttachmentMeta }
  | { state: "pending"; pending: PendingFile };

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;base64,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function useAttachments(entityType: string, entityId: string | null | undefined, notify: Notify) {
  const [saved, setSaved] = useState<AttachmentMeta[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPending([]);
    if (!entityId) { setSaved([]); return; }
    attachmentsApi.list(entityType, entityId)
      .then((r) => setSaved(r.data || []))
      .catch(() => setSaved([]));
  }, [entityType, entityId]);

  const uploadOne = async (id: string, file: File, kind: AttachmentKind) => {
    const res = await attachmentsApi.upload({
      entityType, entityId: id, kind, fileName: file.name,
      mimeType: file.type || "application/octet-stream", dataBase64: await readBase64(file),
    });
    return res.data;
  };

  const addFiles = useCallback(async (kind: AttachmentKind, list: FileList | null) => {
    const files = Array.from(list || []);
    const ok: File[] = [];
    for (const f of files) {
      const typeOk = kind === "IMAGE" ? f.type.startsWith("image/") && IMAGE_ACCEPT.includes(f.type) : DOCUMENT_TYPES.has(f.type);
      if (!typeOk) { notify(`"${f.name}": ${kind === "IMAGE" ? "only JPG, PNG, WEBP or GIF images" : "only PDF, Word, Excel, CSV, text or image files"} can be attached`, "error"); continue; }
      if (f.size > MAX_BYTES) { notify(`"${f.name}" is larger than 5 MB`, "error"); continue; }
      ok.push(f);
    }
    if (!ok.length) return;

    if (!entityId) {
      setPending((p) => [...p, ...ok.map((file) => ({ key: Math.random().toString(36).slice(2), file, kind }))]);
      notify(`${ok.length} file(s) will be attached when you save`, "info");
      return;
    }
    setBusy(true);
    try {
      for (const f of ok) {
        const meta = await uploadOne(entityId, f, kind);
        setSaved((s) => [...s, meta]);
      }
      notify(`${ok.length} file(s) attached`, "success");
    } catch (e: any) {
      notify(e?.response?.data?.message || e?.response?.data?.error || "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType, notify]);

  /** Upload files picked before the record existed. Returns how many failed. */
  const flush = useCallback(async (newEntityId: string) => {
    let failed = 0;
    for (const p of pending) {
      try { await uploadOne(newEntityId, p.file, p.kind); } catch { failed++; }
    }
    setPending([]);
    if (failed) notify(`${failed} attachment(s) could not be uploaded — open the order and attach them again`, "error");
    return failed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, entityType, notify]);

  const remove = useCallback(async (item: AttachmentItem) => {
    if (item.state === "pending") { setPending((p) => p.filter((x) => x.key !== item.pending.key)); return; }
    try {
      await attachmentsApi.remove(item.meta.id);
      setSaved((s) => s.filter((x) => x.id !== item.meta.id));
    } catch (e: any) {
      notify(e?.response?.data?.message || "Could not remove attachment", "error");
    }
  }, [notify]);

  const open = useCallback(async (item: AttachmentItem) => {
    const win = window.open("", "_blank"); // open synchronously so popup blockers allow it
    try {
      const blob = item.state === "pending"
        ? item.pending.file
        : new Blob([(await attachmentsApi.getFile(item.meta.id)).data], { type: item.meta.mimeType });
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win?.close();
      notify("Could not open attachment", "error");
    }
  }, [notify]);

  const items: AttachmentItem[] = [
    ...saved.map((meta) => ({ state: "saved" as const, meta })),
    ...pending.map((p) => ({ state: "pending" as const, pending: p })),
  ];

  const pickImage = () => imageInput.current?.click();
  const pickDocument = () => documentInput.current?.click();

  // Hidden inputs — render once inside the form.
  const inputs = (
    <>
      <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden
        onChange={(e) => { addFiles("IMAGE", e.target.files); e.target.value = ""; }} />
      <input ref={documentInput} type="file" accept={DOCUMENT_ACCEPT} multiple hidden
        onChange={(e) => { addFiles("DOCUMENT", e.target.files); e.target.value = ""; }} />
    </>
  );

  /** Drop unsaved picks (form cancelled / reset). */
  const clearPending = useCallback(() => setPending([]), []);

  return { items, busy, pickImage, pickDocument, inputs, flush, remove, open, clearPending, hasPending: pending.length > 0 };
}

export function AttachmentList({ items, busy, onOpen, onRemove, readOnly }: {
  items: AttachmentItem[]; busy?: boolean; onOpen: (i: AttachmentItem) => void; onRemove: (i: AttachmentItem) => void; readOnly?: boolean;
}) {
  if (!items.length && !busy) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((it) => {
        const name = it.state === "saved" ? it.meta.fileName : it.pending.file.name;
        const size = it.state === "saved" ? it.meta.size : it.pending.file.size;
        const isImage = (it.state === "saved" ? it.meta.mimeType : it.pending.file.type).startsWith("image/");
        const key = it.state === "saved" ? it.meta.id : it.pending.key;
        return (
          <div key={key} className="group flex items-center gap-2 max-w-[260px] pl-2.5 pr-1.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
            {isImage ? <ImageIcon className="h-4 w-4 text-[#f58220] shrink-0" /> : <FileText className="h-4 w-4 text-[#f58220] shrink-0" />}
            <button type="button" onClick={() => onOpen(it)} className="min-w-0 text-left" title={`Open ${name}`}>
              <div className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{name}</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                {formatBytes(size)}
                {it.state === "pending" ? <span className="text-amber-600 dark:text-amber-400">· uploads on save</span> : <ExternalLink className="h-2.5 w-2.5" />}
              </div>
            </button>
            {!readOnly && (
              <button type="button" onClick={() => onRemove(it)} className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0" title="Remove">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      {busy && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f58220]" /> Uploading…
        </div>
      )}
    </div>
  );
}
