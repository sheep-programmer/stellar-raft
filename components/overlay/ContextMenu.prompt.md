Right-click menu primitive. Wrap the target area; a strong-glass panel opens at the cursor (clamped to the viewport) with hairline `separator` dividers. `danger` items take the low-sat warm tint — never for ordinary actions.

```jsx
<ContextMenu items={[
  { id: 'open',   label: '飞往这颗星', icon: 'navigation', kbd: 'Enter' },
  { id: 'link',   label: '建立连接',   icon: 'link' },
  { type: 'separator' },
  { id: 'delete', label: '熄灭并删除', icon: 'trash-2', danger: true },
]} onSelect={(it) => handle(it.id)}>
  <div className="star-canvas">…</div>
</ContextMenu>
```

Keyboard: ↑ ↓ Home End move the highlight, Enter picks, Esc closes; focus returns to where it was. Item `onSelect` fires first, then the shared `onSelect(item)`. The wrapper renders `display: contents`, so layout is untouched.
