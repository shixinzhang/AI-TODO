请帮我初始化一个 Next.js 项目，项目名为 `rag`，使用 TypeScript 和 Tailwind CSS。
然后，请帮我安装以下 RAG 相关的依赖库：
1.  **LangChain 生态**：`@langchain/core`, `@langchain/community`, `@langchain/openai`, `@langchain/classic`, `@langchain/textsplitters`, `@langchain/cohere`, `langchain`
2.  **本地模型与向量**：`@xenova/transformers`, `@huggingface/transformers`
3.  **向量数据库**：`@zilliz/milvus2-sdk-node`, `chromadb`
4.  **工具库**：`lucide-react` (UI图标), `pdf-parse` & `pdfjs-dist` (PDF解析), `pdfkit` (PDF生成), `cheerio` (爬虫), `d3-dsv` (CSV处理)
项目的核心结构如下（先创建文件，不需要具体实现）：
rag/
├── demo-data/              # [数据层] 存放原始数据文件
│   ├── products.csv        # 商品表 (结构化)
│   └── refund_policy.md    # 售后政策 (非结构化)
├── src/
│   ├── app/
│   │   ├── api/            # [后端层] API 路由
│   │   │   ├── chat/       # 聊天接口
│   │   │   └── rag-demo/   # 演示接口 (用于调试各阶段)
│   │   ├── page.tsx        # [前端层] 最终的客服聊天界面
│   │   └── rag-demo/       # [前端层] RAG 流程演示界面
│   └── lib/
│       └── rag.ts          # [核心层] RAG 引擎单例 (连接 Milvus, LLM)
此外，请安装 Milvus 数据库，通过非 Docker 方式安装。
最后，请帮我创建一个 `.env.local` 文件，并预留 `DEEPSEEK_API_KEY` 的位置。
