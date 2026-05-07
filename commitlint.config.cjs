module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "catalog",
        "search",
        "embeddings",
        "tales",
        "scenes",
        "narrator",
        "beats",
        "settings",
        "shared",
        "client",
        "server",
        "polish",
        "build",
        "ci",
        "deps",
        "docs",
      ],
    ],
  },
};
