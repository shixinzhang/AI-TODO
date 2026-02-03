# RAG 项目 Linux 部署说明（Standalone）

## 一、本地构建与打包

在项目根目录（rag/）执行：

```bash
npm run build          # 已配置 output: "standalone"
npm run pack:standalone # 生成 dist-standalone/ 并打 tar 包
```

生成物：

- **dist-standalone/**：可直接在 Linux 上运行的目录
- **rag-standalone.tar.gz**：压缩包，便于上传服务器

## 二、上传到 Linux 服务器

```bash
scp rag-standalone.tar.gz user@your-server:/opt/
# 或使用 rsync 上传 dist-standalone 目录
```

在服务器上解压：

```bash
cd /opt && tar -xzf rag-standalone.tar.gz && cd dist-standalone
```

## 三、在 Linux 上运行

**环境要求**：Node.js 18+（建议 20 LTS）

**重要**：必须用 **`node server.js`** 启动（即 `npm start` 或 `./start.sh`），**不要**在部署目录里执行 `next start`，否则会报 "Couldn't find any pages or app directory"。

**启动命令**：产物的 `package.json` 已包含 `scripts.start = "node server.js"`，在解压后的目录内执行：

```bash
cd /opt/dist-standalone   # 或你解压后的目录
npm start
```

等价于 `node server.js`，且 cwd 自动为当前目录，不会报「没有在项目目录中找到 package.json」。

也可用自带脚本（同上效果）：

```bash
cd /opt/dist-standalone
./start.sh
```

默认监听 **4000** 端口（与本地开发一致）。指定其他端口：

```bash
PORT=4000 npm start
# 或
PORT=4000 ./start.sh
```

## 四、生产环境建议

1. **进程守护**：用 systemd 或 pm2 管理 `node server.js`
2. **反向代理**：用 Nginx 做反向代理，配置 HTTPS
3. **环境变量**：在服务器上配置 `.env` 或 `export`（如向量库、API Key 等），不要提交到仓库
4. **数据目录**：如需 Chroma/Milvus 等，在服务器上单独建目录并挂载或配置路径

### systemd 示例

`/etc/systemd/system/rag.service`：

```ini
[Unit]
Description=RAG Next.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/dist-standalone
Environment=PORT=4000
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

然后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable rag
sudo systemctl start rag
```

## 五、常见错误

### "Couldn't find any `pages` or `app` directory"

**原因**：在 **standalone 部署** 下执行了 `next start`，而 standalone 产物里没有源码的 `app`/`pages` 目录（已打进 `server.js`），所以会报错。

**正确做法**：

- 部署时使用 **打包好的 dist-standalone**（或解压后的目录），在**该目录内**执行：
  ```bash
  npm start
  # 或
  ./start.sh
  ```
  两者都会运行 `node server.js`，这是 standalone 唯一正确的启动方式。

- **不要**在服务器上对源码执行 `npm run build` 后再 `npm start`（那样会跑 `next start`）。要么：
  - 在本地/CI 执行 `npm run build` → `npm run pack:standalone`，把生成的 `dist-standalone` 或 `rag-standalone.tar.gz` 上传到服务器，在解压后的目录里执行 `npm start` 或 `./start.sh`；要么
  - 在服务器上保留**完整源码**（含 `src/app`），再执行 `npm run build` 和 `npm start`（此时 `next start` 能正确找到 `src/app`）。

- 若必须用端口 4000：
  ```bash
  PORT=4000 npm start
  # 或
  PORT=4000 ./start.sh
  ```

## 六、目录结构（dist-standalone）

```
dist-standalone/
├── package.json       # 含 scripts.start = "node server.js"，用 npm start 启动
├── server.js          # 入口
├── start.sh           # 可选：./start.sh 等价 npm start
├── .next/
│   └── static/        # 静态资源
├── public/            # 静态文件
├── node_modules/      # standalone 依赖（已精简）
├── demo-data/         # 示例数据（按需保留或删除）
├── models/            # 嵌入模型等（按需保留）
```
