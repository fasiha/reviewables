"use strict";
var assert = require('assert');
var bs = require("binary-search");
module.exports = function closestButNotOver(arr, i, cmp, skipCheck) {
  cmp = cmp || ((a, b) => a - b);
  if (!skipCheck) {
    for (let i = 1; i < arr.length; i++) {
      if (cmp(arr[i], arr[i-1]) < 0) {
        assert(false, 'sorted array required');
      }
    }
  }
  var hit = bs(arr, i, cmp);
  if (hit >= 0) {
    return i;
  } else if (hit === -1) {
    return -Infinity;
  }
  return arr[-hit - 2];
};