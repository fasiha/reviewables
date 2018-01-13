var fs = require('fs');
var util = require('util');

var shuffle = require('lodash.shuffle');

var cliPrompt = require('./cliPrompt');
import closestButNotOver from './closestButNotOver';
import * as ruby from './ruby';
import logReview from './globalLogger';
//
// PARSING
//
interface Fact {
    furigana: ruby.Furigana[];
    meaning: string;
    id: string;
}
interface Reviewable {
    fact: Fact;
    header: string;
}
type QuizMetadata = Reviewable[];
type QuizResult = any;
// interface FactModule {
//     parseText: (contents: string) => Reviewable[];
//     reviewableToReview: (reviewable: Reviewable) => Review;
//     presentQuiz: (review: Review, reviewables: Reviewable[]) => QuizMetadata;
//     gradeAndDisplay: (result: string, quiz: QuizMetadata, review: Review, reviewables: Reviewable[]) => QuizResult;
// }
// const mod: FactModule = { parseText, reviewableToReview, presentQuiz, gradeAndDisplay };

function parseText(contents: string): Reviewable[] {
    const PREFIX = '- Review ';
    let lines = contents.split('\n');
    let headers = lines.map((s, i): [string, number] => [s, i]).filter(([s, i]) => s.search(/#+\s/) === 0);
    function makeFact(s: string): (Fact | null) {
        let res = s.slice(PREFIX.length).match(/#([^:]+):\s*([^\/]+)\/(.*)/);
        if (res) {
            let id = res[1];
            let furigana = ruby.parseStackExchangeRuby(res[2]);
            let meaning = res[3];
            return { id, furigana, meaning }
        }
        return null;
    };
    let reviewables: Array<[Fact, number]> = lines.map((s, i): [string, number] => [s, i])
        .filter(([s, i]: [string, number]) => s.startsWith(PREFIX))
        .map(([s, i]: [string, number]) => [makeFact(s), i])
        .filter(([f, i]) => f) as Array<[Fact, number]>;
    return reviewables.map(([fact, i]: [Fact, number]) => ({
        fact,
        header: (closestButNotOver(headers, i, (a, b) => a[1] - b) || [""])[0]
    }));
}

//
// SCORE reviewables by urgency for review
//
interface Review {
    reviewable: Reviewable;
    subreview: string;
    recallProbability: number;
}
function reviewableToReview(reviewable: Reviewable): Review {
    return {
        reviewable,
        subreview: ruby.kanjis.length ? (Math.random() < 0.5 ? 'kanji' : 'reading') : 'reading',
        recallProbability: Math.random()
    };
}

//
// Display review
//
function presentQuiz(review: Review, reviewables: Reviewable[]): QuizMetadata {
    if (review.subreview === 'kanji') {
        console.log(`Which of the following is the kanji for: ${ruby.furiganaStringToReading(review.reviewable.fact.furigana)}`);
        let randIdx = Array.from(Array(4), (_, i) => Math.floor(Math.random() * reviewables.length));
        let confusers: Reviewable[] = shuffle(randIdx.map(i => reviewables[i]).concat(review.reviewable));
        confusers.forEach((r, i) => console.log(`${i + 1}. ${ruby.furiganaStringToPlain(r.fact.furigana)}`))
        return confusers;
    }
    // reading quiz
    console.log(`Enter the reading for: ${ruby.furiganaStringToPlain(review.reviewable.fact.furigana)}`);
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
        console.log(`${ruby.furiganaStringToPlain(review.reviewable.fact.furigana)} : ${
            ruby.furiganaStringToReading(review.reviewable.fact.furigana)}`);
        console.log(`Visit ${headerToHash(review.reviewable.header)}`);
        return { result, quiz, review, pass: false, passive: false };
    }
    if (review.subreview === 'kanji') {
        let idx = validateNumber(result) - 1;
        let selected = quiz[idx];
        if (selected && ruby.furiganaStringToPlain(selected.fact.furigana) === ruby.furiganaStringToPlain(review.reviewable.fact.furigana)) {
            console.log('¡¡¡You juiced it!!! 😍');
            return { result, quiz, review, pass: true, passive: false };
        }
        // else: either bad entry or wrong answer
        if (selected) {
            // You actually selected the wrong answer
            console.log(`😭… I was looking for: ${ruby.furiganaStringToPlain(review.reviewable.fact.furigana)}`);
            return { result, quiz, review, pass: false, passive: false };
        }
        // Bad entry
        console.log('Um, u ok?');
        return null;
    }
    // else: reading quiz
    if (result === ruby.furiganaStringToReading(review.reviewable.fact.furigana)) {
        console.log('¡¡¡You juiced it!!! 😍');
        return { result, quiz, review, pass: true, passive: false };
    }
    // else: wrong
    console.log(`😭… I was looking for: ${ruby.furiganaStringToReading(review.reviewable.fact.furigana)}`);
    return { result, quiz, review, pass: false, passive: false };
}

// Parse file -> pick which to review -> display review (with confusers, etc.) -> grade and display result -> log review
if (require.main === module) {
    (async function() {
        let text = await util.promisify(fs.readFile)('Vocab.md', 'utf8');
        let reviewables = parseText(text);
        let reviews = reviewables.map(reviewableToReview);
        if (reviews.length > 0) {
            let pickedForReview = reviews.reduce((prev, curr) => curr.recallProbability > prev.recallProbability ? prev : curr);
            let quizDetails = presentQuiz(pickedForReview, reviewables);
            let enteredText = await cliPrompt();
            let toLog = gradeAndDisplay(enteredText, quizDetails, pickedForReview, reviewables);
            if (toLog) {
                logReview(toLog, 'l1');
            }
        }
    })();
}


// // Parse file -> pick which to review -> display review (with confusers, etc.) -> grade and display result -> log review
// if (require.main === module) {
//     (async function() {
//         let text = await util.promisify(fs.readFile)('Vocab.md', 'utf8');
//         let reviewables = parseText(text);
//         console.log(reviewables);
//     })();
// }
