<?php

declare(strict_types=1);

/**
 * GanttLite — abstract base page.
 *
 * Lightweight SVG Gantt for Filament v4 with full RTL/Arabic + LTR support.
 * Consumers extend this page and implement `getGanttDataArray()` and
 * (optionally) `getGanttSidebar()`. The view renders the bars, today line,
 * dependency arrows, dark-mode aware colours — all via in-house SVG code,
 * no third-party Gantt library.
 *
 * @author Codenzia
 */

namespace Codenzia\FilamentGanttLite\Pages;

use Filament\Pages\Page;

abstract class GanttLite extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-chart-bar';

    protected string $view = 'filament-gantt-lite::filament.pages.gantt-lite';

    protected static ?string $navigationLabel = 'Gantt';

    protected static string|\UnitEnum|null $navigationGroup = 'Tasks';

    protected static ?int $navigationSort = 21;

    protected static ?string $slug = 'gantt-lite';

    /**
     * Default view mode: 'Day', 'Week', or 'Month'. Subclasses may override.
     */
    public string $viewMode;

    /**
     * Tasks for the chart, normalised to the shape:
     *   { id, name, start, end, progress?, color?, dependencies?, task_dependencies?, avatar?, ... }
     *
     * @var array<int, array<string, mixed>>
     */
    public array $ganttData = [];

    /**
     * Optional left-rail tree data:
     *   [{ id, label, children: [{ id, label, children: [...] }] }, ...]
     *
     * Pass an empty array to hide the sidebar entirely.
     *
     * @var array<int, array<string, mixed>>
     */
    public array $ganttSidebar = [];

    public function mount(?int $projectId = null, array $assigneeFilter = []): void
    {
        $this->viewMode = $this->getDefaultViewMode();
        $this->ganttData = $this->getGanttDataArray($projectId, $assigneeFilter);
        $this->ganttSidebar = $this->getGanttSidebar();
    }

    /**
     * Subclass hook: return the task list for this page.
     *
     * @return array<int, array<string, mixed>>
     */
    abstract protected function getGanttDataArray(?int $projectId = null, array $assigneeFilter = []): array;

    /**
     * Subclass hook: return tree-style sidebar data (groups → tasks).
     * Default: empty (no sidebar).
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getGanttSidebar(): array
    {
        return [];
    }

    protected function getDefaultViewMode(): string
    {
        return (string) config('filament-gantt-lite.default_view_mode', 'Week');
    }

    /**
     * The boot config the JS layer reads off the page. Subclasses may
     * override to inject custom locale/labels/scrollTo behaviour.
     *
     * @return array<string, mixed>
     */
    public function getGanttBootConfig(): array
    {
        return [
            'rtl' => app()->getLocale() === 'ar',
            'language' => app()->getLocale(),
            'viewMode' => $this->viewMode,
            'barHeight' => (int) config('filament-gantt-lite.bar_height', 32),
            'barCornerRadius' => (int) config('filament-gantt-lite.bar_corner_radius', 8),
            'padding' => (int) config('filament-gantt-lite.padding', 14),
            'baselines' => $this->isBaselinesEnabled(),
            'holidays' => $this->getHolidays(),
            'nonWorkingDays' => $this->getNonWorkingDays(),
        ];
    }

    /**
     * Toggle the planned-vs-actual baseline rendering. When true, tasks
     * with planned_start + planned_end render an extra translucent rect
     * above the actual bar.
     */
    protected function isBaselinesEnabled(): bool
    {
        return false;
    }

    /**
     * Holidays to mark as non-working (hatched). ISO date strings (Y-m-d).
     *
     * @return array<int, string>
     */
    protected function getHolidays(): array
    {
        return [];
    }

    /**
     * Day-of-week indexes that are non-working (0 = Sun, 6 = Sat).
     * Defaults to the standard Sat/Sun weekend.
     *
     * @return array<int, int>
     */
    protected function getNonWorkingDays(): array
    {
        return [0, 6];
    }

    public function setViewMode(string $mode): void
    {
        if (in_array($mode, ['Day', 'Week', 'Month'], true)) {
            $this->viewMode = $mode;
            $this->dispatch('gantt-lite:view-mode-changed', mode: $mode);
        }
    }

    public function refreshGantt(): void
    {
        $this->dispatch('gantt-lite:refreshed', tasks: $this->ganttData);
    }

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }
}
