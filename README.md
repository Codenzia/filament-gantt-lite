# Filament Gantt Lite — Lightweight, RTL-first SVG Gantt for Filament

[![Latest Version](https://img.shields.io/packagist/v/codenzia/filament-gantt-lite.svg?style=flat-square)](https://packagist.org/packages/codenzia/filament-gantt-lite)
[![PHP Version](https://img.shields.io/packagist/php-v/codenzia/filament-gantt-lite.svg?style=flat-square)](https://packagist.org/packages/codenzia/filament-gantt-lite)
[![Filament](https://img.shields.io/badge/Filament-v4%20%7C%20v5-f59e0b?style=flat-square)](https://filamentphp.com)
[![Tests](https://img.shields.io/badge/tests-Pest%20v3-8b5cf6?style=flat-square)](https://pestphp.com)
[![License](https://img.shields.io/packagist/l/codenzia/filament-gantt-lite.svg?style=flat-square)](LICENSE.md)

A **lightweight, RTL-first SVG Gantt chart page for Filament v4/v5**. Pure in-house code — no `dhtmlxGantt`, no `frappe-gantt`, no third-party vendor lock-in. Full Arabic + English support, dark-mode aware, dependency arrows, today line, baseline rendering, holidays, and non-working days — all rendered by a small JS layer over SVG you can read and patch yourself.

> **Why this exists.** Most Filament Gantt plugins wrap a heavyweight commercial JS library, ship 200+ KB of vendor code, and break the moment Filament theming touches them. `filament-gantt-lite` does the opposite — a thin abstract page you extend, an SVG renderer that respects your locale and Tailwind theme, and zero external dependencies. Right-to-left works *by design*, not as an afterthought.

> **Try it live:** A working integration is included in the [Codenzia plugins demo](https://github.com/Codenzia/plugins-demo) at `/admin/demo/gantt-lite`.

---

## Features

- **SVG-native rendering** — no Canvas, no third-party library, no vendor build step.
- **RTL-first** — Arabic / Hebrew layouts render flawlessly with mirrored bars, time-axis, and dependency arrows.
- **Three view modes** — Day, Week, Month, switchable at runtime.
- **Dependency arrows** between tasks (FS, supports `dependencies` and `task_dependencies` fields).
- **Today line** auto-positioned on the time axis.
- **Baselines** — toggle planned-vs-actual rendering (translucent baseline rect above the actual bar).
- **Holidays + non-working days** — hatch-fill non-working columns; configurable per-page.
- **Optional sidebar tree** — render groups → tasks in a left rail; pass `[]` to hide.
- **Dark-mode aware** — colours inherit from your Tailwind theme.
- **Pure data model** — pass an array of task rows; subclass implements `getGanttDataArray()`.
- **No build step** — assets are published as plain JS/CSS to `public/`.

---

## Requirements

| Dependency | Version |
|---|---|
| PHP | `^8.3` |
| Filament | `^4.0 \|\| ^5.0` |
| Livewire | `^3.0 \|\| ^4.0` |

---

## Installation

```bash
composer require codenzia/filament-gantt-lite
```

Publish the config file:

```bash
php artisan vendor:publish --tag=filament-gantt-lite-config
```

Publish the JS/CSS assets to `public/`:

```bash
php artisan vendor:publish --tag=filament-gantt-lite-assets
```

---

## Quick Start

Extend the abstract `GanttLite` page in your Filament panel and implement `getGanttDataArray()`:

```php
namespace App\Filament\Pages;

use Codenzia\FilamentGanttLite\Pages\GanttLite;

class ProjectGantt extends GanttLite
{
    protected static ?string $title = 'Project Schedule';

    protected static ?string $slug = 'projects/gantt';

    public static function shouldRegisterNavigation(): bool
    {
        return true;
    }

    protected function getGanttDataArray(?int $projectId = null, array $assigneeFilter = []): array
    {
        return Task::query()
            ->when($projectId, fn ($q) => $q->where('project_id', $projectId))
            ->get()
            ->map(fn (Task $t) => [
                'id'           => $t->id,
                'name'         => $t->name,
                'start'        => $t->start_date->toDateString(),
                'end'          => $t->due_date->toDateString(),
                'progress'     => $t->progress_percent,
                'dependencies' => $t->dependencies->pluck('id')->all(),
            ])
            ->all();
    }
}
```

That's it — visit your panel and the SVG Gantt renders with proper RTL detection from `app()->getLocale()`.

---

## Configuration

After publishing, edit `config/filament-gantt-lite.php`:

```php
return [
    // 'Day' | 'Week' | 'Month'
    'default_view_mode' => 'Week',

    'bar_height'        => 32,
    'bar_corner_radius' => 8,
    'padding'           => 14,

    'assets' => [
        'js'  => 'js/filament-gantt-lite.js',
        'css' => 'css/filament-gantt-lite.css',
    ],
];
```

---

## Task data shape

Each task in the array returned by `getGanttDataArray()` must include `id`, `name`, `start`, `end`. All other fields are optional.

| Field | Type | Description |
|---|---|---|
| `id` | int / string | Unique task identifier |
| `name` | string | Display label |
| `start` | `Y-m-d` | Start date |
| `end` | `Y-m-d` | End date |
| `progress` | int (0-100) | Completion % overlay on the bar |
| `color` | hex string | Override bar colour |
| `dependencies` | array of ids | FS dependency arrows |
| `task_dependencies` | array of ids | Alias accepted for compatibility |
| `planned_start` | `Y-m-d` | If `isBaselinesEnabled()` is true, renders baseline bar |
| `planned_end` | `Y-m-d` | See above |
| `avatar` | URL | Optional assignee avatar shown on the bar |

---

## Sidebar tree (optional)

Return a hierarchical tree from `getGanttSidebar()` to render a left rail:

```php
protected function getGanttSidebar(): array
{
    return [
        [
            'id'       => 'phase-1',
            'label'    => 'Phase 1 — Discovery',
            'children' => [
                ['id' => 1, 'label' => 'Stakeholder interviews'],
                ['id' => 2, 'label' => 'Audit existing system'],
            ],
        ],
        [
            'id'       => 'phase-2',
            'label'    => 'Phase 2 — Build',
            'children' => [
                ['id' => 3, 'label' => 'Schema design'],
                ['id' => 4, 'label' => 'API endpoints'],
            ],
        ],
    ];
}
```

Return `[]` (the default) to hide the sidebar entirely.

---

## Customising the page

Override these hooks on your subclass:

```php
protected function getDefaultViewMode(): string
{
    return 'Day'; // default 'Week'
}

protected function isBaselinesEnabled(): bool
{
    return true; // render planned-vs-actual baseline bars
}

protected function getHolidays(): array
{
    return ['2026-01-01', '2026-12-25'];
}

protected function getNonWorkingDays(): array
{
    return [0, 6]; // Sunday + Saturday (default)
}
```

The full boot config sent to the JS layer can also be overridden via `getGanttBootConfig()`.

---

## Livewire events

The page emits these events you can hook from other Livewire components:

| Event | Payload | Fired when |
|---|---|---|
| `gantt-lite:view-mode-changed` | `mode: 'Day'\|'Week'\|'Month'` | User switches view mode |
| `gantt-lite:refreshed` | `tasks: array` | `refreshGantt()` is called |

---

## RTL support

RTL detection is automatic via `app()->getLocale() === 'ar'`. The SVG renderer mirrors:

- Time-axis direction (right-to-left day flow)
- Task bar growth
- Dependency arrow heads
- Sidebar tree indentation

To force a specific direction independent of locale, override `getGanttBootConfig()` and set `'rtl' => true/false`.

---

## Testing

```bash
composer test
```

---

## Roadmap

- Drag-to-reschedule task bars (currently read-only).
- Inline resize handles on bars.
- Critical path highlighting.
- Export to PNG / PDF.

---

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
