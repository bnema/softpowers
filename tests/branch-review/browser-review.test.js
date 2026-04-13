import test from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { formatReviewPrompt, parseUnifiedDiff } from "../../.opencode/plugins/branch-review/review-prompt.js"
import { buildFileTree } from "../../.opencode/plugins/branch-review/review-file-tree.js"
import { groupDraftComments } from "../../.opencode/plugins/branch-review/review-draft-panel.js"
import * as reviewClient from "../../.opencode/plugins/branch-review/review-client.js"
import { initTheme } from "../../.opencode/plugins/branch-review/review-theme.js"
import * as reviewTheme from "../../.opencode/plugins/branch-review/review-theme.js"

const { renderHighlightedCode, storageKey } = reviewClient

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

test("buildFileTree groups files by directory", () => {
  const tree = buildFileTree([
    { path: "a/one.js" },
    { path: "a/two.js" },
    { path: "b/three.js" },
  ])

  assert.equal(tree.children.length, 2)
  assert.equal(tree.children[0].name, "a")
})

test("groupDraftComments orders comments by file and start line", () => {
  const groups = groupDraftComments([
    { path: "z/file.js", startLine: 20, body: "later" },
    { path: "a/file.js", startLine: 30, body: "alpha later" },
    { path: "a/file.js", startLine: 10, body: "alpha early" },
    { path: "z/file.js", startLine: 5, body: "first" },
  ])

  assert.deepEqual(
    groups.map((group) => ({
      path: group.path,
      lines: group.comments.map((comment) => comment.startLine),
    })),
    [
      { path: "a/file.js", lines: [10, 30] },
      { path: "z/file.js", lines: [5, 20] },
    ],
  )
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
      {
        path: "src/app.js",
        side: "new",
        startLine: 20,
        endLine: 21,
        body: "This path needs a guard",
        snippetLines: ["const branch = maybeBranch()", "if (branch) return branch"],
      },
    ],
  })

  assert.match(text, /Local branch review/)
  assert.match(text, /Summary\nCheck the retry path/)
  assert.match(text, /File: src\/app\.js/)
  assert.match(text, /- new line 14: This branch can be nil/)
  assert.match(text, /Snippet: const branch = maybeBranch\(\)/)
  assert.match(text, /- new lines 20-21: This path needs a guard/)
  assert.match(text, /  Snippet:\n  ```\n  const branch = maybeBranch\(\)\n  if \(branch\) return branch\n  ```/)
})

test("normalizeSelection creates a single-line selection", () => {
  assert.equal(typeof reviewClient.normalizeSelection, "function")

  const selection = reviewClient.normalizeSelection([
    { lineRef: 12, text: "const answer = 42" },
  ], "new")

  assert.deepEqual(selection, {
    side: "new",
    startLine: 12,
    endLine: 12,
    snippetLines: ["const answer = 42"],
  })
})

test("normalizeSelection creates a range selection", () => {
  assert.equal(typeof reviewClient.normalizeSelection, "function")

  const selection = reviewClient.normalizeSelection([
    { lineRef: 12, text: "const first = true" },
    { lineRef: 13, text: "const second = true" },
    { lineRef: 14, text: "const third = true" },
  ], "new")

  assert.deepEqual(selection, {
    side: "new",
    startLine: 12,
    endLine: 14,
    snippetLines: ["const first = true", "const second = true", "const third = true"],
  })
})

test("normalizedComments drops blank saved comments", () => {
  assert.equal(typeof reviewClient.normalizedComments, "function")

  const comments = reviewClient.normalizedComments({
    comments: [
      { path: "src/app.js", body: "   " },
      { path: "src/app.js", body: "Keep this", startLine: 1 },
    ],
  })

  assert.deepEqual(comments, [{ path: "src/app.js", body: "Keep this", startLine: 1 }])
})

test("currentReview omits blank comments from submission content", () => {
  assert.equal(typeof reviewClient.currentReview, "function")

  const review = reviewClient.currentReview({
    summary: "  Check this  ",
    comments: [
      { path: "src/app.js", body: "   ", startLine: 1 },
      { path: "src/app.js", body: "Keep this", startLine: 2 },
    ],
  })

  assert.deepEqual(review, {
    summary: "Check this",
    comments: [{ path: "src/app.js", body: "Keep this", startLine: 2 }],
  })
})

test("loadDiff sends the review token header", async () => {
  assert.equal(typeof reviewClient.loadDiff, "function")

  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options])
    return {
      ok: true,
      json: async () => ({ files: [], patch: "" }),
    }
  }

  try {
    await reviewClient.loadDiff({ token: "review-token" })
  } finally {
    globalThis.fetch = previousFetch
  }

  assert.deepEqual(calls, [["/api/diff", { headers: { "x-review-token": "review-token" } }]])
})

test("buildCommentCounts ignores blank saved comments", () => {
  assert.equal(typeof reviewClient.buildCommentCounts, "function")

  const counts = reviewClient.buildCommentCounts({
    comments: [
      { path: "src/app.js", body: "   " },
      { path: "src/app.js", body: "Keep this" },
      { path: "src/other.js", body: "Also keep" },
    ],
  })

  assert.deepEqual([...counts.entries()], [
    ["src/app.js", 1],
    ["src/other.js", 1],
  ])
})

test("renderHighlightedCode falls back without hljs", () => {
  const previous = globalThis.hljs
  delete globalThis.hljs

  try {
    const node = { textContent: "", innerHTML: "" }
    const result = renderHighlightedCode(node, "plain text only")

    assert.equal(result, false)
    assert.equal(node.textContent, "plain text only")
    assert.equal(node.innerHTML, "")
  } finally {
    if (previous === undefined) delete globalThis.hljs
    else globalThis.hljs = previous
  }
})

test("renderHighlightedCode highlights code locally without hljs", () => {
  const previous = globalThis.hljs
  delete globalThis.hljs

  try {
    const node = { textContent: "", innerHTML: "" }
    const result = renderHighlightedCode(node, "const answer = 42 // comment")

    assert.equal(result, true)
    assert.match(node.innerHTML, /hljs-keyword/)
    assert.match(node.innerHTML, /hljs-comment/)
  } finally {
    if (previous === undefined) delete globalThis.hljs
    else globalThis.hljs = previous
  }
})

test("storageKey includes the review session", () => {
  assert.equal(
    storageKey({ repo: "repo", base: "main", head: "feature", session: "ses_expected" }),
    "superpowers:review:repo:main:feature:ses_expected",
  )
})

test("initTheme prefers saved storage over system preference", () => {
  const storage = {
    getItem(key) {
      assert.equal(key, "superpowers:review:theme")
      return "dark"
    },
    setItem() {
      throw new Error("should not write during init")
    },
  }

  const document = {
    documentElement: {
      dataset: {},
      style: {},
    },
  }

  initTheme({
    document,
    storage,
    matchMedia: () => ({ matches: false }),
  })

  assert.equal(document.documentElement.dataset.theme, "dark")
})

test("applyThemeToRoot updates theme attributes in one place", () => {
  assert.equal(typeof reviewTheme.applyThemeToRoot, "function")

  const root = {
    dataset: {},
    style: {},
  }

  reviewTheme.applyThemeToRoot(root, "dark")

  assert.equal(root.dataset.theme, "dark")
  assert.equal(root.style.colorScheme, "dark")
})

test("toggleTheme persists a theme choice to storage", () => {
  const calls = []
  const storage = {
    getItem() {
      return "light"
    },
    setItem(key, value) {
      calls.push([key, value])
    },
  }
  const document = {
    documentElement: {
      dataset: { theme: "light" },
      style: {},
    },
  }
  const button = {
    textContent: "",
    dataset: {},
    setAttribute() {},
  }

  const next = reviewClient.toggleTheme({ document, storage, button })

  assert.equal(next, "dark")
  assert.deepEqual(calls, [["superpowers:review:theme", "dark"]])
})

test("renderApp registers the mouseup listener", async () => {
  const previousDocument = globalThis.document
  const previousFetch = globalThis.fetch
  let mouseupListener = null
  let mouseupOptions = null

  function createNode(tagName) {
    return {
      tagName: String(tagName || "div").toUpperCase(),
      children: [],
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
      dataset: {},
      hidden: false,
      innerHTML: "",
      style: {},
      textContent: "",
      append(...nodes) {
        this.children.push(...nodes)
      },
      replaceChildren(...nodes) {
        this.children = [...nodes]
      },
      querySelector() {
        return null
      },
      querySelectorAll() {
        return []
      },
      setAttribute() {},
      addEventListener() {},
    }
  }

  const elements = new Map([
    ["review-bootstrap", { textContent: JSON.stringify({ repo: "repo", base: "main", head: "feature", session: "ses_123", token: "token" }) }],
    ["file-list", createNode("div")],
    ["diff-view", createNode("div")],
    ["draft-editor", createNode("div")],
    ["review-toolbar", createNode("div")],
    ["status", createNode("p")],
  ])

  const document = {
    documentElement: { dataset: {}, style: {} },
    getElementById(id) {
      return elements.get(id) || null
    },
    createElement(tagName) {
      return createNode(tagName)
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    addEventListener(type, handler, options = {}) {
      if (type !== "mouseup") return
      mouseupListener = handler
      mouseupOptions = options
    },
    removeEventListener() {},
  }

  globalThis.document = document
  globalThis.fetch = async () => ({ ok: false, status: 500 })

  try {
    await import(`${pathToFileURL(new URL("../../.opencode/plugins/branch-review/review-client.js", import.meta.url).pathname).href}?cleanup=${Date.now()}`)

    assert.equal(typeof mouseupListener, "function")
    assert.ok(mouseupOptions?.signal)
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument

    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
  }
})
