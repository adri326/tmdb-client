import express from "express";
import url from "node:url";
import path from "node:path";

const app = express();

let current_directory = path.dirname(url.fileURLToPath(import.meta.url));

app.use("/", express.static(path.join(current_directory, "public")));



app.listen(8080);
