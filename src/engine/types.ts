/** 补丁语料的类型：与 patches/patch.schema.json 一一对应。 */

/** 精确字符串，或 { regex, flags }（运行时还原成 RegExp） */
export type Pattern = string | { regex: string; flags?: string };

export interface Replacement {
	pattern: Pattern;
	replace: string;
	expect?: number;
	insertProbe?: string;
}

export interface PatchSpec {
	id: number;
	name: string;
	layer?: string;
	layer_en?: string;
	desc: string;
	file: string | string[];
	rel?: string[];
	patterns?: Pattern[];
	replace?: string;
	replacements?: Replacement[];
	markers?: string[];
	markersAny?: boolean;
	marker?: string;
	skipIfMarked?: boolean;
	forbid?: string[];
	optional?: boolean;
	strictFiles?: boolean;
	softSettle?: boolean;
	surfaces?: string[];
	kind?: string;
	upgrade?: string;
	text?: string;
}

/** 载入后的 pattern：字符串或已还原的 RegExp */
export type CompiledPattern = string | RegExp;

export interface CompiledReplacement {
	pattern: CompiledPattern;
	replace: string;
	expect?: number;
	insertProbe?: string;
}

/** 载入后的补丁：与 PatchSpec 相同，只是 pattern 可能是 RegExp */
export type CompiledPatch = Omit<PatchSpec, "patterns" | "replacements"> & {
	patterns?: CompiledPattern[];
	replacements?: CompiledReplacement[];
};

export type PatchGroup = "prompt" | "code" | "engine" | "tools";

export interface PatchTableDoc {
	group: PatchGroup;
	note?: string;
	patches: PatchSpec[];
}

export interface PatchTables {
	prompt: CompiledPatch[];
	code: CompiledPatch[];
	engine: CompiledPatch[];
	tools: CompiledPatch[];
	/** 展示分组：groupKey → patch id[] */
	displayGroups: Record<string, number[]>;
	/** 四个表按顺序拼起来（顺序即应用顺序） */
	all: CompiledPatch[];
}

/** apply 的单条结果，状态集合与旧仓库保持一致。 */
export type PatchOutcome =
	| "applied"
	| "already"
	| "pending"
	| "drifted"
	| "skipped"
	| "unmatched"
	| "na"
	| "missing_file";

export interface PatchResult {
	id: number;
	name: string;
	status: PatchOutcome;
	path?: string;
	error?: string;
}

export interface ApplyReport {
	host: string;
	applied: number;
	already: number;
	failed: PatchResult[];
	results: PatchResult[];
}
