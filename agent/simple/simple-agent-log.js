/**
 * simple-agent 的调试输出：写到 stderr，避免和 stdout 上的最终回复、管道混在一起。
 * @param {number} turnIndex 当前用户输入下，第几次调用 chat.completions（ReAct 内循环轮次）
 * @param {object} assistantMessage 即 API 返回的 choices[0].message（含 role、content、tool_calls、refusal 等）
 */
export function printLlmTurn(turnIndex, assistantMessage) {
  const W = 60;
  const line = "━".repeat(W);
  const title = ` LLM 第 ${turnIndex} 轮 `;
  const side = Math.max(0, Math.floor((W - title.length) / 2));
  const mid = `${"━".repeat(side)}${title}${"━".repeat(W - side - title.length)}`;

  const tty = process.stderr.isTTY;
  const b = tty ? "\x1b[1;36m" : ""; // 粗体青
  const y = tty ? "\x1b[33m" : ""; // 黄：正文
  const m = tty ? "\x1b[35m" : ""; // 紫：工具
  const r = tty ? "\x1b[0m" : "";

  process.stderr.write(`\n${b}${line}\n${mid}\n${line}${r}\n`);

  // 与 simple-agent.js 里 choices[0].message 为同一对象；JSON 便于看到 role / refusal 等全部字段
  const j = tty ? "\x1b[90m" : ""; // 灰：整段结构化转储
  process.stderr.write(`${j}【LLM response 完整】${r}\n`);
  process.stderr.write(JSON.stringify(assistantMessage, null, 2) + "\n");

  const c = assistantMessage.content;
  const hasText =
    c != null && (typeof c !== "string" || c.length > 0);

  if (hasText) {
    // 与 API 一致：字符串原样输出（不 trim）；其余类型用 JSON，便于对照文档
    const contentRaw =
      typeof c === "string" ? c : JSON.stringify(c, null, 2);
    // process.stderr.write(`${y}【模型正文·原始】${r}\n${contentRaw}\n`);
  }

  if (assistantMessage.tool_calls?.length) {
    process.stderr.write(`${m}【工具调用信息】${r}\n`);
    process.stderr.write(JSON.stringify(assistantMessage.tool_calls, null, 2) + "\n");
  }

  process.stderr.write(`${b}${line}${r}\n\n`);
}
