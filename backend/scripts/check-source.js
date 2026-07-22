const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const SOURCE_ROOTS = ["config", "migrations", "scripts", "src", "test"];

function findJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findJavaScriptFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path);
    }
  }

  return files;
}

const files = SOURCE_ROOTS.flatMap(findJavaScriptFiles).sort();
let failures = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`Syntax checked ${files.length} backend JavaScript files`);
}
