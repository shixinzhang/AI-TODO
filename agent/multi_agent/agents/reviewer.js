import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel } from "../lib/model.js";

const reviewerModel = createModel({ temperature: 0.2 });

export async function reviewerAgent(state) {
  console.log("\n🔍 [评审 Agent] 开始评审...");

  if (process.env.FORCE_REVIEW_FAIL === "1") {
    const feedback = process.env.FORCE_REVIEW_FEEDBACK || "强制不通过（测试用）";
    console.log("✅ [评审 Agent] 评审完成 - 不通过 ✗");
    console.log(`   修改意见：${feedback}`);
    return { approved: false, review: feedback };
  }

  const article = state.articleWithImages || state.draft;

  const response = await reviewerModel.invoke([
    new SystemMessage(`你是严格的技术编辑，负责评审文章质量。
评审标准：
1. 内容准确性（技术细节是否正确）
2. 结构清晰度（逻辑是否流畅）
3. 代码示例（是否有可运行的代码）
4. 读者友好度（是否易于理解）

必须以 JSON 格式回复，不要有任何多余文字：
{"approved": true/false, "feedback": "具体修改意见，通过则为空字符串"}`),
    new HumanMessage(`请评审以下文章：\n\n${article}`),
  ]);

  let result;
  try {
    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch?.[0] ?? content);
  } catch {
    result = { approved: false, feedback: "评审格式错误，请重新写作" };
  }

  console.log(
    `✅ [评审 Agent] 评审完成 - ${result.approved ? "通过 ✓" : "不通过 ✗"}`
  );
  if (!result.approved) console.log(`   修改意见：${result.feedback}`);

  return { approved: result.approved, review: result.feedback ?? "" };
}
