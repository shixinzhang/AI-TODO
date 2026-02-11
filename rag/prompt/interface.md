# 生成 Next.js API 路由接口

请帮我为 rag 项目生成以下三个 Next.js App Router 风格的 API 接口文件，它们都需要调用 `rag/src/lib/rag.ts` 中导出的单例 `getRAGEngine`。

**通用要求：**
1.  使用 `NextResponse` 返回 JSON 结果。
2.  包含基本的错误处理（try-catch），并在出错时返回 500 状态码和错误信息。
3.  所有接口文件路径均为 `src/app/api/.../route.ts`。

---

## 1. 文档上传接口 (`src/app/api/upload/route.ts`)

**功能**：接收前端上传的文件，并调用 RAG 引擎进行处理。

**逻辑**：
1.  从 `request.formData()` 中获取名为 `file` 的文件。
2.  如果文件不存在，返回 400 错误。
3.  获取 RAG 引擎实例：`const rag = await getRAGEngine();`
4.  将文件转换为 `Buffer`。
5.  调用 `rag.addDocument(buffer, filename)`。
6.  返回成功消息和处理的文档块数量（`chunks`）。

---

## 2. 知识库重置接口 (`src/app/api/reset/route.ts`)

**功能**：清空当前知识库（Milvus 集合或内存库）。

**逻辑**：
1.  这是一个 POST 请求。
2.  获取 RAG 引擎实例。
3.  调用 `rag.reset()`。
4.  返回成功消息。

---

## 3. 文档列表接口 (`src/app/api/documents/route.ts`)

**功能**：获取当前知识库中的文档列表（支持分页）。

**逻辑**：
1.  这是一个 GET 请求。
2.  从 URL 参数中获取 `page`（默认1）和 `pageSize`（默认10）。
3.  获取 RAG 引擎实例。
4.  调用 `rag.getDocuments(page, pageSize)`。
5.  返回包含 `total` 和 `documents` 数组的 JSON。

**代码示例结构**：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    // ... 逻辑实现
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```
