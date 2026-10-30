import { describe, it, expect, vi } from 'vitest';
import { commandAllowlistAuth } from './auth.ts';
import type { SlashCommandHandlerContext } from '@tencent-connect/qqbot-nodejs';

function makeCtx(senderId: string | undefined): SlashCommandHandlerContext {
  return {
    message: { senderId, kind: 'c2c' },
  } as unknown as SlashCommandHandlerContext;
}

const allowlist = { access: { c2cMode: 'allowlist' as const, c2cAllow: ['u1', 'u2'] } };

describe('commandAllowlistAuth（#5：命令白名单鉴权，复用审批名单语义）', () => {
  it('allowlist 模式：名单内用户放行', () => {
    expect(commandAllowlistAuth(allowlist)(makeCtx('u1'))).toBe(true);
  });

  it('allowlist 模式：名单外用户拒绝并返回提示', () => {
    const auth = commandAllowlistAuth(allowlist);
    const result = auth(makeCtx('stranger'));
    expect(result).not.toBe(true);
    expect(typeof result).toBe('string');
  });

  it('allowlist 模式：身份缺失 fail-closed', () => {
    const auth = commandAllowlistAuth(allowlist);
    const result = auth(makeCtx(undefined));
    expect(result).not.toBe(true);
  });

  it('open 模式：直接放行（名单不参与）', () => {
    const open = { access: { c2cMode: 'open' as const, c2cAllow: [] } };
    expect(commandAllowlistAuth(open)(makeCtx('anyone'))).toBe(true);
  });

  it('拒绝时记录 warn 日志', () => {
    const logger = { warn: vi.fn() };
    commandAllowlistAuth(allowlist, logger)(makeCtx('stranger'));
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]?.[0]).toContain('stranger');
  });
});
