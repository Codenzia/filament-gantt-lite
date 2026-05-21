<?php

declare(strict_types=1);

use Codenzia\FilamentGanttLite\Pages\GanttLite;
use Codenzia\FilamentGanttLite\Tests\Fixtures\TestGanttPage;
use Filament\Pages\Page;

it('exposes GanttLite as an abstract Filament page', function (): void {
    expect((new ReflectionClass(GanttLite::class))->isAbstract())->toBeTrue()
        ->and(is_subclass_of(GanttLite::class, Page::class))->toBeTrue();
});

it('returns task data from the subclass hook with the expected shape', function (): void {
    $tasks = (new TestGanttPage)->exposeGanttData();

    expect($tasks)->toBeArray()
        ->and($tasks)->toHaveCount(2)
        ->and($tasks[0])->toHaveKeys(['id', 'name', 'start', 'end'])
        ->and($tasks[0]['name'])->toBe('Design')
        ->and($tasks[1]['name'])->toBe('Build');
});

it('falls back to Week as the default view mode', function (): void {
    config()->set('filament-gantt-lite.default_view_mode', 'Week');

    expect((new TestGanttPage)->exposeDefaultViewMode())->toBe('Week');
});

it('honours a config-driven default view mode', function (): void {
    config()->set('filament-gantt-lite.default_view_mode', 'Month');

    expect((new TestGanttPage)->exposeDefaultViewMode())->toBe('Month');
});

it('marks Arabic locale as RTL in the boot config', function (): void {
    app()->setLocale('ar');

    $page = new TestGanttPage;
    $page->viewMode = 'Day';

    expect($page->getGanttBootConfig())
        ->toHaveKey('rtl', true)
        ->toHaveKey('language', 'ar')
        ->toHaveKey('viewMode', 'Day');
});

it('marks English locale as LTR in the boot config', function (): void {
    app()->setLocale('en');

    $page = new TestGanttPage;
    $page->viewMode = 'Week';

    expect($page->getGanttBootConfig())
        ->toHaveKey('rtl', false)
        ->toHaveKey('language', 'en');
});

it('returns an empty sidebar by default', function (): void {
    expect((new TestGanttPage)->exposeSidebar())->toBe([]);
});

it('skips navigation registration by default', function (): void {
    expect(GanttLite::shouldRegisterNavigation())->toBeFalse();
});
