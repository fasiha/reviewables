var fs = require('fs');
var util = require('util');

var shuffle = require('lodash.shuffle');

var cliPrompt = require('./cliPrompt');
import closestButNotOver from './closestButNotOver';
import * as ruby from './ruby';

//
// PARSING
//
interface Reviewable {
  fact: ruby.Furigana[];
  header: string;
}
async function parseFile(filename: string):
    Promise<Reviewable[]> {
      const RUBY_PREFIX = '- Ruby:';
      let contents: string = await util.promisify(fs.readFile)(filename, 'utf8');
      let lines = contents.split('\n');

      let headers = lines.map((s, i): [ string, number ] => [s, i]).filter(([ s, i ]) => s.search(/#+\s/) === 0);

      let reviewables = lines.map((s, i): [ string, number ] => [s, i]).filter(([ s, i ]) => s.startsWith(RUBY_PREFIX));
      return reviewables.map(([ s, i ]) => ({
        fact : ruby.parseMarkdownLinkRuby(s.slice((RUBY_PREFIX).length).trim()),
        header : (closestButNotOver(headers, i, (a, b) => a[1] - b) || [ "" ])[0]
      }));
    }

//
// PICK which to reivew
//
interface Review {
  reviewable: Reviewable;
  subreview: string;
}
function pickReviewable(reviewables: Reviewable[]): Review {
  let reviewable = reviewables[Math.floor(Math.random() * reviewables.length)];
  let subreview = Math.random() < 0.5 ? "kanji" : "reading";
  return { reviewable, subreview };
}

//
// Display review
//
function presentQuiz(review: Review, reviewables: Reviewable[]) {
  if (review.subreview === 'kanji') {
    console.log(`Which of the following is the kanji for: ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
    let randIdx = Array.from(Array(4), (_, i) => Math.floor(Math.random() * reviewables.length));
    let confusers: Reviewable[] = shuffle(randIdx.map(i => reviewables[i]).concat(review.reviewable));
    confusers.forEach((r, i) => console.log(`${i + 1}. ${ruby.furiganaStringToPlain(r.fact)}`)) return confusers;
  } else {
    console.log(`Enter the reading for: ${ruby.furiganaStringToPlain(review.reviewable.fact)}`);
  }
}

//
// Grade
//
function headerToHash(header: string) {
  let res = header.match(/#+\s*(.*)/);
  return res ? '#' + res[1] : '';
}
function validateNumber(input: string) { return (input.search(/^[0-9]+$/) === 0) ? parseInt(input) : NaN; }
async function gradeAndDisplay(result: string, quiz: any, review: Review, reviewables: Reviewable[]) {
  if (result.indexOf('?') >= 0) {
    // don't know
    console.log(`${
                   ruby.furiganaStringToPlain(review.reviewable.fact)
                 } : ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
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
