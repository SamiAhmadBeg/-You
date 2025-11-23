export type Mode = "normal" | "meeting" | "vacation" | "off"

export interface AppState {
  assistantEnabled: boolean
  mode: Mode
  customMessage?: string
  calls: {
    id: string
    from: string
    time: string
    modeAtTime: Mode
    summary: string
    action?: string
  }[]
}

let state: AppState = {
  assistantEnabled: true,
  mode: "normal",
  customMessage: "",
  calls: [],
}

export function getState(): AppState {
  return state
}

export function updateState(partial: Partial<AppState>) {
  state = { ...state, ...partial }
}

export function addCallLog(entry: AppState["calls"][number]) {
  state = { ...state, calls: [entry, ...state.calls].slice(0, 50) }
}
