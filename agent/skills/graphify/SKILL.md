---
name: graphify
description: Navigate existing Graphify project/global graphs with verified absolute paths and bounded read-only output. Build/update/export only when explicitly assigned; load the relevant reference instead of the full pipeline.
---

# Graphify for the modular Pi profile

Use graph evidence for orientation, then verify candidate source with Serena or targeted reads. User requirements, role authority and candidate boundaries govern every procedure here.

## Choose one procedure

- Existing graph questions, paths or node explanations: `references/query.md`.
- Explicit graph build/update/cluster/export/clone/watch assignment: `references/build.md`.
- Global graph: use the dispatcher's coverage guidance before treating it as a project reference.

Resolve reference and script paths from this skill directory. Reuse loaded guidance; do not read every reference.

## Resolve the graph before using it

Use the dispatcher's verified absolute artifact paths. An existing candidate graph is preferred; the primary checkout can supply a read-only reference when a worktree has no graph. Do not construct or list a missing candidate `graphify-out` folder to rediscover the supplied graph. Never change candidate cwd or Serena project to make a relative graph path work.

In the main session, if no paths were supplied, check the candidate root and resolve its primary checkout through Git worktree metadata. Use exact existing artifacts, not guesses based on repository names or sibling folders. If no applicable graph exists, skip graph navigation and use focused permitted source reads. A missing graph is not authority to install tools, build graphs or initialize caches.

`~/.graphify/global-graph.json` is a separate corpus. Check its bounded coverage manifest and exact source-path relationship to the candidate/primary checkout. If coverage is not established, use it only for an assigned cross-project question or after confirming relevant coverage. Do not load the whole global JSON into model context. Graph source paths can be stale or belong to another branch.

## Read-only means no side effects

Prefer a selected wiki section/report. For graph-level queries, use `scripts/read_graph.py` with an existing absolute graph path; it prints bounded JSON, uses Python's standard library, makes no model calls and writes no files.

Do not create `.graphify_python`, `.vocab.txt`, query stamps or feedback records during ordinary retrieval. The installed Graphify CLI's query path writes a cache stamp beside the graph, so its `query`, `path`, `explain` or `save-result` commands are not a read-only substitute without separately authorized write scope. Do not auto-update graphs after source edits; report possible staleness and verify current source.

## Delegation and evidence

Leaf workers never launch helpers or use an `Agent`/`Task` tool. If another role or a new graph build is needed, return a scoped handoff. Only the main orchestrator may use Pi's actual `subagent` tool with existing named roles when justified. A skill does not independently authorize a pipeline, broader writes, API credentials, extra model calls or default agent batches.

Cite graph source locations as reference evidence, preserve EXTRACTED/INFERRED/AMBIGUOUS distinctions and state missing coverage. Never invent nodes, edges, files or token savings. Candidate edits and tests remain in the assigned candidate even when graph references are elsewhere.
