// import Rest from "./rest.js";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

import superagent from "superagent";
import Throttle from "superagent-throttle";
import prefix from "superagent-prefix";

const DOMAIN = "https://api.themoviedb.org";
const domain = prefix(DOMAIN);
const throttle = new Throttle({
    active: true,
    rate: 50,
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

export class Movie {
    constructor(raw) {
        this.id = raw.id;
        this.adult = raw.adult;
        this.poster_path = raw.poster_path;
        this.original_title = raw.original_title;
        // TODO: handle languages?

        this.title = raw.title;
        this.overview = raw.overview;
        this.release_date = raw.release_date;
        this.status = raw.status ?? null;
        this.tagline = raw.tagline ?? null;
        this.homepage = raw.homepage ?? null;
        this.genres = raw.genres ?? null;
    }

    // Should only be called once!
    load_full() {
        return get(`/3/movie/${this.id}`).then(raw => {
            this.status = raw.status;
            this.tagline = raw.tagline;
            this.homepage = raw.homepage;
            this.genres = raw.genres;

            return this;
        });
    }

    get poster_preview() {
        return `http://themoviedb.org/t/p/w200/${this.poster_path}`;
    }

    get poster_full() {
        return `http://themoviedb.org/t/p/w400/${this.poster_path}`;
    }
}

let movie_cache = new Map();
export function get_movie(id) {
    return new Promise((resolve, reject) => {
        if (movie_cache.has(id)) {
            resolve(movie_cache.get(id));
        } else {
            get(`/3/movie/${id}`).then(movie_raw => {
                let movie = new Movie(movie_raw);
                movie_cache.set(id, movie);
                resolve(movie);
            }).catch(reject);
        }
    });
}

// TODO: add timed cache
export function get_now_playing(page = 1) {
    return new Promise((resolve, reject) => {
        get("/3/movie/now_playing", {page}).then(movies => {
            let res = [];
            for (let movie_raw of movies.results) {
                if (movie_cache.has(movie_raw.id)) {
                    res.push(movie_cache.get(movie_raw.id));
                } else {
                    // Movie not yet available; return a partial view of the movie early
                    let movie = new Movie(movie_raw);
                    movie.load_full().catch(err => console.error(err));
                    movie_cache.set(movie_raw.id, movie);
                    res.push(movie);
                }
            }
            resolve(res);
        }).catch(reject);
    });
}

// Search:
// console.log(await get("/3/search/movie", {
//     language: "en-US",
//     query: "fight club",
//     // page: 1,
//     // include_adult: false
// }));

// Alternative endpoint: /discover/movie, sort by release date (desc)

// console.log(await get_now_playing(1));
