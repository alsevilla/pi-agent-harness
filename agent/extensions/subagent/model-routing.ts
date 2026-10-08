// Model IDs are catalog identifiers: trimmed, otherwise passed through verbatim (no aliasing).
export function parseFallbackModels(value: string | undefined): string[] {
	return [...new Set((value ?? "").split("||").map((model) => model.trim()).filter(Boolean))];
}

// fallbackModels is already parsed at the config boundary (parseFallbackModels); this only drops the primary.
export function getFallbackSequence(primaryModel: string | undefined, fallbackModels: readonly string[] = []): string[] {
	const primary = primaryModel?.trim();
	return fallbackModels.filter((model) => model !== primary);
}

export function nextFallbackModel(
	result: Parameters<typeof isProviderAvailabilityFailure>[0],
	remainingFallbacks: string[],
	aborted = false,
): string | undefined {
	return !aborted && isProviderAvailabilityFailure(result) ? remainingFallbacks[0] : undefined;
}

export function isProviderAvailabilityFailure(result: {
	exitCode: number;
	stopReason?: string;
	errorMessage?: string;
	stderr?: string;
	output?: string;
	toolActivity?: boolean;
}): boolean {
	if (result.stopReason === "aborted" || result.toolActivity || (result.exitCode === 0 && result.stopReason !== "error")) return false;

	const error = `${result.errorMessage ?? ""}\n${result.stderr ?? ""}\n${result.output ?? ""}`;
	return /\b(?:401|403|404|408|429|500|502|503|504)\b|unauthori[sz]ed|forbidden|authentication failed|rate[\s_-]?limit|too many requests|quota exceeded|usage limit (?:has been )?reached|model.{0,40}(?:unavailable|not available|not found|unknown|not supported|does not exist)|(?:provider|service).{0,40}(?:unavailable|overloaded)|temporarily unavailable|overloaded/i.test(
		error,
	);
}

export function shouldRetryWithFallback(
	result: Parameters<typeof isProviderAvailabilityFailure>[0],
	primaryModel: string | undefined,
	fallbackModels: string | undefined,
	aborted = false,
): boolean {
	return Boolean(!aborted && getFallbackSequence(primaryModel, parseFallbackModels(fallbackModels)).length && isProviderAvailabilityFailure(result));
}
