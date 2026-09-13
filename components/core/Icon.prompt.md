One themed Lucide linear icon — the only icon source in Stellar Raft (no emoji, no unicode glyphs). Color inherits via `currentColor` so wrappers tint it.

```jsx
<Icon name="satellite" size={20} />
<Icon name="zap" size={18} color="var(--gold)" />
```

Requires the Lucide CDN script on the page, pinned with SRI (`<script src="https://unpkg.com/lucide@1.45.0/dist/umd/lucide.min.js" integrity="…" crossorigin="anonymous"></script>`). Names are kebab-case Lucide names. Default state should be star-blue ~70%; hover/active gold — handled by `IconButton`.
