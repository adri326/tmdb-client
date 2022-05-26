"strict mode";

import url from "node:url";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import express from "express";
import mustache from "mustache";
import * as api from "./api.js";

const app = express();

app.use("/static", express.static(path.join(process.cwd(), "static")));

app.get("/", async (req, res, next) => {
    const index_template = fs.readFileSync("public/index.html", "utf8");
    const movie_template = fs.readFileSync("public/movie.html", "utf8");

    let view = {
        movies: await api.get_now_playing()
    };

    res.setHeader("Content-Type", "text/html");

    res.send(mustache.render(index_template, view, {
        render_movie: movie_template
    }));
});

app.get("/api/movie/:id", (req, res, next) => {
    let match = /^\d+$/.exec(req.params.id);
    res.setHeader("Content-Type", "application/json");

    if (!match) {
        res.statusCode = 400;
        return res.send(JSON.stringify({
            error: "Expected id to be a number, got " + req.params.id
        }));
    }

    const dialog_template = fs.readFileSync("public/dialog.html", "utf8");

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

app.get("/api/now_playing/:page", (req, res, next) => {
    let match = /^\d+$/.exec(req.params.page);
    res.setHeader("Content-Type", "application/json");

    if (!match) {
        res.statusCode = 400;
        return res.send(JSON.stringify({
            error: "Expected page to be a number, got " + req.params.page
        }));
    }

    const movie_template = fs.readFileSync("public/movie.html", "utf8");

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
