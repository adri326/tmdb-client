"strict mode";

import url from "node:url";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import express from "express";
import mustache from "mustache";
import * as api from "./api.js";

const app = express();

const index_template = fs.readFileSync("public/index.html", "utf8");
mustache.parse(index_template);

app.use("/static", express.static(path.join(process.cwd(), "static")));

app.get("/", async (req, res, next) => {
    let view = {
        movies: await api.get_now_playing()
    };

    res.setHeader("Content-Type", "text/html");

    res.send(mustache.render(index_template, view));
});

app.listen(8080);
