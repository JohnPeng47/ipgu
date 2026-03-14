# Paradigm UI — Style Guide

A component library extracted from Paradigm's predictions dashboard.
Built for data-science dashboards, analysis tools, and data visualization interfaces.

---

## Quick Start

```html
<link rel="stylesheet" href="css/paradigm-tokens.css">
<link rel="stylesheet" href="css/paradigm-components.css">
<link rel="stylesheet" href="css/paradigm-utilities.css">
```

Load order matters. Tokens first, then components, then utilities. All component
styles reference token custom properties defined in `paradigm-tokens.css`.

Fonts must be loaded separately. The system requires:
- **Atlas Typewriter Web** (monospace) — primary interface font
- **Martina Plantijn** (serif) — display and disclaimer text

---

## Typography

### Font Stack

| Role | Family | Var |
|------|--------|-----|
| Interface (everything) | `Atlas Typewriter Web, monospace` | `--p-font-mono` |
| Display / Disclaimer | `Martina Plantijn, serif` | `--p-font-serif` |

Monospace is the default. Every button, label, table cell, tooltip, and data
readout uses the monospace stack. The serif face appears only in two contexts:
large navigational display text and legal/disclaimer copy.

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `--p-text-xs` | 10px | Legend labels, fine print |
| `--p-text-sm` | 12px | Buttons, toggles, breadcrumbs, labels |
| `--p-text-md` | 13px | Data table cells |
| `--p-text-base` | 14px | Tooltips, card titles, body secondary |
| `--p-text-lg` | 16px | Body text (default) |
| `--p-text-display-sm` | 50px | Nav links (mobile) |
| `--p-text-display-lg` | 80px | Nav links (desktop) |

### Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--p-weight-light` | 300 | Display text only |
| `--p-weight-regular` | 400 | Default for all interface text |
| `--p-weight-medium` | 500 | Titles, table headers |

### Numeric Data

Always use `font-variant-numeric: tabular-nums` (class: `.p-tabular-nums`) when
rendering columns of numbers, prices, percentages, or timestamps. This ensures
digits align vertically in tables and data readouts.

---

## Color Palette

### Core

| Swatch | Hex | Var | Meaning |
|--------|-----|-----|---------|
| White | `#ffffff` | `--p-color-bg` | Page background |
| Black | `#000000` | `--p-color-text` | Primary text, borders, active states |
| Green | `#00e100` | `--p-color-accent-green` | Highlighted data values in tooltips |

### Platform Colors

These identify data sources in comparative visualizations:

| Swatch | Hex | Var | Platform |
|--------|-----|-----|----------|
| Soft green | `#ABDFC5` | `--p-color-kalshi` | Kalshi |
| Soft blue | `#92A8F3` | `--p-color-polymarket` | Polymarket |

Extend this pattern for additional platforms by defining new `--p-color-*` tokens.

### State Colors

| State | Treatment |
|-------|-----------|
| Default | bg white, text black, border black |
| Hover | bg `#f0f0f0` |
| Active / Selected | bg black, text white |
| Disabled | opacity 0.5, bg `#f9f9f9`, text `#999`, border `#ccc` |
| Muted | opacity 0.5 |
| Dim | opacity 0.4 (breadcrumb ancestors) |

### Design Philosophy

The palette is intentionally stark: black, white, and one accent color. This
keeps attention on the data. Platform colors are muted pastels so they work
as fills in charts and treemaps without overwhelming numeric labels.

---

## Components

### Toggle Group

A segmented control with a sliding indicator. Use for switching between
related views (e.g., "Timeline / Treemap", "1D / 1W / 1M").

```html
<div class="p-toggle">
  <div class="p-toggle__indicator" style="width: 52px; transform: translateX(0)"></div>
  <button class="p-toggle__btn p-toggle__btn--active">1D</button>
  <button class="p-toggle__btn">1W</button>
  <button class="p-toggle__btn">1M</button>
  <button class="p-toggle__btn">ALL</button>
</div>
```

The indicator element must be positioned with JS. Set its `width` to match the
active button and `transform: translateX()` to slide to the correct offset.

### Button Group

Adjacent bordered buttons for mutually exclusive options. Simpler than
toggles — no sliding indicator, just background swap.

```html
<div class="p-btn-group">
  <button class="p-btn-group__btn p-btn-group__btn--active">Table</button>
  <button class="p-btn-group__btn">Chart</button>
  <button class="p-btn-group__btn">Raw</button>
</div>
```

### Action Buttons (Icon)

Small bordered buttons for toolbar actions (share, download, expand).

```html
<button class="p-action-btn" aria-label="Download CSV">
  <svg><!-- icon --></svg>
</button>
```

### Date Picker

A styled date input. The `140px` width fits `YYYY-MM-DD` comfortably.

```html
<input type="date" class="p-date-input" value="2025-01-15">
```

### Search Input

Input with a leading icon for filtering data.

```html
<div class="p-search">
  <svg class="p-search__icon"><!-- magnifying glass --></svg>
  <input class="p-search__input" type="text" placeholder="Search markets...">
</div>
```

### Tooltip

Position with JS. The `.p-tooltip__value` class renders data in accent green.

```html
<div class="p-tooltip" style="top: 120px; left: 300px">
  <div>
    <span class="p-tooltip__label">Price:</span>
    <span class="p-tooltip__value">$0.73</span>
  </div>
  <div>
    <span class="p-tooltip__label">Volume:</span>
    <span class="p-tooltip__value">142,891</span>
  </div>
</div>
```

### Breadcrumbs

Navigation trail. Ancestor items are dimmed; current item is full opacity.

```html
<nav>
  <ol class="p-breadcrumbs">
    <li class="p-breadcrumbs__item">
      <a class="p-breadcrumbs__link" href="/">Home</a>
    </li>
    <li class="p-breadcrumbs__separator">/</li>
    <li class="p-breadcrumbs__item">
      <a class="p-breadcrumbs__link" href="/politics">Politics</a>
    </li>
    <li class="p-breadcrumbs__separator">/</li>
    <li class="p-breadcrumbs__item p-breadcrumbs__item--current">
      <span>Presidential Election 2028</span>
    </li>
  </ol>
</nav>
```

### Legend

Color swatches paired with labels. Use alongside charts.

```html
<div class="p-legend">
  <div class="p-legend__item">
    <span class="p-legend__swatch p-legend__swatch--kalshi"></span>
    Kalshi
  </div>
  <div class="p-legend__item">
    <span class="p-legend__swatch p-legend__swatch--polymarket"></span>
    Polymarket
  </div>
</div>
```

Add custom platform swatches with inline styles:

```html
<span class="p-legend__swatch" style="background: #F4A261"></span>
```

### Data Table

Terminal-aesthetic table for raw data inspection. Dark background, monospace,
tabular numerals.

```html
<div class="p-data-table__wrapper">
  <table class="p-data-table">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Market</th>
        <th>Price</th>
        <th>Volume</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2025-06-14 09:31:02</td>
        <td>POTUS 2028</td>
        <td>0.42</td>
        <td>89,102</td>
      </tr>
      <tr>
        <td>2025-06-14 09:31:01</td>
        <td>Fed Rate Jul</td>
        <td>0.67</td>
        <td>214,500</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Header

Dashboard title with optional tag (e.g., BETA).

```html
<header class="p-header">
  <h1 class="p-header__title">
    Predictions Dashboard
    <span class="p-header__tag">Beta</span>
  </h1>
</header>
```

### Loader

Pulsing animation for loading states.

```html
<div class="p-loader">
  <img class="p-loader__mark" src="logo.svg" alt="Loading">
</div>
```

### Footer / Disclaimer

```html
<footer class="p-footer">
  <p class="p-disclaimer">
    This dashboard is for informational purposes only. Data sourced from
    public prediction markets. Not financial advice.
  </p>
</footer>
```

### Card / Panel

Generic bordered container for dashboard sections.

```html
<div class="p-card">
  <h2 class="p-card__title">Market Summary</h2>
  <!-- chart, table, or other content -->
</div>
```

### Chart Container

Aspect-ratio container for canvas-based visualizations (ECharts, D3, Konva).

```html
<div class="p-chart">
  <canvas id="timeline-chart"></canvas>
</div>

<!-- Square ratio for treemaps -->
<div class="p-chart p-chart--square">
  <canvas id="treemap"></canvas>
</div>
```

### Range Slider

Structure for custom range sliders. Requires JS for interaction.

```html
<div class="p-range">
  <div class="p-range__track"></div>
  <div class="p-range__fill" style="left: 20%; width: 40%"></div>
  <div class="p-range__handle" style="left: 20%">
    <span class="p-range__label">0.20</span>
  </div>
  <div class="p-range__handle" style="left: 60%">
    <span class="p-range__label">0.60</span>
  </div>
</div>
```

---

## Layout Patterns

### Dashboard Scaffold

```html
<body>
  <div class="p-container">
    <header class="p-header">...</header>

    <!-- Controls bar -->
    <div class="p-flex p-items-center p-justify-between p-gap-4 p-mb-8">
      <div class="p-flex p-gap-4 p-items-center">
        <div class="p-toggle">...</div>
        <div class="p-btn-group">...</div>
      </div>
      <div class="p-flex p-gap-2 p-items-center">
        <input class="p-date-input" type="date">
        <button class="p-action-btn">...</button>
      </div>
    </div>

    <!-- Visualization -->
    <div class="p-card p-mb-8">
      <div class="p-chart">
        <canvas></canvas>
      </div>
      <div class="p-legend p-mt-4">...</div>
    </div>

    <!-- Data table -->
    <div class="p-data-table__wrapper p-mb-8">
      <table class="p-data-table">...</table>
    </div>

    <footer class="p-footer">
      <p class="p-disclaimer">...</p>
    </footer>
  </div>
</body>
```

### Controls Row

Group controls horizontally. On narrow screens, allow wrapping.

```html
<div class="p-flex p-flex-wrap p-gap-4 p-items-center">
  <div class="p-toggle">...</div>
  <div class="p-search" style="width: 200px">...</div>
  <input class="p-date-input" type="date">
</div>
```

---

## Responsive Behavior

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| xs | 490px | Stacks controls vertically |
| sm | 640px | Side-by-side controls, `.p-hide-mobile` visible |
| md | 768px | Full toolbar layout |
| lg | 890px | Wider chart containers |
| xl | 960px | More horizontal space for legends |
| 2xl | 1024px | Comfortable desktop |
| 3xl | 1280px | Container padding increases to 60px, display text scales up |
| 4xl | 1345px | Max comfortable width |

The container is capped at `1400px`. Beyond that, content centers with
growing side margins.

---

## Data Visualization Guidelines

### Color Assignment

- Use platform tokens (`--p-color-kalshi`, `--p-color-polymarket`) for
  data series that represent those sources
- For generic multi-series charts, define new tokens following the same
  muted-pastel convention
- Reserve `--p-color-accent-green` for call-to-action values in tooltips
  and highlighted metrics only — do not use it as a chart series color

### Chart Styling

- Borders on chart containers: `1px solid #000`
- Axes and gridlines: use low-opacity black (`rgba(0,0,0,0.1)`)
- Axis labels: `--p-text-xs` (10px), `--p-font-mono`
- Tooltip follows the `.p-tooltip` pattern — black bg, white text,
  green values, 2px radius

### Treemaps

- Cell labels: monospace, sized relative to cell area
- Cell borders: 1px white to create visual separation
- Platform color as cell fill

### Tables (Raw Data)

- Always use the dark `.p-data-table` treatment for raw/exportable data
- Light tables (white bg) are acceptable for summary/overview contexts
- Sticky headers are built into the component
- Enable horizontal scroll for wide datasets by wrapping in
  `.p-overflow-auto`

---

## Design Principles

1. **Data first.** The interface recedes. Black-and-white palette keeps
   attention on numbers and charts.

2. **Monospace forward.** Tabular data alignment is a feature, not a
   side effect. The monospace font is chosen for readability of numeric
   data at small sizes.

3. **Minimal radius.** 2px everywhere. No pills, no circles (except
   chart elements). Sharp enough to feel institutional, rounded enough
   to not cut.

4. **High contrast states.** Active = black bg, white text. No gradients,
   no shadows, no blur. State changes are binary and immediate.

5. **Restrained color.** One accent color (`#00e100`) used sparingly for
   highlighted values. Platform colors are for data encoding only.

---

## File Inventory

| File | Purpose |
|------|---------|
| `css/paradigm-tokens.css` | CSS custom properties: colors, sizes, spacing, radii |
| `css/paradigm-components.css` | Styled components: toggles, buttons, tables, tooltips, etc. |
| `css/paradigm-utilities.css` | Atomic helper classes for layout and typography |
| `STYLE_GUIDE.md` | This document |
