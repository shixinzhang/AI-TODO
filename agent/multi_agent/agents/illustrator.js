import { createModel } from "../lib/model.js";
import { generateImageTool } from "../tools/image.js";
import path from "path";
import { z } from "zod";
import { createAgent } from "langchain";
import { Overwrite, Send } from "@langchain/langgraph";

const planModel = createModel({ temperature: 0.3 });

const ImagePlanSchema = z.object({
  images: z.array(
    z.object({
      position: z.string(),
      prompt: z.string(),
      filename: z.string(),
      altText: z.string(),
    })
  ),
});

const RepairPromptSchema = z.object({
  prompt: z.string(),
});

const planAgent = createAgent({
  model: planModel,
  tools: [],
  responseFormat: ImagePlanSchema,
  systemPrompt:
    "你是专业的技术文章配图编辑。你会分析文章结构，找出 2-4 个最适合插图的位置（重点概念、流程图、架构示意等）。输出必须严格符合 responseFormat JSON，不要输出多余文字。prompt 字段请用英文详细描述图片，适合生成技术示意图。filename 使用简短英文 snake_case，扩展名用 .png。altText 必须提供，中文即可。",
});

const repairPromptAgent = createAgent({
  model: createModel({ temperature: 0.4 }),
  tools: [],
  responseFormat: RepairPromptSchema,
  systemPrompt:
    "你是图像生成提示词专家。输入会包含原始 prompt 与失败原因。你的任务是只输出一个改进后的英文 prompt，保证更清晰、更可生成（流程图/架构图风格、白底、线条简洁、避免过长）。只输出 responseFormat JSON，不要多余文字。",
});

export async function illustratorPlanAgent(state) {
  console.log("\n🎨 [配图 Agent] 第一步：分析配图位置...");

  let imagePlan = [];
  try {
    const planResult = await planAgent.invoke({
      messages: [
        {
          role: "user",
          content: `请为以下文章制定配图计划（仅输出 JSON）：\n\n${state.draft}`,
        },
      ],
    });
    const images = planResult?.structuredResponse?.images ?? [];
    imagePlan = Array.isArray(images) ? images.slice(0, 4) : [];
    if (imagePlan.length > 0 && imagePlan.length < 2) imagePlan = [];
  } catch {
    console.log("⚠️  配图计划解析失败，跳过配图");
    return {
      imagePlan: [],
      imageInsertions: new Overwrite([]),
      articleWithImages: state.draft,
    };
  }

  console.log(`✅ 配图计划制定完成，共 ${imagePlan.length} 张图`);
  return {
    imagePlan,
    imageInsertions: new Overwrite([]),
  };
}

export function routeAfterIllustratorPlan(state) {
  if (!Array.isArray(state.imagePlan) || state.imagePlan.length === 0) {
    return "illustrator_assemble";
  }

  return state.imagePlan.map((plan) =>
    new Send("illustrator_generate", {
      imageTask: plan,
    })
  );
}

export async function illustratorGenerateAgent(state) {
  const plan = state.imageTask;
  if (!plan || typeof plan !== "object") return {};

  const articleDir = process.env.ARTICLE_OUTPUT_DIR || "./article-output";
  const outputDir = path.join(articleDir, "images");
  const filename = plan.filename;
  const prompt = plan.prompt;

  console.log(`  生成：${filename}...`);
  const savedPath = await generateWithRepair({ prompt, filename, outputDir });
  console.log(`  ✓ 已保存到 ${savedPath}`);

  return {
    generatedImages: [savedPath],
    imageInsertions: [
      {
        filename,
        position: plan.position,
        altText: plan.altText,
        savedBasename: path.basename(savedPath),
      },
    ],
  };
}

export async function illustratorAssembleAgent(state) {
  const articleDir = process.env.ARTICLE_OUTPUT_DIR || "./article-output";
  const outputDir = path.join(articleDir, "images");

  console.log("\n🎨 [配图 Agent] 第二步：批量生成配图...");
  console.log(`  输出目录：${outputDir}`);

  const insertions = Array.isArray(state.imageInsertions) ? state.imageInsertions : [];
  const insertionByFilename = new Map(
    insertions
      .filter((x) => x && typeof x.filename === "string" && typeof x.savedBasename === "string")
      .map((x) => [x.filename, x])
  );

  let articleWithImages = state.draft;
  const planList = Array.isArray(state.imagePlan) ? state.imagePlan : [];
  for (const plan of planList) {
    const inserted = insertionByFilename.get(plan.filename);
    if (!inserted) continue;
    if (!articleWithImages.includes(plan.position)) continue;
    const altText = inserted.altText || plan.altText || "图片";
    const relPath = `./images/${inserted.savedBasename}`;
    const markdownRef = `![${altText}](${relPath})`;
    articleWithImages = articleWithImages.replace(plan.position, `${plan.position}\n\n${markdownRef}`);
  }

  const successCount = insertionByFilename.size;
  const totalCount = planList.length;
  console.log(`✅ [配图 Agent] 完成，成功生成 ${successCount}/${totalCount} 张图`);

  return { articleWithImages };
}

async function generateWithRepair({ prompt, filename, outputDir }) {
  try {
    return await generateImageTool.invoke({ prompt, filename, outputDir });
  } catch (err) {
    const message = err?.message || String(err);
    console.log(`  ✗ ${filename} 生成失败，尝试修复 prompt（${message}）`);

    const repaired = await repairPromptAgent.invoke({
      messages: [
        {
          role: "user",
          content: `原始 prompt:\n${prompt}\n\n失败原因:\n${message}`,
        },
      ],
    });
    const nextPrompt = repaired?.structuredResponse?.prompt;
    if (typeof nextPrompt !== "string" || nextPrompt.trim().length === 0) {
      throw err;
    }

    return await generateImageTool.invoke({ prompt: nextPrompt, filename, outputDir });
  }
}

