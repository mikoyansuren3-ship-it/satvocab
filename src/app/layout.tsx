import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SAT Vocab: top-frequency SAT words",
    template: "%s · SAT Vocab",
  },
  description:
    "Study the top-frequency SAT vocabulary list (Lessons 1.1 to 1.15) with flashcards, two kinds of multiple-choice quizzes, and a filterable word list that tracks your mastery.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <AppHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
