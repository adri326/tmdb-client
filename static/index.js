import A11yDialog from "https://cdn.jsdelivr.net/npm/a11y-dialog@7/dist/a11y-dialog.esm.min.js"

const movie_list = document.getElementById("movie-list");

const dialog_container = document.getElementById("movie-dialog");
const dialog = new A11yDialog(dialog_container);

const dialog_content = document.getElementById("movie-dialog-content");
const dialog_loading = document.getElementById("movie-dialog-loading");

const dialog_fields = {
    title: dialog_content.querySelector(".movie-title"),
    tagline: dialog_content.querySelector(".movie-tagline"),
    overview: dialog_content.querySelector(".movie-overview"),
    homepage: dialog_content.querySelector(".movie-homepage"),

    poster: dialog_content.querySelector(".movie-poster"),

    genres: dialog_content.querySelector(".movie-genres"),
    adult: dialog_content.querySelector(".movie-adult"),
    date: dialog_content.querySelector(".movie-date"),
};

let movies = new Map();

// Stores information about the current request being made
let current_req = null;

function fetch_movie(id) {
    return fetch(`/api/movie/${id}`).then(async res => {
        if (res.ok) return await res.json();
        else throw new Error(`Error while fetching /api/movie/${id}: ${await res.text()}`);
    });
}

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
                update_dialog(movies.get(id));
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

dialog.on("hide", () => {
    dialog_fields.poster.src = "";
});

// TODO: hide/show things with aria-hidden="true" instead of class="hidden"
function update_dialog(movie) {
    dialog_content.classList.remove("hidden");
    dialog_loading.classList.add("hidden");

    dialog_fields.title.innerText = movie.title;
    dialog_fields.tagline.innerText = movie.tagline;
    dialog_fields.overview.innerText = movie.overview;

    dialog_fields.poster.src = `https://themoviedb.org/t/p/w400/${movie.poster_path}`;
    dialog_fields.poster.alt = `Poster for the movie ${movie.title}`;

    if (movie.homepage) {
        dialog_fields.homepage.classList.remove("hidden");
        dialog_fields.homepage.href = movie.homepage;
        dialog_fields.homepage.innerText = `More details on ${new URL(movie.homepage).hostname}`;
    } else {
        dialog_fields.homepage.classList.add("hidden");
    }

    dialog_fields.date.innerText = `Released: ${movie.release_date}`;

    if (movie.genres) {
        dialog_fields.genres.classList.remove("hidden");
        dialog_fields.genres.innerText = `Genres: ${movie.genres.map(genre => genre.name).join(", ")}`;
    } else {
        dialog_fields.genres.classList.add("hidden");
    }

    dialog_fields.adult.innerText = "Adults only: " + (movie.adult ? "yes" : "no");

    console.log(movie);
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
    let response = await fetch(`/api/rendered/now_playing/${page}`);
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
