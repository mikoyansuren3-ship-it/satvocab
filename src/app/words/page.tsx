import type { Metadata } from "next";
import { WordsView } from "@/components/words/WordsView";

export const metadata: Metadata = {
  title: "All words",
  description: "Search and filter every top-frequency SAT word by mastery, lesson, category and part of speech.",
};

export default function WordsPage() {
  return <WordsView />;
}
