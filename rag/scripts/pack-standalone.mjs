#!/usr/bin/env node
/**
 * 打包 standalone 构建产物，供 Linux 部署。
 * 使用方式：先 npm run build，再 npm run pack:standalone
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standaloneRoot = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneRoot)) {
  console.error("未找到 .next/standalone，请先执行: npm run build");
  process.exit(1);
}

// 在 standalone 下递归查找 server.js（跳过 node_modules，只取项目根目录的 server.js）
function findServerDir(dir, base = "") {
  const entries = fs.readdirSync(path.join(dir, base), { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isFile() && e.name === "server.js") return path.join(dir, base);
    if (e.isDirectory() && e.name !== "node_modules") {
      const found = findServerDir(dir, rel);
      if (found) return found;
    }
  }
  return null;
}

const innerDir = findServerDir(standaloneRoot);
if (!innerDir) {
  console.error("未在 .next/standalone 中找到 server.js");
  process.exit(1);
}

const deployDir = path.join(root, "dist-standalone");
const nextStatic = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

// 清理并创建 dist-standalone
if (fs.existsSync(deployDir)) fs.rmSync(deployDir, { recursive: true });
fs.mkdirSync(deployDir, { recursive: true });

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyRecursive(s, d);
    } else {
      // 只复制普通文件，跳过 socket/symlink 等（避免 ENOTSUP）
      try {
        if (fs.statSync(s).isFile()) fs.copyFileSync(s, d);
      } catch (_) {}
    }
  }
}

console.log("复制 standalone 产物...");
copyRecursive(innerDir, deployDir);

// 从源目录读取 package.json，写入 start 脚本后写到产物目录（保证产物必有 package.json）
const srcPkgPath = path.join(innerDir, "package.json");
const dstPkgPath = path.join(deployDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(srcPkgPath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts.start = "node server.js";
fs.writeFileSync(dstPkgPath, JSON.stringify(pkg, null, 2), "utf8");

console.log("复制 .next/static...");
fs.mkdirSync(path.join(deployDir, ".next"), { recursive: true });
copyRecursive(nextStatic, path.join(deployDir, ".next", "static"));

if (fs.existsSync(publicDir)) {
  console.log("复制 public...");
  copyRecursive(publicDir, path.join(deployDir, "public"));
}

// 写入 start.sh：先 cd 到本目录再启动，避免「没有在项目目录中找到 package.json」
const startSh = `#!/bin/bash
cd "$(dirname "$0")"
exec node server.js "$@"
`;
fs.writeFileSync(path.join(deployDir, "start.sh"), startSh, "utf8");
fs.chmodSync(path.join(deployDir, "start.sh"), 0o755);

const tarName = path.join(root, "rag-standalone.tar.gz");
if (fs.existsSync(tarName)) fs.unlinkSync(tarName);
console.log("打包 rag-standalone.tar.gz...");
execSync(`tar -czf "${tarName}" -C "${root}" dist-standalone`, {
  stdio: "inherit",
});

console.log("完成:");
console.log("  目录: dist-standalone/");
console.log("  压缩包: rag-standalone.tar.gz");
