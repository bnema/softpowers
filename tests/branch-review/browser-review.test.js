import test from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { formatReviewPrompt, parseUnifiedDiff } from "../../.opencode/plugins/branch-review/review-prompt.js"
import { buildFileTree } from "../../.opencode/plugins/branch-review/review-file-tree.js"
import { groupDraftComments } from "../../.opencode/plugins/branch-review/review-draft-panel.js"
import * as reviewClient from "../../.opencode/plugins/branch-review/review-client.js"
import { initTheme } from "../../.opencode/plugins/branch-review/review-theme.js"
import * as reviewTheme from "../../.opencode/plugins/branch-review/review-theme.js"

const { renderHighlightedCode, storageKey, renderStaleBanner, preserveComposerAcrossReload } = reviewClient

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

test("renderStaleBanner returns a stale status banner", () => {
  assert.equal(typeof renderStaleBanner, "function")

  const calls = []
  const document = {
    createElement(tagName) {
      const element = {
        tagName: String(tagName).toUpperCase(),
        className: "",
        dataset: {},
        textContent: "",
        innerHTML: "",
        children: [],
        append(...nodes) {
          this.children.push(...nodes)
        },
        setAttribute(name, value) {
          this.attributes ||= []
          this.attributes.push([name, value])
        },
        addEventListener(type, handler) {
          calls.push([type, handler])
        },
      }
      return element
    },
  }

  const banner = renderStaleBanner(document, {
    stale: true,
    reloading: false,
    onReload() {},
  })

  assert.equal(banner.tagName, "DIV")
  assert.match(banner.className, /stale/i)
  assert.equal(banner.dataset.kind, "stale")
  assert.deepEqual(banner.attributes, [
    ["role", "status"],
    ["aria-live", "polite"],
  ])
  assert.match(banner.children[0].innerHTML, /<svg/i)
  assert.equal(banner.children[1].textContent, "Diff changed")
  assert.equal(banner.children[2].textContent, "Reload")
  assert.equal(banner.children[2].className, "review-status__action")
  assert.equal(banner.children.length, 3)
  assert.equal(calls.length, 1)
})

test("preserveComposerAcrossReload keeps the exact anchor", () => {
  assert.equal(typeof preserveComposerAcrossReload, "function")

  const composer = {
    path: "src/app.js",
    side: "new",
    startLine: 12,
    endLine: 14,
    body: "Keep this",
  }
  const files = [
    {
      path: "src/app.js",
      hunks: [
        {
          lines: [
            { type: "add", newLine: 12, text: "const first = true" },
            { type: "add", newLine: 13, text: "const second = true" },
            { type: "add", newLine: 14, text: "const third = true" },
          ],
        },
      ],
    },
  ]

  assert.strictEqual(preserveComposerAcrossReload(composer, files), composer)
})

test("preserveComposerAcrossReload drops a missing anchor", () => {
  assert.equal(typeof preserveComposerAcrossReload, "function")

  const composer = {
    path: "src/app.js",
    side: "new",
    startLine: 12,
    endLine: 14,
    body: "Keep this",
  }
  const files = [
    {
      path: "src/app.js",
      hunks: [
        {
          lines: [
            { type: "add", newLine: 20, text: "const first = true" },
            { type: "add", newLine: 21, text: "const second = true" },
            { type: "add", newLine: 22, text: "const third = true" },
          ],
        },
      ],
    },
  ]

  assert.equal(preserveComposerAcrossReload(composer, files), null)
})

test("createDraftPreviewDisclosure starts collapsed", () => {
  assert.equal(typeof reviewClient.createDraftPreviewDisclosure, "function")

  const elements = []
  const document = {
    createElement(tagName) {
      const element = {
        tagName: tagName.toUpperCase(),
        className: "",
        textContent: "",
        id: "",
        open: true,
        children: [],
        append(...nodes) {
          this.children.push(...nodes)
        },
      }
      elements.push(element)
      return element
    },
  }

  const { draftPreviewSection, draftPreviewHeading, draftPreview } = reviewClient.createDraftPreviewDisclosure(document)

  assert.equal(draftPreviewSection.tagName, "DETAILS")
  assert.equal(draftPreviewSection.className, "draft-preview")
  assert.equal(draftPreviewSection.open, false)
  assert.equal(draftPreviewHeading.tagName, "SUMMARY")
  assert.equal(draftPreviewHeading.textContent, "Prompt preview")
  assert.equal(draftPreview.id, "draft-preview")
  assert.deepEqual(draftPreviewSection.children, [draftPreviewHeading, draftPreview])
  assert.equal(elements.length, 3)
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

test("loadReviewStatus sends the review token header", async () => {
  assert.equal(typeof reviewClient.loadReviewStatus, "function")

  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options])
    return {
      ok: true,
      json: async () => ({ status: "pending" }),
    }
  }

  try {
    await reviewClient.loadReviewStatus({ token: "review-token" })
  } finally {
    globalThis.fetch = previousFetch
  }

  assert.deepEqual(calls, [["/api/review-status", { headers: { "x-review-token": "review-token" } }]])
})

test("loadReviewStatus throws on failed status requests", async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ ok: false }),
  })

  try {
    await assert.rejects(() => reviewClient.loadReviewStatus({ token: "review-token" }), /failed to load review status/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("pollReviewStatus marks review stale when fingerprint changes", async () => {
  assert.equal(typeof reviewClient.pollReviewStatus, "function")

  const state = {
    bootstrap: { token: "review-token" },
    diffFingerprint: "loaded-fingerprint",
    stale: false,
    loadReviewStatus: async () => ({ fingerprint: "new-fingerprint" }),
  }

  await reviewClient.pollReviewStatus(state)

  assert.equal(state.stale, true)
})

test("pollReviewStatus leaves stale state unchanged when status request fails", async () => {
  assert.equal(typeof reviewClient.pollReviewStatus, "function")

  const state = {
    bootstrap: { token: "review-token" },
    diffFingerprint: "loaded-fingerprint",
    stale: true,
    loadReviewStatus: async () => {
      throw new Error("network down")
    },
  }

  await reviewClient.pollReviewStatus(state)

  assert.equal(state.stale, true)
})

test("pollReviewStatus skips fetch while reloading", async () => {
  assert.equal(typeof reviewClient.pollReviewStatus, "function")

  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (...args) => {
    calls.push(args)
    throw new Error("should not fetch")
  }

  const state = {
    bootstrap: { token: "review-token" },
    diffFingerprint: "loaded-fingerprint",
    stale: true,
    reloading: true,
    loadReviewStatus: async () => ({ fingerprint: "new-fingerprint" }),
  }

  try {
    await reviewClient.pollReviewStatus(state)
  } finally {
    globalThis.fetch = previousFetch
  }

  assert.equal(state.stale, true)
  assert.deepEqual(calls, [])
})

test("reloadDiff replaces the snapshot and clears stale state", async () => {
  assert.equal(typeof reviewClient.reloadDiff, "function")

  const oldSnapshot = { patch: "old" }
  const newSnapshot = { patch: "new" }
  const calls = []
  const state = {
    bootstrap: { token: "review-token" },
    diffSnapshot: oldSnapshot,
    diffFingerprint: "old-fingerprint",
    stale: true,
    reloading: false,
    loadDiff: async () => newSnapshot,
    renderFreshDiffSnapshot: async (payload) => {
      calls.push(payload)
      state.diffSnapshot = payload
    },
    renderSidebar() {},
  }

  await reviewClient.reloadDiff(state)

  assert.equal(state.diffSnapshot, newSnapshot)
  assert.equal(state.stale, false)
  assert.equal(state.reloading, false)
  assert.deepEqual(calls, [newSnapshot])
})

test("reloadDiff preserves stale state when reload fails", async () => {
  assert.equal(typeof reviewClient.reloadDiff, "function")

  const state = {
    bootstrap: { token: "review-token" },
    diffSnapshot: { patch: "old" },
    diffFingerprint: "old-fingerprint",
    stale: true,
    reloading: false,
    loadDiff: async () => {
      throw new Error("reload failed")
    },
    renderSidebar() {},
  }

  await reviewClient.reloadDiff(state)

  assert.equal(state.stale, true)
  assert.equal(state.reloading, false)
})

test("reloadDiff ignores an overlapping call", async () => {
  assert.equal(typeof reviewClient.reloadDiff, "function")

  const resolveReloads = []
  const calls = []
  const state = {
    bootstrap: { token: "review-token" },
    stale: true,
    reloading: false,
    loadDiff: async () => {
      calls.push("loadDiff")
      return new Promise((resolve) => {
        resolveReloads.push(resolve)
      })
    },
    renderFreshDiffSnapshot: async () => {
      calls.push("renderFreshDiffSnapshot")
    },
    renderSidebar() {
      calls.push("renderSidebar")
    },
  }

  const first = reviewClient.reloadDiff(state)
  const second = reviewClient.reloadDiff(state)

  for (const resolve of resolveReloads) {
    resolve({ patch: "new" })
  }

  await Promise.all([first, second])

  assert.deepEqual(calls, ["renderSidebar", "loadDiff", "renderFreshDiffSnapshot", "renderSidebar"])
  assert.equal(state.stale, false)
  assert.equal(state.reloading, false)
})

test("reloadDiff leaves diffSnapshot untouched until render snapshot finishes", async () => {
  assert.equal(typeof reviewClient.reloadDiff, "function")

  let releaseRender
  const renderReady = new Promise((resolve) => {
    releaseRender = resolve
  })

  const state = {
    bootstrap: { token: "review-token" },
    diffSnapshot: { patch: "old" },
    diffFingerprint: "old-fingerprint",
    stale: true,
    reloading: false,
    loadDiff: async () => ({ patch: "new", files: [] }),
    renderFreshDiffSnapshot: async () => {
      await renderReady
    },
    renderSidebar() {},
  }

  const inFlight = reviewClient.reloadDiff(state)

  await Promise.resolve()
  assert.equal(state.diffSnapshot.patch, "old")

  releaseRender()
  await inFlight

  assert.equal(state.diffSnapshot.patch, "old")
})

test("fingerprintForLoadedDiff returns a stable hash", async () => {
  assert.equal(typeof reviewClient.fingerprintForLoadedDiff, "function")

  const first = await reviewClient.fingerprintForLoadedDiff({ patch: "diff --git a/src/app.js b/src/app.js\n" })
  const second = await reviewClient.fingerprintForLoadedDiff({ patch: "diff --git a/src/app.js b/src/app.js\n" })
  const different = await reviewClient.fingerprintForLoadedDiff({ patch: "diff --git a/src/app.js b/src/app.js\n+const answer = 42\n" })

  assert.equal(first, second)
  assert.notEqual(first, different)
})

test("submitReview returns the verified delivery message", async () => {
  assert.equal(typeof reviewClient.submitReview, "function")

  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options])
    return {
      ok: true,
      json: async () => ({ ok: true, message: "Review delivered to OpenCode session" }),
    }
  }

  try {
    const result = await reviewClient.submitReview(
      { summary: "Verify the handoff", comments: [{ path: "src/app.js", body: "Looks good" }] },
      { token: "review-token" },
    )

    assert.deepEqual(result, { ok: true, message: "Review delivered to OpenCode session" })
  } finally {
    globalThis.fetch = previousFetch
  }

  assert.deepEqual(calls, [[
    "/api/submit",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-review-token": "review-token",
      },
      body: JSON.stringify({
        summary: "Verify the handoff",
        comments: [{ path: "src/app.js", body: "Looks good" }],
      }),
    },
  ]])
})

test("submitReview surfaces launcher errors", async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => ({ ok: false, error: "prompt_async timed out after 50ms" }),
  })

  try {
    await assert.rejects(
      () => reviewClient.submitReview({ summary: "Fail the handoff", comments: [] }, { token: "review-token" }),
      /prompt_async timed out after 50ms/,
    )
  } finally {
    globalThis.fetch = previousFetch
  }
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

test("detectHighlightLanguage maps common repo paths", () => {
  assert.equal(reviewClient.detectHighlightLanguage("src/app.js"), "javascript")
  assert.equal(reviewClient.detectHighlightLanguage("src/app.tsx"), "typescript")
  assert.equal(reviewClient.detectHighlightLanguage("src/app.jsx"), "javascript")
  assert.equal(reviewClient.detectHighlightLanguage("src/app.json"), "json")
  assert.equal(reviewClient.detectHighlightLanguage("docs/readme.md"), "markdown")
  assert.equal(reviewClient.detectHighlightLanguage("scripts/deploy.sh"), "bash")
  assert.equal(reviewClient.detectHighlightLanguage("Dockerfile"), "dockerfile")
  assert.equal(reviewClient.detectHighlightLanguage("Makefile"), "makefile")
  assert.equal(reviewClient.detectHighlightLanguage("app/models/user.rb"), "ruby")
  assert.equal(reviewClient.detectHighlightLanguage("Gemfile"), "ruby")
  assert.equal(reviewClient.detectHighlightLanguage("notes/plain.txt"), null)
})

test("formatSidebarFileLabel preserves file extension on long names", () => {
  assert.equal(
    reviewClient.formatSidebarFileLabel("hcfbiuiedfvfncheiuorvbnuef.js"),
    "hcfbiuiedfvfnche...js",
  )
  assert.equal(reviewClient.formatSidebarFileLabel("review-client.js"), "review-client.js")
})

test("highlightLanguageAssetUrl builds unpkg language bundle urls", () => {
  assert.equal(
    reviewClient.highlightLanguageAssetUrl("typescript"),
    "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages/typescript.min.js",
  )
})

test("loadHighlightLanguage caches in-flight requests", async () => {
  const previousDocument = globalThis.document
  const previousHljs = globalThis.hljs
  const requests = []
  const available = new Set(["javascript"])
  let lastScript = null

  function createScriptNode() {
    const listeners = new Map()
    return {
      async: false,
      src: "",
      addEventListener(type, handler) {
        listeners.set(type, handler)
      },
      emit(type) {
        listeners.get(type)?.()
      },
    }
  }

  globalThis.hljs = {
    getLanguage(language) {
      return available.has(language) ? {} : null
    },
  }

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "script")
      return createScriptNode()
    },
    head: {
      append(script) {
        requests.push(script.src)
        lastScript = script
      },
    },
    documentElement: {},
  }

  try {
    const first = reviewClient.loadHighlightLanguage("typescript")
    const second = reviewClient.loadHighlightLanguage("typescript")

    assert.equal(requests.length, 1)
    assert.equal(requests[0], "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages/typescript.min.js")

    available.add("typescript")
    lastScript?.emit("load")

    assert.ok(first && second)
    await Promise.all([first, second])
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument

    if (previousHljs === undefined) delete globalThis.hljs
    else globalThis.hljs = previousHljs
  }
})

test("loadHighlightLanguages loads only unique detected file languages", async () => {
  const previousDocument = globalThis.document
  const previousHljs = globalThis.hljs
  const requests = []
  const available = new Set(["javascript"])

  function createScriptNode() {
    const listeners = new Map()
    return {
      async: false,
      src: "",
      addEventListener(type, handler) {
        listeners.set(type, handler)
      },
      emit(type) {
        listeners.get(type)?.()
      },
    }
  }

  globalThis.hljs = {
    getLanguage(language) {
      return available.has(language) ? {} : null
    },
  }

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "script")
      return createScriptNode()
    },
    head: {
      append(script) {
        requests.push(script.src)
        const language = script.src.match(/\/languages\/([^/]+)\.min\.js$/)?.[1]
        if (language) available.add(language)
        queueMicrotask(() => script.emit("load"))
      },
    },
    documentElement: {},
  }

  try {
    await reviewClient.loadHighlightLanguages([
      "src/app.js",
      "src/other.rs",
      "src/nested/app.rs",
      "Dockerfile",
      "notes.css",
    ])

    assert.deepEqual(requests, [
      "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages/rust.min.js",
      "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages/dockerfile.min.js",
      "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages/css.min.js",
    ])
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument

    if (previousHljs === undefined) delete globalThis.hljs
    else globalThis.hljs = previousHljs
  }
})

test("renderHighlightedCode prefers explicit highlight.js languages", () => {
  const previous = globalThis.hljs
  const calls = []
  globalThis.hljs = {
    getLanguage(language) {
      return language === "typescript" ? {} : null
    },
    highlight(text, options) {
      calls.push(["highlight", text, options])
      return { value: `<span class="hljs-keyword">${text}</span>` }
    },
    highlightAuto(text) {
      calls.push(["auto", text])
      return { value: `<span>${text}</span>`, language: "plaintext" }
    },
  }

  try {
    const node = {
      textContent: "",
      innerHTML: "",
      classList: { add() {} },
    }

    const result = renderHighlightedCode(node, "const answer = 42", "src/app.ts")

    assert.equal(result, true)
    assert.equal(node.textContent, "const answer = 42")
    assert.match(node.innerHTML, /hljs-keyword/)
    assert.deepEqual(calls, [["highlight", "const answer = 42", { language: "typescript", ignoreIllegals: true }]])
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
    setAttribute() {},
  }

  const next = reviewClient.toggleTheme({ document, storage, button })

  assert.equal(next, "dark")
  assert.match(button.innerHTML, /<svg[\s\S]*<span class="sr-only">Switch to light mode<\/span>/)
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
