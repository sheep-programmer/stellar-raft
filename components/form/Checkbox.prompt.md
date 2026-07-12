Soft-cornered checkbox. The check is a self-drawn SVG stroke — star-blue, rounded caps — that draws itself in via dashoffset when checked (no emoji, no unicode glyphs, ever). The box lifts to a faint cool glow.

```jsx
const [done, setDone] = React.useState(false);
<Checkbox checked={done} onChange={setDone} label="纳入本周复习" />
<Checkbox checked disabled>已归档</Checkbox>
```

Native button with `role="checkbox"` + `aria-checked`, so Space/Enter toggle and `:focus-visible` draws the `--focus` ring. The draw-in transition collapses under `prefers-reduced-motion`.
