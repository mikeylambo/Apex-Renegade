export class PerformanceHUD {
  constructor(engine, getContext = () => ({})) {
    this.engine = engine;
    this.getContext = getContext;
    this.visible = false;
    this.timer = 0;
    this.avgFrame = 16.7;

    const el = document.createElement('div');
    el.id = 'apex-performance-hud';
    el.style.cssText = 'position:fixed;right:14px;top:86px;z-index:42;display:none;min-width:220px;padding:9px 11px;background:rgba(3,7,12,.78);border:1px solid rgba(165,184,205,.22);color:#cdd8e5;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.03em;pointer-events:none;white-space:pre;';
    document.body.appendChild(el);
    this.el = el;

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'F8') return;
      e.preventDefault();
      this.visible = !this.visible;
      this.el.style.display = this.visible ? 'block' : 'none';
    });
  }

  update(dt) {
    this.avgFrame += (Math.min(.1, dt) * 1000 - this.avgFrame) * Math.min(1, dt * 4);
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = .20;

    const p = this.engine.perf || {};
    const renderInfo = this.engine.renderer?.info?.render || {};
    const ctx = this.getContext?.() || {};
    const visual = ctx.visualPerformance?.getTelemetry?.() || {};
    const bike = ctx.bike;
    const fps = 1000 / Math.max(1, this.avgFrame);

    this.el.textContent = [
      `APEX PERF  ${fps.toFixed(0)} fps / ${this.avgFrame.toFixed(1)} ms`,
      `fixed ${Number(p.fixedMs || 0).toFixed(1)}  update ${Number(p.updateMs || 0).toFixed(1)}  render ${Number(p.renderMs || 0).toFixed(1)}`,
      `draw ${renderInfo.calls ?? '?'}  tris ${renderInfo.triangles ?? '?'}`,
      `post ${ctx.postfx?.mode || 'direct'}  motion ${visual.motionMode ? 'ON' : 'off'}  stress ${visual.hardStress ? 'YES' : 'no'}`,
      `bike ${bike?.mounted ? 'mounted' : 'off'}  speed ${Math.abs(Number(bike?.speed) || 0).toFixed(1)}`,
      `F8 hide diagnostics`
    ].join('\n');
  }
}
