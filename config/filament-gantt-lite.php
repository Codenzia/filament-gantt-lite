<?php

declare(strict_types=1);

/**
 * filament-gantt-lite configuration
 *
 * Lightweight SVG-based Gantt with full RTL/Arabic + LTR support and
 * no third-party Gantt library. Override these defaults in
 * config/filament-gantt-lite.php (publish via the
 * 'filament-gantt-lite-config' tag).
 */

return [
    /*
    |--------------------------------------------------------------------------
    | Default View Mode
    |--------------------------------------------------------------------------
    |
    | One of: 'Day', 'Week', 'Month'. Page subclasses can override via
    | $defaultViewMode property.
    |
    */
    'default_view_mode' => 'Week',

    /*
    |--------------------------------------------------------------------------
    | Bar Appearance
    |--------------------------------------------------------------------------
    */
    'bar_height' => 32,
    'bar_corner_radius' => 8,
    'padding' => 14,

    /*
    |--------------------------------------------------------------------------
    | Asset Paths (published to public/)
    |--------------------------------------------------------------------------
    */
    'assets' => [
        'js' => 'js/filament-gantt-lite.js',
        'css' => 'css/filament-gantt-lite.css',
    ],
];
