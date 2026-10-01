# SAT Vocab

A study site for the [sesamewords](https://sites.google.com/site/sesamewords/home) SAT vocabulary lists: **3,661 words** in three frequency levels, with flashcards, two kinds of multiple-choice quiz, and a searchable, filterable word list that tracks how well you know each word.

| Frequency | Words | Word banks |
| --- | ---: | --- |
| High frequency | 449 | Lessons 1.1–1.15 |
| Mid frequency | 1,349 | Lessons 2.1–2.45 |
| Low frequency | 1,863 | Sets 3.1–3.62 |

The source pages list 4,491 entries. The Low list repeats 828 High and Mid words, and two words appear twice, so each word is kept once, at its most frequent level. The Low list isn't split into lessons on the source site, so its words are grouped into sets of about 30 in the site's order of difficulty.

## Features

- **Flashcards**: flip each card, then mark it "Got it" or "Still learning". You can show the word or the definition on the front.
- **Quizzes**: *word → definition* (one word, four definitions), *definition → word* (one definition, four words), or both mixed together. Wrong answers are drawn from words with the same part of speech so they stay plausible.
- **All words**: search words and definitions; filter by mastery, frequency, word bank, category, part of speech and saved words; sort by weakest first, lesson order, A to Z, most missed or recently studied. "Study these" opens a study session set to the current filters.
- **Progress**: mastery overall and by frequency, word bank and category, day streak, accuracy, most-missed words, recent sessions, and export, import or reset of your progress.
- **Mastery**: each right answer moves a word up one step and each miss moves it down two. Learning is 0 to 1 steps, Almost there is 2 to 3, and Mastered is 4 or more.

## Accounts

The site requires an account: signed-out visitors are sent to the sign-in page (`/login`), and return to the page they asked for after signing in. Accounts are a username and password, with no email. Progress is saved to the server, so it follows each person to any device, and people sharing a computer each keep their own. Progress made on a device before signing up can carry over to the new account.

- `src/proxy.ts` redirects requests without a session cookie to `/login` before any page is served. The browser also checks the session and redirects if it's invalid or expired.

- Passwords are hashed with scrypt (Node's built-in `crypto`). Sessions are a signed, HTTP-only cookie that lasts 60 days.
- Accounts and progress are stored as small private JSON files in **Vercel Blob**: `users/<username>.json` and `progress/<user-id>.json`. No other database or service is needed.
- In `next dev` without Blob credentials, the same data goes to a git-ignored `.data/` folder, so accounts work locally.
- If the deployed site has no Blob store connected, accounts are off and the site works without signing in, saving progress in each browser.

**Setup on Vercel (once):** open the project → **Storage** → **Create** → **Blob**, choose **Private**, and connect it to this project for all environments. Then redeploy (or push a commit). Optionally add an `AUTH_SECRET` environment variable of 32+ random characters; otherwise a secret is generated and kept in the Blob store.

There's no password reset, because accounts have no email address.

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

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, lucide-react and `@vercel/blob`. Pages are prerendered as static content; the account and progress API lives in `src/app/api/` with its helpers in `src/server/`.
