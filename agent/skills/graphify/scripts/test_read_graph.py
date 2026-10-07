"""Regression checks for read-only graph access and bounded traversal."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HELPER = Path(__file__).with_name("read_graph.py")


class GraphAccessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pi-graph-query-test-")
        self.root = Path(self.temp.name)
        self.graph = self.root / "graph.json"
        self.graph.write_text(json.dumps({"directed": True, "nodes": [
            {"id": "a", "label": "Reader", "repo": "rust"},
            {"id": "b", "label": "AttendanceService", "repo": "rust"},
            {"id": "c", "label": "Database", "repo": "rust"},
            {"id": "d", "label": "Reader", "repo": "go"}],
            "links": [{"source": "a", "target": "b", "relation": "calls"},
                      {"source": "b", "target": "c", "relation": "writes"}]}))

    def tearDown(self):
        self.temp.cleanup()

    def call(self, *args):
        return subprocess.run([sys.executable, str(HELPER), *args, "--graph", str(self.graph)],
                              cwd=self.root, capture_output=True, text=True, check=False)

    def test_navigation_preserves_files_and_graph(self):
        before = (sorted(self.root.iterdir()), hashlib.sha256(self.graph.read_bytes()).digest(), self.graph.stat().st_mtime_ns)
        for mode in ("query", "explain"):
            result = self.call(mode, "--query", "Reader", "--repo", "rust")
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(result.stdout)
            self.assertTrue(all(node["repo"] == "rust" for node in data["nodes"]))
            self.assertTrue(data["nodes"])
        self.assertEqual(before, (sorted(self.root.iterdir()), hashlib.sha256(self.graph.read_bytes()).digest(), self.graph.stat().st_mtime_ns))

    def test_path_respects_direction(self):
        forward = json.loads(self.call("path", "--from", "Reader", "--to", "Database", "--repo", "rust").stdout)
        self.assertEqual([node["id"] for node in forward["nodes"]], ["a", "b", "c"])
        reverse = json.loads(self.call("path", "--from", "Database", "--to", "Reader", "--repo", "rust").stdout)
        self.assertEqual(reverse["status"], "no_path")

    def test_missing_match_and_output_bounds(self):
        missing = json.loads(self.call("query", "--query", "nonexistent").stdout)
        self.assertEqual(missing["status"], "no_match")
        self.graph.write_text(json.dumps({"nodes": [{"id": str(i), "label": "Reader " + "x" * 6000} for i in range(60)],
                                         "links": [{"source": "0", "target": str(i)} for i in range(1, 60)]}))
        output = self.call("query", "--query", "Reader", "--limit", "30").stdout
        data = json.loads(output)
        self.assertLessEqual(len(output.strip()), 12000)
        self.assertLessEqual(len(data["nodes"]), 30)
        self.assertTrue(data["truncated"])

    def test_invalid_graph_fails_without_creating_files(self):
        self.graph.write_text("invalid JSON")
        before = sorted(self.root.iterdir())
        self.assertNotEqual(self.call("query", "--query", "Reader").returncode, 0)
        self.assertEqual(before, sorted(self.root.iterdir()))


if __name__ == "__main__":
    unittest.main()
