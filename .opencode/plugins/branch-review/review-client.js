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
  button.textContent = theme === "dark" ? "Light" : "Dark"
  button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false")
  button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`)
  button.dataset.theme = theme
}

export function toggleTheme({ document, storage, button }) {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  const next = current === "dark" ? "light" : "dark"
  const applied = setTheme({ document, storage }, next)
  syncThemeButton(button, applied)
  return applied
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

const localKeywordSet = new Set([
  "await",
  "break",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
])

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isWordChar(char) {
  return /[\w$]/.test(char || "")
}

function highlightLocalSource(source) {
  const text = String(source || "")
  let highlighted = false
  let html = ""

  for (let index = 0; index < text.length; ) {
    const char = text[index]
    const next = text[index + 1]

    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", index + 2)
      const slice = end === -1 ? text.slice(index) : text.slice(index, end)
      html += `<span class="hljs-comment">${escapeHtml(slice)}</span>`
      highlighted = true
      index = end === -1 ? text.length : end
      continue
    }

    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2)
      const slice = end === -1 ? text.slice(index) : text.slice(index, end + 2)
      html += `<span class="hljs-comment">${escapeHtml(slice)}</span>`
      highlighted = true
      index = end === -1 ? text.length : end + 2
      continue
    }

    if (char === '"' || char === "'" || char === "`") {
      let end = index + 1
      let escaped = false
      while (end < text.length) {
        const current = text[end]
        if (!escaped && current === char) {
          end += 1
          break
        }
        escaped = !escaped && current === "\\"
        end += 1
      }
      const slice = text.slice(index, end)
      html += `<span class="hljs-string">${escapeHtml(slice)}</span>`
      highlighted = true
      index = end
      continue
    }

    if (/\d/.test(char) && !isWordChar(text[index - 1])) {
      let end = index + 1
      while (end < text.length && /[0-9_.eExX+-]/.test(text[end])) end += 1
      const slice = text.slice(index, end)
      html += `<span class="hljs-number">${escapeHtml(slice)}</span>`
      highlighted = true
      index = end
      continue
    }

    if (/[A-Za-z_$]/.test(char)) {
      let end = index + 1
      while (end < text.length && isWordChar(text[end])) end += 1
      const word = text.slice(index, end)
      if (localKeywordSet.has(word)) {
        html += `<span class="hljs-keyword">${escapeHtml(word)}</span>`
        highlighted = true
      } else {
        html += escapeHtml(word)
      }
      index = end
      continue
    }

    html += escapeHtml(char)
    index += 1
  }

  return highlighted ? html : null
}

export function renderHighlightedCode(node, text) {
  node.textContent = text

  const local = highlightLocalSource(text)
  if (local) {
    node.innerHTML = local
    return true
  }

  const hljs = globalThis.hljs
  if (!hljs || typeof hljs.highlightAuto !== "function") return false

  try {
    const result = hljs.highlightAuto(text)
    if (!result?.value || !result.language || result.language === "plaintext") return false
    node.innerHTML = result.value
    return true
  } catch {
    return false
  }
}

function renderDraftPreview(state) {
  const draft = document.getElementById("draft-preview")
  if (!draft) return
  draft.textContent = formatReviewPrompt(currentReview(state))
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
  label.textContent = node.name

  button.append(label)

  const count = counts.get(node.path) || 0
  if (count > 0) {
    const badge = document.createElement("span")
    badge.className = "file-tree__badge"
    badge.textContent = String(count)
    button.append(badge)
  }

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
  text.className = "diff-line__text"
  renderHighlightedCode(text, line.text)

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

async function submitReview(state, bootstrap) {
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-review-token": bootstrap.token,
    },
    body: JSON.stringify(currentReview(state)),
  })

  if (!response.ok) throw new Error(`submit failed (${response.status})`)
}

function renderApp(bootstrap) {
  const state = createState(bootstrap)
  const fileList = document.getElementById("file-list")
  const diffView = document.getElementById("diff-view")
  const draftEditor = document.getElementById("draft-editor")
  const toolbar = document.getElementById("review-toolbar")
  const storage = (() => {
    try {
      return globalThis.localStorage
    } catch {
      return undefined
    }
  })()
  const currentTheme = initTheme({ document, storage, matchMedia: globalThis.matchMedia?.bind(globalThis) })
  const themeToggle = document.createElement("button")
  themeToggle.type = "button"
  themeToggle.className = "theme-toggle"
  syncThemeButton(themeToggle, currentTheme)
  themeToggle.addEventListener("click", () => {
    toggleTheme({ document, storage, button: themeToggle })
  })
  toolbar?.replaceChildren(themeToggle)

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

  const draftPreviewHeading = document.createElement("h4")
  draftPreviewHeading.textContent = "Prompt preview"

  const draftPreview = document.createElement("pre")
  draftPreview.id = "draft-preview"

  const actions = document.createElement("div")
  actions.className = "actions"

  const submit = document.createElement("button")
  submit.type = "button"
  submit.textContent = "Submit review"
  submit.addEventListener("click", async () => {
    submit.disabled = true
    setStatus("Submitting review…")
    try {
      await submitReview(state, bootstrap)
      setStatus("Review submitted", "success")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to submit review", "error")
      submit.disabled = false
    }
  })

  const status = document.createElement("p")
  status.id = "status"

  actions.append(submit)
  draftBody.append(summaryLabel, draftCommentsHeading, draftComments, draftPreviewHeading, draftPreview, actions, status)
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

  document.addEventListener("mouseup", stopLineDrag)

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

    fileList.append(listHeading, treeContainer)
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
    .then((payload) => {
      const parsedFiles = parseUnifiedDiff(payload.patch)
      const renderedFiles = payload.files.map(
        (filePath) => parsedFiles.find((file) => file.path === filePath) || { path: filePath, additions: 0, deletions: 0, hunks: [] },
      )
      tree = buildFileTree(renderedFiles)

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
