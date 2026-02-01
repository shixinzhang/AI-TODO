from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import SimpleDirectoryReader

# 演示 LlamaIndex 语义分块
# 需要安装: pip install llama-index llama-index-embeddings-openai

def semantic_chunking():
    # 1. 加载文档
    documents = SimpleDirectoryReader("../demo-data").load_data()
    
    # 2. 创建语义切分器
    # 它会计算句子间的相似度，当相似度低于阈值时进行切分
    splitter = SemanticSplitterNodeParser(
        buffer_size=1,
        breakpoint_percentile_threshold=95, 
        embed_model=OpenAIEmbedding()
    )
    
    # 3. 获取节点 (Chunks)
    nodes = splitter.get_nodes_from_documents(documents)
    
    print(f"Original Docs: {len(documents)}")
    print(f"Semantic Nodes: {len(nodes)}")
    for node in nodes[:3]:
        print(f"--- Node ---\n{node.get_content()[:100]}...\n")

if __name__ == "__main__":
    semantic_chunking()
