import argparse
import time
import signal
import sys
import os
from milvus_lite.server import Server

def run_server(db_file, address):
    # 确保数据库文件路径是绝对路径
    db_file = os.path.abspath(db_file)
    print(f"正在初始化 Milvus Lite 服务器...")
    print(f"数据库文件: {db_file}")
    print(f"监听地址:   {address}")

    # 实例化 Server
    # 根据源码: def __init__(self, db_file: str, address: Optional[str] = None)
    server = Server(db_file=db_file, address=address)
    
    # 初始化检查
    if not server.init():
        print("错误: 服务器初始化失败 (请检查 milvus-lite 安装).")
        sys.exit(1)
        
    # 启动服务器
    if not server.start():
        print("错误: 服务器启动失败.")
        sys.exit(1)
        
    print(f"\n✅ Milvus Lite 服务器已成功启动!")
    print(f"➡  地址: {address}")
    print("按 Ctrl+C 停止服务器...")

    # 优雅退出的处理函数
    def stop_handler(sig, frame):
        print("\n正在停止服务器...")
        server.stop()
        print("服务器已停止.")
        sys.exit(0)

    # 注册信号处理
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    # 保持主线程运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_handler(None, None)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="启动 Milvus Lite 独立服务器")
    parser.add_argument("--data", default="./milvus_data/milvus.db", help="数据库文件路径 (默认: ./milvus_data/milvus.db)")
    parser.add_argument("--host", default="localhost", help="监听主机 (默认: localhost)")
    parser.add_argument("--port", default="19530", help="监听端口 (默认: 19530)")
    
    args = parser.parse_args()
    
    # 确保数据目录存在
    data_dir = os.path.dirname(args.data)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    full_address = f"{args.host}:{args.port}"
    
    run_server(args.data, full_address)
