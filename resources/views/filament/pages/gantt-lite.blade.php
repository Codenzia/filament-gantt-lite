{{--
    filament-gantt-lite — main page view.

    Renders the Gantt chart container plus a small toolbar (view-mode picker
    + scroll-to-today). Tasks and config are passed as JSON to an Alpine
    component which instantiates the FilamentGanttLite class.

    Subclasses can:
      - implement getGanttDataArray() to provide tasks
      - implement getGanttSidebar() to provide a left tree
      - override getGanttBootConfig() to tweak rtl, language, viewMode, etc.

    @package codenzia/filament-gantt-lite
    @author Codenzia
--}}

<x-filament-panels::page>
    @push('styles')
        <link rel="stylesheet" href="{{ asset(config('filament-gantt-lite.assets.css', 'css/filament-gantt-lite.css')) }}">
    @endpush

    @push('scripts')
        <script src="{{ asset(config('filament-gantt-lite.assets.js', 'js/filament-gantt-lite.js')) }}" defer></script>
    @endpush

    <div
        x-data="filamentGanttLite({
            tasks: @js($ganttData),
            sidebar: @js($ganttSidebar),
            config: @js($this->getGanttBootConfig()),
        })"
        x-init="init()"
        wire:ignore
        class="fg-lite-root"
    >
        <div class="fg-lite-toolbar">
            <div class="fg-lite-toolbar__group">
                <button
                    type="button"
                    @click="setViewMode('Day')"
                    :class="viewMode === 'Day' ? 'fg-lite-btn fg-lite-btn--active' : 'fg-lite-btn'"
                >{{ __('Day') }}</button>
                <button
                    type="button"
                    @click="setViewMode('Week')"
                    :class="viewMode === 'Week' ? 'fg-lite-btn fg-lite-btn--active' : 'fg-lite-btn'"
                >{{ __('Week') }}</button>
                <button
                    type="button"
                    @click="setViewMode('Month')"
                    :class="viewMode === 'Month' ? 'fg-lite-btn fg-lite-btn--active' : 'fg-lite-btn'"
                >{{ __('Month') }}</button>
            </div>
            <div class="fg-lite-toolbar__group">
                <button
                    type="button"
                    @click="scrollToToday()"
                    class="fg-lite-btn"
                >{{ __('Today') }}</button>
                <button
                    type="button"
                    @click="exportPNG()"
                    class="fg-lite-btn"
                >{{ __('Export PNG') }}</button>
            </div>
        </div>

        <div class="fg-lite-body" :dir="config.rtl ? 'rtl' : 'ltr'">
            @if (! empty($ganttSidebar))
                <aside class="fg-lite-sidebar" x-ref="sidebar">
                    @foreach ($ganttSidebar as $group)
                        <div class="fg-lite-sidebar__group">
                            <div class="fg-lite-sidebar__group-title">{{ $group['label'] ?? '' }}</div>
                            @foreach ($group['children'] ?? [] as $item)
                                <div class="fg-lite-sidebar__item" data-task-id="{{ $item['id'] }}">
                                    {{ $item['label'] ?? '' }}
                                </div>
                            @endforeach
                        </div>
                    @endforeach
                </aside>
            @endif

            <div class="fg-lite-chart" x-ref="chart"></div>
        </div>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('alpine:init', () => {
                Alpine.data('filamentGanttLite', (initial) => ({
                    tasks: initial.tasks || [],
                    sidebar: initial.sidebar || [],
                    config: initial.config || {},
                    viewMode: initial.config?.viewMode || 'Week',
                    gantt: null,
                    _popup: null,
                    _popupCloseHandler: null,

                    init() {
                        // Boot once the SVG class is loaded (script is `defer`'d).
                        const boot = () => {
                            if (typeof window.FilamentGanttLite === 'undefined') {
                                setTimeout(boot, 50);
                                return;
                            }
                            this._mount();
                        };
                        boot();

                        // Livewire refresh hook
                        this.$wire?.$on('gantt-lite:refreshed', (data) => {
                            const payload = Array.isArray(data) ? data[0] : data;
                            this.tasks = payload?.tasks || this.tasks;
                            if (this.gantt) this.gantt.refresh(this.tasks);
                        });
                    },

                    _mount() {
                        const container = this.$refs.chart;
                        if (!container || !this.tasks.length) return;

                        const self = this;
                        const holidays = (this.config.holidays || []).map((s) => {
                            const [y, m, d] = String(s).split('-').map((n) => parseInt(n, 10));
                            return new Date(y, (m || 1) - 1, d || 1);
                        });
                        const nonWorkingDays = new Set(this.config.nonWorkingDays || [0, 6]);

                        this.gantt = new window.FilamentGanttLite(container, this.tasks, {
                            rtl: this.config.rtl,
                            language: this.config.language || 'en',
                            viewMode: this.viewMode,
                            barHeight: this.config.barHeight ?? 32,
                            barCornerRadius: this.config.barCornerRadius ?? 8,
                            padding: this.config.padding ?? 14,
                            scrollTo: 'today',
                            baselines: !!this.config.baselines,
                            isWeekend: (d) => nonWorkingDays.has(d.getDay()),
                            ignoredDates: holidays,
                            onClick: (task, group, e) => self._showPopup(task, e),
                        });

                        // Tear down listeners when the gantt is destroyed
                        // (e.g. Livewire navigation, full re-render).
                        container.addEventListener('codenzia-gantt:destroy', () => self._teardown());
                    },

                    setViewMode(mode) {
                        if (!this.gantt || !['Day', 'Week', 'Month'].includes(mode)) return;
                        this.viewMode = mode;
                        this.gantt.changeViewMode(mode);
                    },

                    scrollToToday() {
                        this.gantt?.scrollTo('today');
                    },

                    async exportPNG() {
                        if (!this.gantt) return;
                        const dataUrl = await this.gantt.exportPNG({ scale: 2, background: '#ffffff' });
                        if (!dataUrl) return;
                        const link = document.createElement('a');
                        link.href = dataUrl;
                        link.download = 'gantt-' + new Date().toISOString().slice(0, 10) + '.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    },

                    _showPopup(task, event) {
                        this._hidePopup();

                        const isRtl = !!this.config.rtl;
                        const popup = document.createElement('div');
                        popup.className = 'fg-lite-popup';
                        popup.innerHTML = `
                            <div class="fg-lite-popup__title">${this._escape(task.name || '')}</div>
                            <div class="fg-lite-popup__dates">
                                ${task._start ? new Date(task._start).toLocaleDateString() : ''}
                                — ${task._end ? new Date(task._end).toLocaleDateString() : ''}
                            </div>
                            <div class="fg-lite-popup__progress">
                                <div class="fg-lite-popup__progress-bar" style="width: ${Math.round(task.progress || 0)}%; background: ${task.color || 'var(--primary-500, #22C55E)'}"></div>
                            </div>
                            <div class="fg-lite-popup__progress-label">${Math.round(task.progress || 0)}%</div>
                        `;

                        const POPUP_W = 280;
                        const POPUP_H_GUESS = 180;
                        const viewW = window.innerWidth;
                        const viewH = window.innerHeight;
                        let left = isRtl ? event.clientX + 12 : event.clientX - 140;
                        let top = event.clientY + 12;
                        left = Math.max(8, Math.min(left, viewW - POPUP_W));
                        if (top + POPUP_H_GUESS > viewH) top = Math.max(8, event.clientY - POPUP_H_GUESS);

                        popup.style.left = left + 'px';
                        popup.style.top = top + 'px';
                        document.body.appendChild(popup);
                        this._popup = popup;

                        setTimeout(() => {
                            if (!this._popup) return;
                            this._popupCloseHandler = (e) => {
                                if (!popup.contains(e.target)) this._hidePopup();
                            };
                            document.addEventListener('mousedown', this._popupCloseHandler);
                        }, 200);
                    },

                    _hidePopup() {
                        if (this._popupCloseHandler) {
                            document.removeEventListener('mousedown', this._popupCloseHandler);
                            this._popupCloseHandler = null;
                        }
                        if (this._popup) {
                            this._popup.remove();
                            this._popup = null;
                        }
                    },

                    _teardown() {
                        this._hidePopup();
                    },

                    _escape(s) {
                        return String(s).replace(/[&<>"']/g, (c) => ({
                            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
                        }[c]));
                    },

                    destroy() {
                        this._teardown();
                        this.gantt?.destroy();
                    },
                }));
            });
        </script>
    @endpush
</x-filament-panels::page>
