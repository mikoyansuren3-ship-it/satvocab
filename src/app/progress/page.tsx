import type { Metadata } from "next";
import { ProgressView } from "@/components/progress/ProgressView";

export const metadata: Metadata = {
  title: "Progress",
  description: "See how many SAT words you've mastered, by difficulty and frequency.",
};

export default function ProgressPage() {
  return <ProgressView />;
}
