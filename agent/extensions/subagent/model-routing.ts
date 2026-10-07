export function normalizeModelRef(model: string): string {
	return model
		.replace(/(^|\/)claude-sonnet-5(?:-5|\.5)$/, "$1claude-sonnet-5");
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
	fallbackModel: string | undefined,
	aborted = false,
): boolean {
	return Boolean(
		!aborted &&
		fallbackModel &&
		fallbackModel !== primaryModel &&
		isProviderAvailabilityFailure(result),
	);
}
