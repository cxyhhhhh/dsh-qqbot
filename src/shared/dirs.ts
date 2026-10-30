/**
 * 插件数据目录 — 单一事实源
 *
 * workspace / media / 模型偏好等子路径统一从 PLUGIN_HOME 派生，
 * 避免各模块各自 `resolve(homedir(), '.dsh-qqbot', ...)` 造成漂移。
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/** 插件数据根目录（区别于宿主的 ~/.dsh） */
export const PLUGIN_HOME = resolve(homedir(), '.dsh-qqbot');

/**
 * agent 工作目录：显式配置优先（空串视为未配置），缺省 PLUGIN_HOME/workspace。
 *
 * session 创建、路径白名单（send-file 工具与交付物投递）共用此解析，
 * 保证「agent 在哪写文件」与「白名单允许哪个目录」不漂移。
 */
export function resolveAgentCwd(cwdConfig: string | undefined): string {
  return cwdConfig || resolve(PLUGIN_HOME, 'workspace');
}
