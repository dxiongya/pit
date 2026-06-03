# pit — brand mark (SVG)

Vector versions of the app's "p" mark. The glyph is the lowercase **p of
[Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) _Italic_**
(the font named in the app's `--f-accent`), **outlined to vector paths** — so the
files are fully self-contained: no font dependency, identical everywhere, infinitely
scalable. The rounded-square proportions match the in-app mark (`border-radius` =
6/22 of the side).

| File | What | Use |
| --- | --- | --- |
| `pit-mark.svg` | Coral square (`#e8624a`) + white `p` | App icon, avatars, favicons |
| `pit-mark-mono.svg` | Single-colour knockout (`p` as negative space, `fill: currentColor`) | One-colour contexts, dark/light, inline `color:` theming |

```html
<!-- mono inherits the surrounding text color -->
<span style="color:#e8624a"><!-- paste pit-mark-mono.svg here --></span>
```

> Glyph extracted with `fonttools` from `InstrumentSerif-Italic.ttf`
> (SIL Open Font License 1.1 — outlining for a logo is permitted). `viewBox` is
> `0 0 64 64`; change the `rect` fill (or the inherited `currentColor`) to recolor.
