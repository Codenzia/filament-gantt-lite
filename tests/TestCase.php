<?php

declare(strict_types=1);

namespace Codenzia\FilamentGanttLite\Tests;

use Codenzia\FilamentGanttLite\FilamentGanttLiteServiceProvider;
use Livewire\LivewireServiceProvider;
use Orchestra\Testbench\TestCase as BaseTestCase;

class TestCase extends BaseTestCase
{
    protected function getPackageProviders($app): array
    {
        return [
            LivewireServiceProvider::class,
            FilamentGanttLiteServiceProvider::class,
        ];
    }

    protected function getEnvironmentSetUp($app): void
    {
        config()->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
    }
}
