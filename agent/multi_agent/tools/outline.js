import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const createOutlineTool = tool(
  async ({ title, sections }) => {
    const formatted = sections.map((s, i) => `${i + 1}. ${s}`).join("\n");
    return `大纲已生成：\n标题：${title}\n\n章节：\n${formatted}`;
  },
  {
    name: "create_outline",
    description:
      "生成结构化的文章大纲。在搜索完资料、确定文章框架后使用，输出标题和章节列表。",
    schema: z.object({
      title:    z.string().describe("文章标题"),
      sections: z.array(z.string()).describe("章节标题列表，按顺序排列"),
    }),
  }
);
