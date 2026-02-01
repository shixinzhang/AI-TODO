/**
 * 记忆管理模块
 * 
 * 包含两部分功能：
 * 1. 短期记忆管理 (Sliding Window + Summary)
 *    - 当对话轮数超过阈值时，将最早的几轮对话压缩成摘要
 * 
 * 2. 长期记忆与画像提取 (User Profiling)
 *    - 采用"旁路监听"模式，在对话结束后触发画像提取 Agent
 *    - 分析对话内容，提取用户偏好存入数据库
 *    - 下次对话时注入 System Prompt
 */

import { generateText, generateObject, ModelMessage } from 'ai';
import { z } from 'zod';
import { summaryModel, profileModel } from './ai/models';

// ========== 内存数据库（模拟数据库读写） ==========
/**
 * Mock 数据库：内存中的用户画像存储
 * 实际生产环境应替换为真实的数据库（如 PostgreSQL、MongoDB、Redis 等）
 */
const memoryDatabase: Map<string, UserProfile> = new Map();

/**
 * Mock 数据库查询：读取用户画像
 * @param userId - 用户ID
 * @returns 用户画像，如果不存在则返回 null
 */
function dbGetProfile(userId: string): UserProfile | null {
  const profile = memoryDatabase.get(userId);
  if (!profile) {
    return null;
  }
  // 返回副本，避免外部修改影响内部数据
  return { ...profile };
}

/**
 * Mock 数据库写入：保存或更新用户画像
 * @param userId - 用户ID
 * @param profile - 用户画像数据
 */
function dbSaveProfile(userId: string, profile: UserProfile): void {
  memoryDatabase.set(userId, profile);
  console.log(`[Mock DB] 💾 用户 ${userId} 的画像已保存到内存`);
}

/**
 * Mock 数据库查询：读取所有用户画像（用于调试）
 * @returns 所有用户画像的键值对对象
 */
function dbGetAllProfiles(): Record<string, UserProfile> {
  const result: Record<string, UserProfile> = {};
  memoryDatabase.forEach((profile, userId) => {
    result[userId] = profile;
  });
  return result;
}

/**
 * Mock 数据库删除：删除用户画像
 * @param userId - 用户ID
 * @returns 是否删除成功
 */
function dbDeleteProfile(userId: string): boolean {
  return memoryDatabase.delete(userId);
}

// ========== 配置常量 ==========
export const MAX_MESSAGES = 10;        // 滑动窗口大小（保留的最大消息数）
export const SUMMARY_THRESHOLD = 4;    // 每次压缩的消息数（2轮对话 = 4条消息）
const SUMMARY_MARKER = '【历史对话摘要】';  // 摘要标记，用于识别和提取
const PROFILE_MARKER = '【用户画像】';     // 画像标记，用于注入 System Prompt

// ========== 用户画像 Schema ==========
/**
 * 用户画像结构定义（使用 Zod Schema）
 * generateObject 会强制 LLM 返回符合此 Schema 的 JSON 数据
 */
export const UserProfileSchema = z.object({
  profession: z.string().optional().describe('用户的职业或身份，如：程序员、设计师、学生'),
  technical_stack: z.array(z.string()).optional().describe('用户提到的编程语言或技术栈，如：["Python", "React", "AI"]'),
  preferences: z.string().optional().describe('用户的显性偏好，如喜欢的风格、讨厌的东西'),
  interests: z.array(z.string()).optional().describe('用户的兴趣领域，如：["科幻", "音乐", "游戏"]'),
  communication_style: z.string().optional().describe('用户偏好的沟通方式，如：简洁直接、详细解释、幽默风趣'),
  goals: z.string().optional().describe('用户当前的目标或正在做的项目'),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;


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


// ============================================================
// 长期记忆与画像提取 (User Profiling)
// ============================================================

/**
 * 获取用户画像
 * 从内存数据库中读取用户的长期记忆画像
 *
 * @param userId - 用户ID
 * @returns 用户画像字符串（用于注入 System Prompt）
 */
export async function getUserProfile(userId: string): Promise<string | null> {
  try {
    const profile = dbGetProfile(userId);

    if (!profile) {
      console.log(`[画像管理] 用户 ${userId} 暂无画像记录`);
      return null;
    }

    // 将画像对象转换为可读字符串
    const profileParts: string[] = [];

    if (profile.profession) {
      profileParts.push(`职业：${profile.profession}`);
    }
    if (profile.technical_stack?.length) {
      profileParts.push(`技术栈：${profile.technical_stack.join('、')}`);
    }
    if (profile.preferences) {
      profileParts.push(`偏好：${profile.preferences}`);
    }
    if (profile.interests?.length) {
      profileParts.push(`兴趣：${profile.interests.join('、')}`);
    }
    if (profile.communication_style) {
      profileParts.push(`沟通风格：${profile.communication_style}`);
    }
    if (profile.goals) {
      profileParts.push(`当前目标：${profile.goals}`);
    }

    if (profileParts.length === 0) {
      return null;
    }

    const profileString = profileParts.join('；');
    console.log(`[画像管理] 成功获取用户 ${userId} 的画像: ${profileString.substring(0, 100)}...`);
    return profileString;

  } catch (error) {
    console.error('[画像管理] 获取用户画像异常:', error);
    return null;
  }
}

/**
 * 更新用户画像
 * 将提取的新特征与现有画像合并后存入内存数据库
 *
 * @param userId - 用户ID
 * @param newTraits - 新提取的用户特征
 */
export async function updateUserProfile(userId: string, newTraits: UserProfile): Promise<void> {
  try {
    // 读取现有画像
    const existingProfile = dbGetProfile(userId) || {};

    // 智能合并画像（新特征覆盖旧特征，数组去重合并）
    const mergedProfile: UserProfile = {
      profession: newTraits.profession || existingProfile.profession,
      technical_stack: mergeArrays(existingProfile.technical_stack, newTraits.technical_stack),
      preferences: newTraits.preferences || existingProfile.preferences,
      interests: mergeArrays(existingProfile.interests, newTraits.interests),
      communication_style: newTraits.communication_style || existingProfile.communication_style,
      goals: newTraits.goals || existingProfile.goals,
    };

    // 清理空值
    const cleanedProfile = Object.fromEntries(
      Object.entries(mergedProfile).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ) as UserProfile;

    // 保存到内存数据库
    dbSaveProfile(userId, cleanedProfile);

    console.log(`[画像管理] 💾 成功更新用户 ${userId} 的画像:`, cleanedProfile);

  } catch (error) {
    console.error('[画像管理] 更新用户画像异常:', error);
  }
}

/**
 * 合并数组并去重
 */
function mergeArrays(arr1?: string[], arr2?: string[]): string[] | undefined {
  const combined = [...(arr1 || []), ...(arr2 || [])];
  if (combined.length === 0) return undefined;
  return [...new Set(combined)];
}

/**
 * 画像提取 Agent
 * 分析对话内容，提取用户的新特征
 * 使用 generateObject 强制返回结构化数据
 *
 * @param userMessage - 用户的最后一条消息
 * @param assistantResponse - AI 的回复
 * @param existingProfile - 现有的用户画像（可选）
 * @returns 提取的用户特征，如果没有提取到有效信息则返回 null
 */
export async function extractUserProfile(
  userMessage: string,
  assistantResponse: string,
  existingProfile?: string | null
): Promise<UserProfile | null> {
  try {
    console.log('[画像提取] 开始分析对话内容...');
    console.log('[画像提取] 用户消息:', userMessage);
    console.log('[画像提取] AI回复:', assistantResponse.substring(0, 100));
    console.log('[画像提取] 现有画像:', existingProfile || '无');

    const { object: extractedProfile } = await generateObject({
      model: profileModel,
      schema: UserProfileSchema,
      prompt: `你是一个用户画像分析专家。请从对话中提取用户的特征信息。

【提取策略】
1. **直接陈述**：用户明确说的信息要提取，如"我是程序员" → profession: "程序员"
2. **兴趣爱好**：用户说"我喜欢X"、"我爱X"、"我经常X" → 提取到 interests 数组
3. **技能技术**：提到编程语言、工具、框架 → 提取到 technical_stack 数组
4. **从对话推断**：结合上下文合理推断，但不要过度猜测
5. **AI回复中的确认**：如果AI在回复中确认或总结了用户特征，也可以作为参考

【示例】
- "我喜欢睡觉" → interests: ["睡觉"]
- "我喜欢AI相关的" → interests: ["AI", "人工智能"]
- "我是做后端的" → profession: "后端开发工程师"
- "经常用Python" → technical_stack: ["Python"]

【对话内容】
用户说: "${userMessage}"
AI 回复: "${assistantResponse}"

${existingProfile ? `【现有画像】\n${existingProfile}\n\n请在现有画像基础上补充新信息。` : '（这是新用户，建立初始画像）'}

请提取用户的新特征。即使是很小的信息也要提取，只有完全无关的闲聊才返回空对象 {}。`,
    });

    console.log('[画像提取] 原始提取结果:', JSON.stringify(extractedProfile));

    // 检查是否提取到了有效信息
    const hasValidInfo = Object.values(extractedProfile).some(v => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== '';
    });

    if (!hasValidInfo) {
      console.log('[画像提取] ⚠️ 未提取到有效信息，所有字段都为空');
      return null;
    }

    console.log('[画像提取] ✅ 成功提取用户特征:', extractedProfile);
    return extractedProfile;

  } catch (error) {
    console.error('[画像提取] ❌ 提取失败:', error);
    return null;
  }
}

/**
 * 构建包含用户画像的完整 System Prompt
 * 将基础 prompt、历史摘要、用户画像合并
 * 
 * @param baseSystemPrompt - 基础 system prompt
 * @param summary - 历史对话摘要（可选）
 * @param userProfile - 用户画像（可选）
 * @returns 完整的 system prompt
 */
export function buildFullSystemPrompt(
  baseSystemPrompt: string,
  summary: string | null,
  userProfile: string | null
): string {
  let fullPrompt = baseSystemPrompt;

  // 注入用户画像（长期记忆）
  if (userProfile) {
    fullPrompt += `\n\n${PROFILE_MARKER}：${userProfile}\n\n【画像使用指引】\n- 用户画像是已知信息，你可以自由使用这些信息来个性化回答\n- 当用户问"你知道我什么信息"、"你知道我的xx吗"等问题时，要基于画像回答\n- 当用户询问建议或需要推荐时，结合画像中的信息给出针对性建议\n- 在日常对话中，自然地融入画像信息（例如：作为程序员，你可能对...）`;
    console.log('[画像注入] ✅ 用户画像已注入到 System Prompt');
    console.log('[画像注入] 画像内容:', userProfile);
  } else {
    console.log('[画像注入] ⚠️ 用户画像为空，未注入');
  }

  // 注入历史摘要（短期记忆压缩）
  if (summary) {
    fullPrompt += `\n\n${SUMMARY_MARKER}：${summary}`;
    console.log('[摘要注入] ✅ 历史摘要已注入到 System Prompt');
  } else {
    console.log('[摘要注入] ⚠️ 历史摘要为空，未注入');
  }

  console.log('[完整 System Prompt] 长度:', fullPrompt.length, '字符');
  console.log('[完整 System Prompt] 内容预览:', fullPrompt.substring(0, 300) + '...');

  return fullPrompt;
}

/**
 * 创建 onFinish 回调函数
 * 用于在对话结束后触发画像提取（旁路监听模式）
 *
 * @param userId - 用户ID
 * @param lastUserMessage - 用户最后一条消息
 * @param existingProfile - 现有用户画像
 * @returns onFinish 回调函数
 */
export function createProfileExtractionCallback(
  userId: string,
  lastUserMessage: string,
  existingProfile: string | null
) {
  return async ({ text: assistantResponse }: { text: string }) => {
    // 异步执行，不阻塞主对话
    console.log('[画像提取] 🔄 onFinish 回调被触发');
    console.log('[画像提取] 用户消息:', lastUserMessage.substring(0, 100));
    console.log('[画像提取] AI 回复长度:', assistantResponse?.length || 0);

    try {
      // 跳过空回复或工具调用结果
      if (!assistantResponse || assistantResponse.length < 10) {
        console.log('[画像提取] ⏭️ 跳过：回复内容过短');
        return;
      }

      console.log('[画像提取] 🤖 开始提取用户画像...');
      // 触发画像提取 Agent
      const extractedProfile = await extractUserProfile(
        lastUserMessage,
        assistantResponse,
        existingProfile
      );

      // 如果提取到了有效信息，更新数据库
      if (extractedProfile) {
        console.log('[画像提取] ✅ 提取到有效画像，准备保存');
        await updateUserProfile(userId, extractedProfile);
      } else {
        console.log('[画像提取] ⚠️ 未提取到有效信息');
      }
    } catch (error) {
      // 画像提取失败不应影响主对话
      console.error('[画像提取] ❌ 旁路处理失败:', error);
    }
  };
}

// ========== 调试和测试工具函数 ==========

/**
 * 获取内存数据库中的所有用户画像（仅用于调试）
 * @returns 所有用户画像的键值对对象
 */
export function getAllProfilesForDebug(): Record<string, UserProfile> {
  return dbGetAllProfiles();
}

/**
 * 清空内存数据库（仅用于测试）
 * ⚠️ 警告：此操作会删除所有用户数据，不可恢复！
 */
export function clearMemoryDatabase(): void {
  console.warn('[Mock DB] ⚠️ 清空所有用户画像数据');
  memoryDatabase.clear();
}

/**
 * 删除指定用户的画像（仅用于测试）
 * @param userId - 用户ID
 * @returns 是否删除成功
 */
export function deleteUserProfile(userId: string): boolean {
  const success = dbDeleteProfile(userId);
  if (success) {
    console.log(`[Mock DB] 🗑️ 用户 ${userId} 的画像已删除`);
  }
  return success;
}

/**
 * 获取内存数据库中的用户数量（仅用于调试）
 * @returns 用户数量
 */
export function getDatabaseSize(): number {
  return memoryDatabase.size;
}

