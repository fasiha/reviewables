var fs = require('fs');
var util = require('util');
var cliPrompt = require('./cliPrompt');

import { zip } from 'lodash';
import * as furiMeaning from './furiMeaning';
import * as dashRubyMarkdown from './dashRubyMarkdown';
import logReview from './globalLogger';

const modules = [furiMeaning.mod, dashRubyMarkdown.mod];

function slurp(name: string): Promise<string> {
    return util.promisify(fs.readFile)(name, 'utf8');
}
function flatten1<T>(arr: T[][]): T[] {
    return arr.reduce((prev, curr) => prev.concat(curr));
}
if (require.main === module) {
    (async function() {
        var mds = process.argv.filter(s => s.toLocaleLowerCase().endsWith('.md'));
        if (mds.length === 0) {
            console.log('Pass in some .md files');
            process.exit(1);
        }
        var contents = await Promise.all(mds.map(slurp));
        var text = contents.join('\n');
        let reviewables = modules.map(mod => mod.parseText(text));
        let reviews = modules.map((mod, modidx) => (reviewables[modidx] as any).map(mod.reviewableToReview));
        if (Math.max(...reviews.map(x => x.length)) > 0) {
            let pickedForReviews = reviews
                .map((reviews, modidx) => reviews.length
                    ? [reviews.reduce((prev: any, curr: any) => curr.recallProbability > prev.recallProbability ? prev : curr), modidx]
                    : [])
                .filter(x => x.length);

            let [pickedForReview, moduleIdx] = pickedForReviews.reduce((prev, curr) => curr[0].recallProbability > prev[0].recallProbability ? prev : curr);

            let quizDetails = (modules[moduleIdx].presentQuiz as any)(pickedForReview, reviewables[moduleIdx]);
            let enteredText = await cliPrompt();

            let toLog = (modules[moduleIdx].gradeAndDisplay as any)(enteredText, quizDetails, pickedForReview, reviewables[moduleIdx]);

            if (toLog) {
                logReview(toLog, 'l1');
            }
        }
    })();
}
