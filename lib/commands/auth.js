const DENIED = '⚠️ 无权限执行此命令';
/** 构造命令白名单鉴权回调 */
export function commandAllowlistAuth(config, logger) {
    return (ctx) => {
        if (config.access.c2cMode !== 'allowlist')
            return true;
        const senderId = ctx.message.senderId;
        if (!senderId || !config.access.c2cAllow.includes(senderId)) {
            logger?.warn(`im-qqbot: command auth denied: sender=${senderId ?? '(missing)'}`);
            return DENIED;
        }
        return true;
    };
}
//# sourceMappingURL=auth.js.map