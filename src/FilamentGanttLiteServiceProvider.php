<?php

declare(strict_types=1);

namespace Codenzia\FilamentGanttLite;

use Illuminate\Support\ServiceProvider;

class FilamentGanttLiteServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/filament-gantt-lite.php', 'filament-gantt-lite');
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'filament-gantt-lite');

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/filament-gantt-lite.php' => config_path('filament-gantt-lite.php'),
            ], 'filament-gantt-lite-config');

            $this->publishes([
                __DIR__.'/../resources/assets/css/filament-gantt-lite.css' => public_path('css/filament-gantt-lite.css'),
                __DIR__.'/../resources/assets/js/filament-gantt-lite.js' => public_path('js/filament-gantt-lite.js'),
            ], 'filament-gantt-lite-assets');
        }
    }
}
