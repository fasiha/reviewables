var fs = require('fs');
var util = require('util');
var mkdirp = require('mkdirp');

function slurpJSON(name: string): Promise<any> {
    return util.promisify(fs.readFile)(name, 'utf8').then((x: string) => JSON.parse(x));
}
export default async function loadReviews(thisUser: string) {
    await util.promisify(mkdirp)(thisUser);
    let files: string[] = (await util.promisify(fs.readdir)(thisUser)).filter((s: string) => s.toLocaleLowerCase().endsWith('json'));
    return await Promise.all(files.map(s => slurpJSON(thisUser + '/' + s)));
}

if (require.main === module) {
    (async function() {
        let logs = await loadReviews('reviews');
        console.log(logs);
    })();
}
