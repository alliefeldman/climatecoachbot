module.exports = {
  apps: [
    {
      name: "app",
      script: "app.js",
      watch: true,
      ignore_watch: ["result.json", "state.json"],
    },
  ],
};
