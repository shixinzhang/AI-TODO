/**
 * 短期记忆管理模块 (Sliding Window + Summary)
 * 
 * 核心逻辑：当对话轮数超过阈值时，不直接截断，
 * 而是将最早的几轮对话"压缩"成一段摘要，作为 System Prompt 的一部分保留下来。
 */

import { generateText, ModelMessage } from 'ai';
import { summaryModel } from './ai/models';

// ========== 配置常量 ==========
export const MAX_MESSAGES = 10;        // 滑动窗口大小（保留的最大消息数）
export const SUMMARY_THRESHOLD = 4;    // 每次压缩的消息数（2轮对话 = 4条消息）
const SUMMARY_MARKER = '【历史对话摘要】';  // 摘要标记，用于识别和提取


/**
 * 压缩结果类型
 */
export interface CompressResult {
  messages: ModelMessage[];      // 优化后的消息列表（不含摘要 system 消息）
  summary: string | null;        // 历史摘要（如有），需要附加到 system prompt
}

/**
 * 核心函数：上下文压缩器 (Sliding Window + Summary)
 * 当对话轮数超过阈值时，将最早的几轮对话压缩成摘要
 * 
 * @param messages - 原始消息列表
 * @returns CompressResult，包含优化后的消息和可选的摘要
 * 
 * @example
 * // 消息数 <= MAX_MESSAGES 时，直接返回原始消息
 * const result = await compressHistory(messages);
 * // result.summary 为 null
 * 
 * @example
 * // 消息数 > MAX_MESSAGES 时，压缩历史
 * const result = await compressHistory(messages);
 * // result.summary 包含历史摘要，需要附加到 system prompt
 */
export async function compressHistory(messages: ModelMessage[]): Promise<CompressResult> {
  // 过滤掉 system 消息，只处理 user 和 assistant 的对话
  const dialogueMessages = messages.filter(m => m.role !== 'system');
  
  // 提取已有的摘要（如果之前压缩过）
  let existingSummary: string | null = null;
  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg && typeof systemMsg.content === 'string') {
    const summaryMatch = systemMsg.content.match(new RegExp(`${SUMMARY_MARKER}：(.+)`, 's'));
    if (summaryMatch) {
      existingSummary = summaryMatch[1].trim();
    }
  }

  // 如果对话消息没超标，直接返回
  if (dialogueMessages.length <= MAX_MESSAGES) {
    return {
      messages: dialogueMessages,
      summary: existingSummary,
    };
  }

  console.log(`[记忆管理] 对话消息数 ${dialogueMessages.length} 超过阈值 ${MAX_MESSAGES}，开始压缩...`);

  // 1. 切分：取出最早的几条需要被压缩的消息，保留最新的
  const messagesToKeep = MAX_MESSAGES - SUMMARY_THRESHOLD;
  const toCompress = dialogueMessages.slice(0, dialogueMessages.length - messagesToKeep);
  const recentMessages = dialogueMessages.slice(dialogueMessages.length - messagesToKeep);

  // 2. 检查是否有内容需要压缩
  if (toCompress.length === 0) {
    console.log('[记忆管理] ⚠️ 没有需要压缩的对话内容，跳过压缩');
    return {
      messages: recentMessages,
      summary: existingSummary,
    };
  }

  // 3. 调用 AI 生成新摘要
  try {
    const dialogueText = toCompress
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const { text: newSummary } = await generateText({
      model: summaryModel,
      prompt: `你是一个对话摘要助手。请将以下对话历史压缩成简洁的摘要。

${existingSummary ? `之前的对话摘要：${existingSummary}` : '（这是首次压缩，之前没有摘要）'}

最近需要压缩的对话：
${dialogueText}

请生成一段简洁的摘要，保留以下关键信息：
1. 用户的主要需求和意图
2. 已完成的操作（如生成了什么图片/视频）
3. 重要的上下文信息（如用户偏好、讨论主题）
4. 任何未完成的任务

直接输出摘要内容，不要有前缀或解释。限制在200字以内。`,
    });

    // 验证摘要有效性
    const trimmedSummary = newSummary?.trim();
    if (!trimmedSummary) {
      console.warn('[记忆管理] ⚠️ AI 返回空摘要，保留原有摘要');
      return {
        messages: recentMessages,
        summary: existingSummary,
      };
    }

    // 计算压缩效率
    const compressedChars = JSON.stringify(toCompress).length;
    const summaryChars = trimmedSummary.length;
    const savedPercent = compressedChars > 0 
      ? Math.round((1 - summaryChars / compressedChars) * 100)
      : 0;
    console.log(`[记忆管理] ✅ 压缩完成：原始 ${compressedChars} 字符 → 摘要 ${summaryChars} 字符，节省约 ${savedPercent}%`);

    return {
      messages: recentMessages,
      summary: trimmedSummary,
    };
  } catch (error) {
    console.error('[记忆管理] ❌ 摘要生成失败，回退到简单截断:', error);
    // 如果摘要生成失败，回退到简单的滑动窗口（直接截断）
    return {
      messages: dialogueMessages.slice(-MAX_MESSAGES),
      summary: existingSummary, // 保留原有摘要
    };
  }
}

/**
 * 构建包含历史摘要的 System Prompt
 * 
 * @param baseSystemPrompt - 基础 system prompt
 * @param summary - 历史对话摘要（可选）
 * @returns 完整的 system prompt
 */
export function buildSystemPromptWithSummary(baseSystemPrompt: string, summary: string | null): string {
  if (!summary) {
    return baseSystemPrompt;
  }
  return `${baseSystemPrompt}\n\n${SUMMARY_MARKER}：${summary}`;
}
