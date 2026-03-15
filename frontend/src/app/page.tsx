"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadFiles } from "@/lib/api";

interface FileEntry {
  key: string;
  file: File;
  label: string;
}

const EXPECTED_FILES: Record<string, string> = {
  transactions: "transactions.csv (required)",
  accounts: "accounts.csv (required)",
  alert_accounts: "alert_accounts.csv",
  alert_transactions: "alert_transactions.csv",
  account_mapping: "accountMapping.csv",
  individuals: "individuals.csv",
  organizations: "organizations.csv",
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function classifyFile(file: File): string | null {
    const name = file.name.toLowerCase();
    if (name.includes("transaction") && !name.includes("alert")) return "transactions";
    if (name.includes("alert_account") || name.includes("alert-account")) return "alert_accounts";
    if (name.includes("alert_transaction") || name.includes("alert-transaction")) return "alert_transactions";
    if (name.includes("accountmapping") || name.includes("account_mapping")) return "account_mapping";
    if (name.includes("individual")) return "individuals";
    if (name.includes("organization")) return "organizations";
    if (name.includes("account")) return "accounts";
    return null;
  }

  function addFiles(newFiles: FileList) {
    const entries: FileEntry[] = [...files];
    Array.from(newFiles).forEach((file) => {
      const key = classifyFile(file);
      if (key) {
        const idx = entries.findIndex((e) => e.key === key);
        const entry: FileEntry = { key, file, label: EXPECTED_FILES[key] || key };
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
      }
    });
    setFiles(entries);
    setError(null);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  async function handleUpload() {
    const hasTransactions = files.some((f) => f.key === "transactions");
    const hasAccounts = files.some((f) => f.key === "accounts");

    if (!hasTransactions || !hasAccounts) {
      setError("Please upload both transactions.csv and accounts.csv (required).");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append(f.key, f.file));
      const result = await uploadFiles(formData);
      router.push(`/dashboard/${result.run_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <main className="upload-page">
      <div className="upload-container">
        <h1 className="upload-hero-title">
          Detect Financial <span>Fraud with AI</span>
        </h1>
        <p className="upload-hero-subtitle">
          Upload your transaction data and let our ML pipeline analyze patterns,
          score risks, and generate compliance-ready reports in minutes.
        </p>

        <div
          className={`upload-dropzone ${dragging ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="upload-icon">📁</div>
          <h3>Drop CSV files here</h3>
          <p>or click to browse — transactions.csv &amp; accounts.csv required</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {files.length > 0 && (
          <div className="upload-files-list">
            {files.map((f) => (
              <div key={f.key} className="upload-file-item">
                <span className="file-icon">✅</span>
                <span className="file-name">{f.file.name}</span>
                <span className="file-size">{formatSize(f.file.size)}</span>
                <button className="file-remove" onClick={(e) => { e.stopPropagation(); removeFile(f.key); }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: "var(--accent-rose)", marginTop: 16, fontSize: 14 }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary btn-full"
          disabled={uploading || files.length === 0}
          onClick={handleUpload}
        >
          {uploading ? "Processing..." : "🚀 Analyze Transactions"}
        </button>
      </div>
    </main>
  );
}
