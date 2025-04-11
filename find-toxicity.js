import { Octokit } from "@octokit/rest";
import "dotenv/config";
import { checkQuota } from "./helpers.js";

const GOOGLEAPIKEY = process.env.PERS_API_KEY;

const perspectiveUrl = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${GOOGLEAPIKEY}`;

async function getPerspectiveScore(text) {
  let toxic = null;
  let attack = null;

  const dataDict = {
    "comment": {
      "text": text
    },
    "requestedAttributes": {
      "TOXICITY": {},
      "IDENTITY_ATTACK": {}
    }
  };

  try {
    const perspectiveResponse = await fetch(perspectiveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataDict)
    });

    const perspectiveData = await perspectiveResponse.json();
    toxic = perspectiveData?.attributeScores?.TOXICITY?.summaryScore?.value;
    attack = perspectiveData?.attributeScores?.IDENTITY_ATTACK?.summaryScore?.value;
  } catch {
    console.error("Error calling Perspective API:", error);

  }

  return { toxic, attack };


}


const TOXIC_THRES = 0.1; // make higher of course

export async function findToxicity(repo, recentDiscussions, since, end) {
  let octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const toxicConvos = new Set();
  const toxicComments = [];
  // let negativeSentimentConvos = [];

  let maxToxicity = null;
  // let maxAttack = 0;

  // const currentConvos = convos.filter(convo => {
  //   const createdAt = convo.created_at;
  //   return createdAt >= since && createdAt < end;
  // })

  for (let discussion of recentDiscussions) {
    await checkQuota(octokit);

    const issue_number = discussion?.number; // Unique ID for PR or Issue
    // go through their comments and see if > 1 is toxic
    const comments = (await octokit.issues.listComments({
      owner: repo.data.owner.login,
      repo: repo.data.name,
      issue_number: issue_number
    })).data;

    for (let comment of comments) {
      const { toxic: toxic, attack: attack } = await getPerspectiveScore(comment.body);


      const isToxic = toxic >= TOXIC_THRES;

      const createdAt = comment.created_at;
      const isRecent = createdAt >= since && createdAt < end;

      if (isToxic) {
        // Check if issue is in 
        if (!(toxicConvos.has(discussion))) {
          toxicConvos.add(discussion);
        }
      }
      if (isRecent) {
        if (!maxToxicity || (maxToxicity && toxic > maxToxicity)) {
          maxToxicity = toxic;
        }
      }

      if (isRecent && isToxic) {
        toxicComments.push(comment);
      }

    }
  }
  const toxicConvosArray = [...toxicConvos];
  return {
    toxicConvosArray,
    toxicComments,
    // attackComments,
    maxToxicity, // max toxicity is as of now, max toxicity for 
    // maxAttack,
    // negativeSentimentConvos
  }


}