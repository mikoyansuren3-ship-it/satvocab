# SAT Vocab

A study site for the [sesamewords](https://sites.google.com/site/sesamewords/home) SAT vocabulary lists: **3,661 words** in three difficulty levels, with flashcards, two kinds of multiple-choice quiz, and a searchable, filterable word list that tracks how well you know each word.

| Difficulty | Words | Word banks |
| --- | ---: | --- |
| Top frequency | 449 | Lessons 1.1–1.15 |
| Mid frequency | 1,349 | Lessons 2.1–2.45 |
| Low frequency | 1,863 | Sets 3.1–3.62 |

The source pages list 4,491 entries. The Low list repeats 828 Top and Mid words, and two words appear twice, so each word is kept once, at its most frequent level. The Low list isn't split into lessons on the source site, so its words are grouped into sets of about 30 in the site's order of difficulty.

## Features

- **Flashcards**: flip each card, then mark it "Got it" or "Still learning". You can show the word or the definition on the front.
- **Quizzes**: *word → definition* (one word, four definitions), *definition → word* (one definition, four words), or both mixed together. Wrong answers are drawn from words with the same part of speech so they stay plausible.
- **All words**: search words and definitions; filter by mastery, difficulty, word bank, category, part of speech and saved words; sort by weakest first, lesson order, A to Z, most missed or recently studied. "Study these" opens a study session set to the current filters.
- **Progress**: mastery overall and by difficulty, word bank and category, day streak, accuracy, most-missed words, recent sessions, and export, import or reset of your progress.
- **Mastery**: each right answer moves a word up one step and each miss moves it down two. Learning is 0 to 1 steps, Almost there is 2 to 3, and Mastered is 4 or more.

Progress, saved words and filters are stored in the browser (`localStorage`). There are no accounts and no server.

## Data

- `data/words.base.json`: the three word lists scraped from the source site and deduplicated, with the synonym and definition verbatim.
- `data/enrichment.json`: generated part of speech, category and example sentence for each word. Each batch was checked by a second pass.
- `scripts/build-words.mjs`: merges the two into a compact `src/data/words.json`, which the app imports. Run `node scripts/build-words.mjs` after editing either file.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and lucide-react. Every page is prerendered as static content, so it deploys to Vercel with no configuration.
