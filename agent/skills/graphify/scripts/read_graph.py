"""Bounded, standard-library Graphify inspection. Reads one file; writes none."""
import argparse
from collections import deque
import json
from pathlib import Path
import re
import sys


def inspect_graph(args):
    graph_path = Path(args.graph).expanduser()
    if not graph_path.is_absolute():
        raise ValueError("--graph must be an existing absolute path")
    data = json.loads(graph_path.read_text(encoding="utf-8-sig"))
    nodes = {str(n["id"]): n for n in data["nodes"]
             if not args.repo or n.get("repo") == args.repo}
    edges = [e for e in data.get("links", data.get("edges", []))
             if str(e["source"]) in nodes and str(e["target"]) in nodes]
    directed = bool(data.get("directed", False))
    adjacency = {key: [] for key in nodes}
    for edge in edges:
        source, target = str(edge["source"]), str(edge["target"])
        adjacency[source].append(target)
        if args.mode != "path" or not directed:
            adjacency[target].append(source)

    def matches(text, count):
        text = (text or "").strip().casefold()
        if not text:
            return []
        terms = set(re.findall(r"\w+", text)) - {"the", "a", "an", "is", "how", "what", "of", "to", "and"}
        scored = []
        for key, node in nodes.items():
            label = str(node.get("label", key)).casefold()
            score = (100 if text in (key.casefold(), label) else 0) + sum(term in label for term in terms)
            if score:
                scored.append((-score, key))
        return [key for _, key in sorted(scored)[:count]]

    truncated = False
    if args.mode == "path":
        starts, ends = matches(args.start, 1), matches(args.end, 1)
        selected = []
        status = "no_match" if not starts or not ends else "no_path"
        if starts and ends:
            queue, parents = deque(starts), {starts[0]: None}
            while queue:
                current = queue.popleft()
                if current == ends[0]:
                    while current is not None:
                        selected.append(current)
                        current = parents[current]
                    selected.reverse()
                    status = "path_found"
                    break
                if len(parents) >= 10000:
                    truncated, status = True, "search_limit"
                    break
                for neighbor in adjacency[current]:
                    if neighbor not in parents:
                        parents[neighbor] = current
                        queue.append(neighbor)
    else:
        starts = matches(args.query, 1 if args.mode == "explain" else 3)
        selected, seen, queue = [], set(starts), deque((key, 0) for key in starts)
        while queue and len(selected) < args.limit:
            current, depth = queue.popleft()
            selected.append(current)
            if depth < args.depth:
                for neighbor in adjacency[current]:
                    if neighbor not in seen:
                        seen.add(neighbor)
                        queue.append((neighbor, depth + 1))
        truncated = bool(queue)
        status = "matches_found" if starts else "no_match"
    truncated |= len(selected) > args.limit
    selected = selected[:args.limit]
    selected_set = set(selected)
    def fields(record, names):
        return {name: (value[:500] if isinstance(value, str) else value)
                for name in names if (value := record.get(name)) is not None
                and isinstance(value, (str, int, float, bool))}
    result_edges = [fields(e, ("source", "target", "relation", "confidence", "type"))
                    for e in edges if str(e["source"]) in selected_set and str(e["target"]) in selected_set]
    truncated |= len(result_edges) > args.limit
    result = {"mode": args.mode, "status": status, "directed": directed, "repo": args.repo,
              "truncated": truncated,
              "nodes": [fields(nodes[key], ("id", "label", "repo", "source_file", "source_location", "type")) for key in selected],
              "edges": result_edges[:args.limit]}
    encoded = json.dumps(result, ensure_ascii=False)
    while len(encoded) > 12000 and (result["edges"] or result["nodes"]):
        result["truncated"] = True
        (result["edges"] if result["edges"] else result["nodes"]).pop()
        encoded = json.dumps(result, ensure_ascii=False)
    return encoded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("query", "explain", "path"))
    parser.add_argument("--graph", required=True)
    parser.add_argument("--query")
    parser.add_argument("--from", dest="start")
    parser.add_argument("--to", dest="end")
    parser.add_argument("--repo")
    parser.add_argument("--limit", type=int, choices=range(1, 31), default=12)
    parser.add_argument("--depth", type=int, choices=range(0, 5), default=2)
    args = parser.parse_args()
    if args.mode == "path" and (not args.start or not args.end):
        parser.error("path requires --from and --to")
    if args.mode != "path" and not args.query:
        parser.error("query/explain requires --query")
    try:
        print(inspect_graph(args))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Graph unavailable or invalid: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
