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

## Installing the Bot

Before installing the bot, you'll need to be the _owner_ of an existing Discord server.

- [Click here to Install](https://discord.com/oauth2/authorize?client_id=1356370768451342427)

- After adding the bot to your server, a private text channel titled `#climatecoach` channel will be created. If you have `diary` enabled (`true` by default) , we would love it if you did NOT invite other users to this channel.


## Developer Setup

1. Create an [Ubuntu Amazon EC2 instance ](https://docs.aws.amazon.com/kinesisvideostreams/latest/dg/gs-ubuntu.html)
2. If you haven’t done so, [configure SSH](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-to-linux-instance.html) on your local device
3. SSH into your newly created EC2 instance
4. Once connected to your instance in and Ubuntu container, clone the repo
5. Create Discord App [here[(https://discord.com/developers/applications?new_application=true)
    1. Save `APP_ID` and `DISCORD_TOKEN` in `.env`
6. Create a [Github OAuth App](https://github.com/settings/applications/new)
    1. Set the `Authorization callback URL` to: `http://<YOUR_EC2_PUBLIC_IPV4_DNS>/callback`
    2. In `./app.js`, update `REDIRECT_URI` on line 127 to this URL as well
    3. Save your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET; in `.env`
7. Setup the [Perspective API](https://developers.google.com/codelabs/setup-perspective-api#0) by requesting access
    1. Once approved, save the key as GOOGLEAPIKEY in `.env`
8. To collect diary study data from users, setup the [Google Sheets API[(https://developers.google.com/workspace/sheets/api/reference/rest) by creating a_ Service Account _
    1. Save your credentials file (name it `google-credentials.json`) to the root of the project
    2. Create a new Google Sheets file on Google Drive and share it with the email address associated with your service account
    3. In `./googe-sheets.js`, update `spreadsheetId` on line 12 to connect the api to your spreadsheet
		For instance: https://docs.google.com/spreadsheets/d/	1GhhRSIc5Mre_6JL7sSUMRozMBCHjM537er5dtsfAq84/edit?gid=0#gid=0
9. Run `npm install`
10. Running the application with [PM2](https://pm2.keymetrics.io/):
    - To configure the application to run even when not connected locally to your EC2, run `pm2 save` and then `pm2 restart app.js`
    - To see live updates as you develop (not recommended for long term), run `pm2 start app.js —watch`
