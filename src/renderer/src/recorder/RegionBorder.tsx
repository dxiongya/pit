// RegionBorder — accessory window sized exactly to the recording region,
// drawing a dashed red border so the user always sees what's being captured.
// The window itself is click-through (set from main) so user can interact
// with whatever's under the rect normally.

export function RegionBorder(): React.JSX.Element {
  return <div className="rec-region-live" aria-hidden />
}
