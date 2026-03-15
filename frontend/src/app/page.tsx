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

const schemaContent = `Table,Column Name,Display Name,Required,Description
transactions.csv,tran_id,Transaction ID,Yes,Unique identifier for each transaction. Primary key.
transactions.csv,orig_acct,Sender account,Yes,The account ID that sent the money. Source node in the transaction graph.
transactions.csv,bene_acct,Receiver account,Yes,The account ID that received the money. Destination node in the transaction graph.
transactions.csv,tx_type,Transaction type,Yes,"Type of transaction: TRANSFER, PAYMENT, DEPOSIT, WITHDRAWAL, DEBIT, or CREDIT."
transactions.csv,base_amt,Amount,Yes,The transaction amount in USD.
transactions.csv,tran_timestamp,Timestamp,Yes,"Date and time the transaction occurred, in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)."
accounts.csv,acct_id,Account ID,Yes,Unique numeric identifier for each account. Primary key used to link to transactions.
accounts.csv,dsply_nm,Display name,No,"Account display label, formatted as C_[id]. Used as a human-readable account reference."
accounts.csv,type,Account type,No,"Type of account holder. 'I' = Individual, 'C' = Corporate."
accounts.csv,acct_stat,Account status,No,"Whether the account is active or closed. 'A' = Active, 'C' = Closed."
accounts.csv,acct_rptng_crncy,Reporting currency,No,Currency used for account reporting. All accounts use USD in this dataset.
accounts.csv,prior_sar_count,Prior SAR flag,No,"Whether the account has a prior Suspicious Activity Report. ""true"" = previously flagged, ""false"" = clean history."
accounts.csv,branch_id,Branch ID,No,The bank branch this account belongs to. Numeric identifier.
accounts.csv,open_dt,Open date,No,The simulation step when the account was opened. 0 = opened at start of simulation.
accounts.csv,close_dt,Close date,No,The simulation step when the account closes. High value = account stays open throughout.
accounts.csv,initial_deposit,Initial deposit,No,"Starting balance of the account in USD. Ranges from $50,000 to $100,000 in this dataset."
accounts.csv,tx_behavior_id,Transaction behavior,No,The normal transaction model assigned to this account. Blank = no model assigned.
accounts.csv,bank_id,Bank ID,No,"Which bank this account belongs to. All accounts use ""bank"" in this dataset."
accounts.csv,first_name,First name,No,Client's first name.
accounts.csv,last_name,Last name,No,Client's last name.
accounts.csv,street_addr,Street address,No,Street address of the account holder.
accounts.csv,city,City,No,City of residence.
accounts.csv,state,State,No,US state of residence.
accounts.csv,country,Country,No,Country of residence. All accounts are US in this dataset.
accounts.csv,zip,Zip code,No,Postal code.
accounts.csv,gender,Gender,No,Gender of the account holder.
accounts.csv,birth_date,Date of birth,No,Date of birth of the account holder.
accounts.csv,ssn,Social Security Number,No,SSN (simulated for realism only).
accounts.csv,lon,Longitude,No,Geographic longitude coordinate of the account holder.
accounts.csv,lat,Latitude,No,Geographic latitude coordinate of the account holder.`;

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
            <h2 style={{ fontSize: "28px", marginBottom: "16px" }}>Data Requirements</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "32px", lineHeight: "1.6" }}>
              Please provide your data matching the schema below. Both transaction logs and account master records are required to build the network graph and begin analysis.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
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

            {/* Accounts Schema Card */}
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
              <div className="schema-field">
                <span className="schema-field-name">Display name</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>dsply_nm</span>
                <p className="schema-field-desc">Account display label, formatted as C_[id]. Used as a human-readable account reference.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Account type</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>type</span>
                <p className="schema-field-desc">Type of account holder. &apos;I&apos; = Individual, &apos;C&apos; = Corporate.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Account status</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>acct_stat</span>
                <p className="schema-field-desc">Whether the account is active or closed. &apos;A&apos; = Active, &apos;C&apos; = Closed.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Reporting currency</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>acct_rptng_crncy</span>
                <p className="schema-field-desc">Currency used for account reporting. All accounts use USD in this dataset.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Prior SAR flag</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>prior_sar_count</span>
                <p className="schema-field-desc">Whether the account has a prior Suspicious Activity Report. &quot;true&quot; = previously flagged, &quot;false&quot; = clean history.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Branch ID</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>branch_id</span>
                <p className="schema-field-desc">The bank branch this account belongs to. Numeric identifier.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Open date</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>open_dt</span>
                <p className="schema-field-desc">The simulation step when the account was opened. 0 = opened at start of simulation.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Close date</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>close_dt</span>
                <p className="schema-field-desc">The simulation step when the account closes. High value = account stays open throughout.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Initial deposit</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>initial_deposit</span>
                <p className="schema-field-desc">Starting balance of the account in USD. Ranges from $50,000 to $100,000 in this dataset.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Transaction behavior</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>tx_behavior_id</span>
                <p className="schema-field-desc">The normal transaction model assigned to this account. Blank = no model assigned.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Bank ID</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>bank_id</span>
                <p className="schema-field-desc">Which bank this account belongs to. All accounts use &quot;bank&quot; in this dataset.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">First name</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>first_name</span>
                <p className="schema-field-desc">Client&apos;s first name.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Last name</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>last_name</span>
                <p className="schema-field-desc">Client&apos;s last name.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Street address</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>street_addr</span>
                <p className="schema-field-desc">Street address of the account holder.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">City</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>city</span>
                <p className="schema-field-desc">City of residence.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">State</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>state</span>
                <p className="schema-field-desc">US state of residence.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Country</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>country</span>
                <p className="schema-field-desc">Country of residence. All accounts are US in this dataset.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Zip code</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>zip</span>
                <p className="schema-field-desc">Postal code.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Gender</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>gender</span>
                <p className="schema-field-desc">Gender of the account holder.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Date of birth</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>birth_date</span>
                <p className="schema-field-desc">Date of birth of the account holder.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Social Security Number</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>ssn</span>
                <p className="schema-field-desc">SSN (simulated for realism only).</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Longitude</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>lon</span>
                <p className="schema-field-desc">Geographic longitude coordinate of the account holder.</p>
              </div>
              <div className="schema-field">
                <span className="schema-field-name">Latitude</span>
                <span className="schema-badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-secondary)", marginLeft: "8px" }}>lat</span>
                <p className="schema-field-desc">Geographic latitude coordinate of the account holder.</p>
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
