const list = document.getElementById("jobs");
const search = document.getElementById("search");

const savedList = document.getElementById("saved-jobs");
const savedCount = document.getElementById("saved-count");

// Get saved job IDs from the backend.
async function getSavedIds() {
  const response = await fetch("/api/saved");

  if (!response.ok) {
    throw new Error("Unable to load saved jobs");
  }

  const jobs = await response.json();

  return new Set(jobs.map((job) => job.id));
}

// Create a job card.
function createJobElement(job, isSaved, onSave) {
  const li = document.createElement("li");

  const details = document.createElement("p");

  details.textContent =
    `${job.title} at ${job.company}, ${job.location}. ` +
    `Rs ${job.stipend.toLocaleString("en-IN")} a month.`;

  const button = document.createElement("button");

  button.textContent = isSaved ? "Saved" : "Save";

  button.disabled = isSaved;

  button.addEventListener("click", () => onSave(job.id));

  li.append(details, button);

  return li;
}

// Display all available jobs.
async function show(query = "") {
  try {
    const [jobsResponse, savedIds] = await Promise.all([
      fetch(`/api/jobs?q=${encodeURIComponent(query)}`),
      getSavedIds()
    ]);

    if (!jobsResponse.ok) {
      throw new Error("Unable to load jobs");
    }

    const jobs = await jobsResponse.json();

    list.replaceChildren();

    for (const job of jobs) {
      const li = createJobElement(
        job,
        savedIds.has(job.id),
        save
      );

      list.append(li);
    }
  } catch (error) {
    console.error(error);
    list.textContent = "Unable to load jobs.";
  }
}

// Save a job.
async function save(jobId) {
  try {
    const response = await fetch("/api/saved", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jobId })
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Unable to save job");
    }

    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

// Remove a saved job.
async function remove(jobId) {
  try {
    const response = await fetch(
      `/api/saved/${encodeURIComponent(jobId)}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Unable to remove job");
    }

    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

// Display saved jobs.
async function showSaved() {
  try {
    const response = await fetch("/api/saved");

    if (!response.ok) {
      throw new Error("Unable to load saved jobs");
    }

    const jobs = await response.json();

    savedList.replaceChildren();

    savedCount.textContent = `${jobs.length} saved jobs`;

    for (const job of jobs) {
      const li = document.createElement("li");

      const details = document.createElement("p");

      details.textContent =
        `${job.title} at ${job.company}, ${job.location}.`;

      const button = document.createElement("button");

      button.textContent = "Remove";

      button.addEventListener("click", () => remove(job.id));

      li.append(details, button);

      savedList.append(li);
    }
  } catch (error) {
    console.error(error);
    savedList.textContent = "Unable to load saved jobs.";
  }
}

// Refresh both sections.
async function refresh() {
  await Promise.all([
    show(search.value),
    showSaved()
  ]);
}

// Search jobs.
search.addEventListener("input", () => {
  show(search.value);
});

// Initial page load.
refresh();