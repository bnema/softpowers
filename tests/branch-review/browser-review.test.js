import test from "node:test"
import assert from "node:assert/strict"
import { formatReviewPrompt, parseUnifiedDiff } from "../../.opencode/plugins/branch-review/review-prompt.js"
import { renderHighlightedCode } from "../../.opencode/plugins/branch-review/review-client.js"

test("parseUnifiedDiff extracts files and line anchors", () => {
  const files = parseUnifiedDiff(`diff --git a/src/app.js b/src/app.js
index 1234567..89abcde 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,3 @@
 const first = true
-const second = false
+const second = true
+const third = true
`)

  assert.equal(files.length, 1)
  assert.equal(files[0].path, "src/app.js")
  assert.equal(files[0].additions, 2)
  assert.equal(files[0].deletions, 1)
  assert.equal(files[0].hunks[0].lines[0].type, "context")
  assert.equal(files[0].hunks[0].lines[1].type, "remove")
  assert.equal(files[0].hunks[0].lines[1].oldLine, 2)
  assert.equal(files[0].hunks[0].lines[2].type, "add")
  assert.equal(files[0].hunks[0].lines[2].newLine, 2)
})

test("formatReviewPrompt matches the review output format", () => {
  const text = formatReviewPrompt({
    summary: "Check the retry path",
    comments: [
      {
        path: "src/app.js",
        side: "new",
        newLine: 14,
        body: "This branch can be nil",
        snippet: "const branch = maybeBranch()",
      },
    ],
  })

  assert.match(text, /Local branch review/)
  assert.match(text, /Summary\nCheck the retry path/)
  assert.match(text, /File: src\/app\.js/)
  assert.match(text, /- new line 14: This branch can be nil/)
  assert.match(text, /Snippet: const branch = maybeBranch\(\)/)
})

test("renderHighlightedCode falls back without hljs", () => {
  const previous = globalThis.hljs
  delete globalThis.hljs

  try {
    const node = { textContent: "", innerHTML: "" }
    const result = renderHighlightedCode(node, "const answer = 42")

    assert.equal(result, false)
    assert.equal(node.textContent, "const answer = 42")
    assert.equal(node.innerHTML, "")
  } finally {
    if (previous === undefined) delete globalThis.hljs
    else globalThis.hljs = previous
  }
})

test("renderHighlightedCode uses hljs when available", () => {
  const previous = globalThis.hljs
  globalThis.hljs = {
    highlightAuto(text) {
      return { value: `<span class=\"hljs-keyword\">${text}</span>`, language: "javascript" }
    },
  }

  try {
    const node = { textContent: "", innerHTML: "" }
    const result = renderHighlightedCode(node, "const answer = 42")

    assert.equal(result, true)
    assert.equal(node.innerHTML, '<span class="hljs-keyword">const answer = 42</span>')
  } finally {
    if (previous === undefined) delete globalThis.hljs
    else globalThis.hljs = previous
  }
})
