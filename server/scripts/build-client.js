const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const npmCmd = "npm";

const candidateDirs = [
  path.resolve(__dirname, "../../client"),
  path.resolve(process.cwd(), "client"),
  path.resolve(process.cwd(), "../client"),
];

const clientDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, "package.json")));

if (!clientDir) {
  console.log("[build:client] client package not found in this deploy context; skipping frontend build.");
  process.exit(0);
}

const run = (args) => {
  const result = spawnSync(npmCmd, args, {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    console.error("[build:client] failed to execute npm:", result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

console.log(`[build:client] using client path: ${clientDir}`);
const clientPrefix = path.relative(process.cwd(), clientDir) || ".";
run(["install", "--prefix", clientPrefix]);
run(["run", "build", "--prefix", clientPrefix]);
