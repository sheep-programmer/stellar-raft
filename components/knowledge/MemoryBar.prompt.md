Memory strength as a thin cold→warm track (the core "how well do I remember this" signal). Color rides the temperature ramp; `fading` pulses to flag review-due items.

```jsx
<MemoryBar value={0.86} label="记忆强度" showPct />
<MemoryBar value={0.3} fading height={4} />
```

`memoryColor(strength)` is exported for tinting stars and dots consistently.
