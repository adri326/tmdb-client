import A11yDialog from "https://cdn.jsdelivr.net/npm/a11y-dialog@7/dist/a11y-dialog.esm.min.js"

const movie_list = document.getElementById("movie-list");

const dialog_container = document.getElementById("movie-dialog");
const dialog = new A11yDialog(dialog_container);

const dialog_content = document.getElementById("movie-dialog-content");
const dialog_loading = document.getElementById("movie-dialog-loading");


// Stores information about the current request being made
let current_req = null;
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

// Cache for the dialog boxes for each movie
let movies = new Map();

function show_modal(id) {
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

function update_dialog(movie) {
    dialog_content.classList.remove("hidden");
    dialog_loading.classList.add("hidden");

    // Empty dialog_content
    while (dialog_content.childNodes.length) {
        dialog_content.removeChild(dialog_content.firstChild);
    }

    dialog_content.appendChild(movie);
}

function register_modal(element, movie_id = null) {
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

const SCROLL_MARGIN = 380 * 2;
let page_req = false;
let page = 2;
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
