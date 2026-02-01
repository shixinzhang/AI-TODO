import pdfplumber
import pandas as pd

# 演示使用 pdfplumber 提取表格
# 需要安装: pip install pdfplumber pandas

def extract_tables(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            print(f"--- Page {i+1} ---")
            for table in tables:
                df = pd.DataFrame(table)
                print(df)
                print("\n")

if __name__ == "__main__":
    # 请确保文件存在
    extract_tables("../demo-data/sample.pdf")
