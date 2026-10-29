import { describe, it, expect } from 'vitest';
import { mintSessionId, legacyDerivedSessionId } from './session-id.ts';

describe('session-id', () => {
  it('铸造 id 带 session- 前缀且为 UUID 形态（#81）', () => {
    expect(mintSessionId()).toMatch(/^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('铸造 id 不重复（多进程并发下不会撞出重复会话 id）', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => mintSessionId()));
    expect(ids.size).toBe(1000);
  });

  it('legacy 迁移候选保持 0.5.x 老算法：裸 UUID、确定性', () => {
    const id = legacyDerivedSessionId('qqbot:app1:c2c:user1');
    // 老算法产裸 UUID（无前缀），必须与 0.5.x 完全一致才能 resume 到存量会话
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(legacyDerivedSessionId('qqbot:app1:c2c:user1')).toBe(id);
    expect(legacyDerivedSessionId('qqbot:app1:c2c:user1')).not.toBe(legacyDerivedSessionId('qqbot:app1:c2c:user2'));
  });

  it('铸造 id 与 legacy 候选形态可区分（前缀差异）', () => {
    expect(mintSessionId()).not.toMatch(/^[0-9a-f-]{36}$/);
  });
});
