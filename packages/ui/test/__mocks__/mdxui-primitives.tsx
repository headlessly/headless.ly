/**
 * Mock for @mdxui/primitives to avoid emoji-mart JSON import issues in tests.
 * Copied from @mdxui/admin's own test mock — same approach admin uses for its tests.
 */

import * as React from 'react'

// Basic Card components
export const Card = ({ children, className, noPadding }: { children: React.ReactNode; className?: string; noPadding?: boolean }) => (
  <div className={className} data-no-padding={noPadding}>{children}</div>
)

export const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
)

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
)

export const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={className}>{children}</h3>
)

export const CardDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={className}>{children}</p>
)

// Button component
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean }>(
  ({ children, className, variant, size, asChild, ...props }, ref) => (
    <button ref={ref} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  )
)
Button.displayName = 'Button'

// Badge
export const Badge = ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
  <span className={className} data-variant={variant}>{children}</span>
)

// Table components
export const Table = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <table className={className}>{children}</table>
)

export const TableHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <thead className={className}>{children}</thead>
)

export const TableBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <tbody className={className}>{children}</tbody>
)

export const TableRow = ({ children, className, onClick, ...props }: { children: React.ReactNode; className?: string; onClick?: () => void; [key: string]: unknown }) => (
  <tr className={className} onClick={onClick} {...props}>{children}</tr>
)

export const TableHead = ({ children, className, style, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) => (
  <th className={className} style={style} onClick={onClick}>{children}</th>
)

export const TableCell = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <td className={className} style={style}>{children}</td>
)

// Checkbox component
export const Checkbox = React.forwardRef<HTMLInputElement, { checked?: boolean | 'indeterminate'; onCheckedChange?: (checked: boolean | 'indeterminate') => void; onClick?: (e: React.MouseEvent) => void; 'aria-label'?: string }>(
  ({ checked, onCheckedChange, onClick, 'aria-label': ariaLabel }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={checked === true}
      data-state={checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      onClick={onClick}
      aria-label={ariaLabel}
    />
  )
)
Checkbox.displayName = 'Checkbox'

// Skeleton component
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse ${className || ''}`} data-testid="skeleton" />
)

// Input component
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} />
)
Input.displayName = 'Input'

// Label component
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  (props, ref) => <label ref={ref} {...props} />
)
Label.displayName = 'Label'

// Textarea component
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} {...props} />
)
Textarea.displayName = 'Textarea'

// Switch component
export const Switch = React.forwardRef<HTMLInputElement, { checked?: boolean; onCheckedChange?: (checked: boolean) => void; className?: string }>(
  ({ checked, onCheckedChange, ...props }, ref) => (
    <input ref={ref} type="checkbox" role="switch" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...props} />
  )
)
Switch.displayName = 'Switch'

// Select components
export const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void; defaultValue?: string }) => (
  <div data-testid="select-wrapper" data-value={value}>{children}</div>
)

export const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <button data-testid="select-trigger" className={className}>{children}</button>
)

export const SelectValue = ({ placeholder }: { placeholder?: string }) => <span data-testid="select-value">{placeholder}</span>

export const SelectContent = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="select-content">{children}</div>
)

export const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => (
  <option value={value}>{children}</option>
)

// Tabs components
export const Tabs = ({ children, value, onValueChange, className, defaultValue }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void; className?: string; defaultValue?: string }) => (
  <div data-testid="tabs" data-value={value || defaultValue} className={className}>{children}</div>
)

export const TabsList = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div role="tablist" className={className}>{children}</div>
)

export const TabsTrigger = ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
  <button role="tab" data-value={value} className={className}>{children}</button>
)

export const TabsContent = ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
  <div role="tabpanel" data-value={value} className={className}>{children}</div>
)

// Tooltip components
export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const TooltipTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean }>(
  ({ children }, ref) => <span ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>
)
TooltipTrigger.displayName = 'TooltipTrigger'
export const TooltipContent = ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
  <div data-testid="tooltip-content">{children}</div>
)

// ContextMenu components
const ContextMenuContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} })

export const ContextMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  return <ContextMenuContext.Provider value={{ open, setOpen }}>{children}</ContextMenuContext.Provider>
}

export const ContextMenuTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
  const { setOpen } = React.useContext(ContextMenuContext)
  return (
    <div data-testid="context-menu-trigger" data-as-child={asChild} onContextMenu={(e) => { e.preventDefault(); setOpen(true) }}>
      {children}
    </div>
  )
}

export const ContextMenuContent = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(ContextMenuContext)
  if (!open) return null
  return <div data-testid="context-menu-content" role="menu">{children}</div>
}

export const ContextMenuItem = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <div role="menuitem" onClick={onClick} className={className}>{children}</div>
)
export const ContextMenuSeparator = () => <hr data-testid="context-menu-separator" />

// AlertDialog components
export const AlertDialog = ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
  <div data-testid="alert-dialog" data-open={open}>{open ? children : null}</div>
)
export const AlertDialogTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean }>(
  ({ children }, ref) => <span ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>
)
AlertDialogTrigger.displayName = 'AlertDialogTrigger'
export const AlertDialogContent = ({ children }: { children: React.ReactNode }) => (
  <div role="alertdialog" data-testid="alert-dialog-content">{children}</div>
)
export const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="alert-dialog-header">{children}</div>
)
export const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 data-testid="alert-dialog-title">{children}</h2>
)
export const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p data-testid="alert-dialog-description">{children}</p>
)
export const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="alert-dialog-footer">{children}</div>
)
export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }>(
  ({ children, onClick, className, ...props }, ref) => (
    <button ref={ref} onClick={onClick} className={className} {...props}>{children}</button>
  )
)
AlertDialogAction.displayName = 'AlertDialogAction'
export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, onClick, ...props }, ref) => (
    <button ref={ref} onClick={onClick} {...props}>{children}</button>
  )
)
AlertDialogCancel.displayName = 'AlertDialogCancel'

// Collapsible components
export const Collapsible = ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
  <div data-testid="collapsible" data-open={open}>{children}</div>
)
export const CollapsibleTrigger = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
  <button data-testid="collapsible-trigger" className={className} {...props}>{children}</button>
)
export const CollapsibleContent = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="collapsible-content">{children}</div>
)

// ScrollArea
export const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className} data-testid="scroll-area">{children}</div>
)

// Separator
export const Separator = ({ className, orientation }: { className?: string; orientation?: string }) => (
  <hr className={className} data-orientation={orientation} />
)

// Sidebar components
export const SidebarTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props}>{children}</button>
)

// Popover components
export const Popover = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const PopoverTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean }>(
  ({ children }, ref) => <span ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>
)
PopoverTrigger.displayName = 'PopoverTrigger'
export const PopoverContent = ({ children, className }: { children: React.ReactNode; className?: string; align?: string; sideOffset?: number }) => (
  <div className={className}>{children}</div>
)

// DropdownMenu components
export const DropdownMenu = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const DropdownMenuTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean }>(
  ({ children }, ref) => <span ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>
)
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'
export const DropdownMenuContent = ({ children, className }: { children: React.ReactNode; className?: string; align?: string }) => (
  <div className={className}>{children}</div>
)
export const DropdownMenuItem = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <div role="menuitem" onClick={onClick} className={className}>{children}</div>
)
export const DropdownMenuSeparator = () => <hr />
export const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const DropdownMenuSubTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export const DropdownMenuSubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export const DropdownMenuCheckboxItem = ({ children, checked, onCheckedChange }: { children: React.ReactNode; checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
  <div role="menuitemcheckbox" data-checked={checked} onClick={() => onCheckedChange?.(!checked)}>{children}</div>
)

// ToggleGroup components
export const ToggleGroup = ({ children, type, value, onValueChange, className }: { children: React.ReactNode; type?: string; value?: string; onValueChange?: (value: string) => void; className?: string }) => (
  <div role="group" className={className} data-type={type} data-value={value}>{children}</div>
)
export const ToggleGroupItem = ({ children, value, className, 'aria-label': ariaLabel }: { children: React.ReactNode; value: string; className?: string; 'aria-label'?: string }) => (
  <button data-value={value} className={className} aria-label={ariaLabel}>{children}</button>
)

// Dialog components
export const Dialog = ({ children, open }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
  <div data-open={open}>{children}</div>
)
export const DialogTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean }>(
  ({ children }, ref) => <span ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>
)
DialogTrigger.displayName = 'DialogTrigger'
export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div role="dialog" className={className}>{children}</div>
)
export const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>
export const DialogDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>
export const DialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export const DialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => <button ref={ref} {...props}>{children}</button>
)
DialogClose.displayName = 'DialogClose'

// Chart config type
export type ChartConfig = Record<string, { label?: string; color?: string; icon?: React.ComponentType }>
export const ChartContainer = ({ children, config, className }: { children: React.ReactNode; config: ChartConfig; className?: string }) => (
  <div className={className}>{children}</div>
)
export const ChartTooltip = ({ content }: { content: React.ReactNode }) => <div>{content}</div>
export const ChartTooltipContent = () => <div />

export default {}
