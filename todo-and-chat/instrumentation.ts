/**
 * Next.js Instrumentation
 * - 忽略客户端断开连接导致的 ECONNRESET/aborted，避免 uncaughtException 刷屏
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: unknown) => {
      const code = (err as NodeJS.ErrnoException)?.code;
      const msg = (err as Error)?.message ?? '';
      if (code === 'ECONNRESET' || msg === 'aborted') {
        // 客户端提前关闭连接（如长时间请求时刷新/关闭页面），静默忽略
        return;
      }
      console.error('uncaughtException:', err);
    });
  }
}
