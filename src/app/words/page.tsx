import type { Metadata } from "next";
import { WordsView } from "@/components/words/WordsView";

export const metadata: Metadata = {
  title: "All words",
  description: "Search and filter every SAT word by mastery, frequency, word bank, category and part of speech.",
};

export default function WordsPage() {
  return <WordsView />;
}
