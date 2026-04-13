const bootstrap = window.__REVIEW_BOOTSTRAP__
const storageKey = `superpowers:review:${bootstrap.repo}:${bootstrap.base}:${bootstrap.head}`

function loadState() {
  return JSON.parse(localStorage.getItem(storageKey) || '{"summary":"","comments":[]}')
}

function saveState(state) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

function generateDraft(state) {
  const lines = ["Local branch review", ""]
  if (state.summary) lines.push("Summary", state.summary, "")
  for (const comment of state.comments) {
    lines.push(`File: ${comment.path}`)
    lines.push(`- ${comment.side} line ${comment.line}: ${comment.body}`)
    lines.push("")
  }
  return lines.join("\n")
}
