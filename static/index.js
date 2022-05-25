import A11yDialog from "https://cdn.jsdelivr.net/npm/a11y-dialog@7/dist/a11y-dialog.esm.min.js"

const dialog_container = document.getElementById("movie-dialog");
window.dialog_container = dialog_container;
const dialog = new A11yDialog(dialog_container);
window.dialog = dialog;

function show_modal(id) {
    dialog.show();
}

function register_modal(element, movie_id = null) {
    if (movie_id === null) {
        let match = /^movie-(\d+)$/.exec(element.id);
        if (!match) {
            throw new Error(`No movie_id provided and element does not have an id in the format "movie-ID"`);
        }
        movie_id = +match[1];
    }

    element.addEventListener("click", _ => show_modal(movie_id));
    element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            show_modal(movie_id);
        }
    });
}

document.querySelectorAll("#movie-list > li").forEach(element => register_modal(element));
