import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel } from "../lib/model.js";
import { webSearchTool } from "../tools/search.js";
import { createOutlineTool } from "../tools/outline.js";
import { PlannerState } from "../lib/state.js";

const tools = [webSearchTool, createOutlineTool];
const toolNode = new ToolNode(tools);

const plannerModel = createModel({ temperature: 0.7 }).bindTools(tools);

async function agentNode(state) {
  const response = await plannerModel.invoke(state.messages);
  return { messages: [response] };
}

function shouldCallTool(state) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage?.tool_calls?.length) return "tools";
  return "extract";
}

async function extractOutlineNode(state) {
  const lastMessage = state.messages.at(-1);
  return { outline: lastMessage?.content ?? "" };
}

// 策划 Agent 内部图：agent → [有工具?] → tools → agent → extract → END
const plannerGraph = new StateGraph(PlannerState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addNode("extract", extractOutlineNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldCallTool, ["tools", "extract"])
  .addEdge("tools", "agent")
  .addEdge("extract", END)
  .compile();

export async function plannerAgent(state) {
  console.log("\n📋 [策划 Agent] 开始规划...");

  const result = await plannerGraph.invoke({
    messages: [
      new SystemMessage(
        `你是一位资深内容策划，擅长规划技术文章结构。
请为给定主题制定详细大纲，包含：
1. 文章定位和目标读者
2. 核心章节（3-5 个）
3. 每章的关键内容点

工作流程：
1. 先用 web_search 搜索主题的背景资料
2. 基于搜索结果，用 create_outline 生成结构化大纲
3. 最后用自然语言输出完整的大纲说明`
      ),
      new HumanMessage(`请为以下主题制定写作大纲：${state.topic}`),
    ],
  });

  console.log("✅ [策划 Agent] 大纲完成");
  return { outline: result.outline };
}
