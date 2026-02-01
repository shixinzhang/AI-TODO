
import { NextRequest, NextResponse } from "next/server";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { JSONLoader } from "@langchain/classic/document_loaders/fs/json";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { 
    RecursiveCharacterTextSplitter,
    CharacterTextSplitter,
    TokenTextSplitter,
    MarkdownTextSplitter
} from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { MultiQueryRetriever } from "@langchain/classic/retrievers/multi_query";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate, ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser, JsonOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import path from "path";
// import fs from "fs/promises";
import { Document } from "@langchain/core/documents";
import { ContextualCompressionRetriever } from "@langchain/classic/retrievers/contextual_compression";
import { LLMChainExtractor } from "@langchain/classic/retrievers/document_compressors/chain_extract";
import { CohereRerank } from "@langchain/cohere";
import { ParentDocumentRetriever } from "@langchain/classic/retrievers/parent_document";
import { InMemoryStore } from "@langchain/core/stores";

// 模拟数据路径
const DATA_DIR = path.join(process.cwd(), "demo-data");

const createEmbeddings = (apiKey: string) => {
    return new OpenAIEmbeddings({
        model: "text-embedding-3-small",
        apiKey: apiKey,
        configuration: {
            baseURL: "https://sg.uiuiapi.com/v1",
        }
    });
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const apiKey = req.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY;

    let result: any = {};

    switch (action) {
      case "load-text":
        const textLoader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
        const textDocs = await textLoader.load();
        result = {
          type: "TextLoader",
          count: textDocs.length,
          preview: textDocs[0].pageContent,
        };
        break;

      case "load-json":
        // 提取 name 字段
        const jsonLoader = new JSONLoader(
          path.join(DATA_DIR, "sample.json"),
          "/name"
        );
        const jsonDocs = await jsonLoader.load();
        result = {
          type: "JSONLoader",
          count: jsonDocs.length,
          preview: jsonDocs[0].pageContent,
        };
        break;

      case "load-csv":
        const csvLoader = new CSVLoader(path.join(DATA_DIR, "sample.csv"));
        const csvDocs = await csvLoader.load();
        result = {
          type: "CSVLoader",
          count: csvDocs.length,
          preview: csvDocs.map((d) => d.pageContent),
        };
        break;

      case "load-web":
        // 为了避免网络问题，这里只做演示，或者请求一个稳定的页面
        const webLoader = new CheerioWebBaseLoader(
          "https://shixin.blog.csdn.net/"
        );
        const webDocs = await webLoader.load();
        result = {
          type: "CheerioWebBaseLoader",
          count: webDocs.length,
          title: webDocs[0].metadata.title,
          preview: webDocs[0].pageContent.slice(0, 200) + "...",
        };
        break;

      case "load-pdf":
        // 优先使用复杂样本，如果不存在则回退到简单样本
        const pdfPath = require('fs').existsSync(path.join(DATA_DIR, "complex_sample.pdf")) 
            ? path.join(DATA_DIR, "complex_sample.pdf") 
            : path.join(DATA_DIR, "sample.pdf");
            
        const pdfLoader = new PDFLoader(pdfPath);
        const pdfDocs = await pdfLoader.load();
        result = {
          type: "PDFLoader (Standard)",
          file: path.basename(pdfPath),
          count: pdfDocs.length,
          preview: pdfDocs[0].pageContent.slice(0, 300),
        };
        break;

      case "load-pdf-web":
        // 演示 WebPDFLoader，通常对复杂格式支持更好
        const webPdfPath = require('fs').existsSync(path.join(DATA_DIR, "complex_sample.pdf")) 
            ? path.join(DATA_DIR, "complex_sample.pdf") 
            : path.join(DATA_DIR, "sample.pdf");
            
        const blob = new Blob([await require('fs').promises.readFile(webPdfPath)]);
        const webPdfLoader = new WebPDFLoader(blob, { splitPages: false });
        const webPdfDocs = await webPdfLoader.load();
        result = {
          type: "WebPDFLoader (Advanced)",
          file: path.basename(webPdfPath),
          count: webPdfDocs.length,
          preview: webPdfDocs[0].pageContent.slice(0, 300),
          note: "WebPDFLoader 基于 pdfjs-dist，适合处理多栏、表格等复杂 PDF 布局。"
        };
        break;

      case "load-directory":
        // 演示 DirectoryLoader：批量加载目录下的文件
        try {
            const loader = new DirectoryLoader(
                DATA_DIR,
                {
                    ".txt": (path) => new TextLoader(path),
                    ".json": (path) => new JSONLoader(path, "/name"),
                    ".pdf": (path) => new PDFLoader(path, { splitPages: false }),
                }
            );
            const docs = await loader.load();
            
            // 过滤掉 CSV (因为没配 CSVLoader) 和其他未配置的文件
            // DirectoryLoader 默认会忽略未知扩展名，或者根据配置报错
            
            result = {
                type: "DirectoryLoader",
                totalDocs: docs.length,
                files: docs.map(d => path.basename(d.metadata.source)),
                previews: docs.map(d => d.pageContent.slice(0, 50).replace(/\n/g, " ") + "...")
            };
        } catch (e: any) {
             result = { 
                 type: "DirectoryLoader", 
                 error: "DirectoryLoader failed: " + e.message 
             };
        }
        break;

      case "split-text":
        const splitterLoader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
        const docsToSplit = await splitterLoader.load();
        
        // 1. RecursiveCharacterTextSplitter (默认推荐)
        const recursiveSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 50, 
          chunkOverlap: 10,
        });
        const recursiveChunks = await recursiveSplitter.splitDocuments(docsToSplit);

        // 2. CharacterTextSplitter (简单按字符切)
        const charSplitter = new CharacterTextSplitter({
            separator: "\n",
            chunkSize: 50,
            chunkOverlap: 10,
        });
        const charChunks = await charSplitter.splitDocuments(docsToSplit);

        // 3. TokenTextSplitter (按 Token 切，适合 LLM 上下文限制)
        const tokenSplitter = new TokenTextSplitter({
            encodingName: "cl100k_base", // gpt-4, gpt-3.5-turbo
            chunkSize: 20, // token 数量通常比字符少
            chunkOverlap: 5
        });
        const tokenChunks = await tokenSplitter.splitDocuments(docsToSplit);

        result = {
          type: "Text Splitters Comparison",
          originalLength: docsToSplit[0].pageContent.length,
          recursive: {
              desc: "智能递归切分 (推荐)",
              count: recursiveChunks.length,
              preview: recursiveChunks.map(c => c.pageContent)
          },
          character: {
              desc: "简单字符切分",
              count: charChunks.length,
              preview: charChunks.map(c => c.pageContent)
          },
          token: {
              desc: "Token 切分 (适合 LLM)",
              count: tokenChunks.length,
              preview: tokenChunks.map(c => c.pageContent)
          }
        };
        break;

      case "embedding":
        // 需要 OPENAI_API_KEY
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY environment variable or x-openai-api-key header");
        }
        const embeddings = createEmbeddings(apiKey);
        const vector = await embeddings.embedQuery("Hello RAG");
        result = {
          type: "OpenAIEmbeddings",
          model: "text-embedding-3-small",
          vectorLength: vector.length,
          vectorPreview: vector.slice(0, 5), // 只展示前5个维度
        };
        break;
      
      case "vector-store-memory":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 1. 准备数据
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 10 });
            const chunks = await splitter.splitDocuments(docs);
            
            // 2. 存入 MemoryVectorStore
            const vectorStore = await MemoryVectorStore.fromDocuments(
                chunks,
                createEmbeddings(apiKey)
            );
            
            // 3. 简单检索验证
            const results = await vectorStore.similaritySearch("RAG", 1);
            
            result = {
                type: "MemoryVectorStore",
                status: "Success",
                storedCount: chunks.length,
                searchTest: results[0].pageContent
            };
        }
        break;

      case "vector-store-chroma":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 注意：Chroma 需要本地或远程运行 ChromaDB 服务
            // 这里仅演示代码逻辑，如果服务未启动会报错
            try {
                const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
                const docs = await loader.load();
                const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 10 });
                const chunks = await splitter.splitDocuments(docs);

                const vectorStore = await Chroma.fromDocuments(
                    chunks,
                    createEmbeddings(apiKey),
                    {
                        collectionName: "rag-demo-collection",
                        // url: "http://localhost:8000" // 默认地址
                    }
                );

                // vectorStore.asRetriever()
                
                const results = await vectorStore.similaritySearch("LangChain", 1);
                result = {
                    type: "Chroma",
                    status: "Success (Service Connected)",
                    searchTest: results[0].pageContent
                };
            } catch (e: any) {
                result = {
                    type: "Chroma",
                    status: "Failed (Is ChromaDB running?)",
                    error: e.message
                };
            }
        }
        break;

      case "retrieval":
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY environment variable or x-openai-api-key header");
        }
        // 1. 准备数据
        const rLoader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
        const rDocs = await rLoader.load();
        const rSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 10 });
        const rChunks = await rSplitter.splitDocuments(rDocs);
        
        // 2. 存入向量库
        const vectorStore = await MemoryVectorStore.fromDocuments(
            rChunks,
            createEmbeddings(apiKey)
        );

        // 3. 检索
        const retriever = vectorStore.asRetriever();
        
        const query = "LangChain";
        console.log(`--- Basic Retrieval: Invoking with query "${query}" ---`);
        const retrievedDocs = await retriever.invoke(query);
        console.log(`--- Basic Retrieval: Found ${retrievedDocs.length} results ---`);
        retrievedDocs.forEach((doc, i) => {
            console.log(`[Result ${i+1}] ${doc.pageContent.slice(0, 100)}...`);
        });
        
        result = {
            type: "Retrieval",
            query: "LangChain",
            matchCount: retrievedDocs.length,
            matches: retrievedDocs.map((d: Document) => d.pageContent)
        };
        break;

      case "retrieval-multi-query":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 1. 准备向量库 (复用逻辑)
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 10 });
            const chunks = await splitter.splitDocuments(docs);
            const vectorStore = await MemoryVectorStore.fromDocuments(chunks, createEmbeddings(apiKey));
            
            // 2. MultiQuery
            const llm = new ChatOpenAI({ temperature: 0, apiKey: apiKey, configuration:{
              baseURL: "https://sg.uiuiapi.com/v1",
            } });
            console.log("--- MultiQueryRetriever: Initializing ---");
            const retriever = MultiQueryRetriever.fromLLM({
                retriever: vectorStore.asRetriever(),
                llm: llm,
                verbose: true // Enable verbose logging
                // includeOriginal: true
            });
            
            const query = "RAG 框架";
            console.log(`--- MultiQueryRetriever: Invoking with query "${query}" ---`);
            const results = await retriever.invoke(query);
            console.log(`--- MultiQueryRetriever: Found ${results.length} results ---`);
            results.forEach((doc, i) => {
                console.log(`[Result ${i+1}] ${doc.pageContent.slice(0, 100)}...`);
            });
            result = {
                type: "MultiQueryRetriever",
                query: "RAG 框架",
                matchCount: results.length,
                matches: results.map(d => d.pageContent)
            };
        }
        break;

      case "retrieval-hyde":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 1. 准备向量库
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            const chunks = new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 10 }).splitDocuments(docs);
            const vectorStore = await MemoryVectorStore.fromDocuments(await chunks, createEmbeddings(apiKey));
            const baseRetriever = vectorStore.asRetriever();

            // 2. HyDE 链
            const llm = new ChatOpenAI({ temperature: 0, apiKey: apiKey,configuration:{
              baseURL: "https://sg.uiuiapi.com/v1",
            }  });
            const template = "请撰写一段与以下问题相关的回答（假设）：\n问题：{question}\n回答：";
            const promptHyde = ChatPromptTemplate.fromTemplate(template);
            const hydeChain = RunnableSequence.from([
                promptHyde,
                llm,
                new StringOutputParser(),
                (generatedDoc) => {
                    console.log(`--- HyDE Generated Document: ---\n${generatedDoc}\n------------------------------`); 
                    return baseRetriever.invoke(generatedDoc);
                }
            ]);

            const query = "LangChain 的作用";
            console.log(`--- HyDE: Invoking with query "${query}" ---`);
            const results = await hydeChain.invoke({ question: query });
            console.log(`--- HyDE: Found ${results.length} results ---`);
            results.forEach((doc, i) => {
                console.log(`[Result ${i+1}] ${doc.pageContent.slice(0, 100)}...`);
            });
            result = {
                type: "HyDE Retrieval",
                query: "LangChain 的作用",
                matchCount: results.length,
                matches: results.map(d => d.pageContent)
            };
        }
        break;

      case "retrieval-contextual-compression":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 1. 基础检索器
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 200, chunkOverlap: 20 });
            const chunks = await splitter.splitDocuments(docs);
            const vectorStore = await MemoryVectorStore.fromDocuments(chunks, createEmbeddings(apiKey));
            const baseRetriever = vectorStore.asRetriever();

            // 2. 压缩器 (LLMChainExtractor)
            const llm = new ChatOpenAI({ temperature: 0, apiKey: apiKey,configuration:{
              baseURL: "https://sg.uiuiapi.com/v1",
            }  });
            const compressor = LLMChainExtractor.fromLLM(llm);

            // 3. 组合
            const retriever = new ContextualCompressionRetriever({
                baseCompressor: compressor,
                baseRetriever: baseRetriever,
                verbose: true
            });

            const query = "LangChain 的主要组件";
            console.log(`--- ContextualCompression: Invoking with query "${query}" ---`);
            const results = await retriever.invoke(query);
            console.log(`--- ContextualCompression: Found ${results.length} results ---`);
            results.forEach((doc, i) => {
                console.log(`[Result ${i+1}] ${doc.pageContent.slice(0, 100)}...`);
            });
            result = {
                type: "Contextual Compression",
                query: "LangChain 的主要组件",
                matchCount: results.length,
                matches: results.map(d => d.pageContent)
            };
        }
        break;

      case "retrieval-rerank":
        if (!apiKey) throw new Error("Missing API Key");
        // 从 header 获取 cohere key，或者使用环境变量
        const cohereKey = req.headers.get("x-cohere-api-key") || process.env.COHERE_API_KEY;
        if (!cohereKey) {
             result = { error: "Missing COHERE_API_KEY. Please provide it in header 'x-cohere-api-key' or env." };
             break;
        }
        {
            // 1. 基础检索器 (获取更多候选文档)
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 200, chunkOverlap: 20 });
            const chunks = await splitter.splitDocuments(docs);
            const vectorStore = await MemoryVectorStore.fromDocuments(chunks, createEmbeddings(apiKey));
            const baseRetriever = vectorStore.asRetriever(10); // 获取 top 10

            // 2. Rerank 模型
            const cohereRerank = new CohereRerank({
                apiKey: cohereKey as string,
                model: "rerank-english-v3.0", 
                topN: 3 // 重排后只取 top 3
            });

            // 3. 组合
            const retriever = new ContextualCompressionRetriever({
                baseCompressor: cohereRerank,
                baseRetriever: baseRetriever,
                verbose: true
            });

            const query = "LangChain 的核心价值";
            console.log(`--- Cohere Rerank: Invoking with query "${query}" ---`);
            const results = await retriever.invoke(query);
            console.log(`--- Cohere Rerank: Found ${results.length} results ---`);
             results.forEach((doc, i) => {
                console.log(`[Result ${i+1}] (Score: ${doc.metadata.relevanceScore}) ${doc.pageContent.slice(0, 100)}...`);
            });
            result = {
                type: "Cohere Re-ranking",
                query: "LangChain 的核心价值",
                matchCount: results.length,
                matches: results.map(d => ({
                    content: d.pageContent,
                    metadata: d.metadata 
                }))
            };
        }
        break;

      case "retrieval-parent-document":
        if (!apiKey) throw new Error("Missing API Key");
        {
            // 1. 准备数据
            const loader = new TextLoader(path.join(DATA_DIR, "sample.txt"));
            const docs = await loader.load();
            
            // 2. 存储层
            const vectorStore = new MemoryVectorStore(createEmbeddings(apiKey));
            const docstore = new InMemoryStore(); 

            // 3. 切分器
            const parentSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
            const childSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 10 });

            // 4. ParentDocumentRetriever
            const retriever = new ParentDocumentRetriever({
                vectorstore: vectorStore,
                docstore: docstore,
                parentSplitter: parentSplitter, 
                childSplitter: childSplitter,
                childK: 3, 
                parentK: 1,
                verbose: true
            });

            // 添加文档
            console.log("--- ParentDocumentRetriever: Adding documents ---");
            await retriever.addDocuments(docs);

            const query = "LangChain";
            console.log(`--- ParentDocumentRetriever: Invoking with query "${query}" ---`);
            const results = await retriever.invoke(query);
            console.log(`--- ParentDocumentRetriever: Found ${results.length} results ---`);
            results.forEach((doc, i) => {
                console.log(`[Result ${i+1}] ${doc.pageContent.slice(0, 100)}...`);
            });
            
            result = {
                type: "Parent Document Retriever",
                query: "LangChain",
                matchCount: results.length,
                matches: results.map(d => ({
                    content: d.pageContent.slice(0, 200) + "...", // 展示父文档片段
                    fullLength: d.pageContent.length
                }))
            };
        }
        break;

      case "generation-json":
        if (!apiKey) throw new Error("Missing API Key");
        {
             const llm = new ChatOpenAI({ temperature: 0, apiKey: apiKey,configuration:{
               baseURL: "https://sg.uiuiapi.com/v1",
             }  });
             const parser = new JsonOutputParser();
             const prompt = new PromptTemplate({
                 template: "回答用户问题。\n{format_instructions}\n必须严格按照 JSON 格式输出，不要包含任何其他文字。\n问题：{query}",
                 inputVariables: ["query"],
                 partialVariables: { format_instructions: parser.getFormatInstructions() }
             });
             const chain = prompt.pipe(llm).pipe(parser);
             const jsonResult = await chain.invoke({ query: "生成一个虚构的用户画像，包含 name, age, interests" });
             
             result = {
                 type: "Generation (JSON)",
                 query: "生成一个虚构的用户画像...",
                 output: jsonResult
             };
        }
        break;

      case "generation":
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY environment variable or x-openai-api-key header");
        }
        const llm = new ChatOpenAI({ temperature: 0, apiKey: apiKey,configuration:{
          baseURL: "https://sg.uiuiapi.com/v1",
        }  });
        const prompt = PromptTemplate.fromTemplate(
            "Answer the question based on the context.\nContext: {context}\nQuestion: {question}"
        );
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        
        const answer = await chain.invoke({
            context: "RAG stands for Retrieval-Augmented Generation.",
            question: "What does RAG stand for?"
        });

        result = {
            type: "Generation",
            question: "What does RAG stand for?",
            context: "RAG stands for Retrieval-Augmented Generation.",
            answer: answer
        };
        break;

      default:
        result = { error: "Unknown action" };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("RAG Demo Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
