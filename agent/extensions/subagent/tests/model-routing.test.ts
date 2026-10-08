import assert from "node:assert/strict";
import test from "node:test";
import { getFallbackSequence, nextFallbackModel, normalizeModelRef, parseFallbackModels, shouldRetryWithFallback } from "../model-routing.ts";

test("fallback strings parse as ordered normalized model sequences", () => {
  assert.deepEqual(parseFallbackModels(" openai-codex/gpt-6-luna || || github-copilot/gpt-6-luna || openai-codex/gpt-6-luna "), [
    "openai-codex/gpt-6-luna",
    "github-copilot/gpt-6-luna",
  ]);
  assert.deepEqual(parseFallbackModels("github-copilot/gpt-6-luna"), ["github-copilot/gpt-6-luna"]);
  assert.deepEqual(getFallbackSequence("anthropic/claude-haiku-5-5", parseFallbackModels("anthropic/claude-haiku-5-5 || github-copilot/gpt-6-luna")), ["github-copilot/gpt-6-luna"]);
});

test("fallback sequence takes parsed arrays, defaults to none, and skips the normalized primary", () => {
  assert.deepEqual(getFallbackSequence("github-copilot/claude-sonnet-5.5", ["github-copilot/claude-sonnet-5", "openai-codex/gpt-6-luna"]), ["openai-codex/gpt-6-luna"]);
  assert.deepEqual(getFallbackSequence("openai-codex/gpt-6-luna", undefined), []);
  assert.deepEqual(getFallbackSequence("openai-codex/gpt-6-luna", []), []);
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
  assert.equal(normalizeModelRef("openai-codex/gpt-6.1-sol"), "openai-codex/gpt-6.1-sol");
  assert.equal(normalizeModelRef("github-copilot/gpt-6-sol"), "github-copilot/gpt-6-sol");
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
