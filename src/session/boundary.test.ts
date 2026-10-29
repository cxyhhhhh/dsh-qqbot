import { describe, it, expect } from 'vitest';
import { latestCompletedPrefixBoundary } from './session-manager.ts';

const ev = (seq: number, type: string, surfaceOp?: string) =>
  ({ type, seq, time: 1, ...(surfaceOp ? { surfaceOp } : {}) }) as unknown;

describe('latestCompletedPrefixBoundary（复刻宿主 session-controller 语义）', () => {
  it('取最后一个 turn/end 的 seq', () => {
    const events = [ev(0, 'turn/start'), ev(1, 'user/message', 'append'), ev(2, 'turn/end'), ev(3, 'turn/start'), ev(4, 'turn/end')];
    expect(latestCompletedPrefixBoundary(events)).toBe(4);
  });

  it('turn/end 之后的独立事件（非新 turn 开始）纳入边界', () => {
    const events = [ev(0, 'turn/end'), ev(1, 'session/end-seed'), ev(2, 'compaction/end')];
    expect(latestCompletedPrefixBoundary(events)).toBe(2);
  });

  it('遇到 turn/start / user append / inbox spliced 即截止', () => {
    for (const [type, op] of [
      ['turn/start', undefined],
      ['user/message', 'append'],
      ['agent/inbox/spliced', undefined],
    ] as const) {
      const events = [ev(0, 'turn/end'), ev(1, 'session/end-seed'), ev(2, type, op)];
      expect(latestCompletedPrefixBoundary(events)).toBe(1);
    }
  });

  it('无完成 turn 时返回 undefined（无法 fork）', () => {
    expect(latestCompletedPrefixBoundary([ev(0, 'turn/start'), ev(1, 'user/message', 'append')])).toBeUndefined();
    expect(latestCompletedPrefixBoundary([])).toBeUndefined();
  });
});
