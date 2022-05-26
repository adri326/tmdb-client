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
    mustache.parse(index_template);
    let view = {
        movies: await api.get_now_playing()
    };

    res.setHeader("Content-Type", "text/html");

    res.send(mustache.render(index_template, view));
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

    api.get_now_playing(+match[0]).then(movies => {
        res.send(JSON.stringify(movies));
    }).catch(err => {
        res.statusCode = 500;
        console.error(err);
        res.send(JSON.stringify({
            error: err.toString()
        }));
    });
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

    api.get_movie(+match[0]).then(movie => {
        res.send(JSON.stringify(movie));
    }).catch(err => {
        res.statusCode = 500;
        console.error(err);
        res.send(JSON.stringify({
            error: err.toString()
        }));
    });
});

app.listen(8080);
