/**
 * diff.test.js — dependency-free test suite for diff.js.
 * Run with:  node diff.test.js
 * Exits non-zero on the first failed assertion so CI can gate on it.
 */
'use strict';

const Diff = require('./diff.js');

let passed = 0;
let failed = 0;

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error('FAIL: ' + msg);
    console.error('  expected: ' + e);
    console.error('  actual:   ' + a);
  }
}

function ok(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); }
}

// Helper: collapse ops to a compact "type:value" string list for readable assertions.
function shape(ops) {
  return ops.map(function (o) { return o.type + ':' + o.value; });
}

/* ---------- diffSequences: the LCS core ---------- */

eq(shape(Diff.diffSequences([], [])), [], 'empty vs empty -> no ops');

eq(shape(Diff.diffSequences(['a', 'b'], ['a', 'b'])),
   ['equal:a', 'equal:b'], 'identical sequences are all equal');

eq(shape(Diff.diffSequences([], ['a', 'b'])),
   ['insert:a', 'insert:b'], 'empty -> two inserts');

eq(shape(Diff.diffSequences(['a', 'b'], [])),
   ['delete:a', 'delete:b'], 'two deletes -> empty');

eq(shape(Diff.diffSequences(['a', 'b', 'c'], ['a', 'x', 'c'])),
   ['equal:a', 'delete:b', 'insert:x', 'equal:c'],
   'single substitution = delete + insert around equals');

// Classic LCS example: ABCBDAB vs BDCAB  -> LCS length 4 (e.g. BCAB)
(function () {
  const a = 'ABCBDAB'.split('');
  const b = 'BDCAB'.split('');
  const ops = Diff.diffSequences(a, b);
  const lcs = ops.filter(function (o) { return o.type === 'equal'; })
                 .map(function (o) { return o.value; }).join('');
  ok(lcs.length === 4, 'LCS length of ABCBDAB / BDCAB is 4 (got ' + lcs.length + ' "' + lcs + '")');

  // Reconstruct each side from the op list and check it round-trips.
  const left = ops.filter(function (o) { return o.type !== 'insert'; })
                  .map(function (o) { return o.value; }).join('');
  const right = ops.filter(function (o) { return o.type !== 'delete'; })
                   .map(function (o) { return o.value; }).join('');
  eq(left, a.join(''), 'ops reconstruct the left sequence');
  eq(right, b.join(''), 'ops reconstruct the right sequence');
})();

// Custom equality predicate (case-insensitive).
eq(shape(Diff.diffSequences(['A'], ['a'], function (x, y) {
  return x.toLowerCase() === y.toLowerCase();
})), ['equal:A'], 'custom eq predicate treats A/a as equal');

/* ---------- diffLines: line numbers + types ---------- */

(function () {
  const ops = Diff.diffLines('one\ntwo\nthree', 'one\n2\nthree');
  eq(ops.map(function (o) { return o.type; }),
     ['equal', 'delete', 'insert', 'equal'], 'line diff types for a changed middle line');

  // line numbers: deletes carry oldLine only, inserts carry newLine only
  const del = ops[1];
  const ins = ops[2];
  ok(del.type === 'delete' && del.oldLine === 2 && del.newLine === null,
     'deleted line keeps old line number, no new');
  ok(ins.type === 'insert' && ins.newLine === 2 && ins.oldLine === null,
     'inserted line keeps new line number, no old');

  const last = ops[3];
  ok(last.oldLine === 3 && last.newLine === 3, 'trailing equal line numbered on both sides');
})();

// CRLF is normalised so Windows vs Unix line endings do not show as changes.
eq(Diff.diffStats(Diff.diffLines('a\r\nb', 'a\nb')),
   { added: 0, removed: 0, unchanged: 2 }, 'CRLF vs LF is not a difference');

// Empty old text -> every new line is an insert.
eq(Diff.diffStats(Diff.diffLines('', 'a\nb\nc')),
   { added: 3, removed: 0, unchanged: 0 }, 'empty old text -> all inserts');

/* ---------- diffWords: intra-line tokenisation ---------- */

(function () {
  const ops = Diff.diffWords('the quick brown fox', 'the slow brown fox');
  // Reconstructing the right side must equal the new line exactly (separators kept).
  const right = ops.filter(function (o) { return o.type !== 'delete'; })
                   .map(function (o) { return o.value; }).join('');
  eq(right, 'the slow brown fox', 'word diff round-trips the new line incl. spaces');
  const changed = ops.filter(function (o) { return o.type !== 'equal'; })
                     .map(function (o) { return o.value; });
  ok(changed.indexOf('quick') !== -1 && changed.indexOf('slow') !== -1,
     'word diff isolates quick->slow');
})();

eq(Diff.tokenize('a, b!').join('|'), 'a|,| |b|!', 'tokenizer keeps words, punctuation and spaces');

/* ---------- diffStats ---------- */

eq(Diff.diffStats([
  { type: 'equal' }, { type: 'insert' }, { type: 'insert' }, { type: 'delete' }
]), { added: 2, removed: 1, unchanged: 1 }, 'diffStats counts each op type');

/* ---------- summary ---------- */

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
