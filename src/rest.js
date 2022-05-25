import superagent from "superagent";

export default class Rest {
    constructor(domain, global_options = {}, max_requests = 0, max_throughput = 0) {
        this.domain = domain;
        this.global_options = global_options;
        this._max_requests = 0;
        this.max_throughput = 0;

        this.request_semaphore = new Semaphore(this.max_requests);
    }

    get max_requests() {
        return this._max_requests;
    }

    set max_requests(value) {
        // Update the semaphore to reflect the new value for `max_requests`
        this.request_semaphore.count += value - this._max_requests;
        this._max_requests = value;
        this.request_semaphore.update();
    }

    async get(url, params = {}) {
        if (this.max_requests > 0) {
            await this.request_semaphore.take();
        }

        try {
            // TODO: use nodejs url package for the concat
            return await rest(this.domain + url, {
                ...this.global_options,
                ...params,
            });
        } catch (err) {
            throw err;
        } finally {
            this.request_semaphore.give();
        }
    }
}

/// A classic Semaphore class, equipped with two methods, `take` (the `P()` operation) and `give` (the `V()` operation).
/// `take()` returns a promise that fulfills as soon as a resource can be taken from the Semaphore.
export class Semaphore {
    constructor(count) {
        this.count = count;
        this.queue = [];
    }

    take() {
        return new Promise((resolve, reject) => {
            if (this.count > 0) {
                this.count--;
                resolve(this.count);
            } else {
                this.queue.push({resolve, reject});
            }
        });
    }

    give() {
        this.count++;
        this.update();
    }

    update() {
        while (this.count > 0 && this.queue.length) {
            this.count--;
            setTimeout(() => this.queue.shift().resolve(this.count), 0);
        }
    }
}
