# Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs the tests in test/
```

## What is here

- `server.js`: the web server. `GET /api/jobs?q=` lists jobs, `GET /` serves the page.
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Your task

See the work sample brief on insiderOne: add saved jobs (save, list, remove),
with tests, and add a short section to this README about what you built.

## Saved Jobs Feature

### What I built

Implemented a Saved Jobs feature that allows users to:

- Save jobs from the available jobs list.
- View all saved jobs separately.
- Remove jobs from their saved list.
- Retain saved jobs after page reloads and server restarts.

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/saved` | Save a job |
| GET | `/api/saved` | Retrieve saved jobs |
| DELETE | `/api/saved/:jobId` | Remove a saved job |

### How to Run

Requirements: Node.js 20 or newer.

Start the application:

```bash
npm start
```

Open http://localhost:3000.

Run automated tests:

```bash
npm test
```

No external dependencies are required.

### Technical Decision

I chose JSON file-based persistence instead of introducing a database because the assignment requires a lightweight solution without external packages.

I store only job IDs in `saved-jobs.json` rather than duplicating complete job objects. This keeps the saved data small and allows the application to retrieve the latest job information from the original jobs file.

I also prevent duplicate saves and use temporary-file writes followed by file renaming when updating saved data.

### What I Would Do Next

- Add better frontend loading and error states.
- Add accessibility improvements.
- Introduce user-specific saved jobs if authentication is added.
- Move to a database if the application needs to support multiple users and larger datasets.

### AI Tool Disclosure

I used ChatGPT as a development assistant for implementation guidance, code explanations and test-case suggestions. I reviewed and manually implemented the changes, tested the functionality and worked to understand the technical decisions.