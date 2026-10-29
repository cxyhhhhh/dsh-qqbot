import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHostAdapter, _resetAdapterCache } from './adapter.ts';

/** 最小 ctx：可控的 get() */
function makeCtx(services: Record<string, unknown>) {
  return {
    get: (name: string) => {
      if (!(name in services)) throw new Error(`cannot get property "${name}" without inject`);
      return services[name];
    },
  } as never;
}

describe('host adapter', () => {
  beforeEach(() => {
    _resetAdapterCache();
    vi.unstubAllGlobals();
  });

  it('sessionEvents：新宿主 snapshotEvents() 优先', () => {
    const adapter = createHostAdapter(makeCtx({}));
    const events = [{ type: 'a', seq: 0 }];
    expect(adapter.sessionEvents({ snapshotEvents: () => events })).toBe(events);
  });

  it('sessionEvents：旧宿主 events getter 兜底', () => {
    const adapter = createHostAdapter(makeCtx({}));
    const events = [{ type: 'a', seq: 0 }];
    expect(adapter.sessionEvents({ events })).toEqual(events);
  });

  it('sessionEvents：两者皆无返回空数组（不抛）', () => {
    const adapter = createHostAdapter(makeCtx({}));
    expect(adapter.sessionEvents({})).toEqual([]);
  });

  it('serviceFor：旧宿主 presets 实例方法直接命中', async () => {
    const compaction = { compactNow: () => {} };
    const presets = { serviceFor: (agent: unknown, name: string) => (name === 'compaction' ? compaction : undefined) };
    const adapter = createHostAdapter(makeCtx({ agentPresets: presets }));
    expect(await adapter.serviceFor({ ctx: {} }, 'compaction')).toBe(compaction);
    expect(adapter.capabilities).toContain('serviceFor(presets实例方法)');
  });

  it('serviceFor：无实例方法时走动态模块函数', async () => {
    const compaction = { compactNow: () => {} };
    vi.doMock('@deepseek-ai/dsh-agent-presets', () => ({
      serviceForAgent: (_ctx: unknown, agent: unknown, name: string) =>
        name === 'compaction' ? compaction : undefined,
    }));
    const adapter = createHostAdapter(makeCtx({}));
    expect(await adapter.serviceFor({ ctx: {} }, 'compaction')).toBe(compaction);
  });

  it('globalService：未注册返回 undefined（不抛）', () => {
    const adapter = createHostAdapter(makeCtx({}));
    expect(adapter.globalService('compaction')).toBeUndefined();
  });

  it('globalService：已注册返回服务', () => {
    const compaction = { compactNow: () => {} };
    const adapter = createHostAdapter(makeCtx({ compaction }));
    expect(adapter.globalService('compaction')).toBe(compaction);
  });

  it('buildForkSeed：模块不可解析时返回 undefined（不抛）', async () => {
    const adapter = createHostAdapter(makeCtx({}));
    expect(await adapter.buildForkSeed([{ seq: 0 }], 0)).toBeUndefined();
  });
});
