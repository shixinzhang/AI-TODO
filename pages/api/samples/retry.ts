// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 p-retry 库
import pRetry, { AbortError } from 'p-retry'

/**
 * p-retry 库演示 API
 * 
 * p-retry 是一个用于自动重试异步操作的库，特别适合处理网络请求、API 调用等可能失败的操作
 * 
 * 访问示例：
 * GET /api/samples/retry?scenario=basic - 基本重试示例
 * GET /api/samples/retry?scenario=custom - 自定义重试策略
 * GET /api/samples/retry?scenario=abort - 可取消的重试
 * GET /api/samples/retry?scenario=condition - 条件重试
 */

// 模拟一个可能失败的异步操作
async function unstableOperation(shouldFail: boolean = true, attemptNumber?: number): Promise<string> {
  // 模拟随机失败（前几次可能失败，后面会成功）
  const random = Math.random()
  
  if (shouldFail && random < 0.7) {
    throw new Error(`操作失败 (尝试次数: ${attemptNumber || '未知'})`)
  }
  
  return `操作成功！(尝试次数: ${attemptNumber || 1})`
}

// 模拟一个需要重试的 API 调用
async function fetchWithRetry(url: string, attemptNumber?: number): Promise<Response> {
  // 模拟网络请求可能失败
  const random = Math.random()
  
  if (random < 0.6) {
    throw new Error(`网络请求失败 (尝试次数: ${attemptNumber || '未知'})`)
  }
  
  // 模拟返回响应
  return new Response(JSON.stringify({ data: 'success', attempt: attemptNumber || 1 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  const scenario = req.query.scenario as string || 'basic'

  try {
    let result: any

    switch (scenario) {
      // ========== 场景 1：基本重试用法 ==========
      case 'basic': {
        /**
         * 基本用法：使用默认配置重试
         * 默认配置：
         * - retries: 5 次
         * - factor: 2 (指数退避因子)
         * - minTimeout: 1000ms (最小延迟)
         * - maxTimeout: Infinity (最大延迟)
         */
        result = await pRetry(
          async () => {
            // 这个函数会被重试，直到成功或达到最大重试次数
            return await unstableOperation(true)
          },
          {
            retries: 3, // 最多重试 3 次（总共尝试 4 次：初始 1 次 + 重试 3 次）
            onFailedAttempt: ({ error, retriesLeft }) => {
              // 每次失败时的回调
              console.log(`尝试失败: ${error.message}`)
              console.log(`剩余重试次数: ${retriesLeft}`)
            }
          }
        )
        
        return res.status(200).json({
          success: true,
          scenario: 'basic',
          message: '基本重试示例',
          result,
          description: '使用默认配置进行重试，最多重试 3 次'
        })
      }

      // ========== 场景 2：自定义重试策略 ==========
      case 'custom': {
        /**
         * 自定义重试策略：
         * - 自定义重试次数
         * - 自定义延迟时间（指数退避）
         * - 自定义错误处理
         */
        let attemptCount = 0
        
        result = await pRetry(
          async (attemptNumber) => {
            attemptCount = attemptNumber
            console.log(`第 ${attemptNumber} 次尝试`)
            
            // 模拟操作，前几次会失败
            if (attemptNumber < 3) {
              throw new Error(`第 ${attemptNumber} 次尝试失败`)
            }
            
            return `在第 ${attemptNumber} 次尝试时成功`
          },
          {
            retries: 5,                    // 最多重试 5 次
            minTimeout: 100,               // 最小延迟 100ms
            maxTimeout: 2000,              // 最大延迟 2000ms
            factor: 2,                     // 指数退避因子：100ms, 200ms, 400ms, 800ms, 1600ms
            onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
              console.log(`失败原因: ${error.message}`)
              console.log(`已尝试次数: ${attemptNumber}`)
              console.log(`剩余重试次数: ${retriesLeft}`)
            }
          }
        )
        
        return res.status(200).json({
          success: true,
          scenario: 'custom',
          message: '自定义重试策略示例',
          result,
          attemptCount,
          description: '使用自定义的重试次数、延迟时间和错误处理'
        })
      }

      // ========== 场景 3：可取消的重试 ==========
      case 'abort': {
        /**
         * 可取消的重试：
         * 使用 AbortController 可以在需要时取消重试操作
         */
        const abortController = new AbortController()
        
        // 模拟：3 秒后取消操作
        setTimeout(() => {
          abortController.abort()
        }, 3000)
        
        try {
          result = await pRetry(
            async () => {
              // 检查是否已取消
              if (abortController.signal.aborted) {
                throw new AbortError('操作已取消')
              }
              
              // 模拟一个需要较长时间的操作
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              // 模拟可能失败的操作
              const random = Math.random()
              if (random < 0.8) {
                throw new Error('操作失败，需要重试')
              }
              
              return '操作成功'
            },
            {
              retries: 10,
              signal: abortController.signal, // 传入取消信号
              onFailedAttempt: ({ error }) => {
                console.log(`尝试失败: ${error.message}`)
              }
            }
          )
          
          return res.status(200).json({
            success: true,
            scenario: 'abort',
            message: '可取消的重试示例',
            result
          })
        } catch (error) {
          if (error instanceof AbortError) {
            return res.status(200).json({
              success: false,
              scenario: 'abort',
              message: '操作被取消',
              error: error.message,
              description: '演示如何使用 AbortController 取消重试操作'
            })
          }
          throw error
        }
      }

      // ========== 场景 4：条件重试 ==========
      case 'condition': {
        /**
         * 条件重试：
         * 根据错误类型或条件决定是否重试
         * 某些错误不应该重试（如 404、401 等）
         */
        let attemptCount = 0
        
        result = await pRetry(
          async (attemptNumber) => {
            attemptCount = attemptNumber
            
            // 模拟不同类型的错误
            const errorType = attemptNumber % 3
            
            if (errorType === 0) {
              // 不应该重试的错误（如 404）
              const error = new Error('资源不存在 (404)')
              ;(error as any).code = 'NOT_FOUND'
              throw error
            } else if (errorType === 1) {
              // 应该重试的错误（如网络错误）
              throw new Error('网络连接失败')
            } else {
              // 成功
              return '操作成功'
            }
          },
          {
            retries: 5,
            onFailedAttempt: ({ error }) => {
              // 根据错误类型决定是否继续重试
              if ((error as any).code === 'NOT_FOUND') {
                // 404 错误不应该重试，直接抛出 AbortError
                throw new AbortError('资源不存在，停止重试')
              }
              
              console.log(`尝试失败: ${error.message}`)
            }
          }
        )
        
        return res.status(200).json({
          success: true,
          scenario: 'condition',
          message: '条件重试示例',
          result,
          attemptCount
        })
      }

      // ========== 场景 5：实际 API 调用重试 ==========
      case 'api': {
        /**
         * 实际应用场景：API 调用重试
         * 模拟调用外部 API，失败时自动重试
         */
        let attemptCount = 0
        
        const response = await pRetry(
          async (attemptNumber) => {
            attemptCount = attemptNumber
            console.log(`第 ${attemptNumber} 次调用 API`)
            
            // 模拟 API 调用
            const response = await fetchWithRetry('https://api.example.com/data', attemptNumber)
            
            // 检查响应状态
            if (!response.ok) {
              throw new Error(`API 返回错误状态: ${response.status}`)
            }
            
            return response
          },
          {
            retries: 3,
            minTimeout: 500,
            maxTimeout: 5000,
            factor: 2,
            onFailedAttempt: ({ error, retriesLeft }) => {
              console.log(`API 调用失败: ${error.message}`)
              console.log(`剩余重试次数: ${retriesLeft}`)
            }
          }
        )
        
        const data = await response.json()
        
        return res.status(200).json({
          success: true,
          scenario: 'api',
          message: 'API 调用重试示例',
          result: data,
          attemptCount,
          description: '演示如何在实际 API 调用中使用重试机制'
        })
      }

      default:
        return res.status(400).json({
          success: false,
          error: `未知的场景: ${scenario}`,
          availableScenarios: ['basic', 'custom', 'abort', 'condition', 'api']
        })
    }
  } catch (error) {
    // 如果所有重试都失败了，p-retry 会抛出最后一个错误
    console.error('重试失败:', error)
    
    return res.status(500).json({
      success: false,
      scenario,
      error: error instanceof Error ? error.message : '未知错误',
      description: '所有重试尝试都失败了'
    })
  }
}

