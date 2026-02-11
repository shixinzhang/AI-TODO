import { Database, X, ChevronLeft, ChevronRight } from "lucide-react";

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documents: any[];
  // Pagination props are optional because "Query Sources" view doesn't need them
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalDocs: number;
    onPageChange: (page: number) => void;
  };
}

export default function DocumentsModal({
  isOpen,
  onClose,
  title,
  documents,
  pagination,
}: DocumentsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {documents.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              No documents found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                  <tr>
                    <th className="p-3 w-16">ID</th>
                    <th className="p-3">Content</th>
                    <th className="p-3 w-32">Source</th>
                    <th className="p-3 w-48">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc, idx) => {
                    let pdfInfo = null;
                    try {
                      if (doc.pdf) pdfInfo = JSON.parse(doc.pdf).info;
                    } catch (e) {}
                    // Fallback if metadata is directly on doc (for sources) or inside doc.metadata
                    const metadata = doc.metadata || doc;

                    let locInfo = null;
                    try {
                      if (metadata.loc)
                        locInfo =
                          typeof metadata.loc === "string"
                            ? JSON.parse(metadata.loc)
                            : metadata.loc;
                    } catch (e) {}

                    // Handle PDF info for sources too
                    try {
                      if (metadata.pdf && !pdfInfo) {
                        const parsed =
                          typeof metadata.pdf === "string"
                            ? JSON.parse(metadata.pdf)
                            : metadata.pdf;
                        pdfInfo = parsed.info || parsed;
                      }
                    } catch (e) {}

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="p-3 align-top font-mono text-xs text-blue-600">
                          {doc.langchain_primaryid || doc.id || idx + 1}
                        </td>
                        <td className="p-3 align-top">
                          <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-gray-700 text-xs leading-relaxed">
                            {doc.langchain_text || doc.pageContent || doc.text}
                          </div>
                        </td>
                        <td className="p-3 align-top text-xs text-gray-500 break-all">
                          {doc.source || metadata.source || "Unknown"}
                        </td>
                        <td className="p-3 align-top text-xs text-gray-500 space-y-1">
                          {locInfo?.lines && (
                            <div className="bg-gray-100 px-2 py-1 rounded inline-block">
                              Lines: {locInfo.lines.from}-{locInfo.lines.to}
                            </div>
                          )}
                          {pdfInfo?.Producer && (
                            <div
                              className="truncate max-w-[180px]"
                              title={pdfInfo.Producer}
                            >
                              {pdfInfo.Producer}
                            </div>
                          )}
                          {(doc.langchain_vector ||
                            metadata.langchain_vector) && (
                            <div className="text-[10px] text-gray-400">
                              Dim:{" "}
                              {Array.isArray(
                                doc.langchain_vector || metadata.langchain_vector
                              )
                                ? (
                                    doc.langchain_vector ||
                                    metadata.langchain_vector
                                  ).length
                                : "N/A"}
                            </div>
                          )}
                          {(doc.relevanceScore !== undefined || doc.score !== undefined) && (
                            <div className="flex flex-col gap-1 mt-1">
                              {doc.relevanceScore !== undefined && (
                                <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-bold">
                                  Rerank: {doc.relevanceScore}
                                </div>
                              )}
                              {doc.score !== undefined && (
                                <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-medium">
                                  Vector: {typeof doc.score === 'number' ? doc.score.toFixed(4) : doc.score}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination & Footer */}
        <div className="p-4 border-t flex items-center justify-between bg-white">
          {!pagination ? (
            <div className="text-sm text-gray-500">
              Showing top {documents.length} relevant results
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Page {pagination.currentPage} of{" "}
              {Math.ceil(pagination.totalDocs / pagination.pageSize) || 1} (
              {pagination.totalDocs} items)
            </div>
          )}

          <div className="flex items-center gap-2">
            {pagination && (
              <>
                <button
                  onClick={() =>
                    pagination.onPageChange(pagination.currentPage - 1)
                  }
                  disabled={pagination.currentPage <= 1}
                  className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    pagination.onPageChange(pagination.currentPage + 1)
                  }
                  disabled={
                    pagination.currentPage >=
                    Math.ceil(pagination.totalDocs / pagination.pageSize)
                  }
                  className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
