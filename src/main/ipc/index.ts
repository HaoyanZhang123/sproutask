import { ipcMain } from 'electron'
import { z } from 'zod'

/**
 * IPC 处理器注册表。
 * 规矩（docs/CONVENTIONS.md「IPC 与安全」）：
 *   - 通道名 `<域>:<动作>`，如 `agent:chat`
 *   - 入参一律用 Zod 校验，禁止直接把 unknown 传进业务层
 *   - 这里只做"校验 + 转发"，业务逻辑放 src/core
 */

const PingInput = z.object({ message: z.string().max(200) })

export function registerIpcHandlers(): void {
  // M0 冒烟通道：验证 renderer → preload → main 链路通畅
  ipcMain.handle('app:ping', (_event, payload: unknown) => {
    const input = PingInput.parse(payload)
    return { reply: `pong: ${input.message}`, at: new Date().toISOString() }
  })

  // M1+ 将在此注册：
  //   agent:chat      —— 发起一轮对话（流式）
  //   agent:abort     —— 中止当前轮
  //   content:unit    —— 读取单元内容
  //   student:profile —— 读取学情
  //   research:export —— 导出脱敏学习数据
}
