# Manual refresh

Reload Pi, then use:

- `/refresh graph`: update the current Git checkout root's existing `graphify-out/graph.json` (current directory outside Git).
- `/refresh graph "C:/absolute/project root"`: explicitly select a checkout with an existing graph.
- `/refresh qmd`: update every collection in the QMD extension's named global index.
- `/refresh serena`: dispatch the loaded `/serena-restart` command to restart its existing worker.

These commands never ask the orchestrator model. Graphify performs its installed code extraction/update; semantic document/image extraction is separate. A worktree without a graph must explicitly select the intended primary checkout; its graph still describes that checkout. No builds, installs, global-graph rebuilds, QMD embedding, pull commands, or periodic maintenance run automatically.

Graph output is explicitly confined to the selected checkout's `graphify-out` rather than inherited `GRAPHIFY_OUT` overrides; output links outside that checkout are refused. This is a code graph refresh, not an LLM semantic extraction.

QMD uses `../qmd/config.json`, including `indexName`, and checks its effective global YAML. Configured collection update hooks are rejected because they can run arbitrary commands. Index writes refresh text/BM25 and may invalidate old embeddings; no replacement embeddings are generated.

For another machine, copy `config.example.json` to `config.json` and set an existing Graphify Python interpreter. The default Windows interpreter is the current user's installed uv `graphifyy` environment. Both process launches use hidden Windows windows, no shell, a timeout (default 120 seconds, maximum 10 minutes), and bounded output. Only one process refresh runs at a time. Timeout can leave partial outputs; inspect them before repeating. Serena reports its own restart outcome; forwarding is unavailable when its command is not loaded. Reload/extension shutdown does not cancel an already running refresh; let it finish first.

Checks: `node --test tests/core.test.ts`. Tests mock processes and do not refresh project graphs or indexes.
