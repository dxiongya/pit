// RecorderBorder — full-screen transparent overlay that draws a thin red
// frame around the captured display so the user sees the screen is being
// recorded. Click-through is enforced from main via setIgnoreMouseEvents().

export function RecorderBorder(): React.JSX.Element {
  return <div className="rec-border" aria-hidden />
}
