/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "No circular dependencies allowed.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "client-no-server-import",
      comment: "Client must not import from apps/server/.",
      severity: "error",
      from: { path: "^apps/client/" },
      to: { path: "^apps/server/" },
    },
    {
      name: "server-no-client-import",
      comment: "Server must not import client UI code.",
      severity: "error",
      from: { path: "^apps/server/" },
      to: { path: "^apps/client/" },
    },
    {
      name: "shared-depends-on-nothing-internal",
      comment: "@tavern/shared is the leaf — no internal deps.",
      severity: "error",
      from: { path: "^packages/shared/" },
      to: { path: "^(apps/|packages/(?!shared))" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main"],
    },
    exclude: {
      path: "node_modules|dist|drizzle/|\\.test\\.ts$",
    },
  },
};
