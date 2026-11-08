/**
 * 更新检查（单通道）。
 *
 * 设计（D7/D8）：只有一条主线 master，没有 stable/beta；
 * 更新源指向本仓库，仓库尚未上传时返回 unconfigured，不发起任何网络请求。
 */
export const UPDATE_BRANCH = "master";
/** 构建产物分支：mainline 只有 TS，更新包必须取已构建的 dist。 */
export const DIST_BRANCH = "dist";

/** 仓库地址：上传后填这里（或设置 DSH_PURGE_REPO_URL）。 */
export const DEFAULT_REPO_URL = "https://github.com/hongmengshikong/dsh-purge-next";

export interface UpdateStatus {
	configured: boolean;
	channel: "master";
	repoUrl: string;
	reason?: string;
}

export function repoUrl(): string {
	const env = process.env.DSH_PURGE_REPO_URL;
	return (env && env.trim()) || DEFAULT_REPO_URL;
}

export function updateStatusFor(url: string): UpdateStatus {
	if (!url) return { configured: false, channel: "master", repoUrl: "", reason: "repo_not_configured" };
	return { configured: true, channel: "master", repoUrl: url };
}

export function updateStatus(): UpdateStatus {
	return updateStatusFor(repoUrl());
}

export interface UpdateCandidate {
	version: string;
	url: string;
}

/**
 * 构造单通道更新地址：`<repo>/archive/refs/heads/dist.tar.gz`（dist 为构建产物分支）。
 * 未配置仓库时返回 null（调用方据此显示“未配置更新源”）。
 */
export function updateTarballFor(url: string): string | null {
	const status = updateStatusFor(url);
	if (!status.configured) return null;
	const base = status.repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
	return `${base}/archive/refs/heads/${DIST_BRANCH}.tar.gz`;
}

export function updateTarballUrl(): string | null {
	return updateTarballFor(repoUrl());
}

export function describeUpdate(status: UpdateStatus = updateStatus()): string {
	if (!status.configured) return "更新源未配置（仓库上传后填写 URL）";
	return `更新源：${status.repoUrl}（分支 ${status.channel}）`;
}
