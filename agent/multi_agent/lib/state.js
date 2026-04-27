import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

// 策划 Agent 内部使用的 State（消息列表 + outline）
export const PlannerState = Annotation.Root({
  ...MessagesAnnotation.spec,
  outline: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "",
  }),
});

// 整个写作流程共享的 State
export const WritingState = Annotation.Root({
  // 写作主题（入口输入）
  topic: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "",
  }),
  // 策划 Agent 产出的大纲
  outline: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "",
  }),
  // 写作 Agent 产出的草稿
  draft: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "",
  }),
  // 评审 Agent 的反馈意见
  review: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "",
  }),
  // 评审是否通过
  approved: Annotation({
    reducer: (_, update) => update,
    default: () => false,
  }),
  // 迭代次数（累加模式：每个节点返回 1，State 自动 +1）
  iterationCount: Annotation({
    reducer: (curr, update) => curr + update,
    default: () => 0,
  }),
  // 配图 Agent 制定的配图计划
  imagePlan: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),
  // 并行配图任务的单任务输入（仅供 Send 触发的节点使用）
  imageTask: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => null,
  }),
  // 已生成的图片路径列表（追加）
  generatedImages: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // 并行配图生成后的插入信息（追加）
  imageInsertions: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // 插入配图后的完整文章
  articleWithImages: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),
});
