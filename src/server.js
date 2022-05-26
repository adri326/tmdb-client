"strict mode";
import url from "node:url";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import express from "express";
import mustache from "mustache";
import * as api from "./api.js";

/**
* Server module: provides an Express router for rendering pages and exposing the api
* @module server
**/

/** The Express instance for this module, serves all of the routes described here. **/
export const app = express();

/**
* Serves files using `Express.static` to `/static`
* @route GET /static/{path}
* @param path - The path of the file in the static directory
**/
app.use("/static", express.static(path.join(process.cwd(), "static")));

/// Mustache template for the index page (served on `/`)
const index_template = fs.readFileSync("public/index.html", "utf8");
/// Mustache template for a movie card (served on `/` and on `/api/now_playing/{id}`
const movie_template = fs.readFileSync("public/movie.html", "utf8");
/// Mustache template for a dialog box (served on `/api/movie/{id}`
const dialog_template = fs.readFileSync("public/dialog.html", "utf8");

/**
* Serves the index page, generated from `index_template` and `movie_template` (as a partial)
* @route GET /
**/
app.get("/", async (req, res, next) => {
    let view = {
        movies: await api.get_now_playing()
    };

    res.setHeader("Content-Type", "text/html");

    res.send(mustache.render(index_template, view, {
        render_movie: movie_template
    }));
});

/**
* Serves the preview of the poster for a given movie. The preview has a width of 200, if available.
* @route /preview/{id}.jpg
* @param id - The movie ID - Number
**/
app.get("/preview/:id", (req, res, next) => {
    let match = /^(\d+).jpg$/.exec(req.params.id);
    if (!match) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/plain");
        return res.send("Expected id to be of the format [number].jpg, got " + req.params.id);
    }

    api.get_poster_preview(+match[1]).then(poster => {
        res.setHeader("Content-Type", "image/jpeg");
        res.send(poster);
    }).catch(err => {
        console.error(err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        return res.send(`Error while fetching preview for movie ${match[1]}: ${err.toString()}`);
    });
});

/**
* Serves the dialog box for a given movie, generated from `dialog_template`.
* @route /api/movie/{id}
* @param id - The movie ID - Number
* @returns `{value: "Rendered HTML"}`
**/
app.get("/api/movie/:id", (req, res, next) => {
    let match = /^\d+$/.exec(req.params.id);
    res.setHeader("Content-Type", "application/json");

    if (!match) {
        res.statusCode = 400;
        return res.send(JSON.stringify({
            error: "Expected id to be a number, got " + req.params.id
        }));
    }

    api.get_movie(+match[0]).then(movie => {
        res.send(JSON.stringify({
            value: mustache.render(dialog_template, movie)
        }));
    }).catch(err => {
        res.statusCode = 500;
        console.error(err);
        res.send(JSON.stringify({
            error: err.toString()
        }));
    });
});

/**
* Serves a single page of the `now_playing` endpoint, rendered using `movie_template`
* @route /api/now_playing/{page}
* @param page - The page index - Number
* @returns `["Rendered movie 1", "Rendered movie 2", ...]`
**/
app.get("/api/now_playing/:page", (req, res, next) => {
    let match = /^\d+$/.exec(req.params.page);
    res.setHeader("Content-Type", "application/json");

    if (!match) {
        res.statusCode = 400;
        return res.send(JSON.stringify({
            error: "Expected page to be a number, got " + req.params.page
        }));
    }

    api.get_now_playing(+match[0]).then(movies => {
        res.send(JSON.stringify(movies.map(movie => {
            return mustache.render(movie_template, movie);
        })));
    }).catch(err => {
        res.statusCode = 500;
        console.error(err);
        res.send(JSON.stringify({
            error: err.toString()
        }));
    });
});

app.listen(8080);
