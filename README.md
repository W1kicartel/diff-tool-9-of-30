# Diff Tool — LCS text comparison

**Tool 9 of 30 — Building in public.**

A zero-dependency text diff tool. The core is a hand-written **Longest Common
Subsequence (LCS)** engine — the same dynamic-programming technique that powers
`git diff` and most code-review tools — wrapped in a clean side-by-side / unified
diff viewer that runs entirely in the browser.

This entry of the series is about **algorithms on sequences**: building a minimal
edit script (equal / insert / delete) from first principles and reusing the same
primitive for both line-level and word-level (intra-line) diffing.

## What it does

- **Line diff** — compares two blocks of text and shows which lines were added,
  removed, or unchanged, with line numbers for both sides.
- **Word-level highlighting** — when a line is changed, the exact words that
  differ are highlighted inside it (the same LCS engine, run over tokens).
- **Two views** — unified (`+`/`−` like a patch) and side-by-side.
- **Ignore-whitespace option** — trims each line so cosmetic indentation changes
  don't show up as diffs.
- **CRLF/LF normalisation** — Windows vs Unix line endings aren't treated as
  changes.
- 100% client-side — no data leaves the browser.

## How it works

`diff.js` is a small UMD module (works in the browser **and** Node):

| Function | Purpose |
|----------|---------|
| `diffSequences(a, b, eq?)` | Core LCS diff over any two arrays → `[{type, value}]` |
| `diffLines(oldText, newText)` | Line diff with running line numbers |
| `diffWords(oldLine, newLine)` | Token-level diff for intra-line highlighting |
| `diffStats(ops)` | `{ added, removed, unchanged }` summary |

The engine builds an `(n+1)×(m+1)` LCS length table bottom-up
(`dp[i][j] = LCS length of the suffixes a[i..], b[j..]`), then backtracks
greedily from the top-left to emit a deterministic edit script. Tokenisation
keeps separators (spaces and punctuation) so any side can be reconstructed
exactly from its ops — a property the tests assert.

## Run it

Open `index.html` in any browser — no build step, no install. Click **Load
sample** to see a code-change example.

## Tests

```bash
node diff.test.js
```

A dependency-free suite (19 assertions) covering the LCS core (including the
classic `ABCBDAB` / `BDCAB` example), op round-tripping, line numbering,
CRLF handling, word tokenisation, custom equality predicates, and the stats
summary. All passing.

## Files

- `diff.js` — the LCS diff engine (zero dependencies, UMD).
- `diff.test.js` — Node test suite.
- `index.html` — the diff viewer UI.

## Tech

Vanilla JavaScript, HTML, CSS. No frameworks, no dependencies.

---

Part of a 30-day build-in-public series. GitHub: [w1kicartel](https://github.com/w1kicartel)
