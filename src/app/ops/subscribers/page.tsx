"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Subscriber, SubscriberAnnouncement } from "@/lib/types";

export default function OpsSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [announcements, setAnnouncements] = useState<SubscriberAnnouncement[]>(
    []
  );
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailHelp, setEmailHelp] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeAccounts, setIncludeAccounts] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentBase64, setDocumentBase64] = useState("");
  const [documentContentType, setDocumentContentType] = useState("");

  const load = useCallback(async () => {
    const [subRes, annRes] = await Promise.all([
      fetch("/api/subscribers", { cache: "no-store" }),
      fetch("/api/subscribers/announce", { cache: "no-store" }),
    ]);
    const subData = await subRes.json().catch(() => ({}));
    const annData = await annRes.json().catch(() => ({}));
    if (!subRes.ok) {
      setError(subData.error || "Could not load subscribers");
      setLoading(false);
      return;
    }
    setSubscribers(subData.subscribers || []);
    setAnnouncements(annData.announcements || []);
    setEmailConfigured(Boolean(annData.emailConfigured));
    setEmailHelp(String(annData.help || ""));
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/subscribers/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        setUploading(false);
        return;
      }
      setDocumentName(data.name || file.name);
      setDocumentUrl(data.url || "");
      setDocumentBase64(data.base64 || "");
      setDocumentContentType(data.contentType || file.type || "");
      setMessage(
        data.base64
          ? `Document attached: ${data.name}`
          : `Document link ready: ${data.name} (file large — link only)`
      );
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/subscribers/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          includeAccounts,
          documentName: documentName || undefined,
          documentUrl: documentUrl || undefined,
          documentBase64: documentBase64 || undefined,
          documentContentType: documentContentType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed");
        setSending(false);
        return;
      }
      setMessage(data.message || "Announcement sent");
      setSubject("");
      setBody("");
      setDocumentName("");
      setDocumentUrl("");
      setDocumentBase64("");
      setDocumentContentType("");
      await load();
    } catch {
      setError("Send failed");
    }
    setSending(false);
  }

  async function remove(id: string) {
    if (!confirm("Remove this subscriber?")) return;
    const res = await fetch(`/api/subscribers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Remove failed");
      return;
    }
    setMessage("Subscriber removed");
    await load();
  }

  if (loading) return <p className="text-mist">Loading subscribers…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="display text-4xl">Subscribers</h2>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          People who subscribed or signed up. Send announcements or documents —
          they go to the email they used when they signed up.
        </p>
        <p
          className={`mt-3 text-sm ${
            emailConfigured ? "text-emerald-300" : "text-amber-300"
          }`}
        >
          {emailHelp ||
            (emailConfigured
              ? "Email ready"
              : "Set RESEND_API_KEY in Vercel to send mail")}
        </p>
      </div>

      {(message || error) && (
        <p
          className={`text-sm ${error ? "text-red-300" : "text-emerald-300"}`}
        >
          {error || message}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={send}
          className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="display text-3xl">Send announcement</h3>
          <input
            className="field"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
          <textarea
            className="field min-h-40"
            placeholder="Message body — this emails every subscriber automatically"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={includeAccounts}
              onChange={(e) => setIncludeAccounts(e.target.checked)}
            />
            Also include registered shop accounts
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-medium text-chalk">Attach a document</p>
            <p className="mt-1 text-xs text-mist">
              PDF, Word, Excel, or image. Recipients get a download link (and an
              email attachment when the file is small enough).
            </p>
            <input
              type="file"
              className="mt-3 block w-full text-sm text-mist"
              onChange={(e) => void onUpload(e.target.files?.[0] || null)}
              disabled={uploading || sending}
            />
            {documentName ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-chalk">
                <span>{documentName}</span>
                {documentUrl ? (
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-red underline"
                  >
                    Open link
                  </a>
                ) : null}
                <button
                  type="button"
                  className="text-mist underline"
                  onClick={() => {
                    setDocumentName("");
                    setDocumentUrl("");
                    setDocumentBase64("");
                    setDocumentContentType("");
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || uploading || !subject.trim() || !body.trim()}
          >
            {sending
              ? "Sending…"
              : `Email ${subscribers.length} subscriber${
                  subscribers.length === 1 ? "" : "s"
                }`}
          </button>
        </form>

        <div className="space-y-3">
          <h3 className="display text-3xl">
            List ({subscribers.length})
          </h3>
          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {subscribers.length === 0 ? (
              <p className="text-sm text-mist">
                No subscribers yet. When someone uses Subscribe on the site,
                they show up here.
              </p>
            ) : (
              subscribers.map((s) => (
                <article
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-chalk">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="truncate text-sm text-mist">{s.email}</p>
                      <p className="text-xs text-mist/80">
                        {s.city}, {s.state} ·{" "}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red underline"
                      onClick={() => void remove(s.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <section>
        <h3 className="display text-3xl">Sent history</h3>
        <div className="mt-3 space-y-2">
          {announcements.length === 0 ? (
            <p className="text-sm text-mist">No announcements sent yet.</p>
          ) : (
            announcements.map((a) => (
              <article
                key={a.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="font-semibold text-chalk">{a.subject}</p>
                <p className="mt-1 line-clamp-2 text-sm text-mist">{a.body}</p>
                <p className="mt-2 text-xs text-mist/80">
                  {new Date(a.sentAt).toLocaleString()} · by {a.sentBy} ·{" "}
                  {a.recipientCount} delivered
                  {a.failedCount ? ` · ${a.failedCount} failed` : ""}
                  {a.documentName ? ` · ${a.documentName}` : ""}
                  {a.includeAccounts ? " · included accounts" : ""}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
