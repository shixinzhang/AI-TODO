import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 实际项目替换为 Tavily / Serper 等真实搜索 API
export const webSearchTool = tool(
  async ({ query }) => {
    return `关于"${query}"的搜索结果（模拟）：
- 这是一个热门技术话题，核心要点包括架构设计、最佳实践和常见误区
- 近期社区讨论集中在性能优化和工程化落地
- 官方文档已更新，新版本带来了若干破坏性变更需要关注`;
  },
  {
    name: "web_search",
    description:
      "搜索互联网获取最新信息。需要了解某个主题的背景、最新进展或数据时使用。",
    schema: z.object({
      query: z.string().describe("搜索关键词，尽量精确"),
    }),
  }
);
