/**
 * 会话 id 铸造。统一带 `session-` 前缀对齐宿主约定（#81）：
 * 社区插件按该前缀识别正常会话，裸 UUID 会被误判为子代理会话。
 */
import { createHash, randomUUID } from 'node:crypto';

/** 铸造新会话 id（随机全局唯一，避免多进程并发撞出重复 id） */
export function mintSessionId(): string {
  return `session-${randomUUID()}`;
}

/** 0.5.x 老派生算法（裸 UUID）。仅用于迁移：定位存量会话，resume 命中则沿用 */
export function legacyDerivedSessionId(sessionKey: string): string {
  const hash = createHash('sha256').update(sessionKey).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
