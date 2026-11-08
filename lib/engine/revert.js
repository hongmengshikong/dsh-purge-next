/**
 * 还原：把 apply 期间写下的 `.dshpurge.bak` 复制回原文件并清理。
 *
 * 与旧实现保持同一套备份命名；未产生备份的文件（apply 没改过）保持原样。
 * TODO(M3)：宿主升级后的 stale bak 刷新、缺失原文件自愈（restoreMissingOriginalsFromBak）。
 */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
export function restoreMissingOriginals(root) {
    let restored = 0;
    const walk = (dir) => {
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const name of entries) {
            const fp = join(dir, name);
            let isDir = false;
            try {
                isDir = statSync(fp).isDirectory();
            }
            catch {
                continue;
            }
            if (isDir) {
                walk(fp);
                continue;
            }
            if (!name.endsWith(".dshpurge.bak"))
                continue;
            const original = fp.slice(0, -".dshpurge.bak".length);
            let missing = false;
            try {
                missing = !existsSync(original) || statSync(original).size === 0;
            }
            catch {
                missing = true;
            }
            if (!missing)
                continue;
            copyFileSync(fp, original);
            rmSync(fp, { force: true });
            restored += 1;
        }
    };
    if (existsSync(root))
        walk(root);
    return { reverted: restored, removed: 0 };
}
export function revertRoot(root) {
    let reverted = 0;
    let removed = 0;
    const walk = (dir) => {
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const name of entries) {
            const fp = join(dir, name);
            let isDir = false;
            try {
                isDir = statSync(fp).isDirectory();
            }
            catch {
                continue;
            }
            if (isDir) {
                walk(fp);
                continue;
            }
            if (name.endsWith(".dshpurge.bak")) {
                const original = fp.slice(0, -".dshpurge.bak".length);
                copyFileSync(fp, original);
                rmSync(fp, { force: true });
                reverted += 1;
            }
            else if (name.endsWith(".dshpurge.tmp")) {
                rmSync(fp, { force: true });
                removed += 1;
            }
        }
    };
    if (existsSync(root))
        walk(root);
    return { reverted, removed };
}
