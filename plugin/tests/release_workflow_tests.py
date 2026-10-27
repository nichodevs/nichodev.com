import json
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/plugin.yml"
SCRIPT = textwrap.dedent(
    WORKFLOW.read_text(encoding="utf-8")
    .split("      - name: Publicar os pacotes validados desta execução\n", 1)[1]
    .split("        run: |\n", 1)[1]
)
MOCK = r"""
export GH_REPO=nichodevs/nichodev.com GITHUB_RUN_ID=123 GITHUB_SHA=validated-sha
gh() {
  printf '%s\n' "$*" >> calls
  case "$1 $2" in
    "release view")
      case "$MODE" in
        published|draft|incomplete) jq -r "$7" existing.json ;;
        *) return 1 ;;
      esac
      ;;
    "api repos/$GH_REPO/git/matching-refs/tags/v0.2.1")
      if [ "$MODE" = tagged ]; then echo refs/tags/v0.2.1; fi
      ;;
    "run download")
      test "$3" = "$GITHUB_RUN_ID"
      test "$4" = --name
      test "$6" = --dir
      test "$5" = "$7"
      mkdir -p "$7/Nichodev Guitar FX.vst3/Contents"
      echo fixture > "$7/Nichodev Guitar FX.vst3/Contents/binary"
      if [ "$MODE" != missing ]; then
        mkdir -p "$7/Nichodev Deluxe 65 Amp.vst3/Contents"
        echo fixture > "$7/Nichodev Deluxe 65 Amp.vst3/Contents/binary"
      fi
      ;;
    "release create")
      test "$3" = v0.2.1
      test -s "$4"
      test -s "$5"
      test "$6" = --target
      test "$7" = "$GITHUB_SHA"
      test "${10}" = --notes-file
      test -s "${11}"
      echo published > result
      ;;
    *) return 99 ;;
  esac
}
"""


class ReleaseWorkflowTests(unittest.TestCase):
    def test_publication_guards(self):
        for mode in ("new", "published", "draft", "incomplete", "tagged", "missing", "no-notes", "bad-version"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "plugin/releases").mkdir(parents=True)
                version = "invalid" if mode == "bad-version" else "0.2.1"
                (root / "plugin/CMakeLists.txt").write_text(
                    f"project(NichodevVST3Suite VERSION {version} LANGUAGES C CXX)\n",
                    encoding="utf-8",
                )
                if mode != "no-notes":
                    (root / "plugin/releases/v0.2.1.md").write_text("Fixture notes\n", encoding="utf-8")
                assets = [{"name": f"NichodevVST3-{os}.zip"} for os in ("windows-latest", "ubuntu-latest")]
                (root / "existing.json").write_text(json.dumps({
                    "isDraft": mode == "draft",
                    "assets": assets[:1] if mode == "incomplete" else assets,
                }), encoding="utf-8")
                result = subprocess.run(
                    ["bash", "--noprofile", "--norc", "-euo", "pipefail", "-s"],
                    input=f"MODE={mode}\n" + MOCK + SCRIPT,
                    text=True, cwd=root, capture_output=True,
                )
                expected_success = mode in ("new", "published")
                self.assertEqual(result.returncode == 0, expected_success, result.stdout + result.stderr)
                self.assertEqual((root / "result").exists(), mode == "new")
                calls = (root / "calls").read_text() if (root / "calls").exists() else ""
                if mode == "new":
                    self.assertIn("release create", calls)
                else:
                    self.assertNotIn("release create", calls)
                if mode == "published":
                    self.assertNotIn("run download", calls)


if __name__ == "__main__":
    unittest.main()
