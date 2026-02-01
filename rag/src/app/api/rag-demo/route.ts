import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR } from "./shared";
import { handleLoad, type LoadAction } from "./load";
import { handleSplitText } from "./split";
import { handleVectorize, type VectorizeAction } from "./vectorize";
import { handleRetrieval } from "./retrieval";
import {
  handleRetrievalPre,
  type RetrievalPreAction,
} from "./retrieval-pre";
import {
  handleRetrievalPost,
  type RetrievalPostAction,
} from "./retrieval-post";
import { handleGeneration, type GenerationAction } from "./generation";

const LOAD_ACTIONS: LoadAction[] = [
  "load-text",
  "load-json",
  "load-csv",
  "load-web",
  "load-pdf",
  "load-pdf-web",
  "load-directory",
];

const VECTORIZE_ACTIONS: VectorizeAction[] = [
  "embedding",
  "vector-store-memory",
  "vector-store-chroma",
];

const RETRIEVAL_PRE_ACTIONS: RetrievalPreAction[] = [
  "retrieval-multi-query",
  "retrieval-hyde",
];

const RETRIEVAL_POST_ACTIONS: RetrievalPostAction[] = [
  "retrieval-contextual-compression",
  "retrieval-rerank",
  "retrieval-parent-document",
];

const GENERATION_ACTIONS: GenerationAction[] = [
  "generation",
  "generation-json",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;
    if (typeof action !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'action' in request body" },
        { status: 400 }
      );
    }
    const apiKey =
      req.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY;

    let result: Record<string, unknown> = {};

    if (LOAD_ACTIONS.includes(action as LoadAction)) {
      result = await handleLoad(action as LoadAction, DATA_DIR);
    } else if (action === "split-text") {
      result = await handleSplitText(DATA_DIR);
    } else if (VECTORIZE_ACTIONS.includes(action as VectorizeAction)) {
      result = await handleVectorize(
        action as VectorizeAction,
        apiKey || "",
        DATA_DIR
      );
    } else if (action === "retrieval") {
      result = await handleRetrieval(apiKey || "", DATA_DIR);
    } else if (RETRIEVAL_PRE_ACTIONS.includes(action as RetrievalPreAction)) {
      result = await handleRetrievalPre(
        action as RetrievalPreAction,
        apiKey || "",
        DATA_DIR
      );
    } else if (RETRIEVAL_POST_ACTIONS.includes(action as RetrievalPostAction)) {
      const cohereApiKey =
        req.headers.get("x-cohere-api-key") || process.env.COHERE_API_KEY;
      result = await handleRetrievalPost(action as RetrievalPostAction, {
        apiKey: apiKey || "",
        dataDir: DATA_DIR,
        cohereApiKey,
      });
    } else if (GENERATION_ACTIONS.includes(action as GenerationAction)) {
      result = await handleGeneration(action as GenerationAction, apiKey || "");
    } else {
      result = { error: "Unknown action" };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("RAG Demo Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
