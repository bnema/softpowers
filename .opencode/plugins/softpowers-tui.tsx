type TuiPlugin = (api: any) => void

type TuiPluginModule = { id: string; tui: TuiPlugin }

const tui: TuiPlugin = () => {}

const plugin: TuiPluginModule & { id: string } = {
  id: "softpowers.tui",
  tui,
}

export default plugin
