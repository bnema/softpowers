import { formatReviewPrompt, parseUnifiedDiff } from "./review-prompt.js"
import { buildFileTree } from "./review-file-tree.js"
import { groupDraftComments } from "./review-draft-panel.js"
import { normalizeSelection } from "./review-selection.js"
import { initTheme, setTheme } from "./review-theme.js"

export { normalizeSelection } from "./review-selection.js"

function readBootstrap() {
  const element = document.getElementById("review-bootstrap")
  if (!element) throw new Error("missing review bootstrap")
  return JSON.parse(element.textContent || "{}")
}

export function storageKey(bootstrap) {
  return `superpowers:review:${bootstrap.repo}:${bootstrap.base}:${bootstrap.head}:${bootstrap.session}`
}

function createState(bootstrap) {
  const key = storageKey(bootstrap)
  let stored = null
  try {
    stored = JSON.parse(localStorage.getItem(key) || "null")
  } catch {}

  return {
    key,
    summary: typeof stored?.summary === "string" ? stored.summary : "",
    comments: Array.isArray(stored?.comments) ? stored.comments : [],
  }
}

function saveState(state) {
  localStorage.setItem(state.key, JSON.stringify({ summary: state.summary, comments: state.comments }))
}

function syncThemeButton(button, theme) {
  if (!button) return
  const next = theme === "dark" ? "Light mode" : "Dark mode"
  button.textContent = next
  button.setAttribute("aria-label", `Switch to ${next.toLowerCase()}`)
}

export function toggleTheme({ document, storage, button }) {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  const next = current === "dark" ? "light" : "dark"
  const applied = setTheme({ document, storage }, next)
  syncThemeButton(button, applied)
  return applied
}

function setSidebarCollapsed(document, collapsed) {
  if (!document?.body?.dataset) return collapsed
  document.body.dataset.sidebar = collapsed ? "collapsed" : "expanded"
  return collapsed
}

function syncSidebarToggle(button, collapsed) {
  if (!button) return
  button.textContent = collapsed ? "Show sidebar" : "Hide sidebar"
  button.setAttribute("aria-pressed", collapsed ? "true" : "false")
  button.setAttribute("aria-label", `${collapsed ? "Show" : "Hide"} sidebar`)
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function formatSidebarFileLabel(name, maxLength = 21) {
  const text = String(name || "")
  if (text.length <= maxLength) return text

  const dot = text.lastIndexOf(".")
  if (dot <= 0 || dot === text.length - 1) {
    return `${text.slice(0, Math.max(1, maxLength - 3))}...`
  }

  const suffix = text.slice(dot + 1)
  const prefixLength = maxLength - suffix.length - 3
  if (prefixLength < 4) {
    return `${text.slice(0, Math.max(1, maxLength - 3))}...`
  }

  return `${text.slice(0, prefixLength)}...${suffix}`
}

function commentLineRef(comment) {
  return comment.startLine ?? comment.newLine ?? comment.oldLine ?? comment.line ?? "unknown"
}

function commentLineLabel(comment) {
  const startLine = commentLineRef(comment)
  const endLine = comment.endLine ?? startLine

  if (String(startLine) === "unknown") return "unknown"
  if (Number(startLine) === Number(endLine)) return String(startLine)
  return `${startLine}-${endLine}`
}

function composerAnchorLine(composer) {
  return Number(composer?.endLine ?? composer?.startLine ?? NaN)
}

function lineSide(line) {
  return line.type === "remove" ? "old" : "new"
}

function lineRefForSide(line, side) {
  return side === "old" ? line.oldLine : line.newLine
}

function selectableLinesForFile(file, side) {
  const lines = []

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "meta") continue
      const lineRef = lineRefForSide(line, side)
      if (lineRef === null || lineRef === undefined) continue
      lines.push({ lineRef: Number(lineRef), text: line.text })
    }
  }

  return lines
}

function selectionForRange(file, side, startLine, endLine) {
  const lower = Math.min(Number(startLine), Number(endLine))
  const upper = Math.max(Number(startLine), Number(endLine))
  const lines = selectableLinesForFile(file, side).filter(
    (line) => line.lineRef >= lower && line.lineRef <= upper,
  )

  return normalizeSelection(lines, side)
}

function createComposerComment(composer) {
  return {
    id: createId(),
    path: composer.path,
    side: composer.side,
    startLine: composer.startLine,
    endLine: composer.endLine,
    body: composer.body,
    snippetLines: composer.snippetLines,
    snippet: composer.snippetLines.join("\n"),
    line: composer.startLine,
    oldLine: composer.side === "old" ? composer.startLine : null,
    newLine: composer.side === "new" ? composer.startLine : null,
  }
}

function fileSectionId(path) {
  return `file-${path.replace(/[^a-z0-9]+/gi, "-")}`
}

export function normalizedComments(state) {
  return state.comments
    .filter((comment) => String(comment.body || "").trim())
    .map((comment) => ({
      ...comment,
      body: String(comment.body || "").trim(),
    }))
}

export function currentReview(state) {
  const comments = groupDraftComments(normalizedComments(state)).flatMap((group) => group.comments)

  return {
    summary: String(state.summary || "").trim(),
    comments,
  }
}

function setStatus(message, kind = "") {
  const status = document.getElementById("status")
  if (!status) return
  status.textContent = message
  status.dataset.kind = kind
}

const highlightLanguageByName = new Map([
  ["Dockerfile", "dockerfile"],
  ["Gemfile", "ruby"],
  ["Makefile", "makefile"],
  ["Rakefile", "ruby"],
])

const highlightLanguageByExtension = new Map([
  [".bash", "bash"],
  [".cjs", "javascript"],
  [".css", "css"],
  [".go", "go"],
  [".html", "xml"],
  [".jsx", "javascript"],
  [".js", "javascript"],
  [".json", "json"],
  [".md", "markdown"],
  [".mjs", "javascript"],
  [".rb", "ruby"],
  [".rs", "rust"],
  [".sh", "bash"],
  [".toml", "toml"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".zsh", "bash"],
])

// Keep this pinned to match the highlight.js stylesheet/core version in review-template.html.
const highlightLanguageBundleBase = "https://unpkg.com/@highlightjs/cdn-assets@11.11.1/languages"
const highlightLanguageLoads = new Map()

export function detectHighlightLanguage(filePath) {
  const rawPath = String(filePath || "")
  const basename = rawPath.split("/").pop() || ""

  if (highlightLanguageByName.has(basename)) {
    return highlightLanguageByName.get(basename)
  }

  const dot = basename.lastIndexOf(".")
  if (dot === -1) return null

  const extension = basename.slice(dot).toLowerCase()
  return highlightLanguageByExtension.get(extension) || null
}

export function highlightLanguageAssetUrl(language) {
  return `${highlightLanguageBundleBase}/${language}.min.js`
}

function collectHighlightLanguages(filePaths) {
  const languages = new Set()

  for (const filePath of filePaths) {
    const language = detectHighlightLanguage(filePath)
    if (language) languages.add(language)
  }

  return [...languages]
}

export async function loadHighlightLanguage(language) {
  if (!language) return false

  const hljs = globalThis.hljs
  if (typeof hljs?.getLanguage === "function" && hljs.getLanguage(language)) {
    return true
  }

  if (highlightLanguageLoads.has(language)) {
    return highlightLanguageLoads.get(language)
  }

  const promise = new Promise((resolve) => {
    const doc = globalThis.document
    const head = doc?.head || doc?.documentElement
    if (!doc || !head || typeof doc.createElement !== "function" || typeof head.append !== "function") {
      resolve(false)
      return
    }

    const script = doc.createElement("script")
    script.async = true
    script.src = highlightLanguageAssetUrl(language)
    script.addEventListener("load", () => {
      resolve(typeof globalThis.hljs?.getLanguage === "function" ? Boolean(globalThis.hljs.getLanguage(language)) : true)
    }, { once: true })
    script.addEventListener("error", () => resolve(false), { once: true })

    try {
      head.append(script)
    } catch {
      resolve(false)
    }
  }).catch(() => false)

  highlightLanguageLoads.set(language, promise)
  return promise
}

export async function loadHighlightLanguages(filePaths) {
  const languages = collectHighlightLanguages(filePaths)
  return Promise.all(languages.map((language) => loadHighlightLanguage(language)))
}

export function renderHighlightedCode(node, text, filePath = "") {
  node.textContent = text
  node.classList?.add?.("hljs")

  const hljs = globalThis.hljs
  if (!hljs) return false

  const language = detectHighlightLanguage(filePath)

  if (language && typeof hljs.highlight === "function" && (!hljs.getLanguage || hljs.getLanguage(language))) {
    try {
      const result = hljs.highlight(String(text || ""), { language, ignoreIllegals: true })
      if (result?.value) {
        node.innerHTML = result.value
        return true
      }
    } catch {}
  }

  if (typeof hljs.highlightAuto !== "function") return false

  try {
    const result = hljs.highlightAuto(String(text || ""))
    if (!result?.value || !result.language || result.language === "plaintext") return false
    node.innerHTML = result.value
    return true
  } catch {
    return false
  }
}

let lineDragCleanup = null

function renderDraftPreview(state) {
  const draft = document.getElementById("draft-preview")
  if (!draft) return
  draft.textContent = formatReviewPrompt(currentReview(state))
}

export function createDraftPreviewDisclosure(document) {
  const draftPreviewSection = document.createElement("details")
  draftPreviewSection.className = "draft-preview"
  draftPreviewSection.open = false

  const draftPreviewHeading = document.createElement("summary")
  draftPreviewHeading.textContent = "Prompt preview"

  const draftPreview = document.createElement("pre")
  draftPreview.id = "draft-preview"

  draftPreviewSection.append(draftPreviewHeading, draftPreview)
  return { draftPreviewSection, draftPreviewHeading, draftPreview }
}

export function buildCommentCounts(state) {
  const counts = new Map()
  for (const comment of normalizedComments(state)) {
    const path = String(comment.path || "")
    counts.set(path, (counts.get(path) || 0) + 1)
  }
  return counts
}

function renderTreeNode(node, counts, activePath, selectFile) {
  if (node.type === "directory") {
    const directory = document.createElement("div")
    directory.className = "file-tree__directory"

    if (node.name) {
      const label = document.createElement("div")
      label.className = "file-tree__directory-label"
      label.textContent = node.name
      directory.append(label)
    }

    const children = document.createElement("div")
    children.className = "file-tree__children"

    for (const child of node.children) {
      children.append(renderTreeNode(child, counts, activePath, selectFile))
    }

    directory.append(children)
    return directory
  }

  const button = document.createElement("button")
  button.type = "button"
  button.className = "file-tree__file"
  if (node.path === activePath) {
    button.classList.add("file-tree__file--active")
    button.setAttribute("aria-current", "true")
  }

  const label = document.createElement("span")
  label.className = "file-tree__file-label"
  label.textContent = formatSidebarFileLabel(node.name)
  label.title = node.name

  const count = counts.get(node.path) || 0
  if (count > 0) {
    const badge = document.createElement("span")
    badge.className = "file-tree__badge"
    badge.textContent = String(count)
    button.append(badge)
  }

  button.append(label)

  button.addEventListener("click", () => selectFile(node.path))
  return button
}

function buildCommentCard(state, comment, refreshComments, refreshDraftOverview) {
  const card = document.createElement("div")
  card.className = "comment-card"
  card.dataset.commentId = comment.id

  const title = document.createElement("div")
  title.className = "comment-card__title"
  title.textContent = `${comment.path}:${commentLineLabel(comment)} (${comment.side})`

  const textarea = document.createElement("textarea")
  textarea.value = comment.body || ""
  textarea.rows = 3
  textarea.placeholder = "Write a review comment"
  textarea.addEventListener("input", () => {
    comment.body = textarea.value
    saveState(state)
    refreshDraftOverview()
    renderDraftPreview(state)
  })

  const controls = document.createElement("div")
  controls.className = "comment-card__controls"

  const remove = document.createElement("button")
  remove.type = "button"
  remove.textContent = "Remove"
  remove.addEventListener("click", () => {
    state.comments = state.comments.filter((entry) => entry.id !== comment.id)
    saveState(state)
    refreshComments()
  })

  controls.append(remove)
  card.append(title, textarea, controls)
  return card
}

function buildDraftCommentCard(comment) {
  const card = document.createElement("article")
  card.className = "comment-card comment-card--draft"

  const title = document.createElement("div")
  title.className = "comment-card__title"
  title.textContent = `${comment.path}:${commentLineLabel(comment)} (${comment.side})`

  const body = document.createElement("div")
  body.className = "draft-comment__body"
  body.textContent = String(comment.body || "").trim() || "No comment body"

  card.append(title, body)
  return card
}

function buildComposerCard(composer, saveComposer, cancelComposer) {
  const card = document.createElement("div")
  card.className = "comment-card comment-card--composer"

  const title = document.createElement("div")
  title.className = "comment-card__title"
  title.textContent = `${composer.path}:${composer.startLine}${composer.endLine !== composer.startLine ? `-${composer.endLine}` : ""} (${composer.side})`

  const textarea = document.createElement("textarea")
  textarea.value = composer.body || ""
  textarea.rows = 3
  textarea.placeholder = "Write a review comment"
  textarea.addEventListener("input", () => {
    composer.body = textarea.value
  })

  const controls = document.createElement("div")
  controls.className = "comment-card__controls"

  const save = document.createElement("button")
  save.type = "button"
  save.textContent = "Save"
  save.addEventListener("click", saveComposer)

  const cancel = document.createElement("button")
  cancel.type = "button"
  cancel.textContent = "Cancel"
  cancel.addEventListener("click", cancelComposer)

  controls.append(save, cancel)
  card.append(title, textarea, controls)
  return card
}

function renderCommentsForLine(state, slot, file, line, refreshComments, refreshDraftOverview) {
  slot.replaceChildren()
  const comments = state.comments.filter(
    (comment) => comment.path === file.path && comment.side === line.side && Number(commentLineRef(comment)) === Number(line.lineRef),
  )

  for (const comment of comments) {
    slot.append(buildCommentCard(state, comment, refreshComments, refreshDraftOverview))
  }
}

function renderComposerForLine(slot, composer, saveComposer, cancelComposer) {
  slot.replaceChildren()

  if (!composer) return

  const path = slot.dataset.path || ""
  const side = slot.dataset.side || ""
  const lineRef = Number(slot.dataset.lineRef || "")

  if (composer.path !== path || composer.side !== side || composerAnchorLine(composer) !== lineRef) return

  slot.append(buildComposerCard(composer, saveComposer, cancelComposer))
}

function renderDiffLine(state, file, line, refreshComments, refreshDraftOverview, selectLine) {
  const wrapper = document.createElement("section")
  wrapper.className = `diff-line diff-line--${line.type}`
  wrapper.dataset.path = file.path
  wrapper.dataset.side = lineSide(line)
  wrapper.dataset.lineRef = String(lineSide(line) === "old" ? line.oldLine ?? "" : line.newLine ?? "")
  wrapper.dataset.lineType = line.type

  const row = document.createElement("div")
  row.className = "diff-line__row"

  const gutter = document.createElement(line.type === "meta" ? "span" : "button")
  gutter.className = "diff-line__gutter"
  if (line.type === "meta") {
    gutter.textContent = ""
  } else {
    gutter.type = "button"
    gutter.textContent = "+"
    gutter.setAttribute("aria-label", "Add review comment")
    gutter.addEventListener("mousedown", (event) => selectLine(file, line, event))
    gutter.addEventListener("mouseenter", (event) => selectLine(file, line, event))
    gutter.addEventListener("click", (event) => {
      if (event.detail !== 0) return
      selectLine(file, line, event)
    })
  }

  const oldLine = document.createElement("span")
  oldLine.className = "diff-line__number diff-line__number--old"
  oldLine.textContent = line.oldLine ?? ""

  const newLine = document.createElement("span")
  newLine.className = "diff-line__number diff-line__number--new"
  newLine.textContent = line.newLine ?? ""

  const text = document.createElement("span")
  text.className = "diff-line__text hljs"
  renderHighlightedCode(text, line.text, file.path)

  row.append(gutter, oldLine, newLine, text)

  const composerSlot = document.createElement("div")
  composerSlot.className = "diff-line__composer"
  composerSlot.dataset.path = file.path
  composerSlot.dataset.side = lineSide(line)
  composerSlot.dataset.lineRef = String(lineSide(line) === "old" ? line.oldLine ?? "" : line.newLine ?? "")

  if (line.type === "meta") composerSlot.hidden = true

  const commentsSlot = document.createElement("div")
  commentsSlot.className = "diff-line__comments"
  commentsSlot.dataset.path = file.path
  commentsSlot.dataset.side = lineSide(line)
  commentsSlot.dataset.line = String(lineSide(line) === "old" ? line.oldLine ?? "" : line.newLine ?? "")

  renderCommentsForLine(
    state,
    commentsSlot,
    file,
    { side: lineSide(line), lineRef: lineSide(line) === "old" ? line.oldLine : line.newLine },
    refreshComments,
    refreshDraftOverview,
  )

  wrapper.append(row, composerSlot, commentsSlot)
  return wrapper
}

function renderFileSection(state, file, refreshComments, refreshDraftOverview, selectLine) {
  const section = document.createElement("section")
  section.className = "file-section"
  section.id = `file-${file.path.replace(/[^a-z0-9]+/gi, "-")}`

  const heading = document.createElement("h3")
  heading.textContent = `${file.path} (${file.additions}+ / ${file.deletions}-)`
  section.append(heading)

  for (const hunk of file.hunks) {
    const pre = document.createElement("pre")
    pre.className = "hunk-header"
    pre.textContent = hunk.header
    section.append(pre)

    for (const line of hunk.lines) {
      section.append(renderDiffLine(state, file, line, refreshComments, refreshDraftOverview, selectLine))
    }
  }

  return section
}

export async function loadDiff(bootstrap) {
  const response = await fetch("/api/diff", {
    headers: {
      "x-review-token": bootstrap.token,
    },
  })
  if (!response.ok) throw new Error(`failed to load diff (${response.status})`)
  return response.json()
}

export async function submitReview(state, bootstrap) {
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-review-token": bootstrap.token,
    },
    body: JSON.stringify(currentReview(state)),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `submit failed (${response.status})`)
  }

  return payload
}

function renderApp(bootstrap) {
  lineDragCleanup?.abort()
  lineDragCleanup = new AbortController()

  const state = createState(bootstrap)
  const fileList = document.getElementById("file-list")
  const diffView = document.getElementById("diff-view")
  const draftEditor = document.getElementById("draft-editor")
  const storage = (() => {
    try {
      return globalThis.localStorage
    } catch {
      return undefined
    }
  })()
  initTheme({ document, storage, matchMedia: globalThis.matchMedia?.bind(globalThis) })
  let sidebarCollapsed = setSidebarCollapsed(document, false)

  let activePath = ""
  let tree = buildFileTree([])
  let composer = null
  let dragSelection = null

  draftEditor.replaceChildren()
  draftEditor.className = "draft-dock"
  draftEditor.dataset.collapsed = "false"
  draftEditor.setAttribute("aria-label", "Draft review panel")

  const draftHeader = document.createElement("div")
  draftHeader.className = "draft-dock__header"

  const draftHeading = document.createElement("h3")
  draftHeading.textContent = "Draft review"

  const draftToggle = document.createElement("button")
  draftToggle.type = "button"
  draftToggle.textContent = "Collapse panel"
  draftToggle.setAttribute("aria-expanded", "true")

  const draftBody = document.createElement("div")
  draftBody.className = "draft-dock__content"

  draftToggle.addEventListener("click", () => {
    const collapsed = draftEditor.dataset.collapsed === "true"
    const nextCollapsed = !collapsed
    draftEditor.dataset.collapsed = String(nextCollapsed)
    draftBody.hidden = nextCollapsed
    draftToggle.textContent = nextCollapsed ? "Expand panel" : "Collapse panel"
    draftToggle.setAttribute("aria-expanded", String(!nextCollapsed))
  })

  draftHeader.append(draftHeading, draftToggle)

  const summaryLabel = document.createElement("label")
  summaryLabel.textContent = "Summary"

  const summaryInput = document.createElement("textarea")
  summaryInput.rows = 4
  summaryInput.value = state.summary
  summaryInput.addEventListener("input", () => {
    state.summary = summaryInput.value
    saveState(state)
    renderDraftPreview(state)
  })
  summaryLabel.append(summaryInput)

  const draftCommentsHeading = document.createElement("h4")
  draftCommentsHeading.textContent = "Saved comments"

  const draftComments = document.createElement("div")
  draftComments.id = "draft-comments"
  draftComments.className = "draft-group-list"

  const actions = document.createElement("div")
  actions.className = "actions"

  const submit = document.createElement("button")
  submit.type = "button"
  submit.textContent = "Submit review"
  submit.addEventListener("click", async () => {
    submit.disabled = true
    setStatus("Submitting review…")
    try {
      const result = await submitReview(state, bootstrap)
      setStatus(result?.message || "Review delivered to OpenCode", "success")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to submit review", "error")
      submit.disabled = false
    }
  })

  const status = document.createElement("p")
  status.id = "status"

  const { draftPreviewSection } = createDraftPreviewDisclosure(document)

  actions.append(submit)
  draftBody.append(summaryLabel, draftCommentsHeading, draftComments, actions, status, draftPreviewSection)
  draftEditor.append(draftHeader, draftBody)

  function cancelComposer() {
    composer = null
    syncComposerUI()
  }

  function saveComposer() {
    if (!composer) return
    if (!String(composer.body || "").trim()) return

    state.comments.push(createComposerComment(composer))
    composer = null
    saveState(state)
    refreshComments()
  }

  function applyComposerSelection(file, nextSelection, keepBody, focusComposer = true) {
    if (!nextSelection) return

    composer = {
      ...nextSelection,
      path: file.path,
      body: keepBody && composer ? composer.body : "",
    }

    syncComposerUI()
    if (!focusComposer) return

    queueMicrotask(() => {
      document.querySelector(".diff-line__composer textarea")?.focus()
    })
  }

  function stopLineDrag() {
    dragSelection = null
  }

  function renderDraftOverview() {
    draftComments.replaceChildren()

    const groups = groupDraftComments(normalizedComments(state))
    if (groups.length === 0) {
      const empty = document.createElement("p")
      empty.className = "draft-empty"
      empty.textContent = "No saved comments yet."
      draftComments.append(empty)
      return
    }

    for (const group of groups) {
      const section = document.createElement("article")
      section.className = "draft-group"

      const title = document.createElement("div")
      title.className = "draft-group__title"
      title.textContent = group.path

      const items = document.createElement("div")
      items.className = "draft-group__comments"

      for (const comment of group.comments) {
        items.append(buildDraftCommentCard(comment))
      }

      section.append(title, items)
      draftComments.append(section)
    }
  }

  function syncComposerUI() {
    for (const wrapper of document.querySelectorAll(".diff-line")) {
      const path = wrapper.dataset.path || ""
      const side = wrapper.dataset.side || ""
      const lineRef = Number(wrapper.dataset.lineRef || "")
      const selected =
        Boolean(composer) &&
        composer.path === path &&
        composer.side === side &&
        Number.isFinite(lineRef) &&
        lineRef >= composer.startLine &&
        lineRef <= composer.endLine

      wrapper.classList.toggle("diff-line--selected", selected)

      const gutter = wrapper.querySelector(".diff-line__gutter")
      if (gutter) {
        gutter.classList.toggle("diff-line__gutter--selected", selected)
        if (gutter.tagName === "BUTTON") {
          gutter.setAttribute("aria-pressed", selected ? "true" : "false")
        }
      }
    }

    for (const slot of document.querySelectorAll(".diff-line__composer")) {
      renderComposerForLine(slot, composer, saveComposer, cancelComposer)
    }
  }

  function handleLineSelection(file, line, event) {
    if (line.type === "meta") return

    const side = lineSide(line)
    const lineRef = lineRefForSide(line, side)
    if (lineRef === null || lineRef === undefined) return

    if (event.type === "mouseenter") {
      if (!dragSelection || !(event.buttons & 1)) return
      if (dragSelection.path !== file.path || dragSelection.side !== side) return

      applyComposerSelection(
        file,
        selectionForRange(file, side, dragSelection.startLine, Number(lineRef)),
        true,
        false,
      )
      return
    }

    if (event.type === "mousedown") {
      if (event.button !== 0) return
      event.preventDefault()
      dragSelection = {
        path: file.path,
        side,
        startLine: Number(lineRef),
      }
    }

    const nextSelection =
      event.shiftKey && composer && composer.path === file.path && composer.side === side
        ? selectionForRange(file, side, composer.startLine, Number(lineRef))
        : normalizeSelection([{ lineRef, text: line.text }], side)

    const keepBody = Boolean(event.shiftKey && composer && composer.path === file.path && composer.side === side)
    applyComposerSelection(file, nextSelection, keepBody)
  }

  document.addEventListener("mouseup", stopLineDrag, { signal: lineDragCleanup.signal })

  const renderSidebar = () => {
    fileList.replaceChildren()

    const listHeading = document.createElement("h3")
    listHeading.textContent = "Files"

    const treeContainer = document.createElement("div")
    treeContainer.className = "file-tree"

    const counts = buildCommentCounts(state)
    for (const child of tree.children) {
      treeContainer.append(renderTreeNode(child, counts, activePath, (path) => {
        activePath = path
        renderSidebar()
        document.getElementById(fileSectionId(path))?.scrollIntoView({ behavior: "smooth", block: "start" })
      }))
    }

    const themeToggle = document.createElement("button")
    themeToggle.type = "button"
    themeToggle.className = "sidebar-theme-toggle"
    syncThemeButton(themeToggle, document.documentElement.dataset.theme)
    themeToggle.addEventListener("click", () => {
      toggleTheme({ document, storage, button: themeToggle })
    })

    fileList.append(listHeading, treeContainer, themeToggle)
  }

  const refreshComments = () => {
    for (const slot of document.querySelectorAll(".diff-line__comments")) {
      const path = slot.dataset.path || ""
      const side = slot.dataset.side || ""
      const line = Number(slot.dataset.line || "")
      slot.replaceChildren()
      for (const comment of state.comments) {
        if (comment.path === path && comment.side === side && Number(commentLineRef(comment)) === line) {
          slot.append(buildCommentCard(state, comment, refreshComments, renderDraftOverview))
        }
      }
    }

    renderSidebar()
    syncComposerUI()
    renderDraftOverview()
    renderDraftPreview(state)
  }

  renderDraftPreview(state)
  renderDraftOverview()

  return loadDiff(bootstrap)
    .then(async (payload) => {
      diffView.replaceChildren()
      const parsedFiles = parseUnifiedDiff(payload.patch)
      const renderedFiles = payload.files.map(
        (filePath) => parsedFiles.find((file) => file.path === filePath) || { path: filePath, additions: 0, deletions: 0, hunks: [] },
      )
      await loadHighlightLanguages(renderedFiles.map((file) => file.path))
      tree = buildFileTree(renderedFiles)

      const diffControls = document.createElement("div")
      diffControls.className = "diff-view__controls"

      const sidebarToggle = document.createElement("button")
      sidebarToggle.type = "button"
      sidebarToggle.className = "diff-view__sidebar-toggle"
      syncSidebarToggle(sidebarToggle, sidebarCollapsed)
      sidebarToggle.addEventListener("click", () => {
        sidebarCollapsed = setSidebarCollapsed(document, !sidebarCollapsed)
        syncSidebarToggle(sidebarToggle, sidebarCollapsed)
      })

      diffControls.append(sidebarToggle)
      diffView.append(diffControls)

      for (const file of renderedFiles) {
        diffView.append(renderFileSection(state, file, refreshComments, renderDraftOverview, handleLineSelection))
      }

      renderSidebar()
      refreshComments()
      syncComposerUI()
    })
    .catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load diff", "error")
    })
}

if (typeof document !== "undefined") {
  renderApp(readBootstrap())
}
