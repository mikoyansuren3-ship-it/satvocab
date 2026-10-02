# SAT Vocab

A study site for the [sesamewords](https://sites.google.com/site/sesamewords/home) SAT vocabulary lists: **3,661 words**, each graded Easy, Medium or Hard and grouped into three frequency levels, with flashcards, two kinds of multiple-choice quiz, and a searchable, filterable word list that tracks how well you know each word.

| Frequency | Words |
| --- | ---: |
| High frequency | 449 |
| Mid frequency | 1,349 |
| Low frequency | 1,863 |

The source pages list 4,491 entries. The Low list repeats 828 High and Mid words, and two words appear twice, so each word is kept once, at its most frequent level.

## Difficulty

Each word is graded for its SAT meaning. Difficulty is separate from frequency, which only says how often a word appeared on past SATs: plenty of High-frequency words are hard (*laconic*, *obsequious*) and plenty of Low-frequency words are easy (*unimportant*, *agony*).

| Difficulty | Words | Means |
| --- | ---: | --- |
| Easy | 820 | Middle school level: most students know the meaning by about 8th grade |
| Medium | 1,493 | High school level: usually learned in grades 9–12 |
| Hard | 1,348 | College level: most high school seniors don't know the meaning yet |

The levels come from published research data, combined into one score per word:

- **How many people know the word** (40% of the score): the [word prevalence norms](https://osf.io/g4xrt/) of Brysbaert et al. (2019), which asked about 220,000 people whether they know each of 62,000 English words. The score uses 18–23-year-olds and all ages.
- **The grade at which students know the SAT meaning** (25%): the [Living Word Vocabulary](https://osf.io/kz2px/), which tested 44,000 word meanings on students in grades 4–16 (Dale & O'Rourke, 1981; Brysbaert & Biemiller, 2017). Each word is matched to the tested meaning its SAT definition uses, so *founder* is graded as "to sink," not "a person who starts something."
- **A rating of the SAT meaning** (20%): a 1–5 rating of how hard the meaning is for a high school junior, made by Claude without seeing the data.
- **Age of acquisition** (10%): when adults remember learning the word (Kuperman et al., 2012).
- **How common the word is** (5%): its frequency in English today ([wordfreq](https://github.com/rspeer/wordfreq)), counting inflections such as *disgruntled* for *disgruntle*.

When the SAT meaning is a less common sense of a familiar word (*founder*, *fawn*, *oblique*), the word-level measures describe the wrong sense, so the tested grade (45%) and the rating (40%) carry the score instead.

The cutoffs give each level the same share of words as the Living Word Vocabulary grade bands: grade 8 or earlier, grades 10–12, and grade 13 or later. The 407 words whose measures disagreed, or that had little data, were then reviewed again with all the evidence, and 45 changed level: mostly words that are rarer than they are hard (*faddish*, *time-worn*) and words a dated grade test overrated (*nocturnal*, *plagiarize*). In a blind check, 150 random words graded without the data matched their level 74% of the time and were never two levels apart.

`data/difficulty.json` lists every word from easiest to hardest with its `level` and the evidence: `score` (0 is the easiest in the list, 100 the hardest), `known` and `knownAll` (percent of 18–23-year-olds and of all ages who know the word), `grade` and `meaning` (the matched Living Word Vocabulary meaning), `aoa`, `zipf`, `rating`, and `secondarySense`. Where the second review changed a level, `computed` is the level from the score and `review` says why. To move a word, change its `level` and run `node scripts/build-words.mjs`.

## Features

- **Flashcards**: flip each card, then mark it "Got it" or "Still learning". You can show the word or the definition on the front.
- **Quizzes**: *word → definition* (one word, four definitions), *definition → word* (one definition, four words), or both mixed together. Wrong answers are drawn from words with the same part of speech so they stay plausible. You can give each question a time limit of 10, 20 or 30 seconds; running out counts as a miss.
- **All words**: search words and definitions; filter by mastery, difficulty, frequency, part of speech and saved words; sort by weakest first, easiest or hardest first, A to Z, most missed or recently studied. Words you haven't studied yet come up easiest first. "Study these" opens a study session set to the current filters.
- **Progress**: mastery overall and by difficulty and frequency, day streak, accuracy, most-missed words, recent sessions, and export, import or reset of your progress.
- **Mastery**: each right answer moves a word up one step and each miss moves it down two. Learning is 0 to 1 steps, Almost there is 2 to 3, and Mastered is 4 or more.
- **Saving as you go**: every answer counts right away, without finishing the session, and a reload picks the session up where you left off. **Pause** sets a session aside to resume later, on any device signed in to the account.
- **Dark mode**: follows the device setting until you use the sun/moon button in the header; that choice is remembered in the browser.

## Accounts

The site requires an account: signed-out visitors are sent to the sign-in page (`/login`), and return to the page they asked for after signing in. Signing in is step by step: enter a username, then a 6-digit PIN. If the username is new, you choose a PIN, type it twice, and the account is created. There's no email. Progress is saved to the server, so it follows each person to any device, and people sharing a computer each keep their own. Progress made on a device before signing up can carry over to the new account.

- `src/proxy.ts` redirects requests without a session cookie to `/login` before any page is served. The browser also checks the session and redirects if it's invalid or expired.

- PINs are hashed with scrypt (Node's built-in `crypto`). Sessions are a signed, HTTP-only cookie that lasts 60 days.
- Five wrong PINs lock that username for 15 minutes. Failed tries are counted in storage, not in server memory, so the limit holds across server instances.
- Accounts and progress are stored as small private JSON files in **Vercel Blob**: `users/<username>.json`, `progress/<user-id>.json` and `attempts/<username>.json`. No other database or service is needed.
- In `next dev` without Blob credentials, the same data goes to a git-ignored `.data/` folder, so accounts work locally.
- If the deployed site has no Blob store connected, accounts are off and the site works without signing in, saving progress in each browser.

**Setup on Vercel (once):** open the project → **Storage** → **Create** → **Blob**, choose **Private**, and connect it to this project for all environments. Then redeploy (or push a commit). Optionally add an `AUTH_SECRET` environment variable of 32+ random characters; otherwise a secret is generated and kept in the Blob store.

There's no PIN reset, because accounts have no email address.

## Data

- `data/words.base.json`: the three word lists scraped from the source site and deduplicated, with the synonym and definition verbatim.
- `data/enrichment.json`: generated part of speech and example sentence for each word (it also has a category, which the site no longer uses). Each batch was checked by a second pass.
- `data/difficulty.json`: each word's difficulty level and the evidence behind it (see [Difficulty](#difficulty)).
- `scripts/build-words.mjs`: merges the three into a compact `src/data/words.json`, ordered easiest first, which the app imports. Run `node scripts/build-words.mjs` after editing any of them.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, lucide-react and `@vercel/blob`. Pages are prerendered as static content; the account and progress API lives in `src/app/api/` with its helpers in `src/server/`.
