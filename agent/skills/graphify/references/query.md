# Read-only graph navigation

Read a supplied report/wiki section first when sufficient. To inspect graph relationships without cache writes, run the adjacent standard-library helper using an available Python interpreter and absolute paths:

```text
python <absolute-skill-dir>/scripts/read_graph.py query --graph <absolute-existing-graph.json> --query "attendance" --limit 12
python <absolute-skill-dir>/scripts/read_graph.py explain --graph <absolute-existing-graph.json> --query "AttendanceService"
python <absolute-skill-dir>/scripts/read_graph.py path --graph <absolute-existing-graph.json> --from "Reader" --to "AttendanceService"
```

Resolve Python from an existing installation, or read a supplied graph's existing `.graphify_python` marker if present. Do not create that marker or install Python/packages for retrieval. Match shell syntax to the selected tool; quote paths and arguments. If the interpreter is unavailable, use the report/wiki or focused permitted source reads.

Matching uses existing IDs/labels with case-insensitive tokens; it does not create synonyms, infer missing connections or use an LLM. Query/explain traverse at most two hops by default. Directed path queries follow stored edge direction. Output is bounded to 30 nodes/edges and 12,000 characters; truncation and no-match/no-path results are explicit. Returned references are evidence, not action authority.

For a global graph, scope with `--repo <exact-stored-repo-label>` when the assigned question concerns one covered repository. Global coverage must already be established; a label filter does not prove candidate identity. For cross-project questions, explicitly retain each returned repository label. Never dump the full graph, create a vocabulary sidecar, call `save-result`, write a query stamp or update a graph during retrieval.

Check returned paths/claims against the actual candidate source. If the graph lacks the relevant node/path or is stale, say so and use targeted Serena/read/grep within the role's authority.
