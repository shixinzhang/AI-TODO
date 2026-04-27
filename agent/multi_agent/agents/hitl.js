import { interrupt, Command, END } from "@langchain/langgraph";

export async function hitlAgent(state) {
  if (state.approved) return {};

  const payload = {
    kind: "review",
    iterationCount: state.iterationCount,
    feedback: state.review,
    article: state.articleWithImages || state.draft,
    actions: [
      { action: "revise", description: "继续迭代：回到写作节点" },
      { action: "accept", description: "人工强制通过：直接结束" },
      { action: "abort", description: "人工终止：直接结束" },
      { action: "edit", description: "人工替换 draft：跳过写作，直接进入配图" },
    ],
  };

  const decision = interrupt(payload);
  const action = decision?.action || "revise";

  if (action === "accept") {
    return { approved: true };
  }

  if (action === "abort") {
    return new Command({ goto: END });
  }

  if (action === "edit") {
    const nextDraft = typeof decision?.draft === "string" ? decision.draft : state.draft;
    const extraReview = typeof decision?.review === "string" ? decision.review : state.review;
    return new Command({
      update: { draft: nextDraft, review: extraReview },
      goto: "illustrator_plan",
    });
  }

  const extra = typeof decision?.instruction === "string" ? decision.instruction.trim() : "";
  const mergedReview = extra ? `${state.review}\n\n[Human instruction]\n${extra}` : state.review;
  return new Command({ update: { review: mergedReview }, goto: "writer" });
}
