<?php

declare(strict_types=1);

namespace Codenzia\FilamentGanttLite\Tests\Fixtures;

use Codenzia\FilamentGanttLite\Pages\GanttLite;

class TestGanttPage extends GanttLite
{
    protected function getGanttDataArray(?int $projectId = null, array $assigneeFilter = []): array
    {
        return [
            ['id' => 1, 'name' => 'Design', 'start' => '2026-01-01', 'end' => '2026-01-10'],
            ['id' => 2, 'name' => 'Build', 'start' => '2026-01-11', 'end' => '2026-01-30'],
        ];
    }

    public function exposeGanttData(): array
    {
        return $this->getGanttDataArray();
    }

    public function exposeDefaultViewMode(): string
    {
        return $this->getDefaultViewMode();
    }

    public function exposeSidebar(): array
    {
        return $this->getGanttSidebar();
    }
}
