export function getTime(windowOffset) {
  const now = new Date();
  now.setMonth(now.getMonth() - windowOffset); // Subtracts 'windowOffset' months
  now.setDate(1); // Set to the first day of the month
  now.setHours(0, 0, 0, 0); // Set to midnight (00:00:00)
  return now.toISOString(); // Return ISO format string (e.g., '2025-03-01T00:00:00.000Z')
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
      await new Promise(resolve => setTimeout(resolve, delayTime)); // Wait for quota reset

      // After waiting, you can recheck the rate limit
      return await checkQuota(octokit);
    }

    return octokit; // Return the octokit instance if quota is fine
  } catch (error) {
    console.error('Error checking GitHub API rate limit:', error);
    throw error;
  }
}


export async function getBots() {
  // This could be a predefined list or pulled from some other source
  return [
    'dependabot',
    'bot2',
    'bot3',
    // Add more bot usernames here
  ];
}
