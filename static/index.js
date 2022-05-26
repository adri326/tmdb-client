import A11yDialog from "https://cdn.jsdelivr.net/npm/a11y-dialog@7/dist/a11y-dialog.esm.min.js"

/// Contains a list of cards for movies
const movie_list = document.getElementById("movie-list");

const dialog_container = document.getElementById("movie-dialog");
const dialog = new A11yDialog(dialog_container);

/// Contains the actual content in the dialog
const dialog_content = document.getElementById("movie-dialog-content");
/// The "loading" screen for the dialog
const dialog_loading = document.getElementById("movie-dialog-loading");

/// Stores information about the current request being made
let current_req = null;

/**
* Fetches information about a movie, rendered on the server side as a dialog box, then parses it and returns it.
* @param id - The ID of the movie to render and fetch
* @returns a Promise returning an Element
**/
function fetch_movie(id) {
    return fetch(`/api/movie/${id}`).then(async res => {
        if (!res.ok) {
            throw new Error(`Error while fetching /api/movie/${id}: ${await res.text()}`);
        }
        let json = await res.json();
        let parser = new DOMParser();
        let parsed = parser.parseFromString(json.value, "text/html");

        return parsed.querySelector(".movie-content");
    });
}

/**
* Used by `show_modal` to replace the contents of the dialog box in the DOM.
* @param movie - an Element to replace the children of `dialog_content` with.
**/
function update_dialog(movie) {
    dialog_content.classList.remove("hidden");
    dialog_loading.classList.add("hidden");

    // Empty dialog_content
    while (dialog_content.childNodes.length) {
        dialog_content.removeChild(dialog_content.firstChild);
    }

    dialog_content.appendChild(movie);
}

// Cache for the dialog boxes for each movie
let movies = new Map();

/**
* Calls `fetch_movie` if the movie dialog isn't cached, and displays it as the dialog box' content.
* @param id - The ID of the movie to display in the dialog.
**/
export function show_modal(id) {
    if (!movies.has(id)) {
        dialog_loading.classList.remove("hidden");
        dialog_content.classList.add("hidden");

        let my_req = {
            abort: false
        };
        if (current_req) current_req.abort = true;
        current_req = my_req;
        fetch_movie(id).then(movie => {
            movies.set(id, movie);
            if (!current_req.abort) {
                update_dialog(movie);
            }
        }).catch(err => {
            // TODO: close the dialog box or print an error in it
            console.error(err);
        });
    } else {
        update_dialog(movies.get(id));
    }
    dialog.show();
}

/**
* Register an event listener for the given movie card
* @param element - The DOM element for the movie card
* @param movie_id - The ID of the movie; if set to null, the ID is extracted from `element.id` (in the format `movie-ID`)
**/
export function register_modal(element, movie_id = null) {
    if (movie_id === null) {
        let match = /^movie-(\d+)$/.exec(element.id);
        if (!match) {
            throw new Error(`No movie_id provided and element does not have an id in the format "movie-ID"`);
        }
        movie_id = +match[1];
    }

    element.movie_id = movie_id;

    element.addEventListener("click", _ => show_modal(movie_id));
    element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            show_modal(movie_id);
        }
    });
}

movie_list.querySelectorAll("li").forEach(element => register_modal(element));

/**
* Loads a new page of cards. Should only be called once per page to load.
* @param page - The page index
**/
async function get_page(page) {
    let response = await fetch(`/api/now_playing/${page}`);
    if (!response.ok) {
        throw new Error(`Error while fetching /api/now_playing/${page}: ${await response.text()}`);
    }
    let movies = await response.json();

    let fragment = document.createDocumentFragment();
    let parser = new DOMParser();
    for (let movie of movies) {
        let parsed = parser.parseFromString(movie, "text/html");
        let element = parsed.querySelector("li");
        register_modal(element);
        fragment.appendChild(element);
    }
    movie_list.appendChild(fragment);
}

window.get_page = get_page;

/// The vertical distance to the bottom of the page that a card must be at for a new page to be loaded
export const SCROLL_MARGIN = 380 * 2;
/// Whether a new page is being loaded
let page_req = false;
/// The current index of the pages
let page = 2;

/**
* Loads a new page when the bottom of the page is reached and no new page is being loaded
**/
function update_scroll() {
    if (page_req) return;

    let bounding = movie_list.lastElementChild.getBoundingClientRect();

    if (bounding.bottom <= window.innerHeight + SCROLL_MARGIN) {
        page_req = true;
        get_page(page).then(_ => {
            page++;
            page_req = false;
        }).catch(err => {
            console.error(err);
            page_req = false;
        });
    }
}

window.addEventListener("scroll", update_scroll);
update_scroll();
