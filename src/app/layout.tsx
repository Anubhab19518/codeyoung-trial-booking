import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codeyoung — Book a Live Trial Class",
  description: "Timezone-aware trial class booking platform for Codeyoung students and parents worldwide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
