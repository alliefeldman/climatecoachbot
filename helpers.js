import fs from "fs";

export function getTime(weeksAgo, daysAgo) {
  const now = new Date();
  // now.setDate(now.getDate() - (weeksAgo * 7) - daysAgo);
  now.setDate(now.getDate() - weeksAgo * 7);
  now.setDate(now.getDate() - daysAgo);

  now.setHours(0, 0, 0, 0); // Set to midnight (00:00:00)
  return now.toISOString(); // Return ISO format string (e.g., '2025-03-01T00:00:00.000Z')
}
export function loadResultsFromFile(guildId) {
  const resultFile = "result.json";
  if (fs.existsSync(resultFile)) {
    const content = fs.readFileSync(resultFile, "utf-8").trim();
    if (!content) {
      console.log("📂 Result file is empty. Initializing with empty maps.");
      return;
    }
    const data = JSON.parse(content);
    for (const [gid, { lastMetrics, currentMetrics }] of Object.entries(data)) {
      if (gid === guildId) {
        return { lastMetrics, currentMetrics };
      }
    }
    return null;
  }
}

export function plural(word, count) {
  if (count === 1) {
    return word;
  }
  if (word[0] == word[0].toUpperCase()) {
    return word + "S";
  } else {
    return word + "s";
  }
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  const formatted = date.toLocaleDateString("en-US"); // "4/10/2025"
  return formatted;
}

export function capitalizeWords(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function callWithPerspectiveQuotaRetry(fetchFn, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchFn();

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2 ** attempt * 1000 + Math.random() * 500;

        console.warn(
          `Rate limited by Perspective API. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`
        );
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      if (!response.ok) {
        const errorDetails = await response.json();
        throw new Error(
          `Perspective API error: ${response.status} ${response.statusText} -- ${JSON.stringify(errorDetails)}`
        );
      }

      return await response.json(); // Success!
    } catch (error) {
      // Only retry on rate limit; rethrow other errors
      if (error.name === "FetchError" || error.message.includes("rate limit")) {
        console.warn(`Retryable error: ${error.message}`);
      } else {
        throw error;
      }
    }
  }
  console.error("Max retries exceeded for Perspective API call.");
  return null;
}

export async function checkQuota(octokit) {
  try {
    const { data: rateLimitData } = await octokit.rateLimit.get();
    const remaining = rateLimitData.resources.core.remaining;

    if (remaining === 0) {
      const resetTime = rateLimitData.resources.core.reset;
      const resetDate = new Date(resetTime * 1000); // Reset time in milliseconds
      const delayTime = resetDate.getTime() - Date.now(); // Delay until reset time

      console.log(`Rate limit exceeded. Sleeping until ${resetDate}`);
      await new Promise((resolve) => setTimeout(resolve, delayTime)); // Wait for quota reset

      // After waiting, you can recheck the rate limit
      return await checkQuota(octokit);
    }

    return octokit; // Return the octokit instance if quota is fine
  } catch (error) {
    console.error("Error checking GitHub API rate limit:", error);
    throw error;
  }
}

export async function getBots() {
  // This could be a predefined list or pulled from some other source
  return [
    "dependabot",
    "bot2",
    "bot3",
    // Add more bot usernames here
  ];
}
