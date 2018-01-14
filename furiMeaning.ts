var fs = require('fs');
var util = require('util');

var shuffle = require('lodash.shuffle');

var cliPrompt = require('./cliPrompt');
import closestButNotOver from './closestButNotOver';
import * as ruby from './ruby';
import logReview from './globalLogger';
import loadReviews from './loadReviews';
import { ebisu, EbisuObject } from "./ebisu";
import { DEFAULT_ECDH_CURVE } from 'tls';
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
type MemoryModel = any;
interface Review {
    reviewable: Reviewable;
    subreview: string;
    recallProbability: number;
    previousMemory: MemoryModel | null;
    previousTime: Date | null;
}
type QuizMetadata = Reviewable[];
interface QuizResult {
    result: string;
    quiz: QuizMetadata;
    review: Review;
    pass: boolean;
    passive: boolean;
    memory: MemoryModel;
    time: Date;
}
interface FactModule {
    parseText: (contents: string) => Reviewable[];
    reviewableToReview: (reviewable: Reviewable, logs: QuizResult[]) => Review;
    presentQuiz: (review: Review, reviewables: Reviewable[]) => QuizMetadata;
    gradeAndDisplay: (result: string, quiz: QuizMetadata, review: Review, reviewables: Reviewable[]) => QuizResult | null;
}
export const mod: FactModule = { parseText, reviewableToReview, presentQuiz, gradeAndDisplay };

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
const DEFAULT_MEMORY_MODEL = [0.25, 2.5, 2.5];
function elapsedHours(d: Date, dnow?: Date) {
    return (((dnow || new Date()) as any) - (d as any)) / 3600e3 as number
};
function reviewableToReview(reviewable: Reviewable, logs: QuizResult[]): Review {
    let relevantLogs = logs.filter(log =>
        log.review.reviewable.fact.furigana
        && (ruby.furiganaStringToBoth(log.review.reviewable.fact.furigana) === ruby.furiganaStringToBoth(reviewable.fact.furigana)));
    let relevantLog = relevantLogs.length ? relevantLogs[relevantLogs.length - 1] : null;
    let recallProbability = 2;
    let previousTime = null;
    let previousMemory = null;
    if (relevantLog) {
        previousTime = relevantLog.time;
        previousMemory = relevantLog.memory;
        recallProbability = ebisu.predictRecall(previousMemory, elapsedHours(new Date(previousTime), new Date()));
    }
    return {
        reviewable,
        subreview: ruby.kanjis.length ? (Math.random() < 0.5 ? 'kanji' : 'reading') : 'reading',
        recallProbability,
        previousMemory,
        previousTime
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
function gradeAndDisplay(result: string, quiz: QuizMetadata, review: Review, reviewables: Reviewable[]): QuizResult | null {
    let time = new Date();
    let previousMemoryModel = review.previousMemory;
    let previousTime = review.previousTime;
    if (result.indexOf('?') >= 0) {
        // don't know
        console.log(`${ruby.furiganaStringToPlain(review.reviewable.fact.furigana)} : ${
            ruby.furiganaStringToReading(review.reviewable.fact.furigana)}`);
        console.log(`Visit ${headerToHash(review.reviewable.header)}`);
        return { result, quiz, review, pass: false, passive: false, time, memory: previousMemoryModel || DEFAULT_MEMORY_MODEL };
    }
    if (review.subreview === 'kanji') {
        let idx = validateNumber(result) - 1;
        let selected = quiz[idx];
        if (selected && ruby.furiganaStringToPlain(selected.fact.furigana) === ruby.furiganaStringToPlain(review.reviewable.fact.furigana)) {
            console.log('¡¡¡You juiced it!!! 😍');
            return {
                result, quiz, review, pass: true, passive: false, time,
                memory: previousTime
                    ? ebisu.updateRecall(previousMemoryModel, true, elapsedHours(previousTime, time))
                    : DEFAULT_MEMORY_MODEL
            };
        }
        // else: either bad entry or wrong answer
        if (selected) {
            // You actually selected the wrong answer
            console.log(`😭… I was looking for: ${ruby.furiganaStringToPlain(review.reviewable.fact.furigana)}`);
            return {
                result, quiz, review, pass: false, passive: false, time,
                memory: previousTime
                    ? ebisu.updateRecall(previousMemoryModel, false, elapsedHours(previousTime, time))
                    : DEFAULT_MEMORY_MODEL
            };
        }
        // Bad entry
        console.log('Um, u ok?');
        return null;
    }
    // else: reading quiz
    if (result === ruby.furiganaStringToReading(review.reviewable.fact.furigana)) {
        console.log('¡¡¡You juiced it!!! 😍');
        return {
            result, quiz, review, pass: true, passive: false, time, memory: previousTime
                ? ebisu.updateRecall(previousMemoryModel, true, elapsedHours(previousTime, time))
                : DEFAULT_MEMORY_MODEL
        };
    }
    // else: wrong
    console.log(`😭… I was looking for: ${ruby.furiganaStringToReading(review.reviewable.fact.furigana)}`);
    return {
        result, quiz, review, pass: false, passive: false, time, memory: previousTime
            ? ebisu.updateRecall(previousMemoryModel, false, elapsedHours(previousTime, time))
            : DEFAULT_MEMORY_MODEL
    };
}

// Parse file -> pick which to review -> display review (with confusers, etc.) -> grade and display result -> log review
if (require.main === module) {
    (async function() {
        const RECALL_FLOOR = 0.5;
        let text = await util.promisify(fs.readFile)('Vocab.md', 'utf8');
        let reviewables = parseText(text);
        let logs = await loadReviews('reviews');
        let reviews = reviewables.map(reviewable => reviewableToReview(reviewable, logs));
        if (reviews.length > 0) {
            let pickedForReview = reviews.reduce((prev, curr) => curr.recallProbability > prev.recallProbability ? prev : curr);
            if (pickedForReview.recallProbability > RECALL_FLOOR) {
                pickedForReview = reviews.find(review=>review.recallProbability > 1) || pickedForReview;
            }
            let quizDetails = presentQuiz(pickedForReview, reviewables);
            let enteredText = await cliPrompt();
            let toLog = gradeAndDisplay(enteredText, quizDetails, pickedForReview, reviewables);
            if (toLog) {
                logReview(toLog, 'l1');
            }
        }
    })();
}
