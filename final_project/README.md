# Book Review API

Final project for IBM's Developing Back-End Apps with Node.js and Express.
Forked from ibm-developer-skills-network/expressBookReviews.

## Run
Requires Node.js 20 or newer. From final_project:
```sh
npm install
npm start
npm test
```
A pnpm lockfile is also included; pnpm install --frozen-lockfile reproduces the tested dependencies.
The server listens on http://127.0.0.1:5000. PORT and HOST can override this.

## Routes
| Method | Path | Purpose |
| --- | --- | --- |
| GET | / | List all books |
| GET | /isbn/:isbn | Look up one book |
| GET | /author/:author | Find books by author |
| GET | /title/:title | Find books by title |
| GET | /review/:isbn | Read reviews |
| POST | /register | Register with username and password |
| POST | /customer/login | Log in; stores a signed JWT in the server-side session |
| PUT | /customer/auth/review/:isbn | Add or update the signed-in user's review |
| DELETE | /customer/auth/review/:isbn | Delete only the signed-in user's review |

Send JSON request bodies. PUT accepts {"review":"text"} or the review query parameter.
Use a cookie jar with cURL to preserve the session between login and review requests.
Author and title matching is exact, ignoring case; URL-encode spaces.
The original booksdb.js dataset is preserved. Searches with no matches return an empty object.
Unknown ISBNs return 404; missing authentication returns 401.

## Asynchronous requests
router/general.js exports getAllBooks (async/await with optional error-first callback),
getBookByISBN (Axios promise), getBooksByAuthor, and getBooksByTitle (async/await).
createBookClient(baseURL) creates the same four methods for another server address.
Concurrent requests are verified with Promise.all in the integration test.

## Verification
npm test starts an isolated HTTP server and checks all catalog methods, callback results,
concurrent registration, login failures, protected routes, two independent user sessions,
review updates, ownership isolation, deletion, and invalid ISBNs.

## Scope
This educational app intentionally uses in-memory users, reviews and sessions. Restarting
the process resets them. Passwords are salted and hashed. SESSION_SECRET and JWT_SECRET
may be supplied through environment variables; otherwise random process-local keys are
created. Public deployment would require persistent stores, HTTPS and secure cookies.
Test account passwords are disposable examples, not real credentials.
