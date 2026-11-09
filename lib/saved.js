import { readFile, writeFile, rename } from "node:fs/promises";

async function readSavedIds(path) {
  try {
    const data = await readFile(path, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// Serialize file modifications to prevent concurrent requests
// from overwriting each other's changes.
let writeQueue = Promise.resolve();

function updateSavedIds(path, update) {
  const operation = writeQueue.then(async () => {
    const ids = await readSavedIds(path);
    const result = update(ids);

    const tempPath = `${path}.${process.pid}.tmp`;

    await writeFile(tempPath, JSON.stringify(ids, null, 2));
    await rename(tempPath, path);

    return result;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

// Get all saved job IDs.
export async function getSavedIds(path) {
  return readSavedIds(path);
}

// Save a job ID. Avoid duplicates.
export async function saveJob(id, path) {
  return updateSavedIds(path, (ids) => {
    if (ids.includes(id)) {
      return false;
    }

    ids.push(id);
    return true;
  });
}

// Remove a saved job.
export async function removeSavedJob(id, path) {
  return updateSavedIds(path, (ids) => {
    const index = ids.indexOf(id);

    if (index === -1) {
      return false;
    }

    ids.splice(index, 1);
    return true;
  });
}