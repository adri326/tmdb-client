"use strict";

import path from "node:path";
import fs from "node:fs";
import process from "node:process";

import superagent from "superagent";
import Throttle from "superagent-throttle";
import prefix from "superagent-prefix";
import mkdirp from "mkdirp";

/**
* The api module interfaces with TMDB's API, sending requests and caching results as needed.
* @module api
**/

/** The domain name for TMDB's API **/
const DOMAIN = "https://api.themoviedb.org";

/** Plugin for superagent to prefix TMDB's domain name to all requests. **/
const domain_prefix = prefix(DOMAIN);

/** Throttle plugin for superagent, used for TMDB's API. **/
const api_throttle = new Throttle({
    active: true,
    rate: 50,
    ratePer: 1000,
    concurrent: 32,
});

/** Throttle plugin for superagent, used for downloading the poster previews for caching. **/
const poster_throttle = new Throttle({
    active: true,
    rate: 100,
    ratePer: 10000,
    concurrent: 16,
});

/** Contains API keys. **/
let secret = JSON.parse(fs.readFileSync(path.join(process.cwd(), "secret.json")));

/**
* Wrapper function around the `superagent` library, sends a GET request to `url` and provides the API key
* @param url - The URL from the api to fetch from
* @param params - GET parameters for the requests, as an Object
* @returns A Promise that resolves to the body of the response, parsed by `superagent` if possible
**/
export function get(url, params = {}) {
    return new Promise((resolve, reject) => {
        superagent
            .get(url)
            .query({
                ...params,
                api_key: secret.api_key
            })
            .use(domain_prefix)
            .use(api_throttle.plugin())
            .end((err, res) => {
                if (err) reject(new Error(`Received HTTP code ${err.status} while fetching ${url}:\n${err.response?.text}`));
                else resolve(res.body);
            });
    });
}

/**
* Contains data for a Movie, there should only be one instance of Movie for each movie ID.
*
* Used in the Mustache renderer and contains some getters that are used by the templates.
**/
export class Movie {
    /**
    * Constructs a movie, extracting available data from `raw`. If `raw` does not contain all of the data, then you should call `load_full()`
    * @param raw - An object containing properties about the movie
    **/
    constructor(raw) {
        this.id = raw.id;
        this.adult = raw.adult;

        // The poster path needs to be appended to `/t/p/{param}/`, with `param` describing the dimensions of the image
        this.poster_path = raw.poster_path;

        this.title = raw.title;
        this.original_title = raw.original_title;

        // Abstract for the movie
        this.overview = raw.overview;
        // Release date, in `YYYY-MM-DD` format
        this.release_date = raw.release_date;
        this.status = raw.status ?? null;
        this.tagline = raw.tagline ?? null;
        this.homepage = raw.homepage ?? null;
        this.genres = raw.genres ?? null;
        this.spoken_languages = raw.spoken_languages ?? null;

        this.loading_full = false;
        this.loading_poster = false;
    }

    /**
    * Loads the missing information from the API
    **/
    load_full() {
        if (this.loading_full) return null;
        this.load_full = true;

        return get(`/3/movie/${this.id}`).then(raw => {
            this.status = raw.status;
            this.tagline = raw.tagline;
            this.homepage = raw.homepage;
            this.genres = raw.genres;
            this.spoken_languages = raw.spoken_languages;

            return this;
        });
    }

    /**
    * Preemptively load the preview poster for this instance.
    **/
    load_poster() {
        if (this.loading_poster) return null;
        this.loading_poster = true;

        return get_poster_preview(this.id).then(_ => {}).catch(console.error);
    }

    /**
    * Returns the path to the fastest endpoint for the poster:
    * if a poster preview is available in the cache, then returns the path to it, otherwise returns the path on TMDB's website.
    *
    * Note: TMDB's website seems to be slower on node.js than on the browser, maybe because superagent closes the connection every time.
    **/
    get poster_preview() {
        if (get_poster_preview.has(this.id)) {
            return `/preview/${this.id}.jpg`;
        } else {
            return `https://themoviedb.org/t/p/w200/${this.poster_path}`;
        }
    }

    /**
    * Returns the URL of a 400px-wide poster on TMDB's website.
    **/
    get poster_full() {
        return `https://themoviedb.org/t/p/w400/${this.poster_path}`;
    }

    /**
    * Returns true if the status isn't null but is something other than "Released" (for instance, "In Production")
    **/
    get not_released() {
        return this.status !== null && this.status !== "Released";
    }
}

/// Cache for `get_movie`
let movie_cache = new Map();
/**
* Fetches and returns a movie from TMDB's API; implements caching
* @param id - The ID of the movie to fetch
* @returns a Promise returning a Movie instance
**/
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

/**
* Fetches and returns a list of movies from TMDB's API, as returned by the `now_playing` endpoint for a given page.
*
* This endpoint returns an incomplete view of the Movie, so the complete view is then pre-fetched
* and the incomplete view is returned from this function early.
* @param page - The page of the `now_playing` list
* @returns a Promise returning an array of Movie instances
**/
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

            res.forEach(x => x.load_poster());

            resolve(res);
        }).catch(reject);
    });
}

/**
* @fn Cached variant of `fetch_now_playing`
* @see fetch_now_playing
**/
export const get_now_playing = timed_cache(
    fetch_now_playing,
    5 * 60 * 1000, // 5 minutes
    false
);

/**
* Fetches a preview poster from TMDB's website.
* Fetches the required `Movie` information if necessary.
*
* @param id The ID of the movie whose poster to fetch.
* @returns a Promise returning a Buffer
**/
function fetch_poster_preview(id) {
    return new Promise((resolve, reject) => {
        get_movie(id).then(movie => {
            movie.fetching_preview = true;
            superagent
                .get(`https://themoviedb.org/t/p/w200/${movie.poster_path}`)
                .use(poster_throttle.plugin())
                .end((err, res) => {
                    if (err) reject(new Error(`Received HTTP code ${err.status} while fetching poster for movie ${id}:\n${err.response.text}`));
                    else resolve(res.body);
                });
        }).catch(reject);
    });
}

/**
* @fn Cached variant of `fetch_poster_preview`, caching both in the RAM for one minute and to the disk
* @see fetch_poster_preview
**/
export const get_poster_preview = timed_cache(
    disk_cache(
        fetch_poster_preview,
        path.join(process.cwd(), "cache/preview/"),
        ".jpg"
    ),
    60 * 1000,
    true
);

/**
* Wraps an async function to caches its results for a limited amount of time.
* @type T, U
* @param callback - A function taking one input of type `T` and returning a Promise that resolves into `U`
* @param timeout - How long elements are kept in the cache
* @param keepalive - If true, the cache's duration will be extended whenever it is queried
* @returns A Promise that resolves into `U`
**/
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

/**
* Wraps an async function to caches its results on the disk.
* @type T, U
* @param callback - A function taking one input of type `T` and returning a Promise that resolves into `U`
* @param root - The directory to store values in
* @param extension - The file extension to give to stored values
* @returns A Promise that resolves into `U`
**/
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
