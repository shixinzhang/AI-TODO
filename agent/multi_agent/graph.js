import { StateGraph, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { WritingState } from "./lib/state.js";
import { plannerAgent } from "./agents/planner.js";
import { writerAgent } from "./agents/writer.js";
import {
  illustratorAssembleAgent,
  illustratorGenerateAgent,
  illustratorPlanAgent,
  routeAfterIllustratorPlan,
} from "./agents/illustrator.js";
import { reviewerAgent } from "./agents/reviewer.js";
import { hitlAgent } from "./agents/hitl.js";

// 路由函数：评审结果决定下一步
function routeAfterReview(state) {
  if (state.approved) {
    console.log("\n🎉 文章通过评审！");
    return END;
  }
  console.log("\n🛑 评审未通过，进入 HITL 决策节点...");
  return "hitl";
}

const checkpointer = new MemorySaver();

export const writingGraph = new StateGraph(WritingState)
  .addNode("planner",    plannerAgent)
  .addNode("writer",     writerAgent)
  .addNode("illustrator_plan", illustratorPlanAgent)
  .addNode("illustrator_generate", illustratorGenerateAgent)
  .addNode("illustrator_assemble", illustratorAssembleAgent)
  .addNode("reviewer",   reviewerAgent)
  .addNode("hitl",       hitlAgent, { ends: ["writer", "illustrator_plan", END] })
  .addEdge(START,        "planner")
  .addEdge("planner",    "writer")
  .addEdge("writer",     "illustrator_plan")
  .addConditionalEdges(
    "illustrator_plan",
    routeAfterIllustratorPlan,
    ["illustrator_generate", "illustrator_assemble"]
  )
  .addEdge("illustrator_generate", "illustrator_assemble")
  .addEdge("illustrator_assemble", "reviewer")
  .addConditionalEdges("reviewer", routeAfterReview, ["hitl", END])
  .compile({ checkpointer });
