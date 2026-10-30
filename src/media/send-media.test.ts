import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { isPathAllowed, isWithinRoot, resolveAgentCwd } from './send-media.ts';

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-qqbot-media-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const config = (restrictPaths: boolean, extraRoots: string[] = []) =>
  ({ restrictPaths, extraRoots }) as Parameters<typeof isPathAllowed>[1];

describe('isWithinRoot / isPathAllowed（#94-4：符号链接绕过防护）', () => {
  it('普通文件在 root 内 → 放行', () => {
    const root = tempDir();
    const file = join(root, 'a.txt');
    writeFileSync(file, 'x');
    expect(isWithinRoot(file, root)).toBe(true);
  });

  it('root 外文件 → 拒绝', () => {
    const a = tempDir();
    const b = tempDir();
    const file = join(b, 'a.txt');
    writeFileSync(file, 'x');
    expect(isWithinRoot(file, a)).toBe(false);
  });

  it('root 内的符号链接指向 root 外 → 拒绝（父目录链接绕过）', () => {
    const root = tempDir();
    const outside = tempDir();
    const secret = join(outside, 'secret.txt');
    writeFileSync(secret, 'x');
    const link = join(root, 'leak');
    symlinkSync(outside, link);

    // 经链接访问外部文件：文本路径在 root 内，但真实位置在外 → 必须 false
    expect(isWithinRoot(join(link, 'secret.txt'), root)).toBe(false);
  });

  it('root 本身是符号链接 → 按真实位置判定', () => {
    const real = tempDir();
    const file = join(real, 'a.txt');
    writeFileSync(file, 'x');
    const link = tempDir() + '-link';
    symlinkSync(real, link);
    tempDirs.push(link);
    expect(isWithinRoot(file, link)).toBe(true);
    expect(isWithinRoot(join(real, '..', 'other.txt'), link)).toBe(false);
  });

  it('file 不存在但词法在 root 内 → 放行（存在性由调用方 existsSync 报错，不误报为路径不允许）', () => {
    const root = tempDir();
    expect(isWithinRoot(join(root, 'nope.txt'), root)).toBe(true);
    expect(isWithinRoot(join(root, '..', 'nope.txt'), root)).toBe(false);
  });

  it('root 不存在 → 该 root 无效（fail-closed）', () => {
    const root = tempDir();
    expect(isWithinRoot(join(root, 'a.txt'), join(root, 'missing-root'))).toBe(false);
  });

  it('isPathAllowed 经 extraRoots 的链接同样拦截', () => {
    const cwd = tempDir();
    const outside = tempDir();
    const secret = join(outside, 's.txt');
    writeFileSync(secret, 'x');
    const extra = tempDir();
    const link = join(extra, 'leak');
    symlinkSync(outside, link);

    expect(isPathAllowed(join(link, 's.txt'), config(true, [extra]), cwd)).toBe(false);
    expect(isPathAllowed(join(cwd, 'f.txt'), config(true, [extra]), join(cwd, 'f.txt'))).toBe(false);
    expect(isPathAllowed(secret, config(true, [outside]), cwd)).toBe(true);
  });
});

describe('resolveAgentCwd（agent 工作目录单一事实源）', () => {
  it('未配置/空串 → 默认 ~/.dsh-qqbot/workspace（不随宿主进程 cwd）', () => {
    const expected = resolve(homedir(), '.dsh-qqbot', 'workspace');
    expect(resolveAgentCwd(undefined)).toBe(expected);
    expect(resolveAgentCwd('')).toBe(expected);
  });

  it('显式配置 → 原样使用', () => {
    expect(resolveAgentCwd('/opt/my-workspace')).toBe('/opt/my-workspace');
  });
});
