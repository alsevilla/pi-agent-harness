import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelRef, shouldRetryWithFallback } from "../model-routing.ts";

test("declared GPT-6.1 primary is preserved independently of Copilot fallback", () => {
  assert.equal(normalizeModelRef("openai-codex/gpt-6.1-sol"), "openai-codex/gpt-6.1-sol");
  assert.equal(normalizeModelRef("github-copilot/gpt-6-sol"), "github-copilot/gpt-6-sol");
});

test("quota fallback cannot replay edits, canceled work or task failures", () => {
  const primary = "openai-codex/gpt-6.1-sol", fallback = "github-copilot/gpt-6-sol";
  const failure = { exitCode: 1, stopReason: "error", errorMessage: "Codex error: The usage limit has been reached" };
  assert.equal(shouldRetryWithFallback(failure, primary, fallback), true);
  assert.equal(shouldRetryWithFallback({ ...failure, toolActivity: true }, primary, fallback), false);
  assert.equal(shouldRetryWithFallback({ ...failure, stopReason: "aborted" }, primary, fallback), false);
  assert.equal(shouldRetryWithFallback(failure, primary, fallback, true), false);
  assert.equal(shouldRetryWithFallback({ ...failure, errorMessage: "test failed" }, primary, fallback), false);
});
