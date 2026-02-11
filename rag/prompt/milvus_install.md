根据要求安装 milvus:

#### 第一步：创建虚拟环境
```bash
# 在项目根目录下创建名为 .venv 的虚拟环境
python3 -m venv .venv
```

#### 第二步：安装 Milvus 及依赖
我们需要安装 `milvus` 包来获取 `milvus-server` 可执行文件。

```bash
.venv/bin/pip install milvus
```

> **注意：依赖地狱 (Dependency Hell)**
> 
> 在实际安装过程中，您可能会遇到一系列 `ModuleNotFoundError` 错误。这是因为 `milvus` 或 `milvus-lite` 依赖的一些底层库没有被自动拉取。
> 
> **如果您遇到以下错误，请按顺序执行修复命令：**
>
> 1. **错误**: `ModuleNotFoundError: No module named 'pkg_resources'`
>    *   **原因**: 缺少 `setuptools`。
>    *   **修复**: 
>        ```bash
>        .venv/bin/pip install setuptools
>        ```
>
> 2. **错误**: `ModuleNotFoundError: No module named 'numpy'`
>    *   **原因**: 缺少数值计算库。
>    *   **修复**:
>        ```bash
>        .venv/bin/pip install numpy
>        ```
>
> 3. **错误**: `ModuleNotFoundError: No module named 'pymilvus'`
>    *   **原因**: 缺少 Milvus Python SDK。
>    *   **修复**:
>        ```bash
>        .venv/bin/pip install pymilvus
>        ```
>
> 4. **错误**: `ModuleNotFoundError: Missing packages: ['minio', 'azure', 'requests', 'pyarrow']`
>    *   **原因**: 缺少批量数据处理相关的依赖（`bulk_writer`）。
>    *   **修复**:
>        ```bash
>        .venv/bin/pip install "pymilvus[bulk_writer]"
>        ```

### 2. 验证安装
检查 `.venv/bin` 目录下是否存在 `milvus-server` 可执行文件：

```bash
ls -F .venv/bin/milvus-server
# 应该输出: .venv/bin/milvus-server*
```

运行帮助命令确保它可以正常执行：

```bash
.venv/bin/milvus-server --help
```
