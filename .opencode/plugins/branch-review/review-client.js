import { formatReviewPrompt, parseUnifiedDiff } from "./review-prompt.js"

function readBootstrap() {
  const element = document.getElementById("review-bootstrap")
  if (!element) throw new Error("missing review bootstrap")
  return JSON.parse(element.textContent || "{}")
}

function storageKey(bootstrap) {
  return `superpowers:review:${bootstrap.repo}:${bootstrap.base}:${bootstrap.head}`
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

function createId() {
  return globalThis.crypto?.randomUUID?.() || `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function commentLineRef(comment) {
  return comment.newLine ?? comment.oldLine ?? comment.line ?? "unknown"
}

function normalizedComments(state) {
  return state.comments
    .filter((comment) => String(comment.body || "").trim())
    .map((comment) => ({
      ...comment,
      body: String(comment.body || "").trim(),
    }))
}

function currentReview(state) {
  return {
    summary: String(state.summary || "").trim(),
    comments: normalizedComments(state),
  }
}

function setStatus(message, kind = "") {
  const status = document.getElementById("status")
  if (!status) return
  status.textContent = message
  status.dataset.kind = kind
}

export function renderHighlightedCode(node, text) {
  node.textContent = text

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

function buildCommentCard(state, comment, refreshComments) {
  const card = document.createElement("div")
  card.className = "comment-card"
  card.dataset.commentId = comment.id

  const title = document.createElement("div")
  title.className = "comment-card__title"
  title.textContent = `${comment.path}:${commentLineRef(comment)} (${comment.side})`

  const textarea = document.createElement("textarea")
  textarea.value = comment.body || ""
  textarea.rows = 3
  textarea.placeholder = "Write a review comment"
  textarea.addEventListener("input", () => {
    comment.body = textarea.value
    saveState(state)
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
    renderDraftPreview(state)
  })

  controls.append(remove)
  card.append(title, textarea, controls)
  return card
}

function renderCommentsForLine(state, slot, file, line, refreshComments) {
  slot.replaceChildren()
  const comments = state.comments.filter(
    (comment) => comment.path === file.path && comment.side === line.side && Number(commentLineRef(comment)) === Number(line.lineRef),
  )

  for (const comment of comments) {
    slot.append(buildCommentCard(state, comment, refreshComments))
  }
}

function renderDiffLine(state, file, line, refreshComments) {
  const wrapper = document.createElement("section")
  wrapper.className = `diff-line diff-line--${line.type}`

  const row = document.createElement("div")
  row.className = "diff-line__row"

  const oldLine = document.createElement("span")
  oldLine.className = "diff-line__number diff-line__number--old"
  oldLine.textContent = line.oldLine ?? ""

  const newLine = document.createElement("span")
  newLine.className = "diff-line__number diff-line__number--new"
  newLine.textContent = line.newLine ?? ""

  const text = document.createElement("span")
  text.className = "diff-line__text"
  renderHighlightedCode(text, line.text)

  const addComment = document.createElement("button")
  addComment.type = "button"
  addComment.textContent = "Add comment"

  const lineSide = line.type === "remove" ? "old" : "new"
  const lineRef = lineSide === "old" ? line.oldLine : line.newLine

  if (line.type === "meta") {
    addComment.disabled = true
    addComment.textContent = "N/A"
  } else {
    addComment.addEventListener("click", () => {
      const comment = {
        id: createId(),
        path: file.path,
        side: lineSide,
        oldLine: line.oldLine ?? null,
        newLine: line.newLine ?? null,
        body: "",
        snippet: line.text,
        line: lineRef,
      }
      state.comments.push(comment)
      saveState(state)
      refreshComments()
      renderDraftPreview(state)
      queueMicrotask(() => {
        const textarea = document.querySelector(`[data-comment-id="${comment.id}"] textarea`)
        if (textarea) textarea.focus()
      })
    })
  }

  row.append(oldLine, newLine, text, addComment)

  const commentsSlot = document.createElement("div")
  commentsSlot.className = "diff-line__comments"
  commentsSlot.dataset.path = file.path
  commentsSlot.dataset.side = lineSide
  commentsSlot.dataset.line = String(lineRef ?? "")

  renderCommentsForLine(state, commentsSlot, file, { side: lineSide, lineRef }, refreshComments)

  wrapper.append(row, commentsSlot)
  return wrapper
}

function renderFileSection(state, file, refreshComments) {
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
      section.append(renderDiffLine(state, file, line, refreshComments))
    }
  }

  return section
}

async function loadDiff() {
  const response = await fetch("/api/diff")
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
  const summary = document.getElementById("summary")
  const diffView = document.getElementById("diff-view")
  const draftEditor = document.getElementById("draft-editor")

  const refreshComments = () => {
    for (const slot of document.querySelectorAll(".diff-line__comments")) {
      const path = slot.dataset.path || ""
      const side = slot.dataset.side || ""
      const line = Number(slot.dataset.line || "")
      slot.replaceChildren()
      for (const comment of state.comments) {
        if (comment.path === path && comment.side === side && Number(commentLineRef(comment)) === line) {
          slot.append(buildCommentCard(state, comment, refreshComments))
        }
      }
    }
  }

  summary.replaceChildren()
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
  summary.append(summaryLabel)

  draftEditor.replaceChildren()
  const draftHeading = document.createElement("h3")
  draftHeading.textContent = "Draft preview"
  const draftPreview = document.createElement("pre")
  draftPreview.id = "draft-preview"
  const status = document.createElement("p")
  status.id = "status"
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
  draftEditor.append(draftHeading, draftPreview, submit, status)

  renderDraftPreview(state)

  fileList.replaceChildren()
  const listHeading = document.createElement("h3")
  listHeading.textContent = "Files"
  fileList.append(listHeading)

  return loadDiff()
    .then((payload) => {
      const parsedFiles = parseUnifiedDiff(payload.patch)
      const files = payload.files.map((filePath) => parsedFiles.find((file) => file.path === filePath) || { path: filePath, additions: 0, deletions: 0, hunks: [] })

      for (const file of files) {
        const item = document.createElement("button")
        item.type = "button"
        item.className = "file-list__item"
        item.textContent = `${file.path} (${file.additions}+ / ${file.deletions}-)`
        item.addEventListener("click", () => {
          document.getElementById(`file-${file.path.replace(/[^a-z0-9]+/gi, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
        })
        fileList.append(item)
        diffView.append(renderFileSection(state, file, refreshComments))
      }

      refreshComments()
      renderDraftPreview(state)
    })
    .catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load diff", "error")
    })
}

if (typeof document !== "undefined") {
  renderApp(readBootstrap())
}
