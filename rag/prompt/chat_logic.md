# RAG 核心对话逻辑与接口生成

请基于以下详细需求，生成 RAG 引擎的 `chat` 方法以及对应的 Next.js API 接口。

## 1. 核心逻辑 (`chat` 方法)

在 `RAGEngine` 类中实现 `chat(query: string)` 方法，该方法需包含完整的 **检索-重排序-生成 (Retrieval-Rerank-Generation)** 流程。

**详细逻辑步骤：**

1.  **Mock 模式前置拦截**：
    *   检查 `DEEPSEEK_CONFIG.apiKey` 是否为 `'mock-key'`。
    *   如果是，跳过所有后续步骤，直接返回预设的模拟回复（"这是模拟的回答..."）和伪造的 `sources`。

2.  **知识库状态检查与重连**：
    *   如果 `this.vectorStore` 为空：
        *   如果是内存模式 (`isMemoryStore` 为 true)，抛出错误 "知识库为空..."。
        *   如果是 Milvus 模式，尝试使用 `Milvus.fromExistingCollection` 重新连接。
        *   重连失败则抛出错误 "知识库连接失败..."。

3.  **阶段一：初步检索 (Retrieval)**
    *   调用 `vectorStore.similaritySearchWithScore(query, 10)`。
    *   获取 Top 10 个相关文档作为 Rerank 的候选集。
    *   **再次 Mock 检查**（针对仅有 key 但无真实 LLM 的情况）：如果 key 是 mock-key，在这里再次拦截返回。

4.  **阶段二：LLM 重排序 (Rerank)**
    *   **Prompt 构造**：
        *   将 Top 10 候选文档格式化为 `[文档ID: x]\n内容: ...` 的文本。
        *   构建 Prompt，要求 LLM 扮演“文档相关性评分专家”，对每个文档与 query 的相关性打分（0-10分）。
        *   **输出格式强制**：要求 LLM 必须返回纯 JSON 数组 `[{"id": 0, "score": 9.5}, ...]`。
    *   **LLM 调用**：使用 `this.llm.invoke(rerankPrompt)`。
    *   **结果解析与过滤**：
        *   解析 JSON，处理可能的 Markdown 代码块包裹。
        *   将评分回填到文档对象的 `relevanceScore` 属性中。
        *   **过滤阈值**：只保留评分 >= 6 的文档。
    *   **降级策略**：如果 LLM 调用失败或 JSON 解析出错，捕获异常并降级使用原始检索结果的前 3 个（标记 relevanceScore 为 0）。
    *   **最终排序与截取**：按分数降序排列，取 **Top 3**。
    *   **兜底**：如果 Rerank 后结果为空，强制使用 Top 1 避免无话可说。

5.  **阶段三：最终生成 (Generation)**
    *   **上下文组装**：将筛选后的 Top 3 文档内容拼接。
    *   **Prompt 模板**：
        *   角色："睿智商城"智能客服。
        *   限制：基于已知信息回答，不编造，亲切专业。
        *   变量：`{question}` 和 `{context}`。
    *   **生成**：
        *   使用 `PromptTemplate` 和 `StringOutputParser`。
        *   调用 LLM 生成最终回复。

6.  **返回值**：返回 `{ answer: string, sources: Document[] }`。

## 2. API 接口 (`src/app/api/chat/route.ts`)

实现对应的 Next.js App Router 接口。

**逻辑要求：**
1.  **POST 请求**：接收 JSON body `{ query: string }`。
2.  **参数校验**：如果 `query` 为空，返回 400。
3.  **调用引擎**：
    *   `const rag = await getRAGEngine();`
    *   `const result = await rag.chat(query);`
4.  **返回结果**：返回 JSON `{ answer: result.answer, sources: result.sources }`。
5.  **错误处理**：捕获异常并返回 500。

请直接生成包含这两个部分（`chat` 方法实现代码 和 `route.ts` 完整代码）的 Prompt 回复。
