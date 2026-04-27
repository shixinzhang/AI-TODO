import fs from "fs/promises";
import path from "path";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/repair-article-md.js <file-or-dir>");
  process.exit(1);
}

const abs = path.resolve(target);
const stat = await fs.stat(abs);
const files = [];

if (stat.isDirectory()) {
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (ent.name.toLowerCase() !== "article.md") continue;
    files.push(path.join(abs, ent.name));
  }
} else {
  files.push(abs);
}

let changed = 0;
for (const file of files) {
  const before = await fs.readFile(file, "utf8");
  const after = stripOuterMarkdownFence(before);
  if (after !== before) {
    await fs.writeFile(file, after.endsWith("\n") ? after : `${after}\n`, "utf8");
    changed += 1;
    console.log(`fixed ${file}`);
  }
}

console.log(`done. changed=${changed}`);

function stripOuterMarkdownFence(text) {
  if (typeof text !== "string") return "";
  const trimmedStart = text.trimStart();
  if (!trimmedStart.startsWith("```")) return text;
  const firstNewline = trimmedStart.indexOf("\n");
  if (firstNewline === -1) return text;
  const closeIdx = trimmedStart.lastIndexOf("\n```");
  if (closeIdx === -1 || closeIdx <= firstNewline) return text;
  const inner = trimmedStart.slice(firstNewline + 1, closeIdx);
  const after = trimmedStart.slice(closeIdx + "\n```".length);
  return `${inner}${after}`.trimEnd();
}

