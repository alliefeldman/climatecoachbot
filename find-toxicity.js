
const TOXIC_THRES = 0.4;

export async function findToxicity(repo, convos, since, end, octokit) {
  let toxicConvos = [];
  let negativeSentimentConvos = [];

  const currentConvos = convos.filter(convo => {
    const createdAt = convo.created_at;
    return createdAt >= since && createdAt < end;
  })

  let toxicComments = [];
  let attackComments = [];

  for (const convo of currentConvos) {
    const issue = repo.getIssue(conv["number"]);

    const comments = issue.getComments();

    for (const comment of comments) {
      const { toxic, attack } = getPerspectiveScore(comment.body);
      toxicComments.append(toxic);
      attackComments.append(toxic);

      if (toxic > TOXIC_THRES || attack > TOXIC_THRES) {
        toxicConvos.append({
          "title": issue.title,
          "link": issue.html_url
        })
      }
    }
  }

  return {
    "toxic_convos": toxicConvos,
    "max_toxic": max_toxic,
    "max_attack": max_attack,
    "neg_senti": negativeSentimentConvos
  }


}