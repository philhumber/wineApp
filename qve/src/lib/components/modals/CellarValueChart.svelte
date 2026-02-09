<!--
  CellarValueChart Component (WIN-127 Phase 2)
  Pure SVG chart: Catmull-Rom spline line, gradient fill, axes, tooltip, animations.
  Purely presentational — receives pre-filtered, currency-converted data.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let data: { date: string; displayValue: number; bottleCount: number }[];
  export let currencySymbol: string;
  export let formatValue: (v: number) => string;

  // ─── Chart dimensions ───
  const padding = { top: 8, right: 12, bottom: 28, left: 44 };
  let containerWidth = 0;
  let chartEl: HTMLDivElement;

  // Responsive height
  let isMobile = false;
  $: chartHeight = isMobile ? 160 : 200;
  $: plotWidth = Math.max(containerWidth - padding.left - padding.right, 0);
  $: plotHeight = Math.max(chartHeight - padding.top - padding.bottom, 0);

  // ─── Animations ───
  let mounted = false;
  let prefersReducedMotion = false;

  onMount(() => {
    if (browser) {
      isMobile = window.matchMedia('(max-width: 480px)').matches;
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    // Trigger draw-in animation
    requestAnimationFrame(() => { mounted = true; });
  });

  // ─── Scales ───
  function computeScales(pts: typeof data, pw: number, ph: number, cw: number) {
    if (pts.length === 0) return { xScale: (_i: number) => 0, yScale: (_v: number) => 0, yTicks: [] as number[], xLabels: [] as { x: number; label: string }[] };

    const values = pts.map(p => p.displayValue);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    // Add 10% padding to y range
    const range = maxVal - minVal || 1;
    minVal = Math.max(0, minVal - range * 0.05);
    maxVal = maxVal + range * 0.1;

    const xScale = (i: number) => (pts.length === 1) ? pw / 2 : (i / (pts.length - 1)) * pw;
    const yScale = (v: number) => ph - ((v - minVal) / (maxVal - minVal)) * ph;

    // Nice y-axis ticks (4-5 ticks)
    const yTicks = niceYTicks(minVal, maxVal, 4);

    // X-axis date labels (4-6 labels)
    const xLabels = computeXLabels(pts, xScale, cw);

    return { xScale, yScale, yTicks, xLabels, minVal, maxVal };
  }

  function niceYTicks(min: number, max: number, count: number): number[] {
    const range = max - min;
    const roughStep = range / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;

    let niceStep: number;
    if (residual <= 1.5) niceStep = magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    const ticks: number[] = [];
    const start = Math.ceil(min / niceStep) * niceStep;
    for (let t = start; t <= max; t += niceStep) {
      ticks.push(t);
    }
    return ticks;
  }

  function computeXLabels(pts: typeof data, xScale: (i: number) => number, cw: number): { x: number; label: string }[] {
    if (pts.length <= 1) return pts.map((p, i) => ({ x: xScale(i), label: formatDateShort(p.date) }));

    const targetCount = cw < 400 ? 3 : 5;
    const step = Math.max(1, Math.floor((pts.length - 1) / (targetCount - 1)));
    const labels: { x: number; label: string }[] = [];

    for (let i = 0; i < pts.length; i += step) {
      labels.push({ x: xScale(i), label: formatDateShort(pts[i].date) });
    }
    // Always include last
    const lastIdx = pts.length - 1;
    if (labels.length === 0 || labels[labels.length - 1].x !== xScale(lastIdx)) {
      labels.push({ x: xScale(lastIdx), label: formatDateShort(pts[lastIdx].date) });
    }
    return labels;
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${MONTH_ABBR[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }

  function formatDateFull(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatYLabel(v: number): string {
    if (v >= 1000) return `${currencySymbol}${Math.round(v / 1000)}k`;
    return `${currencySymbol}${Math.round(v)}`;
  }

  $: scales = computeScales(data, plotWidth, plotHeight, containerWidth);

  // ─── Points ───
  $: points = data.map((d, i) => ({
    x: scales.xScale(i),
    y: scales.yScale(d.displayValue),
    ...d
  }));

  // ─── Catmull-Rom spline ───
  function catmullRomToBezier(pts: { x: number; y: number }[], tension = 0.5): string {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;

    // Duplicate first and last for boundary control points
    const all = [pts[0], ...pts, pts[pts.length - 1]];
    let path = `M${pts[0].x},${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = all[i];
      const p1 = all[i + 1];
      const p2 = all[i + 2];
      const p3 = all[i + 3];

      const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

      path += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
    }
    return path;
  }

  $: linePath = points.length >= 2 ? catmullRomToBezier(points) : '';
  $: areaPath = linePath
    ? `${linePath}L${points[points.length - 1].x},${plotHeight}L${points[0].x},${plotHeight}Z`
    : '';

  // ─── Line draw animation ───
  // Use SVG pathLength="1" to normalize stroke-dash values to 0–1 range,
  // avoiding getTotalLength() timing issues with Svelte's reactive cycle

  // ─── Tooltip ───
  let tooltipIdx: number | null = null;
  let tooltipVisible = false;

  function findNearestPoint(clientX: number): number {
    if (!chartEl || points.length === 0) return 0;
    const rect = chartEl.getBoundingClientRect();
    const x = clientX - rect.left - padding.left;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - x);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    return closest;
  }

  function handlePointerDown(e: PointerEvent) {
    tooltipIdx = findNearestPoint(e.clientX);
    tooltipVisible = true;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!tooltipVisible && !isMobile) {
      tooltipVisible = true;
    }
    if (tooltipVisible) {
      tooltipIdx = findNearestPoint(e.clientX);
    }
  }

  function handlePointerUp() {
    if (isMobile) {
      tooltipVisible = false;
      tooltipIdx = null;
    }
  }

  function handlePointerLeave() {
    tooltipVisible = false;
    tooltipIdx = null;
  }

  // Tooltip position (keep within bounds)
  $: tooltipPoint = tooltipIdx !== null && points[tooltipIdx] ? points[tooltipIdx] : null;
  $: tooltipLeft = tooltipPoint
    ? Math.min(Math.max(tooltipPoint.x + padding.left, 80), containerWidth - 80)
    : 0;
</script>

<div
  class="chart-container"
  bind:this={chartEl}
  bind:clientWidth={containerWidth}
  role="img"
  aria-label="Cellar value over time chart"
>
  {#if data.length === 0}
    <!-- Empty state handled by parent -->
  {:else}
    <svg
      width="100%"
      height={chartHeight}
      viewBox="0 0 {containerWidth} {chartHeight}"
      preserveAspectRatio="xMidYMid meet"
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointerleave={handlePointerLeave}
      style="touch-action: pan-y;"
    >
      <defs>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate({padding.left},{padding.top})">
        <!-- Grid lines -->
        {#each scales.yTicks as tick}
          {@const ty = scales.yScale(tick)}
          <line
            x1="0" y1={ty} x2={plotWidth} y2={ty}
            class="grid-line"
          />
          <text
            x="-8" y={ty}
            class="y-label"
            dominant-baseline="middle"
            text-anchor="end"
          >{formatYLabel(tick)}</text>
        {/each}

        <!-- X-axis labels -->
        {#each scales.xLabels as lbl}
          <text
            x={lbl.x}
            y={plotHeight + 18}
            class="x-label"
            text-anchor="middle"
          >{lbl.label}</text>
        {/each}

        <!-- Area fill -->
        {#if areaPath}
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            class="area-fill"
            class:animate={mounted && !prefersReducedMotion}
          />
        {/if}

        <!-- Line -->
        {#if linePath}
          <path
            d={linePath}
            pathLength="1"
            class="chart-line"
            class:animate={mounted && !prefersReducedMotion}
          />
        {/if}

        <!-- Single point -->
        {#if points.length === 1}
          <circle
            cx={points[0].x}
            cy={points[0].y}
            r="4"
            class="single-dot"
          />
        {/if}

        <!-- Tooltip elements -->
        {#if tooltipVisible && tooltipPoint}
          <line
            x1={tooltipPoint.x}
            y1="0"
            x2={tooltipPoint.x}
            y2={plotHeight}
            class="tooltip-hairline"
          />
          <circle
            cx={tooltipPoint.x}
            cy={tooltipPoint.y}
            r="4"
            class="tooltip-dot"
          />
        {/if}
      </g>
    </svg>

    <!-- Tooltip card (outside SVG for better styling) -->
    {#if tooltipVisible && tooltipPoint && tooltipIdx !== null}
      <div
        class="tooltip-card"
        style:left="{tooltipLeft}px"
        style:top="{padding.top + tooltipPoint.y - 8}px"
      >
        <span class="tooltip-date">{formatDateFull(data[tooltipIdx].date)}</span>
        <span class="tooltip-value">{formatValue(data[tooltipIdx].displayValue)}</span>
        <span class="tooltip-count">{data[tooltipIdx].bottleCount} bottles</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Grid lines */
  .grid-line {
    stroke: var(--divider-subtle);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.5;
  }

  :global([data-theme='dark']) .grid-line {
    opacity: 0.3;
  }

  /* Axis labels */
  .y-label, .x-label {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    fill: var(--text-tertiary);
  }

  /* Chart line — pathLength="1" normalises dash values to 0–1 */
  .chart-line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition: stroke-dashoffset 0.8s var(--ease-out);
  }

  .chart-line.animate {
    stroke-dashoffset: 0;
  }

  /* Area gradient fill */
  .area-fill {
    opacity: 0;
  }

  .area-fill.animate {
    animation: areaFadeIn 0.6s var(--ease-out) 0.4s forwards;
  }

  @keyframes areaFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  :global([data-theme='dark']) .area-fill.animate {
    animation: areaFadeInDark 0.6s var(--ease-out) 0.4s forwards;
  }

  @keyframes areaFadeInDark {
    from { opacity: 0; }
    to { opacity: 0.8; }
  }

  /* Single dot */
  .single-dot {
    fill: var(--accent);
  }

  /* Tooltip hairline & dot */
  .tooltip-hairline {
    stroke: var(--accent-subtle);
    stroke-width: 1;
  }

  .tooltip-dot {
    fill: var(--surface);
    stroke: var(--accent);
    stroke-width: 2;
  }

  /* Tooltip card */
  .tooltip-card {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-top: -12px;
    background: var(--surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    pointer-events: none;
    z-index: 2;
    white-space: nowrap;
  }

  :global([data-theme='dark']) .tooltip-card {
    background: var(--surface-raised);
  }

  .tooltip-date {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    color: var(--text-tertiary);
  }

  .tooltip-value {
    font-family: var(--font-serif);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .tooltip-count {
    font-family: var(--font-sans);
    font-size: 0.5625rem;
    color: var(--text-tertiary);
  }

  @media (prefers-reduced-motion: reduce) {
    .chart-line {
      transition: none;
      stroke-dashoffset: 0;
    }

    .area-fill {
      opacity: 1;
    }

    .area-fill.animate {
      animation: none;
      opacity: 1;
    }
  }
</style>
