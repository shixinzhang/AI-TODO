import "dotenv/config";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { logger } from "../lib/logger.js";

// 通过 OpenRouter 调用 Gemini 图像生成模型
// 走 chat.completions 端点，加 modalities: ["text", "image"]
const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.OPENAI_API_BASE_URL,
});

export const generateImageTool = tool(
  async ({ prompt, filename, outputDir }) => {
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, filename);

    const model = process.env.IMAGE_MODEL || "google/gemini-flash-1.5";
    logger.info("image.generate.start", {
      model,
      baseURL: process.env.OPENAI_API_BASE_URL,
      filename,
      outputDir,
      outputPath,
      promptLength: typeof prompt === "string" ? prompt.length : 0,
    });

    let resp;
    try {
      if (shouldUseImagesEndpoint(model)) {
        const savedPath = await generateViaImagesEndpoint({
          model,
          prompt,
          filename,
          outputDir,
        });
        return savedPath;
      }

      resp = await imageClient.chat.completions.create({
        model,
        // @ts-ignore — OpenRouter 扩展字段
        modalities: ["text", "image"],
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      });
    } catch (err) {
      logger.error("image.generate.request_failed", formatOpenAIError(err, { model, filename }));
      throw err;
    }

    const choice0 = resp?.choices?.[0];
    const message0 = choice0?.message;
    const content = message0?.content;

    logger.info("image.generate.response", {
      model,
      id: resp?.id,
      created: resp?.created,
      providerModel: resp?.model,
      usage: resp?.usage,
      finishReason: choice0?.finish_reason,
      contentSummary: summarizeContent(content),
    });

    const items = Array.isArray(content) ? content : [];
    for (const item of items) {
      if (item?.type === "image_url" && item?.image_url?.url) {
        const url = String(item.image_url.url);
        if (url.startsWith("data:image/")) {
          const mime = parseDataUrlMime(url);
          const base64Data = url.replace(/^data:image\/\w+;base64,/, "");
          const decoded = Buffer.from(base64Data, "base64");
          const normalized = normalizeImageBuffer(decoded);
          const finalMime = mime || normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
          const finalOutputPath = getOutputPathForMime(outputDir, filename, finalMime);
          fs.writeFileSync(finalOutputPath, normalized.buffer);
          logger.info("image.generate.saved", {
            filename,
            outputPath: finalOutputPath,
            bytes: fs.statSync(finalOutputPath).size,
            source: "data_url",
            mime: finalMime,
            prefixStripped: normalized.prefixStripped,
            aigcSegmentStripped: normalized.aigcSegmentStripped,
          });
          return finalOutputPath;
        }

        if (/^https?:\/\//i.test(url)) {
          const downloaded = await downloadHttpUrl(url);
          if (!downloaded.ok) {
            logger.error("image.generate.download_failed", {
              filename,
              outputPath,
              url,
              status: downloaded.status,
              contentType: downloaded.contentType,
              bodySnippet: downloaded.bodySnippet,
            });
            throw new Error(`生图失败：图片下载失败（HTTP ${downloaded.status}）`);
          }
          const normalized = normalizeImageBuffer(downloaded.buffer);
          const mimeFromHeader = typeof downloaded.contentType === "string"
            ? downloaded.contentType.split(";")[0].trim()
            : undefined;
          const finalMime = mimeFromHeader || normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
          const finalOutputPath = getOutputPathForMime(outputDir, filename, finalMime);
          fs.writeFileSync(finalOutputPath, normalized.buffer);
          logger.info("image.generate.saved", {
            filename,
            outputPath: finalOutputPath,
            bytes: fs.statSync(finalOutputPath).size,
            source: "http_url",
            mime: finalMime,
            prefixStripped: normalized.prefixStripped,
            aigcSegmentStripped: normalized.aigcSegmentStripped,
          });
          return finalOutputPath;
        }
      }
    }

    if (typeof content === "string") {
      const extracted = extractFirstImageUrlFromText(content);
      if (extracted?.startsWith("data:image/")) {
        const mime = parseDataUrlMime(extracted);
        const base64Data = extracted.replace(/^data:image\/\w+;base64,/, "");
        const decoded = Buffer.from(base64Data, "base64");
        const normalized = normalizeImageBuffer(decoded);
        const finalMime = mime || normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
        const finalOutputPath = getOutputPathForMime(outputDir, filename, finalMime);
        fs.writeFileSync(finalOutputPath, normalized.buffer);
        logger.info("image.generate.saved", {
          filename,
          outputPath: finalOutputPath,
          bytes: fs.statSync(finalOutputPath).size,
          source: "text_markdown_data_url",
          mime: finalMime,
          prefixStripped: normalized.prefixStripped,
          aigcSegmentStripped: normalized.aigcSegmentStripped,
        });
        return finalOutputPath;
      }

      if (extracted && /^https?:\/\//i.test(extracted)) {
        const downloaded = await downloadHttpUrl(extracted);
        if (!downloaded.ok) {
          logger.error("image.generate.download_failed", {
            filename,
            outputPath,
            url: extracted,
            status: downloaded.status,
            contentType: downloaded.contentType,
            bodySnippet: downloaded.bodySnippet,
          });
          throw new Error(`生图失败：图片下载失败（HTTP ${downloaded.status}）`);
        }
        const normalized = normalizeImageBuffer(downloaded.buffer);
        const mimeFromHeader = typeof downloaded.contentType === "string"
          ? downloaded.contentType.split(";")[0].trim()
          : undefined;
        const finalMime = mimeFromHeader || normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
        const finalOutputPath = getOutputPathForMime(outputDir, filename, finalMime);
        fs.writeFileSync(finalOutputPath, normalized.buffer);
        logger.info("image.generate.saved", {
          filename,
          outputPath: finalOutputPath,
          bytes: fs.statSync(finalOutputPath).size,
          source: "text_markdown_http_url",
          mime: finalMime,
          prefixStripped: normalized.prefixStripped,
          aigcSegmentStripped: normalized.aigcSegmentStripped,
        });
        return finalOutputPath;
      }
    }

    logger.warn("image.generate.no_image", {
      model,
      filename,
      responseKeys: resp ? Object.keys(resp) : [],
      choiceKeys: choice0 ? Object.keys(choice0) : [],
      messageKeys: message0 ? Object.keys(message0) : [],
      contentSummary: summarizeContent(content),
    });
    throw new Error("生图失败：响应中没有图片数据");
  },
  {
    name: "generate_image",
    description:
      "根据描述生成一张配图，保存到指定目录，返回文件路径。适合为文章段落生成说明性插图。",
    schema: z.object({
      prompt:    z.string().describe("图片的详细描述，英文效果更好"),
      filename:  z.string().describe("保存的文件名，如 intro.png"),
      outputDir: z.string().describe("保存目录"),
    }),
  }
);

async function generateViaImagesEndpoint({ model, prompt, filename, outputDir }) {
  logger.info("image.generate.images.start", {
    model,
    baseURL: process.env.OPENAI_API_BASE_URL,
    filename,
    outputDir,
    promptLength: typeof prompt === "string" ? prompt.length : 0,
  });

  let resp;
  try {
    resp = await imageClient.images.generate({
      model,
      prompt,
      // 兼容更多提供方：优先要 base64，若不支持会忽略或报错
      // @ts-ignore
      response_format: "b64_json",
    });
  } catch (err) {
    logger.error(
      "image.generate.images.request_failed",
      formatOpenAIError(err, { model, filename })
    );
    throw err;
  }

  const first = Array.isArray(resp?.data) ? resp.data[0] : undefined;
  logger.info("image.generate.images.response", {
    model,
    created: resp?.created,
    hasData: Array.isArray(resp?.data),
    firstKeys: first ? Object.keys(first) : [],
  });

  if (first?.b64_json) {
    const raw = String(first.b64_json);
    if (raw.startsWith("data:image/")) {
      const mime = parseDataUrlMime(raw);
      const finalOutputPath = getOutputPathForMime(outputDir, filename, mime);
      const base64Data = raw.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(finalOutputPath, Buffer.from(base64Data, "base64"));
      logger.info("image.generate.saved", {
        filename,
        outputPath: finalOutputPath,
        bytes: fs.statSync(finalOutputPath).size,
        source: "images_b64_data_url",
        mime,
      });
      return finalOutputPath;
    }

    const decoded = Buffer.from(raw, "base64");
    const normalized = normalizeImageBuffer(decoded);
    const mime = normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
    const finalOutputPath = getOutputPathForMime(outputDir, filename, mime);
    fs.writeFileSync(finalOutputPath, normalized.buffer);
    logger.info("image.generate.saved", {
      filename,
      outputPath: finalOutputPath,
      bytes: fs.statSync(finalOutputPath).size,
      source: "images_b64_json",
      mime,
      prefixStripped: normalized.prefixStripped,
    });
    return finalOutputPath;
  }

  if (first?.url && /^https?:\/\//i.test(String(first.url))) {
    const url = String(first.url);
    const downloaded = await downloadHttpUrl(url);
    if (!downloaded.ok) {
      logger.error("image.generate.download_failed", {
        filename,
        outputPath: path.join(outputDir, filename),
        url,
        status: downloaded.status,
        contentType: downloaded.contentType,
        bodySnippet: downloaded.bodySnippet,
      });
      throw new Error(`生图失败：图片下载失败（HTTP ${downloaded.status}）`);
    }

    const mimeFromHeader = typeof downloaded.contentType === "string"
      ? downloaded.contentType.split(";")[0].trim()
      : undefined;
    const normalized = normalizeImageBuffer(downloaded.buffer);
    const mime = mimeFromHeader || normalized.mime || detectImageMimeFromBuffer(normalized.buffer);
    const finalOutputPath = getOutputPathForMime(outputDir, filename, mime);
    fs.writeFileSync(finalOutputPath, normalized.buffer);
    logger.info("image.generate.saved", {
      filename,
      outputPath: finalOutputPath,
      bytes: fs.statSync(finalOutputPath).size,
      source: "images_url",
      mime,
      prefixStripped: normalized.prefixStripped,
    });
    return finalOutputPath;
  }

  logger.warn("image.generate.images.no_image", {
    model,
    filename,
    responseKeys: resp ? Object.keys(resp) : [],
    firstKeys: first ? Object.keys(first) : [],
  });
  throw new Error("生图失败：images.generate 响应中没有图片数据");
}

function shouldUseImagesEndpoint(model) {
  const m = typeof model === "string" ? model.toLowerCase() : "";
  return m.startsWith("doubao-") || m.includes("seedream");
}

function detectImageMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return undefined;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return undefined;
}

function normalizeImageBuffer(buffer) {
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpegSig = Buffer.from([0xff, 0xd8, 0xff]);
  const riffSig = Buffer.from("RIFF");

  const candidates = [];
  const jpegAt = buffer.indexOf(jpegSig);
  if (jpegAt !== -1) candidates.push({ offset: jpegAt, mime: "image/jpeg" });

  const pngAt = buffer.indexOf(pngSig);
  if (pngAt !== -1) candidates.push({ offset: pngAt, mime: "image/png" });

  let webpAt = buffer.indexOf(riffSig);
  while (webpAt !== -1) {
    if (
      buffer.length >= webpAt + 12 &&
      buffer.toString("ascii", webpAt + 8, webpAt + 12) === "WEBP"
    ) {
      candidates.push({ offset: webpAt, mime: "image/webp" });
      break;
    }
    webpAt = buffer.indexOf(riffSig, webpAt + 1);
  }

  if (candidates.length === 0) {
    return { buffer, mime: undefined, prefixStripped: 0, aigcSegmentStripped: false };
  }

  candidates.sort((a, b) => a.offset - b.offset);
  const best = candidates[0];
  let sliced = buffer.slice(best.offset);
  let aigcSegmentStripped = false;

  if (best.mime === "image/jpeg") {
    const stripped = stripAigcJpegSegment(sliced);
    if (stripped !== sliced) {
      aigcSegmentStripped = true;
      sliced = stripped;
    }
  }

  if (best.mime === "image/jpeg") {
    const eoi = sliced.lastIndexOf(Buffer.from([0xff, 0xd9]));
    if (eoi !== -1) sliced = sliced.slice(0, eoi + 2);
  }

  return {
    buffer: sliced,
    mime: best.mime,
    prefixStripped: best.offset,
    aigcSegmentStripped,
  };
}

function stripAigcJpegSegment(buffer) {
  if (buffer.length < 6) return buffer;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  if (buffer[2] !== 0xff || buffer[3] !== 0xeb) return buffer;
  const segLen = (buffer[4] << 8) | buffer[5];
  if (!Number.isFinite(segLen) || segLen < 2) return buffer;
  const segEnd = 4 + segLen;
  if (segEnd > buffer.length) return buffer;
  const markerPayload = buffer.slice(6, Math.min(segEnd, buffer.length));
  if (markerPayload.indexOf(Buffer.from("AIGC")) === -1) return buffer;
  return Buffer.concat([buffer.slice(0, 2), buffer.slice(segEnd)]);
}

function summarizeContent(content) {
  if (Array.isArray(content)) {
    return content.slice(0, 8).map((item) => {
      const type = item?.type;
      if (type === "text") {
        return {
          type,
          textLength: typeof item?.text === "string" ? item.text.length : undefined,
          textSnippet: typeof item?.text === "string" ? item.text.slice(0, 120) : undefined,
        };
      }
      if (type === "image_url") {
        const url = item?.image_url?.url;
        const urlStr = typeof url === "string" ? url : undefined;
        return {
          type,
          urlType: urlStr?.startsWith("data:image/") ? "data_url" : urlStr ? "url" : "missing",
          urlPrefix: urlStr ? urlStr.slice(0, 60) : undefined,
          urlLength: urlStr ? urlStr.length : undefined,
        };
      }
      return { type: type ?? typeof item };
    });
  }

  if (typeof content === "string") {
    return { type: "string", length: content.length, snippet: content.slice(0, 300) };
  }

  return { type: typeof content };
}

function extractFirstImageUrlFromText(text) {
  if (typeof text !== "string" || text.length === 0) return undefined;
  const mdMatch = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdMatch?.[1]) return mdMatch[1].trim();

  const dataMatch = text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+/);
  if (dataMatch?.[0]) return dataMatch[0];

  const httpMatch = text.match(/https?:\/\/[^\s)]+/);
  if (httpMatch?.[0]) return httpMatch[0];

  return undefined;
}

function parseDataUrlMime(dataUrl) {
  if (typeof dataUrl !== "string") return undefined;
  const m = dataUrl.match(/^data:([^;]+);base64,/);
  return m?.[1];
}

function getOutputPathForMime(outputDir, filename, mime) {
  const targetExt = mimeToExtension(mime);
  if (!targetExt) return path.join(outputDir, filename);
  const parsed = path.parse(filename);
  const currentExt = parsed.ext.toLowerCase();
  if (currentExt === targetExt) return path.join(outputDir, filename);
  return path.join(outputDir, `${parsed.name}${targetExt}`);
}

function mimeToExtension(mime) {
  const m = typeof mime === "string" ? mime.toLowerCase() : "";
  if (m === "image/png") return ".png";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/webp") return ".webp";
  return undefined;
}

function formatOpenAIError(err, meta = {}) {
  const anyErr = err;
  return {
    ...meta,
    name: anyErr?.name,
    message: anyErr?.message,
    stack: typeof anyErr?.stack === "string" ? anyErr.stack.split("\n").slice(0, 8).join("\n") : undefined,
    status: anyErr?.status,
    code: anyErr?.code,
    type: anyErr?.type,
    param: anyErr?.param,
    requestId: anyErr?.request_id ?? anyErr?.requestId,
    error: anyErr?.error,
    cause: anyErr?.cause ? { name: anyErr.cause.name, message: anyErr.cause.message } : undefined,
  };
}

function downloadHttpUrl(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.get(parsed, (res) => {
      const status = res.statusCode ?? 0;
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentTypeRaw = res.headers["content-type"];
        const contentType = Array.isArray(contentTypeRaw)
          ? contentTypeRaw.join(", ")
          : contentTypeRaw;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          buffer,
          contentType,
          bodySnippet: buffer.toString("utf8", 0, 500),
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.setTimeout(30000, () => req.destroy(new Error("download timeout")));
  });
}
