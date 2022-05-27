# Client for The Movie Database (TMDb)

This project is a quick implementation of a client for the api of `themoviedb.org`, written in `Node.JS` (using [`express`](https://npmjs.com/package/express), [Mustache](https://github.com/janl/mustache.js/) and [`superagent`](https://npmjs.com/package/superagent)) and in vanilla javascript/html5 (using [`a11y-dialog`](https://github.com/KittyGiraudel/a11y-dialog) for handling the dialog).

The file architecture is as follows:
- `secret.json`: contains the API key for `api.themoviedb.org`
- `src/`: files used by `node.js`
    - `src/api.js`: CJS module that interfaces with `api.themoviedb.org`; handles caching of the results
    - `src/server.js`: backend entry point; CJS module that defines and starts an Express router, with all of the routes required by the application
- `static/`: static files served by `Express.static`
    - `static/index.js`: frontend entry point; defines behavior when scrolling, clicking a card, etc.
    - `static/style.css`: stylesheet for the application
    - `static/assets/`: images needed by the application
- `public/`: files to be transformed and served by the backend
    - `public/index.html`: Mustache.js template for the main page
    - `public/dialog.html`: Mustache.js template for the dialog box, served by the `/movie/:id` route
    - `public/movie.html`: Mustache.js template for a movie card, used by other templates
    - `public/page.html`: Mustache.js template for a list of movie cards
- `node_modules/`: `npm`'s folder (`88` packages as of writing this)
- `cache/`: contains a cache of poster previews, for faster loading of the pages

## Installation

Clone this repository

```sh
git clone https://github.com/adri326/tmdb-client && cd tmdb-client
```

Then, install the required dependencies

```sh
npm ci
```

Then, copy `secret.json.template` to `secret.json` and type in the required fields.
Once this is done, you can start the server by running

```sh
node .
```

## Checklist

- ~~post function~~
- [x] fetch the list of movies and each movie's informations
- [x] required endpoints
- [x] cache for the pictures
- [x] cache for the search results
- [x] clarify and document backend
- [ ] automatic testing of the backend?
- [x] display them to the client
- [x] implement a modal screen when the client clicks on a movie
- [x] implement infinite scrolling
- [x] use mustache.js to handle the dialog box
- [x] clarify and document frontend
- [ ] arrow controls
- [x] revise the "about" footer
- [x] mobile layout
