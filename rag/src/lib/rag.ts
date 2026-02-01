import { ChatOpenAI } from "@langchain/openai";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
// 引入 transformers.js 的 env 配置，用于直接控制环境（如本地模型路径、是否允许远程下载）
import { env } from "@xenova/transformers";
import path from "path";
import fs from "fs";

// 1. 全局配置 transformers.js 环境
// 强制指向项目根目录下的 models 文件夹，并禁止远程下载，解决连接 HuggingFace 超时的问题
const projectRoot = process.cwd();
const modelsPath = path.resolve(projectRoot, "models");
env.localModelPath = modelsPath;
env.allowRemoteModels = false; // 禁止联网下载，强制使用本地模型
env.allowLocalModels = true;   // 允许加载本地模型

console.log("[RAG Config] 项目根目录:", projectRoot);
console.log("[RAG Config] 模型目录:", modelsPath);
console.log("[RAG Config] 检查模型文件是否存在:", fs.existsSync(path.join(modelsPath, "Xenova", "bge-small-zh-v1.5")));

// 配置信息
const MILVUS_CONFIG = {
  collectionName: "teacher_profiles", // 向量数据库中的集合名称（类似于关系型数据库的表名）
  clientConfig: {
    address: process.env.MILVUS_ADDRESS || "localhost:19530", // Milvus 连接地址
  },
};

const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://sg.uiuiapi.com/v1", // DeepSeek 或兼容 OpenAI 协议的 API 地址
};

// 单例模式：避免在开发环境热重载时重复加载模型，节省内存和时间
let ragPromise: Promise<RAGEngine> | null = null;

import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@xenova/transformers";

// 2. 自定义 Embeddings 类
// 继承 LangChain 的 Embeddings 基类，自己实现 embedding 逻辑
// 目的是为了完全控制底层 transformers.js 的 pipeline 参数（如 cache_dir, quantized）
class LocalHuggingFaceEmbeddings extends Embeddings {
  private pipeline: any;
  private model: string;
  private cacheDir: string;

  constructor(fields: { model: string; cacheDir: string }) {
    super({});
    this.model = fields.model;
    this.cacheDir = fields.cacheDir;
  }

  // 初始化 pipeline，这是耗时操作，只会执行一次
  async _initPipeline() {
    if (!this.pipeline) {
      // 创建 feature-extraction 管道，用于生成文本向量
      this.pipeline = await pipeline("feature-extraction", this.model, {
        cache_dir: this.cacheDir, // 关键：指定本地缓存目录
        quantized: true,          // 开启量化，减少内存占用，提升速度（精度略有损失但通常可接受）
      });
    }
  }

  // 核心方法：将文档列表转换为向量数组
  async embedDocuments(documents: string[]): Promise<number[][]> {
    console.log(`[Embeddings] 正在向量化 ${documents.length} 个文档片段...`);
    await this._initPipeline();
    const results: number[][] = [];
    for (const doc of documents) {
      // 调用 pipeline 生成 embedding
      // pooling: "mean" 表示对所有 token 的向量求平均值作为句向量
      // normalize: true 表示归一化向量，方便计算余弦相似度
      // @ts-ignore
      const output = await this.pipeline(doc, { pooling: "mean", normalize: true });
      results.push(Array.from(output.data) as number[]);
    }
    console.log(`[Embeddings] 成功完成向量化。`);
    return results;
  }

  // 核心方法：将用户查询（Query）转换为向量
  async embedQuery(document: string): Promise<number[]> {
    console.log(`[Embeddings] 正在向量化查询: "${document.substring(0, 50)}${document.length > 50 ? '...' : ''}"`);
    await this._initPipeline();
    // @ts-ignore
    const output = await this.pipeline(document, { pooling: "mean", normalize: true });
    console.log(`[Embeddings] 查询向量生成完毕 (维度: ${output.data.length})`);
    return Array.from(output.data) as number[];
  }
}

export class RAGEngine {
  private vectorStore: Milvus | null = null;
  private embeddings: LocalHuggingFaceEmbeddings;
  private llm: ChatOpenAI;

  constructor() {
    console.log("[RAG Constructor] 正在初始化 RAG 引擎...");
    if (!DEEPSEEK_CONFIG.apiKey) {
        throw new Error("环境变量中未设置 DEEPSEEK_API_KEY。");
    }

    // 初始化 Embeddings 模型
    // 使用本地下载好的 Xenova/bge-small-zh-v1.5 模型（中文效果好）
    console.log("[RAG Constructor] 正在初始化 Embeddings 模型...");
    try {
        this.embeddings = new LocalHuggingFaceEmbeddings({
          model: "Xenova/bge-small-zh-v1.5",
          cacheDir: modelsPath,
        });
        console.log("[RAG Constructor] Embeddings 模型初始化完成");
    } catch (error) {
        console.error("[RAG Constructor] Embeddings 初始化失败:", error);
        throw error;
    }

    console.log("[RAG Constructor] 正在初始化大语言模型 (LLM)...");
    this.llm = new ChatOpenAI({
      modelName: "doubao-seed-1-6-flash-250828", // 使用的模型名称
      apiKey: DEEPSEEK_CONFIG.apiKey,
      configuration: {
        baseURL: DEEPSEEK_CONFIG.baseURL,
      },
      temperature: 0.7, // 随机性控制：0.7 比较平衡，既有创造性又不会太发散
    });
  }

  // 初始化方法：连接向量数据库
  async init() {
    if (this.vectorStore) return;

    // 尝试连接现有的 Milvus 集合
    try {
        console.log("[RAG Init] 正在连接 Milvus 数据库...");
        this.vectorStore = await Milvus.fromExistingCollection(
            this.embeddings,
            MILVUS_CONFIG
        );
        console.log("[RAG Init] 成功连接到现有的 Milvus 集合。");
    } catch (e: any) {
        // 如果集合不存在是正常的，会在第一次上传文档时自动创建
        if (e.message?.includes("Collection not found")) {
            console.log("[RAG Init] 未找到 'teacher_profiles' 集合，将在首次上传文档时创建。");
        } else {
            console.warn("[RAG Init] 连接现有集合失败（可能是新环境），准备新建:", e);
        }
        this.vectorStore = null;
    }
  }

  // 添加文档：上传、解析、切分、向量化、存储
  async addDocument(fileBuffer: Buffer, fileName: string) {
    console.log(`[Add Document] 开始处理文件: ${fileName}`);
    let docs: Document[] = [];

    // 1. 文档加载 (Load)
    if (fileName.toLowerCase().endsWith(".pdf")) {
      // PDF 处理：优先尝试 WebPDFLoader (基于 pdfjs-dist，对复杂布局支持较好且免费)
      // 如果失败，回退到标准的 PDFLoader
      const blob = new Blob([new Uint8Array(fileBuffer)]);
      
      try {
        console.log("[Add Document] 尝试使用 WebPDFLoader 加载 PDF...");
        const loader = new WebPDFLoader(blob, { 
            // splitPages: false // WebPDFLoader 默认按页加载，通常效果更好
        });
        docs = await loader.load();
        console.log(`[Add Document] WebPDFLoader 加载成功，共 ${docs.length} 页。`);
      } catch (e) {
        console.warn("[Add Document] WebPDFLoader 失败，回退到基础 PDFLoader:", e);
        const loader = new PDFLoader(blob, { splitPages: false });
        docs = await loader.load();
      }
    } else {
      // 文本处理
      const text = fileBuffer.toString("utf-8");
      docs = [new Document({ pageContent: text, metadata: { source: fileName } })];
    }
    console.log(`[Add Document] 读取到 ${docs.length} 个原始文档对象。`);

    // 2. 文本切分 (Split)
    // 优化分块策略：
    // - chunkSize: 800 (每个块约 800 字符，适合 bge-small 模型)
    // - chunkOverlap: 100 (重叠 100 字符，保证上下文连贯性)
    // - separators: 优先按自然段落(\n\n)切分，其次按句子(。！？)切分
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
    });

    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`[Add Document] 切分为 ${splitDocs.length} 个文本块 (Chunks)。`);
    
    // 3. 元数据清洗 (Metadata Cleaning)
    // Milvus 对元数据类型要求严格，通常只支持标量（字符串、数字）。
    // LangChain 的 PDFLoader 可能会生成嵌套对象（如 loc, pdf info），直接存入会报错。
    // 这里我们将所有嵌套对象转换为 JSON 字符串。
    splitDocs.forEach((doc, index) => {
        if (doc.metadata) {
            console.log(`[Metadata Debug] 处理前文档 ${index} 元数据:`, doc.metadata);
            
            // 处理已知的嵌套字段
            if (doc.metadata.loc && typeof doc.metadata.loc === 'object') {
                doc.metadata.loc = JSON.stringify(doc.metadata.loc);
            }
            if (doc.metadata.pdf && typeof doc.metadata.pdf === 'object') {
                doc.metadata.pdf = JSON.stringify(doc.metadata.pdf);
            }

            // 遍历所有字段，兜底处理其他可能的嵌套对象
            for (const key in doc.metadata) {
                const value = doc.metadata[key];
                if (typeof value === 'object' && value !== null) {
                    doc.metadata[key] = JSON.stringify(value);
                }
            }
            
            console.log(`[Metadata Debug] 处理后文档 ${index} 元数据:`, doc.metadata);
        }
    });

    // 4. 向量化并存储 (Embed & Store)
    if (!this.vectorStore) {
        console.log("[Add Document] 创建新的 Milvus 集合...");
        // fromDocuments 会自动调用 embeddings 模型生成向量，并创建集合 schema
        this.vectorStore = await Milvus.fromDocuments(
            splitDocs,
            this.embeddings,
            MILVUS_CONFIG
        );
        console.log("[Add Document] 集合创建成功，文档已添加。");
    } else {
        console.log("[Add Document] 向现有集合添加文档...");
        await this.vectorStore.addDocuments(splitDocs);
        console.log("[Add Document] 文档添加完成。");
    }

    return splitDocs.length;
  }

  // 聊天核心逻辑
  async chat(query: string) {
    console.log(`[Chat] 收到用户提问: "${query}"`);
    if (!this.vectorStore) {
         try {
            console.log("[Chat] 尝试重新初始化 Milvus 连接...");
            this.vectorStore = await Milvus.fromExistingCollection(
                this.embeddings,
                MILVUS_CONFIG
            );
        } catch (e) {
            console.error("[Chat] 知识库为空。");
            throw new Error("知识库为空，请先上传文档。");
        }
    }

    // 1. 检索 (Retrieval)
    console.log("[Chat] 🔍 开始在向量库中检索...");
    // 使用 similaritySearchWithScore 获取文档和相似度分数
    // Top-K = 5，即获取最相似的 5 个片段
    const results = await this.vectorStore.similaritySearchWithScore(query, 5);
    console.log(`[Chat] ✅ 检索到 ${results.length} 个相关文档片段。`);
    
    // 将分数注入到文档对象中，方便前端展示
    const retrievedDocs = results.map(([doc, score]) => {
        // @ts-ignore
        doc.score = score; // 动态添加 score 属性
        return doc;
    });
    
    // 打印检索结果用于调试，这对于理解 RAG 到底检索到了什么非常有用
    retrievedDocs.forEach((doc, i) => {
        // @ts-ignore
        console.log(`[Chat] --- 片段 ${i + 1} (相关性分数: ${doc.score}) ---`);
        console.log(`[Score] 元数据:`, doc.metadata);
        console.log(doc.pageContent.substring(0, 200) + "...");
    });

    // 2. 构建提示词 (Prompt Construction)
    const template = `
    <角色>
    你是一个智能助手，请基于以下提供的信息回答用户的问题。
    <限制>
    如果信息中没有提到相关内容，请直接回答“档案中未找到相关信息”。
<用户问题>
{question}
<已知信息>
{context}
`;

    const prompt = PromptTemplate.fromTemplate(template);
    
    // 手动拼接上下文，用于日志打印
    const contextStr = retrievedDocs.map((d) => d.pageContent).join("\n\n");
    const formattedPrompt = await prompt.format({
        question: query,
        context: contextStr
    });
    
    console.log("\n[Chat] 🤖 构建好的完整提示词 (Prompt):");
    console.log("--------------------------------------------------");
    console.log(formattedPrompt);
    console.log("--------------------------------------------------\n");

    // 3. 生成回答 (Generation)
    console.log("[Chat] 🚀 发送请求给 LLM...");
    const chain = RunnableSequence.from([
      this.llm,
      new StringOutputParser(), // 将 LLM 的输出对象转换为纯字符串
    ]);

    const response = await chain.invoke(formattedPrompt);
    console.log("[Chat] 🏁 收到 LLM 回复。");
    // 返回回答内容和来源文档，供前端展示引用
    return { answer: response, sources: retrievedDocs };
  }

  // 重置知识库
  async reset() {
    // 动态导入 SDK，确保在服务端运行
    const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
    const client = new MilvusClient(MILVUS_CONFIG.clientConfig.address);
    try {
        // 删除整个集合
        await client.dropCollection({ collection_name: MILVUS_CONFIG.collectionName });
        this.vectorStore = null; 
        console.log("集合已删除，知识库重置成功。");
    } catch (e) {
        console.error("重置数据库失败:", e);
        throw e;
    } finally {
        await client.closeConnection();
    }
  }

  // 获取文档列表（用于前端表格展示）
  async getDocuments(page: number = 1, pageSize: number = 10) {
    const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
    const client = new MilvusClient(MILVUS_CONFIG.clientConfig.address);
    try {
        const hasCollection = await client.hasCollection({ collection_name: MILVUS_CONFIG.collectionName });
        if (!hasCollection.value) return { total: 0, documents: [] };

        // 确保集合已加载到内存，这是 Query 操作的前提
        await client.loadCollectionSync({ collection_name: MILVUS_CONFIG.collectionName });

        // 获取集合统计信息（总行数）
        const stats = await client.getCollectionStatistics({ collection_name: MILVUS_CONFIG.collectionName });
        const rowCountStat = stats.stats.find((s: any) => s.key === "row_count");
        const total = rowCountStat ? parseInt(String(rowCountStat.value)) : 0;

        const offset = (page - 1) * pageSize;

        // 分页查询
        // filter: "langchain_primaryid >= 0" 是为了匹配所有记录
        // output_fields: ["*"] 表示返回所有字段（向量除外，除非显式指定向量字段名，但这里 * 通常包含标量和元数据）
        // @ts-ignore
        let results = await client.query({
            collection_name: MILVUS_CONFIG.collectionName,
            limit: pageSize,
            offset: offset,
            output_fields: ["*"], 
            filter: "langchain_primaryid >= 0", 
        });
        
        // 容错处理：如果默认的主键名不叫 langchain_primaryid，尝试自动发现主键名并重试
        if (!results.status || results.status.error_code !== "Success") {
             const desc = await client.describeCollection({ collection_name: MILVUS_CONFIG.collectionName });
             const pkField = desc.schema.fields.find((f: any) => f.is_primary_key)?.name;
             if (pkField && pkField !== 'langchain_primaryid') {
                 // @ts-ignore
                 results = await client.query({
                    collection_name: MILVUS_CONFIG.collectionName,
                    limit: pageSize,
                    offset: offset,
                    output_fields: ["*"],
                    filter: `${pkField} >= 0` 
                 });
             }
        }

        return { total, documents: results.data || [] };
    } catch (e) {
        console.error("获取文档列表失败:", e);
        return { total: 0, documents: [] };
    } finally {
        await client.closeConnection();
    }
  }
}

// 导出获取 RAGEngine 的单例方法
export async function getRAGEngine() {
  if (!ragPromise) {
    ragPromise = (async () => {
        const engine = new RAGEngine();
        await engine.init();
        return engine;
    })();
  }
  return ragPromise;
}
