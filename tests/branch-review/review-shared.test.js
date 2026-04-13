import test from "node:test"
import assert from "node:assert/strict"
import { formatReviewPrompt } from "../../.opencode/plugins/review-shared.js"

test("formatReviewPrompt groups comments by file", () => {
  const text = formatReviewPrompt({
    summary: "Check the retry path",
    comments: [
      { path: "src/app.js", side: "new", newLine: 14, body: "This branch can be nil", snippet: "@@ -10,3 +10,4 @@" },
    ],
  })

  assert.match(text, /Local branch review/)
  assert.match(text, /src\/app.js/)
  assert.match(text, /line 14/)
  assert.match(text, /Check the retry path/)
})
