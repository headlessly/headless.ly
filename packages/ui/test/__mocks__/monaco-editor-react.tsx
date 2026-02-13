/**
 * Stub mock for @monaco-editor/react — required by @mdxui/admin QueryView/FormatView.
 * Our @headlessly/ui components don't use Monaco; this prevents import failures.
 */
import * as React from 'react'

const Editor = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
  (props, ref) => <div ref={ref} data-testid="monaco-editor" />
)
Editor.displayName = 'Editor'

export default Editor
export type Monaco = unknown
export type OnMount = (editor: unknown, monaco: unknown) => void
export type BeforeMount = (monaco: unknown) => void
