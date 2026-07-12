On/off toggle. On, the thumb warms to star-blue with a faint glow — a small light switched on, nothing louder. Off stays a dim, cool thumb on a quiet track. Gold is never used here; a setting is structure, not reward.

```jsx
const [twinkle, setTwinkle] = React.useState(true);
<Switch checked={twinkle} onChange={setTwinkle} label="背景星闪烁" />
<Switch checked={false} onChange={…} size="sm" />
```

Semantic `role="switch"` + `aria-checked`; Space/Enter toggle via the native button, `:focus-visible` draws the `--focus` ring. The thumb glides with `--ease-flight` (instant under `prefers-reduced-motion`).
