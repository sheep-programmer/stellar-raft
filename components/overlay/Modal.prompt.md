Glass dialog floating over a deep-space darkened + blurred mask (`rgba(3,4,12,.55)` + blur — never flat black). Focus is trapped inside, Esc / mask / the x button close it, and focus returns to the opener. Header and footer are pinned; the body scrolls.

```jsx
const [open, setOpen] = React.useState(false);
<Modal open={open} onClose={() => setOpen(false)} title="移动到星座" icon="orbit" width={440}
  footer={<><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button variant="primary" icon="check">确认</Button></>}>
  <p>这颗星将飞入「量子力学」。</p>
</Modal>
```

Enters with the quiet `sr-cardin` lift (skipped under `prefers-reduced-motion`). `role="dialog" aria-modal` with the title as its accessible name. Keep gold buttons in the footer for confirm/reward only.
