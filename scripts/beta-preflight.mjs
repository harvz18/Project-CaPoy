import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { evaluateBetaPreflight, parseEnv } from "./lib/beta-preflight.mjs";

const strict = process.argv.includes("--strict");
const fileArgument = process.argv.find((value) => value.startsWith("--env-file="));
const envPath = path.resolve(fileArgument ? fileArgument.slice("--env-file=".length) : ".env");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
const results = evaluateBetaPreflight({
  env,
  app: readJson("app.json"),
  eas: readJson("eas.json"),
  firebaseRc: readJson(".firebaserc"),
  hasDynamicConfig: fs.existsSync(path.resolve("app.config.js"))
});

for (const item of results) {
  const marker = item.level === "pass" ? "PASS" : item.level === "warn" ? "WARN" : "FAIL";
  console.log(`${marker} ${item.id}: ${item.message}`);
}

const failures = results.filter((item) => item.level === "fail");
const warnings = results.filter((item) => item.level === "warn");
console.log(`Beta preflight summary: ${results.length - failures.length - warnings.length} passed, ${warnings.length} warnings, ${failures.length} failures.`);

if (failures.length || (strict && warnings.length)) {
  process.exitCode = 1;
}
