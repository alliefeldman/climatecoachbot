import { Octokit } from "@octokit/rest";
import "dotenv/config";
import { checkQuota, callWithPerspectiveQuotaRetry } from "./helpers.js";

const GOOGLEAPIKEY = process.env.PERS_API_KEY;

const TOXIC_THRES = 0.1; // make higher

async function getPerspectiveScore(text) {
  let toxic = null;
  let attack = null;
  const perspectiveUrl = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${GOOGLEAPIKEY}`;

  const dataDict = {
    comment: {
      text: text,
    },
    requestedAttributes: {
      TOXICITY: {},
      IDENTITY_ATTACK: {},
    },
    languages: ["en"],
  };

  try {
    const perspectiveResponse = await callWithPerspectiveQuotaRetry(() =>
      fetch(perspectiveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataDict),
      })
    );

    toxic = perspectiveResponse?.attributeScores?.TOXICITY?.summaryScore?.value;
    attack = perspectiveResponse?.attributeScores?.IDENTITY_ATTACK?.summaryScore?.value;
  } catch (error) {
    console.log("dataDict before error: ", dataDict);
    console.error("Error calling Perspective API:", error);
  }

  return { toxic, attack };
}
function extractActualComment(body) {
  // Remove content inside <table> tags and the tags themselves
  body = body.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, "");

  // Process the remaining content
  return body
    .split("\n") // Break into lines
    .filter((line) => !line.trim().startsWith(">")) // Remove blockquotes (lines starting with >)
    .map((line) => line.trim()) // Clean up spacing
    .filter(Boolean) // Remove empty lines
    .join("\n"); // Join back into a string
}

export async function findToxicity(repo, comments, since, end) {
  //swap recentDiscussions with comments
  let octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const toxicConvoNumbers = new Set();
  const toxicComments = [];

  const toxicConvos = new Set();
  // let negativeSentimentConvos = [];

  let maxToxicity = null;
  let isPR = false;
  // let maxAttack = 0;

  for (let comment of comments) {
    const shortenedCommentBody = extractActualComment(comment.body).slice(0, 20000);
    // console.log("shortened comment body: ", shortenedCommentBody);
    if (isPR === false && comment?.issue_url == null) {
      isPR = true; // Check if the comment is from a PR
    }
    const convoNumber = isPR ? comment.pull_request_url?.split("/").pop() : comment?.issue_url?.split("/").pop(); // Extract issue number from URL
    if (toxicConvoNumbers.has(convoNumber)) {
      continue; // Skip if already processed
    }
    const { toxic: toxic, attack: attack } = await getPerspectiveScore(shortenedCommentBody);
    const isToxic = (await toxic) && toxic >= TOXIC_THRES;
    if (isToxic) {
      toxicConvoNumbers.add(convoNumber);
    }
  }
  for (let convoNumber of [...toxicConvoNumbers]) {
    await checkQuota(octokit);
    let convoObject;
    if (isPR) {
      console.log("is PR");
      console.log("convoNumber: ", convoNumber);
    }

    convoObject = await octokit.issues.get({
      owner: repo.data.owner.login,
      repo: repo.data.name,
      issue_number: convoNumber,
    });

    toxicConvos.add(convoObject.data);
  }

  const toxicConvosArray = [...toxicConvos];

  return {
    toxicConvos: toxicConvosArray,
    toxicComments,
    // attackComments,
    maxToxicity, // max toxicity is as of now, max toxicity for
    // maxAttack,
    // negativeSentimentConvos
  };
}
