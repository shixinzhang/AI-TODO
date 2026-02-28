node -e '
const { pipeline, env } = require("@xenova/transformers");
const path = require("path");
// 只配置 host，不配置 template
env.remoteHost = "hf-mirror.com";...
env.allowRemoteModels = true;
async function download() {
  const cacheDir = path.resolve("./models");
  console.log(`Downloading to: ${cacheDir}`);
  await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", {
    cache_dir: cacheDir
  });
  console.log("Download complete!");
}
download().catch(console.error);
'

复制后直接在 terminal 执行，不需要放到  shell 脚本里。

要在 node_modules 同级目录执行。