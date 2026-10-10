// Provider cooldown entry: child --extension guard for anthropic and openai-codex, plus the parent's pre-spawn check and
// /provider-cooldown helpers. Delegates are the installed public pi-ai/compat factories: api/* subpaths do not resolve in the
// production extension loader. Coverage is only these two providers; other providers are never classified or claimed.
import * as path from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { anthropicMessagesApi, openAICodexResponsesApi } from "@earendil-works/pi-ai/compat";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { guardStreamSimple } from "./provider-cooldown-guard.ts";
import { type CooldownStore, createCooldownStore } from "./provider-cooldown.ts";

export const COOLDOWN_PROVIDERS = ["anthropic", "openai-codex"] as const;
const REPLAYABLE_KINDS = new Set(["quota", "rate", "transient"]); // same kinds as model-routing's availability replay
export type LaunchState = { state: "launch" } | { state: "cooling" | "blocked" | "unavailable" | "probe-busy"; replayable: boolean };

export const cooldownStoreDir = (): string => path.join(getAgentDir(), "run-state", "provider-cooldown");

// Overrides only the stream handler; models, baseUrl, headers, apiKey and auth stay the built-in provider's values.
export function registerProviderCooldown(pi: ExtensionAPI, store: CooldownStore = createCooldownStore({ dir: cooldownStoreDir() })): void {
	const streams = { anthropic: anthropicMessagesApi(), "openai-codex": openAICodexResponsesApi() };
	const apis = { anthropic: "anthropic-messages", "openai-codex": "openai-codex-responses" } as const;
	for (const provider of COOLDOWN_PROVIDERS) {
		const delegate = (model: any, context: any, options: any) => streams[provider].streamSimple(model, context, options);
		pi.registerProvider(provider, {
			api: apis[provider],
			streamSimple: guardStreamSimple({ provider, store, delegate, createStream: createAssistantMessageEventStream }) as any,
		});
	}
}

// Parent pre-spawn check for one declared provider/model. A probe-due admission is launchable: the child's guard claims the lease.
export async function providerLaunchState(model: string, store: CooldownStore = createCooldownStore({ dir: cooldownStoreDir() })): Promise<LaunchState> {
	const slash = model.indexOf("/");
	const provider = slash > 0 ? model.slice(0, slash) : "";
	if (!(COOLDOWN_PROVIDERS as readonly string[]).includes(provider)) return { state: "launch" };
	let admission;
	try {
		admission = await store.check({ provider, model: model.slice(slash + 1) });
	} catch {
		return { state: "unavailable", replayable: false };
	}
	if (admission.state === "open" || admission.state === "probe-due") return { state: "launch" };
	return { state: admission.state, replayable: admission.state === "probe-busy" || (admission.state === "cooling" && REPLAYABLE_KINDS.has(admission.kind)) };
}

// The child guard's own refusal text is the only marker trusted; the parent replays only when its own store still says replayable.
export async function guardRefusalReplayable(model: string, errorMessage: string | undefined, store: CooldownStore = createCooldownStore({ dir: cooldownStoreDir() })): Promise<boolean> {
	if (!/^provider cooldown (cooling|probe-busy)$/.test(errorMessage ?? "")) return false;
	return (await providerLaunchState(model, store)).replayable === true;
}

const USAGE = "Usage: /provider-cooldown [status] | /provider-cooldown refresh <anthropic|openai-codex>";

// Status shows provider-wide scope only; model-scoped cooldowns are enforced at launch and request time.
export async function runProviderCooldownCommand(args: string, store: CooldownStore = createCooldownStore({ dir: cooldownStoreDir() })): Promise<{ message: string; type: "info" | "error" }> {
	const [sub, provider, ...rest] = args.trim().split(/\s+/).filter(Boolean);
	if (sub === undefined || sub === "status") {
		if (provider !== undefined) return { message: USAGE, type: "error" };
		const lines = await Promise.all(COOLDOWN_PROVIDERS.map((name) => statusLine(store, name)));
		return { message: lines.join("\n"), type: "info" };
	}
	if (sub === "refresh" && provider !== undefined && rest.length === 0 && (COOLDOWN_PROVIDERS as readonly string[]).includes(provider)) {
		// Explicit only: run this after re-authenticating the provider; nothing unblocks automatically.
		await store.refreshAuth(provider);
		return { message: `${provider}: auth refresh recorded; the next request may probe`, type: "info" };
	}
	return { message: USAGE, type: "error" };
}

async function statusLine(store: CooldownStore, provider: string): Promise<string> {
	let admission;
	try {
		admission = await store.check({ provider });
	} catch {
		return `${provider}: unavailable`;
	}
	switch (admission.state) {
		case "open":
			return `${provider}: open`;
		case "probe-due":
			return `${provider}: expired; next request probes`;
		case "cooling":
			return `${provider}: cooling kind=${admission.kind} source=${admission.source} until=${new Date(admission.untilMs).toISOString()}`;
		case "probe-busy":
			return `${provider}: probe in progress until=${new Date(admission.untilMs).toISOString()}`;
		case "blocked":
			return `${provider}: blocked reason=${admission.reason} needsrefresh=yes`;
		case "unavailable":
			return `${provider}: unavailable reason=${admission.reason}`;
	}
}

// Child entry: loaded with --extension for every subagent launch (explicitly, despite --no-extensions).
export default function providerCooldownEntry(pi: ExtensionAPI): void {
	registerProviderCooldown(pi);
}
