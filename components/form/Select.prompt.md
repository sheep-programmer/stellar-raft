Custom dropdown on the dark input surface (matches `Input`). The open list is a strong-glass panel with soft radius; the current option carries a star-blue check — never gold, selection is structure, not reward.

```jsx
const [sort, setSort] = React.useState('recent');
<Select value={sort} onChange={setSort} placeholder="排序方式" options={[
  { value: 'recent', label: '最近编辑', icon: 'clock' },
  { value: 'dim',    label: '最先变暗', icon: 'moon' },
  { value: 'links',  label: '连接最多', icon: 'link' },
]} />
```

Keyboard: ↑ ↓ move, Home/End jump, Enter/Space pick, Esc closes, Tab closes and moves on. ARIA 1.2 combobox pattern (`aria-expanded`, `aria-activedescendant`); click-outside dismisses. List enters with `sr-cardin`, skipped under `prefers-reduced-motion`.
