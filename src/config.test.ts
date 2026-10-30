import { describe, it, expect } from 'vitest';
import { ConfigSchema } from './config.ts';

describe('ConfigSchema 默认值（#94-1：省略 access 不得回落 open）', () => {
  it('完全省略 access → c2cMode allowlist（子 schema 默认生效）', () => {
    const cfg = ConfigSchema({});
    expect(cfg.access.c2cMode).toBe('allowlist');
    expect(cfg.access.groupMode).toBe('open');
  });

  it('access: {} → 子字段默认填充 allowlist', () => {
    const cfg = ConfigSchema({ access: {} });
    expect(cfg.access.c2cMode).toBe('allowlist');
  });

  it('access 空值（YAML access: 后无内容）→ allowlist', () => {
    const cfg = ConfigSchema({ access: null });
    expect(cfg.access.c2cMode).toBe('allowlist');
  });

  it('显式配置不受默认影响', () => {
    const cfg = ConfigSchema({ access: { c2cMode: 'open' } });
    expect(cfg.access.c2cMode).toBe('open');
  });
});
