# SAT Vocab

A study site for the [sesamewords](https://sites.google.com/site/sesamewords/home) SAT vocabulary lists: flashcards, two kinds of multiple-choice quiz, and a searchable, filterable word list that tracks how well you know each word.

## Features

- **Flashcards**: flip each card, then mark it "Got it" or "Still learning". You can show the word or the definition on the front.
- **Quizzes**: *word → definition* (one word, four definitions), *definition → word* (one definition, four words), or both mixed together. Wrong answers are drawn from words with the same part of speech so they stay plausible.
- **All words**: search words and definitions; filter by mastery, word bank (lesson), category, part of speech and saved words; sort by weakest first, A to Z, lesson order, most missed or recently studied. "Study these" starts a session using the current filters.
- **Progress**: mastery overall and by lesson and category, day streak, accuracy, most-missed words, recent sessions, and export, import or reset of your progress.
- **Mastery**: each right answer moves a word up one step and each miss moves it down two. Learning is 0 to 1 steps, Almost there is 2 to 3, and Mastered is 4 or more.

Progress, saved words and filters are stored in the browser (`localStorage`). There are no accounts and no server.

## Data

- `data/words.base.json`: the word lists scraped from the source site, with the synonym and definition verbatim.
- `data/enrichment.json`: generated part of speech, category and example sentence for each word. Each batch was checked by a second pass.
- `scripts/build-words.mjs`: merges the two into `src/data/words.json`, which the app imports.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and lucide-react. Every page is prerendered as static content, so it deploys to Vercel with no configuration.
