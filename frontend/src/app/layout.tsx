import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMLI — AI-Powered Anti-Money Laundering Detection",
  description:
    "Detect suspicious financial activity with LightGBM, SHAP explainability, and IBM watsonx.ai. Upload transaction data and get actionable risk analysis in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <nav className="navbar">
            <a href="/" className="navbar-brand">
              <span className="navbar-logo">AMLI</span>
              <span className="navbar-badge">AI</span>
            </a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
