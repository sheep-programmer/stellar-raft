A small glass card that surfaces after a quiet delay (450ms) on hover or keyboard focus — a whisper next to a control, one short line only. Esc hides it; the trigger gets `aria-describedby`.

```jsx
<Tooltip content="模拟一个月后的星空">
  <IconButton name="hourglass" title="模拟遗忘" />
</Tooltip>
<Tooltip content="融会贯通的连接是金色的" side="right">
  <Tag icon="link">跨星座</Tag>
</Tooltip>
```

Glass-bg-strong + hairline border + `--r-sm`, entering with `sr-cardin` (skipped under `prefers-reduced-motion`). Don't put actions inside — it's `pointer-events: none` by design.
