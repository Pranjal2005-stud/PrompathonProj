import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudShield — Enterprise Fraud Intelligence",
  description: "AI-powered procurement fraud detection platform",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
