// import Rest from "./rest.js";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

import superagent from "superagent";
import Throttle from "superagent-throttle";
import prefix from "superagent-prefix";

const domain = prefix("https://api.themoviedb.org/");
const throttle = new Throttle({
    active: true,
    rate: 5,
    ratePer: 10000,
    concurrent: 32,
});

let secret = JSON.parse(fs.readFileSync(path.join(process.cwd(), "secret.json")));

/// Wrapper function around the `superagent` library, sends a GET request to `url` and provides the API key
export function get(url, params = {}) {
    return new Promise((resolve, reject) => {
        superagent
            .get(url)
            .query({
                ...params,
                api_key: secret.api_key
            })
            .use(domain)
            .use(throttle.plugin())
            .end((err, res) => {
                if (err) reject(new Error(`Received HTTP code ${err.status} while fetching ${url}:\n${err.response.text}`));
                else resolve(res.body);
            });
    });
}

console.log(await get("/3/movie/550"));
