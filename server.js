// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  loadJobs,
  searchJobs,
  findJob
} from "./lib/jobs.js";

import {
  getSavedIds,
  saveJob,
  removeSavedJob
} from "./lib/saved.js";
const JOBS_PATH = new URL("./jobs.json", import.meta.url);
const SAVED_PATH = fileURLToPath(new URL("./saved-jobs.json", import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

async function readBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 10000) {
      const error = new Error("Request body too large");
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}
function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function createApp({
  jobsPath = JOBS_PATH,
  savedPath = SAVED_PATH
} = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      // GET all jobs
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs(jobsPath);
        return sendJson(
          res,
          200,
          searchJobs(jobs, url.searchParams.get("q"))
        );
      }

      // GET saved jobs
      if (req.method === "GET" && url.pathname === "/api/saved") {
        const jobs = await loadJobs(jobsPath);
        const savedIds = await getSavedIds(savedPath);

        const savedJobs = jobs.filter((job) =>
          savedIds.includes(job.id)
        );

        return sendJson(res, 200, savedJobs);
      }

      // POST save a job
      if (req.method === "POST" && url.pathname === "/api/saved") {
        const body = await readBody(req);

        if (
          !body ||
          typeof body.jobId !== "string" ||
          !body.jobId.trim()
        ) {
          return sendJson(res, 400, {
            error: "jobId is required"
          });
        }

        const jobs = await loadJobs(JOBS_PATH);
        const job = findJob(jobs, body.jobId);

        if (!job) {
          return sendJson(res, 404, {
            error: "Job not found"
          });
        }

        const added = await saveJob(body.jobId, savedPath);

        return sendJson(res, added ? 201 : 200, {
          message: added ? "Job saved successfully" : "Job already saved",
          job
        });
      }

      // DELETE a saved job
      if (
        req.method === "DELETE" &&
        url.pathname.startsWith("/api/saved/")
      ) {
        const jobId = decodeURIComponent(
          url.pathname.slice("/api/saved/".length)
        );

        if (!jobId) {
          return sendJson(res, 400, {
            error: "Job ID is required"
          });
        }

        const removed = await removeSavedJob(jobId, savedPath);

        if (!removed) {
          return sendJson(res, 404, {
            error: "Saved job not found"
          });
        }

        return sendJson(res, 200, {
          message: "Job removed successfully"
        });
      }

      // Serve frontend
      if (
        req.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/app.js")
      ) {
        const file = url.pathname === "/" ? "index.html" : "app.js";

        const type = file.endsWith(".html")
          ? "text/html"
          : "text/javascript";

        const body = await readFile(
          new URL(`./public/${file}`, import.meta.url)
        );

        res.writeHead(200, {
          "content-type": `${type}; charset=utf-8`
        });

        return res.end(body);
      }

      return sendJson(res, 404, {
        error: "Not found"
      });

    } catch (err) {
      if (err.status) {
        return sendJson(res, err.status, {
          error: err.message
        });
      }

      console.error(err);

      return sendJson(res, 500, {
        error: "Something went wrong"
      });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
