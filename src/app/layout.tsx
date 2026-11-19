import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Attendance & Daily Logbook | TMT Group",
  description:
    "Aplikasi Web Fullstack Multi-User Attendance & Daily Logbook dengan Digital Signature & Export PDF/Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen flex flex-col font-sans">{children}</body>
    </html>
  );
}
