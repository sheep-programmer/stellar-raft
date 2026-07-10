The floating glass surface every overlay UI is built on: HUD bars, tool capsules, sidebar, drawers, slash menu, cards. Translucent deep blue + blur + 1px cool edge.

```jsx
<GlassPanel pad="md">…</GlassPanel>
<GlassPanel strong radius="xl" pad="lg">drawer content</GlassPanel>
```

Use `strong` for drawers/modals over the canvas. Never put it on an opaque background — it's meant to float over the starfield.
