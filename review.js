"use strict";
var fs = require('fs');
var util = require('util');

var bs = require("binary-search");
var shuffle = require('lodash.shuffle');

var ruby = require('./ruby');
var cliPrompt = require('./cliPrompt');

//
// PARSING
//
function findClosestButNotOver(arr, i, cmp) {
  cmp = cmp || ((a, b) => a - b);
  var hit = bs(arr, i, cmp);
  if (hit >= 0) {
    return i;
  } else if (hit === -1) {
    return -Infinity;
  }
  return arr[-hit - 2];
}
async function parseFile(filename) {
  const RUBY_PREFIX = '- Ruby:';
  let contents = await util.promisify(fs.readFile)(filename, 'utf8');
  let lines = contents.split('\n');

  let headers = lines.map((s, i) => [s, i]).filter(([ s, i ]) => s.search(/#+\s/) === 0);

  let reviewables = lines.map((s, i) => [s, i]).filter(([ s, i ]) => s.startsWith(RUBY_PREFIX));
  return reviewables.map(([ s, i ]) => ({
    fact : ruby.parseMarkdownLinkRuby(s.slice((RUBY_PREFIX).length).trim()),
    header : findClosestButNotOver(headers, i, (a, b) => a[1] - b)[0]
  }));
}

//
// PICK which to reivew
//
function pickReviewable(reviewables) {
  let reviewable = reviewables[Math.floor(Math.random() * reviewables.length)];
  let subreview = Math.random() < 0.5 ? "kanji" : "reading";
  return { reviewable, subreview };
}

//
// Display review
//
function presentQuiz(review, reviewables) {
  if (review.subreview === 'kanji') {
    console.log(`Which of the following is the kanji for: ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
    let randIdx = Array.from(Array(4), (_, i) => Math.floor(Math.random() * reviewables.length));
    let confusers = shuffle(randIdx.map(i => reviewables[i]).concat(review.reviewable));
    confusers.forEach((r, i) => console.log(`${i + 1}. ${ruby.furiganaStringToPlain(r.fact)}`))
    return confusers;
  } else {
    console.log(`Enter the reading for: ${ruby.furiganaStringToPlain(review.reviewable.fact)}`);
  }
}

//
// Grade and display
//
function headerToHash(header) {
  let res = header.match(/#+\s*(.*)/);
  return res ? '#' + res[1] : '';
}
function validateNumber(input) { return (input.search(/^[0-9]+$/) === 0) ? parseInt(input) : NaN; }
async function gradeAndDisplay(result, quiz, review, reviewables) {
  if (result.indexOf('?') >= 0) {
    // don't know
    console.log(`${ruby.furiganaStringToPlain(review.reviewable.fact)} : ${
        ruby.furiganaStringToReading(review.reviewable.fact)}`);
    console.log(`Visit ${headerToHash(review.reviewable.header)}`);
    return;
  }
  if (review.subreview === 'kanji') {
    let idx = validateNumber(result) - 1;
    let selected = quiz[idx];
    if (selected && ruby.furiganaStringToPlain(selected.fact) === ruby.furiganaStringToPlain(review.reviewable.fact)) {
      console.log('¡¡¡You juiced it!!! 😍');
    } else {
      if (selected) {
        // You actually selected the wrong answer
        console.log('You pooped it 😭…');
        console.log(`I was looking for: ${ruby.furiganaStringToPlain(review.reviewable.fact)}`);
      } else {
        console.log('Um, u ok?');
      }
    }
  } else {
    if (result === ruby.furiganaStringToReading(review.reviewable.fact)) {
      console.log('¡¡¡You juiced it!!! 😍');
    } else {
      console.log('You pooped it 😭…');
      console.log(`I was looking for: ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
    }
  }
}

// Parse file -> pick which to review -> display review (with confusers, etc.) -> grade and display result -> log review
if (require.main === module) {
  (async function() {
    let reviewables = await parseFile('Toponyms.md');
    let pickedForReview = pickReviewable(reviewables);
    let quizDetails = presentQuiz(pickedForReview, reviewables);
    // console.log(pickedForReview);
    // console.log(reviewables[0]);
    let enteredText = await cliPrompt();
    gradeAndDisplay(enteredText, quizDetails, pickedForReview, reviewables);
  })();
}
