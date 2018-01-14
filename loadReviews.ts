var fs = require('fs');
var util = require('util');
var mkdirp = require('mkdirp');

function slurpJSON(name: string): Promise<any> {
    return util.promisify(fs.readFile)(name, 'utf8').then((x: string) => JSON.parse(x));
}
export default async function loadReviews(dir: string) {
    await util.promisify(mkdirp)(dir);
    let files: string[] = (await util.promisify(fs.readdir)(dir)).filter((s: string) => s.toLocaleLowerCase().endsWith('json'));
    return await Promise.all(files.map(s => slurpJSON(dir + '/' + s)));
}

if (require.main === module) {
    (async function() {
        let logs = await loadReviews('reviews');
        console.log(logs);
    })();
}
