import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findJob,
  loadJobs,
  searchJobs
} from "../lib/jobs.js";

import {
  getSavedIds,
  saveJob,
  removeSavedJob
} from "../lib/saved.js";

import { createApp } from "../server.js";

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Original starter tests

test("loads the jobs file", async () => {
  const jobs = await loadJobs();

  assert.ok(jobs.length >= 8);
  assert.ok(jobs.every((j) => j.id && j.title));
});

test("search matches title, company and place, ignoring case", async () => {
  const jobs = await loadJobs();

  assert.equal(searchJobs(jobs, "intern").length, jobs.length);

  assert.deepEqual(
    searchJobs(jobs, "REMOTE").map((j) => j.id),
    ["j1", "j3", "j6", "j8"]
  );

  assert.deepEqual(
    searchJobs(jobs, "kosha").map((j) => j.id),
    ["j4"]
  );

  assert.equal(searchJobs(jobs, "").length, jobs.length);
});

test("findJob returns null for an unknown id", async () => {
  const jobs = await loadJobs();

  assert.equal(findJob(jobs, "j2").company, "Kite Learning");
  assert.equal(findJob(jobs, "nope"), null);
});

// Helper for temporary storage

async function createTempDirectory() {
  return mkdtemp(join(tmpdir(), "job-board-test-"));
}

// Saved jobs storage tests

test("saved jobs initially return an empty array", async () => {
  const dir = await createTempDirectory();

  try {
    const path = join(dir, "saved-jobs.json");

    assert.deepEqual(await getSavedIds(path), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saves a job ID", async () => {
  const dir = await createTempDirectory();

  try {
    const path = join(dir, "saved-jobs.json");

    const added = await saveJob("j1", path);

    assert.equal(added, true);
    assert.deepEqual(await getSavedIds(path), ["j1"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("does not save duplicate jobs", async () => {
  const dir = await createTempDirectory();

  try {
    const path = join(dir, "saved-jobs.json");

    await saveJob("j1", path);
    const addedAgain = await saveJob("j1", path);

    assert.equal(addedAgain, false);
    assert.deepEqual(await getSavedIds(path), ["j1"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("removes a saved job", async () => {
  const dir = await createTempDirectory();

  try {
    const path = join(dir, "saved-jobs.json");

    await saveJob("j1", path);
    const removed = await removeSavedJob("j1", path);

    assert.equal(removed, true);
    assert.deepEqual(await getSavedIds(path), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("returns false when removing an unsaved job", async () => {
  const dir = await createTempDirectory();

  try {
    const path = join(dir, "saved-jobs.json");

    const removed = await removeSavedJob("j1", path);

    assert.equal(removed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// API integration tests

test("saved jobs API supports saving, listing and removing jobs", async () => {
  const dir = await createTempDirectory();
  const savedPath = join(dir, "saved-jobs.json");

  const server = createApp({ savedPath });

  try {
    await new Promise((resolve) => server.listen(0, resolve));

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // Initially empty
    let response = await fetch(`${baseUrl}/api/saved`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);

    // Save a valid job
    response = await fetch(`${baseUrl}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "j1" })
    });

    assert.equal(response.status, 201);

    // Save the same job again
    response = await fetch(`${baseUrl}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "j1" })
    });

    assert.equal(response.status, 200);

    // Retrieve saved jobs
    response = await fetch(`${baseUrl}/api/saved`);

    const jobs = await response.json();

    assert.equal(response.status, 200);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, "j1");

    // Remove the saved job
    response = await fetch(`${baseUrl}/api/saved/j1`, {
      method: "DELETE"
    });

    assert.equal(response.status, 200);

    // Confirm removal
    response = await fetch(`${baseUrl}/api/saved`);

    assert.deepEqual(await response.json(), []);

    // Unknown job ID
    response = await fetch(`${baseUrl}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "unknown" })
    });

    assert.equal(response.status, 404);

    // Invalid request
    response = await fetch(`${baseUrl}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 400);

  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });

    await rm(dir, { recursive: true, force: true });
  }
});

// Persistence test

test("saved jobs remain available after restarting the server", async () => {
  const dir = await createTempDirectory();
  const savedPath = join(dir, "saved-jobs.json");

  try {
    const firstServer = createApp({ savedPath });

    await new Promise((resolve) => firstServer.listen(0, resolve));

    const firstUrl =
      `http://127.0.0.1:${firstServer.address().port}`;

    await fetch(`${firstUrl}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "j1" })
    });

    await new Promise((resolve) => firstServer.close(resolve));

    // Start a new server using the same JSON file.
    const secondServer = createApp({ savedPath });

    try {
      await new Promise((resolve) => secondServer.listen(0, resolve));

      const secondUrl =
        `http://127.0.0.1:${secondServer.address().port}`;

      const response = await fetch(`${secondUrl}/api/saved`);

      const jobs = await response.json();

      assert.equal(response.status, 200);
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].id, "j1");

      // Also confirm the actual file was written.
      const storedIds = JSON.parse(
        await readFile(savedPath, "utf8")
      );

      assert.deepEqual(storedIds, ["j1"]);

    } finally {
      await new Promise((resolve, reject) => {
        secondServer.close((error) => error ? reject(error) : resolve());
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});