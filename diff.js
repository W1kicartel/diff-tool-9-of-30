/**
 * diff.js — a zero-dependency text diff engine (UMD: runs in the browser AND Node).
 *
 * The core is a Longest Common Subsequence (LCS) diff — the same dynamic-programming
 * technique that underpins `git diff`, code-review tools and most "compare" features.
 * Given two sequences it emits a compact edit script of three op kinds:
 *   - 'equal'  : the item is present in both sides
 *   - 'delete' : the item exists only on the left (old) side
 *   - 'insert' : the item exists only on the right (new) side
 *
 * The same primitive (`diffSequences`) powers both line-level and word-level diffs:
 *   - diffLines  -> diff arrays of lines, with running 1-based line numbers
 *   - diffWords  -> diff arrays of tokens for intra-line (word) highlighting
 *
 * Public API:
 *   diffSequences(a, b, eq?) -> [{ type, value }]
 *   diffLines(oldText, newText) -> [{ type, oldLine, newLine, value }]
 *   diffWords(oldLine, newLine) -> [{ type, value }]
 *   diffStats(ops) -> { added, removed, unchanged }
 *
 * @author Gianluca (github.com/w1kicartel)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();          // Node / CommonJS
  } else {
    root.Diff = factory();               // browser global: window.Diff
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Build the LCS length table for sequences `a` and `b`.
   *
   * dp[i][j] = length of the LCS of the suffixes a[i..] and b[j..].
   * We fill it bottom-up so backtracking can read forwards (i=0, j=0).
   * Time/space: O(n*m) — fine for typical documents.
   *
   * @param {Array} a
   * @param {Array} b
   * @param {(x:any, y:any) => boolean} eq equality predicate
   * @returns {number[][]} (n+1) x (m+1) table
   */
  function lcsTable(a, b, eq) {
    const n = a.length;
    const m = b.length;
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1).fill(0);
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (eq(a[i], b[j])) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    return dp;
  }

  /**
   * Diff two arbitrary sequences into an ordered list of ops.
   * Greedy backtrack over the LCS table; ties prefer 'delete' before 'insert'
   * so output is deterministic.
   *
   * @param {Array} a left/old sequence
   * @param {Array} b right/new sequence
   * @param {(x:any, y:any) => boolean} [eq] equality (default strict ===)
   * @returns {Array<{type:'equal'|'delete'|'insert', value:any}>}
   */
  function diffSequences(a, b, eq) {
    eq = eq || function (x, y) { return x === y; };
    const dp = lcsTable(a, b, eq);
    const ops = [];
    let i = 0;
    let j = 0;
    const n = a.length;
    const m = b.length;

    while (i < n && j < m) {
      if (eq(a[i], b[j])) {
        ops.push({ type: 'equal', value: a[i] });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'delete', value: a[i] });
        i++;
      } else {
        ops.push({ type: 'insert', value: b[j] });
        j++;
      }
    }
    while (i < n) { ops.push({ type: 'delete', value: a[i] }); i++; }
    while (j < m) { ops.push({ type: 'insert', value: b[j] }); j++; }
    return ops;
  }

  /**
   * Split text into lines, normalising CRLF/CR to LF first.
   * An empty string yields no lines (not a single empty line).
   * @param {string} text
   * @returns {string[]}
   */
  function splitLines(text) {
    if (text === '' || text == null) return [];
    return String(text).replace(/\r\n?/g, '\n').split('\n');
  }

  /**
   * Line-level diff between two blobs of text.
   * Adds running 1-based line numbers for each side (null where the line
   * does not exist on that side).
   *
   * @param {string} oldText
   * @param {string} newText
   * @returns {Array<{type, oldLine:number|null, newLine:number|null, value:string}>}
   */
  function diffLines(oldText, newText) {
    const a = splitLines(oldText);
    const b = splitLines(newText);
    const ops = diffSequences(a, b);
    let oldLine = 0;
    let newLine = 0;
    return ops.map(function (op) {
      if (op.type === 'equal') {
        oldLine++; newLine++;
        return { type: 'equal', oldLine: oldLine, newLine: newLine, value: op.value };
      }
      if (op.type === 'delete') {
        oldLine++;
        return { type: 'delete', oldLine: oldLine, newLine: null, value: op.value };
      }
      newLine++;
      return { type: 'insert', oldLine: null, newLine: newLine, value: op.value };
    });
  }

  /**
   * Tokenise a line into words, whitespace runs and punctuation runs, keeping
   * the separators so a reconstructed string is identical to the input.
   * @param {string} line
   * @returns {string[]}
   */
  function tokenize(line) {
    return String(line).match(/\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+/g) || [];
  }

  /**
   * Word-level diff for highlighting changes *within* a changed line.
   * @param {string} oldLine
   * @param {string} newLine
   * @returns {Array<{type, value:string}>}
   */
  function diffWords(oldLine, newLine) {
    return diffSequences(tokenize(oldLine), tokenize(newLine));
  }

  /**
   * Summarise an op list (from diffLines or diffSequences).
   * @param {Array<{type:string}>} ops
   * @returns {{added:number, removed:number, unchanged:number}}
   */
  function diffStats(ops) {
    let added = 0, removed = 0, unchanged = 0;
    for (let k = 0; k < ops.length; k++) {
      const t = ops[k].type;
      if (t === 'insert') added++;
      else if (t === 'delete') removed++;
      else unchanged++;
    }
    return { added: added, removed: removed, unchanged: unchanged };
  }

  return {
    diffSequences: diffSequences,
    diffLines: diffLines,
    diffWords: diffWords,
    diffStats: diffStats,
    splitLines: splitLines,
    tokenize: tokenize
  };
});
