/** 前端 API 客户端：统一 POST /redteam/api 与插件自带的 GET 路由。 */

export interface ApiError {
	ok: false;
	error?: string;
}

const API_PATH = "/redteam/api";

export async function api<T = Record<string, unknown>>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
	const response = await fetch(API_PATH, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ op, ...payload }),
	});
	const data = (await response.json()) as T & { ok?: boolean; error?: string };
	if (!response.ok) throw new Error(String((data as { error?: string }).error ?? `HTTP ${response.status}`));
	return data;
}

export async function getJson<T = Record<string, unknown>>(path: string): Promise<T> {
	const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
	return (await response.json()) as T;
}

export async function postJson<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
	const response = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify(body),
	});
	return (await response.json()) as T;
}

export const plugin = {
	status: <T>() => getJson<T>("/dsh-purge-next/status"),
	patches: <T>() => getJson<T>("/dsh-purge-next/patches"),
	apply: <T>() => postJson<T>("/dsh-purge-next/apply"),
	revert: <T>() => postJson<T>("/dsh-purge-next/revert"),
	update: <T>() => getJson<T>("/dsh-purge-next/update"),
	prompt: <T>() => getJson<T>("/dsh-purge-next/prompt"),
	savePrompt: <T>(content: string) => postJson<T>("/dsh-purge-next/prompt", { content }),
};

export const redteam = {
	bootstrap: <T>() => api<T>("bootstrap"),
	open: <T>(name: string, scope: string[] = []) => api<T>("openEngagement", { name, scope }),
	activate: <T>(eng: string) => api<T>("activateEngagement", { engagement: eng }),
	stats: <T>(eng: string) => api<T>("stats", { engagement: eng }),
	assets: <T>(eng: string, filter: Record<string, unknown> = {}) => api<T>("assets", { engagement: eng, ...filter }),
	asset: <T>(eng: string, id: number) => api<T>("asset", { engagement: eng, id }),
	ingest: <T>(eng: string, bundle: Record<string, unknown>) => api<T>("ingest", { engagement: eng, bundle }),
	assess: <T>(eng: string, assess: Record<string, unknown>) => api<T>("assessAsset", { engagement: eng, assess }),
	test: <T>(eng: string, test: Record<string, unknown>) => api<T>("assetTest", { engagement: eng, test }),
	graph: <T>(eng: string, cidr?: string) => api<T>("graph", { engagement: eng, cidr }),
	timeline: <T>(eng: string, limit = 50) => api<T>("discoveryTimeline", { engagement: eng, limit }),
	domains: <T>(eng: string, q?: string) => api<T>("domains", { engagement: eng, q }),
	web: <T>(eng: string, q?: string) => api<T>("web", { engagement: eng, q }),
	vulns: <T>(eng: string, filter: Record<string, unknown> = {}) => api<T>("vulns", { engagement: eng, ...filter }),
	addVuln: <T>(eng: string, vuln: Record<string, unknown>) => api<T>("addVuln", { engagement: eng, vuln }),
	updateVuln: <T>(eng: string, id: number, patch: Record<string, unknown>) => api<T>("updateVuln", { engagement: eng, id, patch }),
	vulnStats: <T>(eng: string) => api<T>("vulnStats", { engagement: eng }),
	credentials: <T>(eng: string) => api<T>("credentials", { engagement: eng }),
	addCredential: <T>(eng: string, credential: Record<string, unknown>) => api<T>("addCredential", { engagement: eng, credential }),
	access: <T>(eng: string) => api<T>("access", { engagement: eng }),
	addAccess: <T>(eng: string, access: Record<string, unknown>) => api<T>("addAccess", { engagement: eng, access }),
	webshells: <T>(eng: string) => api<T>("webshells", { engagement: eng }),
	addWebshell: <T>(eng: string, webshell: Record<string, unknown>) => api<T>("addWebshell", { engagement: eng, webshell }),
	updateWebshell: <T>(eng: string, id: number, patch: Record<string, unknown>) => api<T>("updateWebshell", { engagement: eng, id, patch }),
	tunnels: <T>(eng: string) => api<T>("tunnels", { engagement: eng }),
	addTunnel: <T>(eng: string, tunnel: Record<string, unknown>) => api<T>("addTunnel", { engagement: eng, tunnel }),
	updateTunnel: <T>(eng: string, id: number, patch: Record<string, unknown>) => api<T>("updateTunnel", { engagement: eng, id, patch }),
	sessions: <T>(eng: string) => api<T>("sessions", { engagement: eng }),
	probe: <T>(eng: string) => api<T>("probeSessions", { engagement: eng }),
	chain: <T>(eng: string) => api<T>("chain", { engagement: eng }),
	addChainStep: <T>(eng: string, step: Record<string, unknown>) => api<T>("addChainStep", { engagement: eng, step }),
	attackGraph: <T>(eng: string) => api<T>("attackGraph", { engagement: eng }),
	scores: <T>(eng: string) => api<T>("scores", { engagement: eng }),
	addScoreHit: <T>(eng: string, hit: Record<string, unknown>) => api<T>("addScoreHit", { engagement: eng, hit }),
	scoreReport: <T>(eng: string) => api<T>("scoreReport", { engagement: eng }),
	scoreChain: <T>(eng: string) => api<T>("scoreChain", { engagement: eng }),
	report: <T>(eng: string) => api<T>("report", { engagement: eng }),
	reportTargets: <T>(eng: string) => api<T>("reportTargets", { engagement: eng }),
	shots: <T>(eng: string, filter: Record<string, unknown> = {}) => api<T>("shots", { engagement: eng, ...filter }),
	shotData: <T>(eng: string, id: number) => api<T>("shotData", { engagement: eng, id }),
	addShot: <T>(eng: string, shot: Record<string, unknown>) => api<T>("shotAdd", { engagement: eng, shot }),
	httpEvidence: <T>(eng: string) => api<T>("httpEvidence", { engagement: eng }),
	addHttpEvidence: <T>(eng: string, evidence: Record<string, unknown>) => api<T>("addHttpEvidence", { engagement: eng, evidence }),
	attackFiles: <T>(eng: string) => api<T>("attackFiles", { engagement: eng }),
	addAttackFile: <T>(eng: string, file: Record<string, unknown>) => api<T>("addAttackFile", { engagement: eng, file }),
	prompts: <T>(eng: string) => api<T>("prompts", { engagement: eng }),
	savePrompt: <T>(eng: string, role: string, content: string) => api<T>("savePrompt", { engagement: eng, role, content }),
	evidenceList: <T>(eng: string, filter: Record<string, unknown> = {}) => api<T>("evidenceList", { engagement: eng, ...filter }),
	recordEvidence: <T>(eng: string, evidence: Record<string, unknown>) => api<T>("evidenceRecord", { engagement: eng, evidence }),
	unknowns: <T>(eng: string, filter: Record<string, unknown> = {}) => api<T>("unknownList", { engagement: eng, ...filter }),
	recordUnknown: <T>(eng: string, unknown: Record<string, unknown>) => api<T>("unknownRecord", { engagement: eng, unknown }),
	resolveUnknown: <T>(eng: string, unk_id: string, disposition: string, resolution?: string) =>
		api<T>("unknownResolve", { engagement: eng, unk_id, disposition, resolution }),
};

export const knowledge = {
	search: <T>(filter: Record<string, unknown> = {}) => api<T>("pocSearch", filter),
	get: <T>(code: string) => api<T>("pocGet", { code }),
	save: <T>(poc: Record<string, unknown>) => api<T>("pocSave", { poc }),
	remove: <T>(code: string) => api<T>("pocDelete", { code }),
	use: <T>(code: string, used_on?: string) => api<T>("pocUse", { code, used_on }),
	stats: <T>() => api<T>("pocStats"),
	templates: <T>(q: string, limit = 40) => api<T>("templateSearch", { q, limit }),
};

export const skills = {
	catalog: <T>() => api<T>("skillCatalog"),
	read: <T>(name: string, library = "redteam") => api<T>("skillRead", { name, library }),
	save: <T>(name: string, content: string, description?: string) => api<T>("skillSave", { name, content, description }),
	remove: <T>(name: string) => api<T>("skillDelete", { name }),
	installBundled: <T>() => api<T>("skillInstallBundled"),
	importPath: <T>(path: string) => api<T>("skillImport", { path }),
	health: <T>() => api<T>("skillHealth"),
};

export const platform = {
	summary: <T>() => api<T>("platformConfigGet"),
	save: <T>(config: Record<string, unknown>) => api<T>("platformConfigSave", { config }),
	assign: <T>(dir: string) => api<T>("platformAssignToolkit", { dir }),
};
