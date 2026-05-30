// ui/index.tsx — pit's UI primitives.
// Behavior + a11y come from Base UI (headless, base-ui.com); all styling is ours
// (CSS variables / tokens), so controls are consistent without changing the look.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
import { Switch as BaseSwitch } from '@base-ui-components/react/switch'
import { Input as BaseInput } from '@base-ui-components/react/input'
import { Slider as BaseSlider } from '@base-ui-components/react/slider'
import { I } from '../../lib/icons'

/* Button — variants: default | primary | ghost | accent; sizes: md | sm */
type ButtonVariant = 'default' | 'primary' | 'ghost' | 'accent'
export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
}): React.JSX.Element {
  return (
    <button className={`ui-btn ${variant} ${size} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}

/* Square icon-only button */
export function IconButton({
  danger = false,
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean
  size?: 'md' | 'sm'
}): React.JSX.Element {
  return (
    <button
      className={`ui-icon-btn ${size} ${danger ? 'danger' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}

/* Text input (Base UI Input). `mono` for monospace, `trailing` for an inline adornment. */
export function Input({
  mono = false,
  className = '',
  trailing,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  mono?: boolean
  trailing?: ReactNode
}): React.JSX.Element {
  const input = (
    <BaseInput className={`ui-input ${mono ? 'mono' : ''} ${className}`.trim()} {...rest} />
  )
  if (!trailing) return input
  return (
    <div className="ui-input-group">
      {input}
      {trailing}
    </div>
  )
}

/* Select (Base UI) — pass items {value,label}[]; styled to match our controls. */
export function Select<T extends string>({
  value,
  onValueChange,
  items,
  placeholder = 'Select…',
  className = ''
}: {
  value: T
  onValueChange: (v: T) => void
  items: { value: T; label: string }[]
  placeholder?: string
  className?: string
}): React.JSX.Element {
  return (
    <BaseSelect.Root items={items} value={value} onValueChange={(v) => onValueChange(v as T)}>
      <BaseSelect.Trigger className={`ui-select-trigger ${className}`.trim()}>
        <span className="ui-select-value">
          <BaseSelect.Value>
            {(v: T | null) => items.find((i) => i.value === v)?.label ?? placeholder}
          </BaseSelect.Value>
        </span>
        <BaseSelect.Icon className="ui-select-arrow">
          <I.Down size={14} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="ui-select-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className="ui-select-popup">
            {items.map((it) => (
              <BaseSelect.Item key={it.value} value={it.value} className="ui-select-item">
                <BaseSelect.ItemText>{it.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="ui-select-indicator">
                  <I.Check size={13} />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

/* Labeled field wrapper. `labelExtra` floats to the right of the label. */
export function Field({
  label,
  hint,
  labelExtra,
  children
}: {
  label: ReactNode
  hint?: ReactNode
  labelExtra?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="ui-field">
      <label className="ui-label">
        {label}
        {labelExtra && <span className="ui-label-extra">{labelExtra}</span>}
      </label>
      {children}
      {hint && <div className="ui-hint">{hint}</div>}
    </div>
  )
}

/* Range slider (Base UI Slider) — single value; min/max/step like native range. */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = ''
}: {
  value: number
  onValueChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}): React.JSX.Element {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(v) => onValueChange(typeof v === 'number' ? v : v[0])}
      min={min}
      max={max}
      step={step}
      className={`ui-slider ${className}`.trim()}
    >
      <BaseSlider.Control className="ui-slider-control">
        <BaseSlider.Track className="ui-slider-track">
          <BaseSlider.Indicator className="ui-slider-indicator" />
          <BaseSlider.Thumb className="ui-slider-thumb" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

/* On/off switch (Base UI Switch) */
export function Switch({ on, onChange }: { on: boolean; onChange: () => void }): React.JSX.Element {
  return (
    <BaseSwitch.Root checked={on} onCheckedChange={() => onChange()} className="ui-switch">
      <BaseSwitch.Thumb className="ui-switch-thumb" />
    </BaseSwitch.Root>
  )
}
