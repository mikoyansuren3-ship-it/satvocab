// Merges the scraped word lists (data/words.base.json) with the generated
// enrichment (data/enrichment.json: part of speech, category, example) into
// src/data/words.json, which the app imports. Run: node scripts/build-words.mjs
//
// Output is compact to keep the client bundle small:
//   { categories: [...], rows: [[word, lesson, synonym, definition, pos, categoryIndex, example], ...] }
// Row order is the study order (Top lessons, then Mid, then Low sets); the
// word id is derived from the word (see slugify in src/lib/words.ts).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CATEGORIES = [
  "Action",
  "Communication",
  "Mind & Reason",
  "Character",
  "Emotion",
  "Opposition",
  "Change & Growth",
  "Society & Power",
  "Quality & Degree",
];
const POS = ["n.", "v.", "adj.", "adv."];
const slugify = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const base = JSON.parse(readFileSync("data/words.base.json", "utf8"));
const enrichment = existsSync("data/enrichment.json") ? JSON.parse(readFileSync("data/enrichment.json", "utf8")) : [];
const byId = new Map(enrichment.map((e) => [e.id, e]));

const problems = [];
const ids = new Set();
const rows = base.map((w) => {
  const id = slugify(w.word);
  if (id !== w.id) problems.push(`${w.word}: id ${w.id} != derived ${id}`);
  if (ids.has(id)) problems.push(`${w.word}: duplicate id ${id}`);
  ids.add(id);
  const e = byId.get(w.id);
  if (!e) problems.push(`${w.id}: no enrichment`);
  else {
    if (!POS.includes(e.pos)) problems.push(`${w.id}: bad pos ${e.pos}`);
    if (!CATEGORIES.includes(e.category)) problems.push(`${w.id}: bad category ${e.category}`);
    if (!e.example?.trim()) problems.push(`${w.id}: empty example`);
  }
  return [
    w.word,
    w.lesson,
    w.synonym,
    w.definition,
    e?.pos ?? "n.",
    Math.max(0, CATEGORIES.indexOf(e?.category ?? "Quality & Degree")),
    (e?.example ?? "").trim(),
  ];
});

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/words.json", JSON.stringify({ categories: CATEGORIES, rows }) + "\n");
console.log(`wrote ${rows.length} words`);
if (problems.length) {
  console.warn(`${problems.length} problem(s):\n  ` + problems.slice(0, 40).join("\n  "));
  process.exitCode = 1;
}
