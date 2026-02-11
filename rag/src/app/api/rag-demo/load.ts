import path from "path";
import fs from "fs";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { JSONLoader } from "@langchain/classic/document_loaders/fs/json";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { DATA_DIR } from "./shared";

export type LoadAction =
  | "load-text"
  | "load-json"
  | "load-csv"
  | "load-web"
  | "load-pdf"
  | "load-pdf-web"
  | "load-directory";

export async function handleLoad(
  action: LoadAction,
  dataDir: string = DATA_DIR
): Promise<Record<string, unknown>> {
  switch (action) {
    case "load-text": {
      const textLoader = new TextLoader(path.join(dataDir, "refund_policy.md"));
      const textDocs = await textLoader.load();
      return {
        type: "TextLoader",
        count: textDocs.length,
        preview: textDocs[0].pageContent,
      };
    }

    case "load-json": {
      const jsonLoader = new JSONLoader(
        path.join(dataDir, "sample.json"),
        "/name"
      );
      const jsonDocs = await jsonLoader.load();
      return {
        type: "JSONLoader",
        count: jsonDocs.length,
        preview: jsonDocs[0].pageContent,
      };
    }

    case "load-csv": {
      const csvLoader = new CSVLoader(path.join(dataDir, "products.csv"));
      const csvDocs = await csvLoader.load();
      return {
        type: "CSVLoader",
        count: csvDocs.length,
        preview: csvDocs.map((d) => d.pageContent),
      };
    }

    case "load-web": {
      const webLoader = new CheerioWebBaseLoader(
        "https://shixin.blog.csdn.net/"
      );
      const webDocs = await webLoader.load();
      return {
        type: "CheerioWebBaseLoader",
        count: webDocs.length,
        title: webDocs[0].metadata.title,
        preview: webDocs[0].pageContent.slice(0, 200) + "...",
      };
    }

    case "load-pdf": {
      const pdfPath = fs.existsSync(path.join(dataDir, "complex_sample.pdf"))
        ? path.join(dataDir, "complex_sample.pdf")
        : path.join(dataDir, "sample.pdf");
      const pdfLoader = new PDFLoader(pdfPath);
      const pdfDocs = await pdfLoader.load();
      return {
        type: "PDFLoader (Standard)",
        file: path.basename(pdfPath),
        count: pdfDocs.length,
        preview: pdfDocs[0].pageContent.slice(0, 300),
      };
    }

    case "load-pdf-web": {
      const webPdfPath = fs.existsSync(path.join(dataDir, "complex_sample.pdf"))
        ? path.join(dataDir, "complex_sample.pdf")
        : path.join(dataDir, "sample.pdf");
      const blob = new Blob([await fs.promises.readFile(webPdfPath)]);
      const webPdfLoader = new WebPDFLoader(blob, { splitPages: false });
      const webPdfDocs = await webPdfLoader.load();
      return {
        type: "WebPDFLoader (Advanced)",
        file: path.basename(webPdfPath),
        count: webPdfDocs.length,
        preview: webPdfDocs[0].pageContent.slice(0, 300),
        note: "WebPDFLoader 基于 pdfjs-dist，适合处理多栏、表格等复杂 PDF 布局。",
      };
    }

    case "load-directory": {
      try {
        const loader = new DirectoryLoader(dataDir, {
          ".txt": (p) => new TextLoader(p),
          ".json": (p) => new JSONLoader(p, "/name"),
          ".pdf": (p) => new PDFLoader(p, { splitPages: false }),
        });
        const docs = await loader.load();
        return {
          type: "DirectoryLoader",
          totalDocs: docs.length,
          files: docs.map((d) => path.basename(d.metadata.source as string)),
          previews: docs.map(
            (d) => d.pageContent.slice(0, 50).replace(/\n/g, " ") + "..."
          ),
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          type: "DirectoryLoader",
          error: "DirectoryLoader failed: " + message,
        };
      }
    }

    default:
      return { error: "Unknown load action" };
  }
}
