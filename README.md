# Climate Coach (Bot)

### Created by [HCII](https://hcii.cmu.edu/) students Alec Chen, Allison Feldman, Ethan Huang, Anika Ramachandran, and Amanda Zhu

This project contains the final prototype code for an undergraduate HCI capstone project.

## What is Climate Coach (or at least this prorotype)?

The Climate Coach prototype is Discord Bot that can send automated community health reports to OSS project maintainters. Additionally, the Bot is configured with a `diary` spec which can be used to collect data on _actionability_.

### All included indicators were inspired by the original _Climate Coach_ Prototype and paper.

> You can read the original _Climate Coach_ Paper [here](https://cmustrudel.github.io/papers/chi23_626.pdf).

> The original _Dashboard_ Prototype can be found [here](https://www.sophiehsqq.com/climate_coach/index_id.html)

## Project structure

Below is a basic overview of the project structure:

```
├── app.js                      -> main entrypoint for app
├── calculate_metrics           -> retrieves and aggregated repo metrics
├── app.js                      -> main entrypoint for app
├── embed.js                    -> renders report message embeds slash command payloads + helpers
├── find_toxicity.js            -> helper function that returns toxic convos
├── generate-report-message.js  -> renders report in channel
├── get-metric-trends.js        -> helper that determines the change ratio for each metric
├── github-helpers.js           -> functions that fetch repository data from Github
├── helpers.js
├── package-lock.json
├── package.json
├── README.md
└── .gitignore
```

## Instaling the Bot

Before installing the bot, you'll need to be the _owner_ of an existing Discord server.

- [Click here to Install](https://discord.com/oauth2/authorize?client_id=1356370768451342427)

- After adding the bot to your server, a private text channel titled `#climatecoach` channel will be created. If you have `diary` enabled (`true` by default) , we would love it if you did NOT invite other users to this channel.
