var fs = require('fs');
var util = require('util');

var mkdirp = require('mkdirp');
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
type QuizMetadata = Reviewable[];
type QuizResult = any;
interface FactModule {
    parseText: (contents: string) => Reviewable[];
    reviewableToReview: (reviewable: Reviewable) => Review;
    presentQuiz: (review: Review, reviewables: Reviewable[]) => QuizMetadata;
    gradeAndDisplay: (result: string, quiz: QuizMetadata, review: Review, reviewables: Reviewable[]) => QuizResult;
    logReview: (result: QuizResult) => any;
}
const mod: FactModule = { parseText, reviewableToReview, presentQuiz, gradeAndDisplay, logReview };

function parseText(contents: string): Reviewable[] {
    const RUBY_PREFIX = '- Ruby:';
    let lines = contents.split('\n');
    let headers = lines.map((s, i): [string, number] => [s, i]).filter(([s, i]) => s.search(/#+\s/) === 0);
    let reviewables = lines.map((s, i): [string, number] => [s, i]).filter(([s, i]) => s.startsWith(RUBY_PREFIX));
    return reviewables.map(([s, i]) => ({
        fact: ruby.parseMarkdownLinkRuby(s.slice((RUBY_PREFIX).length).trim()),
        header: (closestButNotOver(headers, i, (a, b) => a[1] - b) || [""])[0]
    }));
}
function reviewableToReview(reviewable: Reviewable): Review {
    return {
        reviewable,
        subreview: Math.random() < 0.5 ? "kanji" : "reading",
        recallProbability: Math.random()
    };
}

//
// PICK which to reivew
//
interface Review {
    reviewable: Reviewable;
    subreview: string;
    recallProbability: number;
}

//
// Display review
//
function presentQuiz(review: Review, reviewables: Reviewable[]): QuizMetadata {
    if (review.subreview === 'kanji') {
        console.log(`Which of the following is the kanji for: ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
        let randIdx = Array.from(Array(4), (_, i) => Math.floor(Math.random() * reviewables.length));
        let confusers: Reviewable[] = shuffle(randIdx.map(i => reviewables[i]).concat(review.reviewable));
        confusers.forEach((r, i) => console.log(`${i + 1}. ${ruby.furiganaStringToPlain(r.fact)}`))
        return confusers;
    }
    // reading quiz
    console.log(`Enter the reading for: ${ruby.furiganaStringToPlain(review.reviewable.fact)}`);
    return [];
}

//
// Grade
//
function headerToHash(header: string) {
    let res = header.match(/#+\s*(.*)/);
    return res ? '#' + res[1] : '';
}
function validateNumber(input: string) { return (input.search(/^[0-9]+$/) === 0) ? parseInt(input) : NaN; }
function gradeAndDisplay(result: string, quiz: QuizMetadata, review: Review, reviewables: Reviewable[]): QuizResult {
    if (result.indexOf('?') >= 0) {
        // don't know
        console.log(`${ruby.furiganaStringToPlain(review.reviewable.fact)} : ${
            ruby.furiganaStringToReading(review.reviewable.fact)}`);
        console.log(`Visit ${headerToHash(review.reviewable.header)}`);
        return { result, quiz, review, pass: false, passive: false };
    }
    if (review.subreview === 'kanji') {
        let idx = validateNumber(result) - 1;
        let selected = quiz[idx];
        if (selected && ruby.furiganaStringToPlain(selected.fact) === ruby.furiganaStringToPlain(review.reviewable.fact)) {
            console.log('¡¡¡You juiced it!!! 😍');
            return { result, quiz, review, pass: true, passive: false };
        }
        // else: either bad entry or wrong answer
        if (selected) {
            // You actually selected the wrong answer
            console.log(`😭… I was looking for: ${ruby.furiganaStringToPlain(review.reviewable.fact)}`);
            return { result, quiz, review, pass: false, passive: false };
        }
        // Bad entry
        console.log('Um, u ok?');
        return null;
    }
    // else: reading quiz
    if (result === ruby.furiganaStringToReading(review.reviewable.fact)) {
        console.log('¡¡¡You juiced it!!! 😍');
        return { result, quiz, review, pass: true, passive: false };
    }
    // else: wrong
    console.log(`😭… I was looking for: ${ruby.furiganaStringToReading(review.reviewable.fact)}`);
    return { result, quiz, review, pass: false, passive: false };
}

//
// LOG
//
async function logReview(result: QuizResult) {
    const now = new Date();
    const nowStr = now.toISOString().replace(/:/g, '_');
    const dir = 'reviews';
    const thisComputer = 'l1';
    const filename = `${dir}/review-${nowStr}-${thisComputer}.json`;
    await util.promisify(mkdirp)(dir);
    util.promisify(fs.writeFile)(filename, JSON.stringify(result, null, 1));
}

// Parse file -> pick which to review -> display review (with confusers, etc.) -> grade and display result -> log review
if (require.main === module) {
    (async function() {
        let text = await util.promisify(fs.readFile)('Toponyms.md', 'utf8');
        let reviewables = parseText(text);
        let reviews = reviewables.map(reviewableToReview);
        let pickedForReview = reviews.reduce((prev, curr) => curr.recallProbability > prev.recallProbability ? prev : curr);
        if (pickedForReview) {
            let quizDetails = presentQuiz(pickedForReview, reviewables);
            let enteredText = await cliPrompt();
            let toLog = gradeAndDisplay(enteredText, quizDetails, pickedForReview, reviewables);
            if (toLog) {
                logReview(toLog);
            }
        }
    })();
}
