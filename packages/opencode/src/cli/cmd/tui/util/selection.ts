import * as Clipboard from "./clipboard"

type Toast = {
  show: (input: { message: string; variant: "info" | "success" | "warning" | "error" }) => void
  error: (err: unknown) => void
}

type Renderer = {
  getSelection: () => { getSelectedText: () => string } | null
  clearSelection: () => void
}

export function text(renderer: Renderer): string | undefined {
  const value = renderer.getSelection()?.getSelectedText()
  if (!value?.trim()) return undefined
  return value
}

export function copy(renderer: Renderer, toast: Toast): boolean {
  const value = text(renderer)
  if (!value) return false

  Clipboard.copy(value)
    .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
    .catch(toast.error)

  renderer.clearSelection()
  return true
}
