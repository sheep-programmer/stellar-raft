Quiet glass feedback pill. Two forms: the `<Toast>` component (a `role="status"` pill you position yourself) and the `toast()` command, which stacks self-dismissing pills bottom-center in a shared `aria-live` region.

```jsx
toast('已移入「量子力学」');                          // everyday, star-blue check
toast('点亮 +1 · 融会贯通', { tone: 'gold', icon: 'zap' }); // the ignite moment
const hide = toast('正在同步…', { duration: 6000 }); // hide() dismisses early

<Toast tone="gold" icon="sparkles" message="这颗星已融会贯通" />
```

Tones: `blue` (default) for everyday feedback, `gold` strictly for ignition / reward / mastery, `danger` (rare) for destructive results. Copy stays terse and a little poetic — one line, no exclamation spam. Enter/exit use `sr-cardin` + a soft fade, skipped under `prefers-reduced-motion`.
