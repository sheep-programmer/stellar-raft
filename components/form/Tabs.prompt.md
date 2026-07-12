Underline tabs over a hairline baseline. The selected tab carries a 2px star-blue indicator with a faint glow that glides between tabs with `--ease-flight` (no glide under `prefers-reduced-motion`).

```jsx
const [tab, setTab] = React.useState('graph');
<Tabs value={tab} onChange={setTab} tabs={[
  { id: 'graph', label: '星图',   icon: 'sparkles' },
  { id: 'list',  label: '列表',   icon: 'list', count: 48 },
  { id: 'dim',   label: '正变暗', icon: 'moon-star' },
]} />
```

`role="tablist"` with roving tabindex: ← → Home End move and select, `:focus-visible` draws the `--focus` ring. Give each tab a `panelId` to wire `aria-controls` to your `role="tabpanel"` regions. Keep labels to a word or two — the underline speaks, not the type.
