import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const hqRoot = join(root, "..");
const crmRoot = join(hqRoot, "crm");
const distDir = join(crmRoot, "dist");
const targetDir = join(hqRoot, "public", "sales");

if (!existsSync(crmRoot)) {
  console.error(`Sales OS not found at: ${crmRoot}`);
  process.exit(1);
}

console.log("Building Commercial Sales OS…");
const build = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  { cwd: crmRoot, stdio: "inherit", shell: true },
);

if (build.status !== 0) {
  console.error("Sales OS build failed.");
  process.exit(build.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error(`Missing build output: ${distDir}`);
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(dirname(targetDir), { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

console.log(`Synced Sales OS → ${targetDir}`);
console.log("Open http://localhost:3000/sales/ after starting HQ.");
