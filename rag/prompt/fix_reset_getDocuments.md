# 完善 RAGEngine 的管理功能

请帮我更新 `rag/src/lib/rag.ts` 文件中的 `RAGEngine` 类，添加或修改 `reset` 和 `getDocuments` 两个方法。

请确保实现逻辑与以下描述完全一致：

## 1. 重置知识库 (`reset`)

该方法用于清空知识库中的所有数据。

**逻辑要求：**
1.  **内存模式检查**：如果 `isMemoryStore` 为 true：
    *   将 `this.vectorStore` 置为 `null`。
    *   打印日志 "内存向量库已重置。" 并直接返回。
2.  **Milvus 模式**：
    *   动态导入 `@zilliz/milvus2-sdk-node` 中的 `MilvusClient`。
    *   创建 client 实例，连接地址为 `MILVUS_CONFIG.clientConfig.address`。
    *   使用 `client.dropCollection({ collection_name: MILVUS_CONFIG.collectionName })` 删除整个集合。
    *   成功后将 `this.vectorStore` 置为 `null`，并打印日志。
    *   **异常处理**：捕获并打印错误。
    *   **资源清理**：无论成功失败，都在 `finally` 块中调用 `client.closeConnection()`。

## 2. 获取文档列表 (`getDocuments`)

该方法用于获取已存储的文档列表，支持分页，主要用于前端管理界面展示。

**参数**：
*   `page`: number (默认 1)
*   `pageSize`: number (默认 10)

**逻辑要求：**
1.  **内存模式**：如果 `isMemoryStore` 为 true，打印警告 "MemoryVectorStore 不支持 getDocuments..."，并返回 `{ total: 0, documents: [] }`。
2.  **Milvus 模式**：
    *   动态导入 `MilvusClient` 并建立连接。
    *   **健康检查**：先调用 `client.checkHealth()`，失败则捕获异常并返回空列表。
    *   **集合检查**：调用 `client.hasCollection`，如果集合不存在，返回空列表。
    *   **加载集合**：调用 `client.loadCollectionSync` 确保集合已加载到内存（查询前必须的操作）。
    *   **获取总数**：调用 `client.getCollectionStatistics`，查找 `row_count` 统计项作为 `total`。
    *   **分页查询**：
        *   计算 `offset = (page - 1) * pageSize`。
        *   调用 `client.query`：
            *   `filter`: 使用 `"langchain_primaryid >= 0"` 匹配所有记录。
            *   `output_fields`: `["*"]` 返回所有标量字段。
            *   `limit` 和 `offset` 用于分页。
    *   **主键兼容性处理**：
        *   检查 query 结果。如果失败（`status.error_code !== "Success"`），可能是主键名不叫 `langchain_primaryid`。
        *   调用 `client.describeCollection` 获取 Schema，找到 `is_primary_key: true` 的字段名。
        *   如果主键名不同，使用新的主键名（例如 `${pkField} >= 0`）重试查询。
    *   **返回结果**：返回 `{ total, documents: results.data || [] }`。
    *   **资源清理**：`finally` 中关闭连接。

请直接生成这两个方法的 TypeScript 代码。
