"use strict";
var test = require('tape');

var closestButNotOver = require('../closestButNotOver');

test('basic', function(t) {
  let arr = [ 10, 20, 30, 40 ];
  t.equal(10, closestButNotOver(arr, 10));
  t.equal(10, closestButNotOver(arr, 11));
  t.equal(null, closestButNotOver(arr, 0));

  arr = [ -Infinity, 10, 20, 30 ];
  t.equal(-Infinity, closestButNotOver(arr, -Infinity));
  t.equal(-Infinity, closestButNotOver(arr, 0));

  t.end();
});

test('comparator', function(t) {
  let arr = [ 1, 2, 3, 4 ].map(x => ({ num : x }));
  let cmp = (a, b) => a.num - b;
  t.deepEqual({ num : 1 }, closestButNotOver(arr, 1, cmp));
  t.deepEqual({ num : 1 }, closestButNotOver(arr, 1.1, cmp));
  t.deepEqual(null, closestButNotOver(arr, -1, cmp));

  t.end();
})

test('skip sort check', function(t) {
  let arr = [ 4, 3 ];
  t.throws(() => closestButNotOver(arr, 2), /AssertionError/);
  t.doesNotThrow(() => closestButNotOver(arr, 2, undefined, true));
  
  arr = [3, 4, 5];
  t.equal(3, closestButNotOver(arr, 3.3, undefined, true));
  t.equal(3, closestButNotOver(arr, 3.3, undefined, false));
  t.end();
});