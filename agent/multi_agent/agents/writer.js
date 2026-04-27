import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel } from "../lib/model.js";

export async function writerAgent(state) {
  console.log("\n✍️  [写作 Agent] 开始写作...");

  const isRevision = state.iterationCount > 0;
  const prompt = isRevision
    ? `你将对文章进行“增量修订”。请严格依据评审意见逐条改进，确保每一轮都比上一轮更好。

要求：
1) 必须逐条回应评审意见：在文首添加一个 "## 修改清单" 小节，用列表形式写“意见 → 你做了哪些修改”。
2) 必须补充至少 1 个“完整可运行”的代码示例，包含：依赖安装命令、运行命令、预期输出/验证方式。
3) 必须增加更具体的技术细节（例如：节点如何自定义、状态如何传递、条件路由如何写、检查点如何使用）。
4) 尽量保留原文结构与优点，只在必要处扩展与重写；不要删除原文已有的关键小节标题。
5) 语言对初学者友好：出现新概念时给一句背景解释。

主题：${state.topic}

原文：
${state.draft}

评审意见：
${state.review}

请输出修订后的完整文章（Markdown）。`
    : `请根据以下大纲写一篇完整的技术文章（Markdown）：

要求：
1) 结构清晰，标题层级规范。
2) 至少包含 1 个可运行的代码示例（含安装/运行/验证）。
3) 对关键术语给出简短解释，照顾初学者。

主题：${state.topic}

大纲：
${state.outline}`;

  const writerModel = createModel({ temperature: isRevision ? 0.4 : 0.8 });

  const response = await writerModel.invoke([
    new SystemMessage(
      "你是一位技术写手，擅长写清晰易懂的技术文章。文章要有代码示例，语言要生动。"
    ),
    new HumanMessage(prompt),
  ]);

  console.log("✅ [写作 Agent] 写作完成");
  return {
    draft: response.content,
    iterationCount: 1, // 触发累加 reducer，每次 +1
  };
}
