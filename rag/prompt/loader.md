请帮我生成 `rag/src/lib/rag.ts` 文件的基础代码，主要实现 RAG 引擎的初始化和文档入库功能。

1. 基础依赖与环境
*   引入 LangChain 核心 (`@langchain/openai`, `@langchain/core`, `@langchain/textsplitters`)。
*   引入向量库适配器 (`@langchain/community/vectorstores/milvus`, `@langchain/classic/vectorstores/memory`)。
*   引入文档加载器 (`CSVLoader`, `PDFLoader`, `WebPDFLoader`)。
*   引入本地模型支持 (`@xenova/transformers`, `@langchain/community/embeddings/huggingface_transformers`)。
*   全局配置：强制设置 `transformers.js` 使用本地模型目录 (`项目根目录/models`)，禁止远程下载。

2. 核心类：LocalHuggingFaceEmbeddings
*   继承自 `Embeddings`。目的是为了完全控制底层 transformers.js 的 pipeline 参数（如 cache_dir, quantized）
*   实现 `embedDocuments` 和 `embedQuery` 方法。
*   使用 `@xenova/transformers` 的 `pipeline` 进行特征提取 (`feature-extraction`)，需开启 `quantized: true`。
*   核心代码：
      // 创建 feature-extraction 管道，用于生成文本向量
      this.pipeline = await pipeline("feature-extraction", this.model, {
        cache_dir: this.cacheDir, // 关键：指定本地缓存目录
        quantized: true,          // 开启量化，减少内存占用，提升速度（精度略有损失但通常可接受）
      });

3. 核心类：RAGEngine
请实现 `RAGEngine` 类，包含以下核心逻辑：

*   属性：
    *   `vectorStore`: 支持 `Milvus` 或 `MemoryVectorStore`。
    *   `embeddings`: 自定义 Embedding 实例。
    *   `isMemoryStore`: 标记当前是否降级为内存模式。

*   构造函数 (Constructor)：
    *   初始化 `LocalHuggingFaceEmbeddings`（模型使用 `Xenova/bge-small-zh-v1.5`）。
    *   初始化 `ChatOpenAI`，模型使用 `doubao-seed-1-6-flash-250828`，baseURL 使用：https://sg.uiuiapi.com/v1

*   初始化方法 (init)：
    *   尝试连接本地 Milvus (`Milvus.fromExistingCollection`)。
    *   关键逻辑：如果连接失败，自动捕获异常，打印警告，并将 `isMemoryStore` 标记为 `true`，后续操作将降级使用内存向量库。

*   文档处理方法 (addDocument)：
    这是核心功能，需包含完整 ETL 流程：
    1.  Load: 根据文件后缀 (.csv, .pdf, .txt) 自动选择合适的 Loader 加载文件 buffer。
    2.  Split: 使用 `RecursiveCharacterTextSplitter` 切分文档 (chunkSize: 800)。
    3.  Embed & Store:
        *   如果 `vectorStore` 尚未创建：
            *   若 `isMemoryStore=false`，尝试创建 Milvus 集合 (`Milvus.fromDocuments`)。
            *   如果 Milvus 创建失败，自动回退到 `MemoryVectorStore` 并更新标记。
        *   如果 `vectorStore` 已存在，直接调用 `addDocuments` 追加数据。

4. 单例导出
*   实现 `getRAGEngine()` 单例模式，使用 `global` 对象防止开发环境热重载导致状态丢失。

请生成包含上述逻辑的完整 TypeScript 代码，并添加必要的 `console.log` 以便调试。