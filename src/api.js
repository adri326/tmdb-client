// import Rest from "./rest.js";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

import superagent from "superagent";
import Throttle from "superagent-throttle";
import prefix from "superagent-prefix";
import mkdirp from "mkdirp";

const DOMAIN = "https://api.themoviedb.org";
const domain = prefix(DOMAIN);
const api_throttle = new Throttle({
    active: true,
    rate: 50,
    ratePer: 1000,
    concurrent: 32,
});

const poster_throttle = new Throttle({
    active: true,
    rate: 100,
    ratePer: 10000,
    concurrent: 16,
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
            .use(api_throttle.plugin())
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
        this.spoken_languages = raw.spoken_languages ?? null;

        this.cached_preview = false;
        this.fetching_preview = false;
    }

    // Should only be called once!
    load_full() {
        return get(`/3/movie/${this.id}`).then(raw => {
            this.status = raw.status;
            this.tagline = raw.tagline;
            this.homepage = raw.homepage;
            this.genres = raw.genres;
            this.spoken_languages = raw.spoken_languages;

            return this;
        });
    }

    get poster_preview() {
        if (get_poster_preview.has(this.id)) {
            return `/preview/${this.id}.jpg`;
        } else {
            return `http://themoviedb.org/t/p/w200/${this.poster_path}`;
        }
    }

    get poster_full() {
        return `http://themoviedb.org/t/p/w400/${this.poster_path}`;
    }

    get not_released() {
        return this.status !== null && this.status !== "Released";
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

async function fetch_now_playing(page = 1) {
    let start = Date.now();
    return new Promise((resolve, reject) => {
        get("/3/movie/now_playing", {page}).then(movies => {
            if (Date.now() - start > 1000) {
                console.warn(`Fetching /3/movie/now_playing for page ${page} took ${(Date.now() - start) / 1000}s!`);
            }
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

export const get_now_playing = timed_cache(
    fetch_now_playing,
    5 * 60 * 1000, // 5 minutes
    false
);

function fetch_poster_preview(id) {
    return new Promise((resolve, reject) => {
        get_movie(id).then(movie => {
            movie.fetching_preview = true;
            let start = Date.now();
            superagent
                .get(`https://themoviedb.org/t/p/w200/${movie.poster_path}`)
                .use(poster_throttle.plugin())
                .end((err, res) => {
                    console.log((Date.now() - start) / 1000);
                    if (err) reject(new Error(`Received HTTP code ${err.status} while fetching poster for movie ${id}:\n${err.response.text}`));
                    else resolve(res.body);
                });
        }).catch(reject);
    });
}

export const get_poster_preview = timed_cache(
    disk_cache(
        fetch_poster_preview,
        path.join(process.cwd(), "cache/preview/"),
        ".jpg"
    ),
    60 * 1000,
    true
);

function timed_cache(callback, timeout, keepalive = false) {
    let cache = new Map();

    setInterval(() => {
        let now = Date.now();
        for (let [key, entry] of cache) {
            if (entry[1] < now - timeout) {
                cache.delete(key);
            }
        }
    }, timeout);

    let res = function with_timed_cache(input) {
        return new Promise((resolve, reject) => {
            if (cache.has(input)) {
                let entry = cache.get(input);
                if (keepalive) {
                    entry[1] = Date.now();
                }
                resolve(entry[0]);
            } else {
                callback(input).then(value => {
                    cache.set(input, [value, Date.now()]);
                    resolve(value);
                }).catch(resolve);
            }
        });
    };

    res.parent = callback;
    res.cache = cache;
    res.has = (input) => {
        if (cache.has(input)) return true;
        else if (typeof callback.has === "function") return callback.has(input);
        else return false;
    }

    return res;
}

function disk_cache(callback, root, extension = "") {
    mkdirp.sync(root);
    let files = fs.readdirSync(root);

    let res = function with_disk_cache(input) {
        return new Promise((resolve, reject) => {
            let sanitized = input.toString().replace(/[^a-zA-Z0-9\-_]/g, "-");

            if (files.includes(sanitized + extension)) {
                resolve(fs.readFileSync(path.join(root, sanitized + extension)));
            } else {
                callback(input).then(value => {
                    fs.writeFile(path.join(root, sanitized + extension), value, err => {
                        if (err) return console.error(err);
                        files.push(sanitized + extension);
                    });
                    resolve(value);
                }).catch(reject);
            }
        });
    };

    res.parent = callback;
    res.files = files;
    res.has = (input) => {
        let sanitized = input.toString().replace(/[^a-zA-Z0-9\-_]/g, "-");
        if (files.includes(sanitized + extension)) return true;
        else if (typeof callback.has === "function") return callback.has(input);
        else return false;
    };

    return res;
}
