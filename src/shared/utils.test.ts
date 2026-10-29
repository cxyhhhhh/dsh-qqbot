/**
 * getProfileDir 推导策略测试
 *
 * 覆盖三种 profile 布局：
 * 1. Desktop pnpm workspace 嵌套布局（标志文件探测，旧启发式会返回错误目录）
 * 2. CLI 浅层 npm 布局（标志文件或 node_modules 启发式）
 * 3. 开发模式源码目录（无命中返回 null）
 */
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { getProfileDir } from './utils.ts';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-qqbot-profile-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('getProfileDir', () => {
  it('link: 安装（symlink）：反查 profiles/*/node_modules 命中 profile 根（#78）', () => {
    const root = tempDir();
    // 插件源码目录（node_modules 之外）
    const pluginSrc = join(root, 'plugin-src', 'dsh-qqbot');
    mkdirSync(pluginSrc, { recursive: true });
    // profile 通过 symlink 安装
    const profile = join(root, 'home', 'profiles', 'web');
    const linked = join(profile, 'node_modules', '@tencent-connect', 'dsh-qqbot');
    mkdirSync(join(profile, 'node_modules', '@tencent-connect'), { recursive: true });
    symlinkSync(pluginSrc, linked);

    process.env.DSH_HOME = join(root, 'home');
    try {
      expect(getProfileDir(pluginSrc)).toBe(profile);
    } finally {
      delete process.env.DSH_HOME;
    }
  });

  it('link: 多 profile 共享同一源码：优先当前进程 argv 的 profile（dsh web 不误写 desktop）', () => {
    const root = tempDir();
    const pluginSrc = join(root, 'plugin-src', 'dsh-qqbot');
    mkdirSync(pluginSrc, { recursive: true });
    // desktop 与 web 两个 profile 都 symlink 同一份源码
    for (const name of ['desktop', 'web']) {
      const linked = join(root, 'home', 'profiles', name, 'node_modules', '@tencent-connect', 'dsh-qqbot');
      mkdirSync(join(root, 'home', 'profiles', name, 'node_modules', '@tencent-connect'), { recursive: true });
      symlinkSync(pluginSrc, linked);
    }
    process.env.DSH_HOME = join(root, 'home');
    const argv = process.argv;
    try {
      // 裸子命令缩写：dsh web
      process.argv = ['node', '/path/to/dsh', 'web'];
      expect(getProfileDir(pluginSrc)).toBe(join(root, 'home', 'profiles', 'web'));
      // --profile flag 形式
      process.argv = ['node', '/path/to/dsh', '--profile', 'web'];
      expect(getProfileDir(pluginSrc)).toBe(join(root, 'home', 'profiles', 'web'));
    } finally {
      process.argv = argv;
      delete process.env.DSH_HOME;
    }
  });

  it('link: 多 profile 共享同一源码：Electron 运行时判 desktop', () => {
    const root = tempDir();
    const pluginSrc = join(root, 'plugin-src', 'dsh-qqbot');
    mkdirSync(pluginSrc, { recursive: true });
    for (const name of ['desktop', 'web']) {
      const linked = join(root, 'home', 'profiles', name, 'node_modules', '@tencent-connect', 'dsh-qqbot');
      mkdirSync(join(root, 'home', 'profiles', name, 'node_modules', '@tencent-connect'), { recursive: true });
      symlinkSync(pluginSrc, linked);
    }
    process.env.DSH_HOME = join(root, 'home');
    const versions = process.versions as { electron?: string };
    const had = versions.electron;
    try {
      versions.electron = '33.0.0';
      expect(getProfileDir(pluginSrc)).toBe(join(root, 'home', 'profiles', 'desktop'));
    } finally {
      if (had === undefined) delete versions.electron;
      else versions.electron = had;
      delete process.env.DSH_HOME;
    }
  });

  it('link: 安装但 DSH_HOME 下无对应 symlink：返回 null', () => {
    const root = tempDir();
    const pluginSrc = join(root, 'plugin-src', 'dsh-qqbot');
    mkdirSync(pluginSrc, { recursive: true });
    const home = join(root, 'home', 'profiles');
    mkdirSync(join(home, 'other'), { recursive: true });

    process.env.DSH_HOME = join(root, 'home');
    try {
      expect(getProfileDir(pluginSrc)).toBeNull();
    } finally {
      delete process.env.DSH_HOME;
    }
  });

  it('Desktop pnpm 嵌套布局：按 profile 标志文件命中 profile 根', () => {
    const root = tempDir();
    const profile = join(root, 'profiles', 'desktop');
    const plugin = join(
      profile, 'dependencies', 'node_modules', '.pnpm', 'dsh-qqbot@1.0.0',
      'node_modules', '@tencent-connect', 'dsh-qqbot',
    );
    mkdirSync(plugin, { recursive: true });
    writeFileSync(join(profile, 'cordis.patch.yml'), '# patch\n');
    writeFileSync(join(profile, 'dependencies', 'pnpm-workspace.yaml'), 'packages:\n  - .\n');

    // 旧启发式会返回 .../dsh-qqbot@1.0.0（内层 node_modules 的父目录），标志文件策略返回 profile 根
    expect(getProfileDir(plugin)).toBe(profile);
  });

  it('CLI 浅层布局：cordis.patch.yml 命中 profile 根', () => {
    const root = tempDir();
    const profile = join(root, 'profiles', 'qqbot');
    const plugin = join(profile, 'node_modules', '@tencent-connect', 'dsh-qqbot');
    mkdirSync(plugin, { recursive: true });
    writeFileSync(join(profile, 'cordis.patch.yml'), '# patch\n');

    expect(getProfileDir(plugin)).toBe(profile);
  });

  it('全新 profile（尚无标志文件）：回退 node_modules 启发式', () => {
    const root = tempDir();
    const profile = join(root, 'profiles', 'qqbot');
    const plugin = join(profile, 'node_modules', '@tencent-connect', 'dsh-qqbot');
    mkdirSync(plugin, { recursive: true });

    expect(getProfileDir(plugin)).toBe(profile);
  });

  it('pnpm-workspace.yaml 单独存在时也命中', () => {
    const root = tempDir();
    const profile = join(root, 'profile');
    const plugin = join(profile, 'deps', 'node_modules', 'dsh-qqbot');
    mkdirSync(plugin, { recursive: true });
    writeFileSync(join(profile, 'pnpm-workspace.yaml'), 'packages:\n');

    expect(getProfileDir(plugin)).toBe(profile);
  });

  it('dev 源码 checkout（根目录自带 cordis.patch.yml 仓库文件）：返回 null', () => {
    const root = tempDir();
    const checkout = join(root, 'dsh-qqbot');
    const src = join(checkout, 'src');
    mkdirSync(src, { recursive: true });
    // checkout 根有 bundle patch 仓库文件，但它不是 profile——不得命中
    writeFileSync(join(checkout, 'cordis.patch.yml'), '# bundle patch\n');
    writeFileSync(join(checkout, 'pnpm-workspace.yaml'), 'packages:\n');

    expect(getProfileDir(src)).toBeNull();
  });

  it('npm 安装：插件包内自带 bundle patch 不得命中，profile 根才有效', () => {
    const root = tempDir();
    const profile = join(root, 'profiles', 'desktop');
    const plugin = join(profile, 'node_modules', '@tencent-connect', 'dsh-qqbot');
    mkdirSync(plugin, { recursive: true });
    // 插件包内自带 dsh.bundle.patch 分发物——它是插件自己的，不是 profile 标志
    writeFileSync(join(plugin, 'cordis.patch.yml'), '# bundle patch\n');
    writeFileSync(join(profile, 'cordis.patch.yml'), '# profile patch\n');

    expect(getProfileDir(plugin)).toBe(profile);
  });

  it('开发模式源码目录：无命中返回 null', () => {
    const root = tempDir();
    const source = join(root, 'workspace', 'dsh-qqbot', 'src');
    mkdirSync(source, { recursive: true });

    expect(getProfileDir(source)).toBeNull();
  });
});
