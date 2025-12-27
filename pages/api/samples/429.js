async function callWithRateLimitHandling(prompt) {

    try {

        const response = await client.chat.completions.create({

            model: "deepseek-chat",

            messages: [{ role: "user", content: prompt }]

        });

        return response;

    } catch (error) {

        if (error.status === 429) {

            // 从响应头获取重试时间

            const retryAfter = error.headers?.['retry-after'];

            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;



            console.log(`触发限流，${waitTime}ms 后重试`);

            await new Promise(resolve => setTimeout(resolve, waitTime));



            // 递归重试

            return callWithRateLimitHandling(prompt);

        }

        throw error;

    }

}

/**
 * OpenAI 客户端类 - 支持多 API Key 轮询和自动重试
 * 用于处理 API 限流（429 错误）和多个 API Key 的负载均衡
 */
class OpenAIClient {

    /**
     * 构造函数 - 初始化多个 OpenAI 客户端实例
     * @param {string[]} apiKeys - API Key 数组，支持多个 Key 进行轮询
     */
    constructor(apiKeys) {
        // 为每个 API Key 创建一个 OpenAI 客户端实例
        this.clients = apiKeys.map(key => new OpenAI({
            apiKey: key,                                    // API Key
            baseURL: "https://api.deepseek.com",           // DeepSeek API 地址
            timeout: 60000                                  // 请求超时时间：60秒
        }));

        // 当前使用的客户端索引，用于轮询
        this.currentIndex = 0;
    }

    /**
     * 获取下一个客户端（轮询算法）
     * 使用轮询方式依次使用不同的 API Key，实现负载均衡
     * @returns {OpenAI} 返回下一个可用的 OpenAI 客户端实例
     */
    getNextClient() {
        // 获取当前索引对应的客户端
        const client = this.clients[this.currentIndex];
        
        // 更新索引，使用取模运算实现循环轮询
        // 例如：3个 Key，索引 0->1->2->0->1->2...
        this.currentIndex = (this.currentIndex + 1) % this.clients.length;

        return client;
    }

    /**
     * 发送聊天请求，支持自动重试和多个 API Key 切换
     * @param {string} prompt - 用户输入的提示词
     * @param {number} maxRetries - 最大重试次数，默认 3 次
     * @returns {Promise<string>} 返回 AI 生成的回复内容
     * @throws {Error} 如果所有 API Key 都失败，抛出错误
     */
    async chat(prompt, maxRetries = 3) {
        let lastError;  // 记录最后一次的错误信息

        // 循环重试，最多尝试 maxRetries 次
        for (let i = 0; i < maxRetries; i++) {
            // 获取下一个客户端（轮询切换 API Key）
            const client = this.getNextClient();

            try {
                // 调用 OpenAI API 发送聊天请求
                const response = await client.chat.completions.create({
                    model: "deepseek-chat",                          // 使用的模型
                    messages: [{ role: "user", content: prompt }]   // 消息内容
                });

                // 成功时返回 AI 的回复内容
                return response.choices[0].message.content;

            } catch (error) {
                // 记录错误信息
                lastError = error;
                console.log(`API Key ${this.currentIndex} 失败，尝试下一个...`);

                // 如果是 429 限流错误，等待 2 秒后重试
                // 429 表示请求过于频繁，需要等待一段时间
                if (error.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                // 其他错误（如网络错误、API Key 无效等）会继续尝试下一个 API Key
            }
        }

        // 如果所有重试都失败，抛出错误
        throw new Error(`所有 API Key 都失败了：${lastError.message}`);
    }

}

/**
 * 使用示例
 * 从环境变量中读取多个 API Key，创建客户端实例
 */
const client = new OpenAIClient([
    process.env.DEEPSEEK_API_KEY_1,  // 第一个 API Key
    process.env.DEEPSEEK_API_KEY_2,   // 第二个 API Key
    process.env.DEEPSEEK_API_KEY_3    // 第三个 API Key
]);

// 发送聊天请求
const response = await client.chat("你好");