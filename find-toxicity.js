
const TOXIC_THRES = 0.4;

export async function findToxicity(repo, commentsInCurrentWindow, allDiscussions, since, end) {
  let toxicConvos = [];
  let negativeSentimentConvos = [];

  // const currentConvos = convos.filter(convo => {
  //   const createdAt = convo.created_at;
  //   return createdAt >= since && createdAt < end;
  // })
  const convoIds = commentsInCurrentWindow.map(comment => comment.issue_url);
  const relevantConvos = allDiscussions.filter(discussion => {
    return convoIds.includes(discussion.url);
  })
  console.log("relevant convos", relevantConvos.length);

  let toxicComments = [];
  let attackComments = [];

  for (const convo of relevantConvos) {

    console.log("the convo?", convo);

    const issue = repo.getIssue(convo["number"]);


    const comments = convo.getComments();
    console.log("we got here yay");

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
    toxicConvos,
    max_toxic,
    max_attack,
    negativeSentimentConvos
  }


}