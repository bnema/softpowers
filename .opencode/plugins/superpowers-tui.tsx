import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: "Review branch locally",
      value: "superpowers.review-branch-locally",
      category: "Superpowers",
      slash: { name: "review-branch-locally", aliases: ["review-branch"] },
      onSelect: () => {
        api.ui.toast({ variant: "info", message: "Branch review wiring is not implemented yet" })
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "superpowers.review",
  tui,
}

export default plugin
