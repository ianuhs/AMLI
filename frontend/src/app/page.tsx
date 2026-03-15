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
  alert_accounts: "alert_accounts.csv (optional, for validation)",
};

const schemaContent = `Table,Column Name,Display Name,Required,Description
transactions.csv,tran_id,Transaction ID,Yes,Unique identifier for each transaction. Primary key.
transactions.csv,orig_acct,Sender account,Yes,The account ID that sent the money. Source node in the transaction graph.
transactions.csv,bene_acct,Receiver account,Yes,The account ID that received the money. Destination node in the transaction graph.
transactions.csv,tx_type,Transaction type,Yes,"Type of transaction: TRANSFER, PAYMENT, DEPOSIT, WITHDRAWAL, DEBIT, or CREDIT."
transactions.csv,base_amt,Amount,Yes,The transaction amount in USD.
transactions.csv,tran_timestamp,Timestamp,Yes,"Date and time the transaction occurred, in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)."
accounts.csv,acct_id,Account ID,Yes,Unique numeric identifier for each account. Primary key used to link to transactions.
alert_accounts.csv,acct_id,Account ID,Yes,List of known-suspicious account IDs. Optional file for validation; when provided, enables Precision @ top 3% and true/false positive labels.`;

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadSchema = () => {
    const blob = new Blob([schemaContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'amli_schema_requirements.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(schemaContent);
    alert('Schema copied to clipboard!');
  };

  function classifyFile(file: File): string | null {
    const name = file.name.toLowerCase();
    if (name.includes("transaction")) return "transactions";
    if (name.includes("alert_account") || name.includes("alert-account")) return "alert_accounts";
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

  function scrollToUpload() {
    const section = document.getElementById("upload-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <main className="landing-page">
      {/* SECTION 1: HERO SCREENSAVER */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Fraud Detection & Entity Risk
          </h1>
          <p className="hero-subtitle">
            Upload transaction logs and account data to map relationships and flag suspicious activity patterns across your master data.
          </p>
          <button className="btn btn-primary" onClick={scrollToUpload} style={{ padding: "16px 32px", fontSize: "18px" }}>
            Begin Analysis
          </button>

          <div className="scroll-indicator" onClick={scrollToUpload}>
            Scroll to Upload
            <div className="scroll-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: SPLIT SCREEN (SCHEMA & UPLOAD) */}
      <section id="upload-section" className="upload-section">
        <div className="split-layout">

          {/* LEFT: SCHEMA DOCUMENTATION */}
          <div className="split-left">
            <h2 style={{ fontSize: "28px", marginBottom: "8px" }}>Data Requirements</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
              Provide data matching the schema below. Transactions and accounts are required. Include flagged accounts for optional validation metrics.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCopySchema}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: "10px 16px", background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Schema
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadSchema}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: "10px 16px", background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download CSV
              </button>
            </div>

            {/* Transactions Schema Card */}
            <div className="schema-card">
              <div className="schema-card-header">
                <span className="schema-badge">Required</span>
                <h3 className="schema-card-title">transactions.csv</h3>
              </div>

              <div className="schema-field">
                <span className="schema-field-name">Transaction ID</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>tran_id</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">Unique identifier for each transaction. Primary key.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Sender account</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>orig_acct</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">The account ID that sent the money. Source node in the transaction graph.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Receiver account</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>bene_acct</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">The account ID that received the money. Destination node in the transaction graph.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Transaction type</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>tx_type</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">Type of transaction: TRANSFER, PAYMENT, DEPOSIT, WITHDRAWAL, DEBIT, or CREDIT.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Amount</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>base_amt</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">The transaction amount in USD.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Timestamp</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>tran_timestamp</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">Date and time the transaction occurred, in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ).</p>
              </div>
            </div>

            {/* Accounts Schema Card - required fields only */}
            <div className="schema-card">
              <div className="schema-card-header">
                <span className="schema-badge">Required</span>
                <h3 className="schema-card-title">accounts.csv</h3>
              </div>

              <div className="schema-field">
                <span className="schema-field-name">Account ID</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>acct_id</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">Unique numeric identifier for each account. Primary key used to link to transactions.</p>
              </div>
            </div>

            {/* Alert accounts - optional validation */}
            <div className="schema-card">
              <div className="schema-card-header">
                <span className="schema-badge" style={{ backgroundColor: "var(--accent-amber)", color: "var(--bg-primary)" }}>Optional</span>
                <h3 className="schema-card-title">alert_accounts.csv</h3>
              </div>
              <p className="schema-field-desc" style={{ marginBottom: "16px" }}>
                For optional validation: provide a list of known-suspicious account IDs. When this file is uploaded, the dashboard shows Precision @ top 3% and labels flagged accounts as true or false positives. Omit this file if you do not have ground-truth labels.
              </p>
              <div className="schema-field">
                <span className="schema-field-name">Account ID</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>acct_id</span>
                <span className="schema-field-req">*</span>
                <p className="schema-field-desc">Numeric account ID. Each row is one account that is considered a true positive (known suspicious) for validation.</p>
              </div>
            </div>
          </div>

          {/* RIGHT: DRAG AND DROP UPLOAD */}
          <div className="split-right">
            <div className="upload-container">
              <h2 className="upload-action-title">Upload Data</h2>
              <p className="upload-action-subtitle">Drag and drop your prepared CSV files here.</p>

              <div
                className={`upload-dropzone ${dragging ? "drag-over" : ""}`}
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <div className="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <h3>Drop CSV files here</h3>
                <p>or click to browse — transactions.csv and accounts.csv required</p>
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
                  {files.map((f: FileEntry) => (
                    <div key={f.key} className="upload-file-item">
                      <span className="file-icon" style={{ display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                      <span className="file-name">{f.file.name}</span>
                      <span className="file-size">{formatSize(f.file.size)}</span>
                      <button className="file-remove" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); removeFile(f.key); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                {uploading ? "Processing..." : "Analyze Transactions"}
              </button>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
