Quiet glass metadata chip for note tags, filter chips, and constellation labels. `dot` accepts a color string to show a constellation's representative hue.

```jsx
<Tag icon="hash">量子力学</Tag>
<Tag dot="var(--gold)" active>线性代数</Tag>
<Tag removable onRemove={…}>待复习</Tag>
```

`active` lights it gold (selected filter). Keep tags low-contrast — they're metadata, not buttons.
