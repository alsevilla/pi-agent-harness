# Plain QMD Pi extension

index.ts registers qmd_search, qmd_get and qmd_status. config.json points to your installed Node/QMD CLI. The main session discovers this folder; code subagents load index.ts explicitly.

Search uses BM25 with three hits by default (maximum five), an optional collection scope, and no returned snippets. Get reads a selected document with a 100-line/10000-character cap. Status inspects existing collections. No LLM expansion, reranking, adaptive learning or index setup/update/embed tools are exposed. CLI arguments are passed without a shell.

Edit config.json if your Node or QMD installation moves. Restart Pi or use /reload. Existing QMD collections and database are preserved.
