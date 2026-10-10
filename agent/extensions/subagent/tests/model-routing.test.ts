import assert from "node:assert/strict";
import test from "node:test";
import { getFallbackSequence, isProviderAvailabilityFailure, nextFallbackModel, parseFallbackModels, shouldRetryWithFallback } from "../model-routing.ts";

test("fallback strings parse as ordered normalized model sequences", () => {
  assert.deepEqual(parseFallbackModels(" openai-codex/gpt-6-luna || || github-copilot/gpt-6-luna || openai-codex/gpt-6-luna "), [
    "openai-codex/gpt-6-luna",
    "github-copilot/gpt-6-luna",
  ]);
  assert.deepEqual(parseFallbackModels("github-copilot/gpt-6-luna"), ["github-copilot/gpt-6-luna"]);
  assert.deepEqual(getFallbackSequence("anthropic/claude-haiku-5-5", parseFallbackModels("anthropic/claude-haiku-5-5 || github-copilot/gpt-6-luna")), ["github-copilot/gpt-6-luna"]);
});

test("fallback sequence takes parsed arrays, defaults to none, and skips only the exact primary", () => {
  assert.deepEqual(getFallbackSequence("github-copilot/claude-sonnet-5.5", ["github-copilot/claude-sonnet-5", "openai-codex/gpt-6-luna"]), ["github-copilot/claude-sonnet-5", "openai-codex/gpt-6-luna"]);
  assert.deepEqual(getFallbackSequence("github-copilot/claude-sonnet-5.5", ["github-copilot/claude-sonnet-5.5", "github-copilot/claude-sonnet-5"]), ["github-copilot/claude-sonnet-5"]);
  assert.deepEqual(getFallbackSequence("openai-codex/gpt-6-luna", undefined), []);
  assert.deepEqual(getFallbackSequence("openai-codex/gpt-6-luna", []), []);
});

test("literal Sonnet 5.5 IDs are preserved verbatim through fallback parsing and primary matching", () => {
  assert.deepEqual(parseFallbackModels("anthropic/claude-sonnet-5-5 || github-copilot/claude-sonnet-5.5 || github-copilot/claude-sonnet-5 || anthropic/claude-sonnet-5-5"), ["anthropic/claude-sonnet-5-5", "github-copilot/claude-sonnet-5.5", "github-copilot/claude-sonnet-5"]);
  assert.deepEqual(getFallbackSequence("anthropic/claude-sonnet-5-5", parseFallbackModels("anthropic/claude-sonnet-5 || anthropic/claude-sonnet-5-5")), ["anthropic/claude-sonnet-5"]);
});

test("ordered retry policy exhausts on availability errors and never retries task, aborted, or tool results", () => {
  const chain = ["openai-codex/gpt-6-luna", "github-copilot/gpt-6-luna"];
  const unavailable = { exitCode: 1, stopReason: "error", errorMessage: "503 provider unavailable" };
  assert.equal(nextFallbackModel(unavailable, chain), chain[0]);
  assert.equal(nextFallbackModel(unavailable, chain.slice(1)), chain[1]);
  assert.equal(nextFallbackModel(unavailable, []), undefined);
  assert.equal(nextFallbackModel({ ...unavailable, errorMessage: "test failed" }, chain), undefined);
  assert.equal(nextFallbackModel({ ...unavailable, stopReason: "aborted" }, chain), undefined);
  assert.equal(nextFallbackModel({ ...unavailable, toolActivity: true }, chain), undefined);
});

test("declared GPT-6.1 primary is preserved independently of Copilot fallback", () => {
  assert.deepEqual(parseFallbackModels("openai-codex/gpt-6.1-sol || github-copilot/gpt-6-sol"), ["openai-codex/gpt-6.1-sol", "github-copilot/gpt-6-sol"]);
});

test("quota fallback cannot replay edits, canceled work or task failures", () => {
  const primary = "openai-codex/gpt-6.1-sol", fallback = "github-copilot/gpt-6-sol";
  const failure = { exitCode: 1, stopReason: "error", errorMessage: "Codex error: The usage limit has been reached" };
  assert.equal(shouldRetryWithFallback(failure, primary, fallback), true);
  assert.equal(shouldRetryWithFallback(failure, primary, `${primary} || ${fallback}`), true);
  assert.equal(shouldRetryWithFallback({ ...failure, toolActivity: true }, primary, fallback), false);
  assert.equal(shouldRetryWithFallback({ ...failure, stopReason: "aborted" }, primary, fallback), false);
  assert.equal(shouldRetryWithFallback(failure, primary, fallback, true), false);
  assert.equal(shouldRetryWithFallback({ ...failure, errorMessage: "test failed" }, primary, fallback), false);
});

test("availability classifier reads only the real error message: no output/stderr prose, no auth or model replay", () => {
  const base = { exitCode: 1, stopReason: "error" };
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "You have hit your ChatGPT usage limit (plus plan). Try again in ~53 min." }), true);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "upstream returned no response" }), true);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "429 Too Many Requests" }), true);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "401 unauthorized" }), false);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "model gpt-x not found" }), false);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "test failed", output: "rate limit exceeded in my answer" }), false);
  assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage: "", stderr: "503 unavailable" }), false);
});

test("the guard's own synthetic cooldown messages are never provider health, so a child refusal cannot bypass the store", () => {
  const base = { exitCode: 1, stopReason: "error" };
  for (const errorMessage of ["provider cooldown unavailable", "provider cooldown cooling", "provider cooldown probe-busy", "provider cooldown blocked"]) {
    assert.equal(isProviderAvailabilityFailure({ ...base, errorMessage }), false, errorMessage);
    assert.equal(shouldRetryWithFallback({ ...base, errorMessage }, "openai-codex/gpt-6.1-sol", "github-copilot/gpt-6-sol"), false, errorMessage);
  }
});
