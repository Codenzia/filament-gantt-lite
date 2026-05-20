/**
 * Codenzia Gantt — Custom SVG Gantt Chart
 * A lightweight, RTL-aware Gantt chart renderer.
 */

// ── Date Utilities ──────────────────────────────────────────────

const dateUtils = {
    parse(date, separator = '-') {
        if (date instanceof Date) return date;
        if (typeof date === 'string') {
            const parts = date.split(' ');
            const dateParts = parts[0].split(separator).map(v => parseInt(v, 10));
            dateParts[1] = dateParts[1] ? dateParts[1] - 1 : 0;
            const timeParts = parts[1] ? parts[1].split(/[.:]/) : [0, 0, 0, 0];
            return new Date(...dateParts, ...timeParts);
        }
        return new Date();
    },

    format(date, fmt = 'YYYY-MM-DD', lang = 'en') {
        const longMonth = new Intl.DateTimeFormat(lang, { month: 'long' });
        const shortMonth = new Intl.DateTimeFormat(lang, { month: 'short' });
        const monthName = longMonth.format(date);
        const vals = this.getValues(date).map(d => String(d).padStart(2, '0'));
        const map = {
            YYYY: vals[0],
            MM: String(+vals[1] + 1).padStart(2, '0'),
            DD: vals[2],
            HH: vals[3],
            mm: vals[4],
            ss: vals[5],
            D: String(date.getDate()),
            MMMM: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            MMM: shortMonth.format(date),
        };
        let str = fmt;
        const ordered = Object.keys(map).sort((a, b) => b.length - a.length);
        const placeholders = [];
        ordered.forEach(key => {
            if (str.includes(key)) {
                str = str.replaceAll(key, `$${placeholders.length}`);
                placeholders.push(map[key]);
            }
        });
        placeholders.forEach((val, i) => {
            str = str.replaceAll(`$${i}`, val);
        });
        return str;
    },

    diff(a, b, scale = 'day') {
        const ms = a - b + (b.getTimezoneOffset() - a.getTimezoneOffset()) * 60000;
        const seconds = ms / 1000;
        const minutes = seconds / 60;
        const hours = minutes / 60;
        const days = hours / 24;
        let yearDiff = a.getFullYear() - b.getFullYear();
        let monthDiff = a.getMonth() - b.getMonth();
        // Use the actual number of days in `a`'s month rather than a fixed 31
        // — fixes ~3-10% drift in width calculations across 28/30 day months.
        const daysInAMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
        monthDiff += a.getDate() / daysInAMonth;
        const months = yearDiff * 12 + monthDiff;
        const years = months / 12;
        const s = scale.endsWith('s') ? scale : scale + 's';
        return Math.round({ milliseconds: ms, seconds, minutes, hours, days, months, years }[s] * 100) / 100;
    },

    add(date, qty, scale) {
        qty = parseInt(qty, 10);
        return new Date(
            date.getFullYear() + (scale === 'year' ? qty : 0),
            date.getMonth() + (scale === 'month' ? qty : 0),
            date.getDate() + (scale === 'day' ? qty : 0),
            date.getHours() + (scale === 'hour' ? qty : 0),
            date.getMinutes() + (scale === 'minute' ? qty : 0),
            date.getSeconds() + (scale === 'second' ? qty : 0),
            date.getMilliseconds() + (scale === 'millisecond' ? qty : 0),
        );
    },

    startOf(date, scale) {
        const scores = { year: 6, month: 5, day: 4, hour: 3, minute: 2, second: 1, millisecond: 0 };
        const max = scores[scale];
        const reset = s => scores[s] <= max;
        return new Date(
            date.getFullYear(),
            reset('year') ? 0 : date.getMonth(),
            reset('month') ? 1 : date.getDate(),
            reset('day') ? 0 : date.getHours(),
            reset('hour') ? 0 : date.getMinutes(),
            reset('minute') ? 0 : date.getSeconds(),
            reset('second') ? 0 : date.getMilliseconds(),
        );
    },

    today() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },

    getValues(date) {
        return [
            date.getFullYear(), date.getMonth(), date.getDate(),
            date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds(),
        ];
    },

    parseDuration(str) {
        const m = /^(\d+)(y|m|d|h|min|s|ms)$/.exec(str);
        if (!m) return { duration: 0, scale: 'day' };
        const scaleMap = { y: 'year', m: 'month', d: 'day', h: 'hour', min: 'minute', s: 'second', ms: 'millisecond' };
        return { duration: parseInt(m[1]), scale: scaleMap[m[2]] };
    },

    convertScales(period, toScale) {
        const toDays = { millisecond: 1 / 86400000, second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, month: 30, year: 365 };
        const { duration, scale } = this.parseDuration(period);
        return (duration * toDays[scale]) / toDays[toScale];
    },

    daysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    },

    isWeekend(date) {
        return date.getDay() === 0 || date.getDay() === 6;
    },
};

// ── SVG Helper ──────────────────────────────────────────────────

function svgCreate(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const key in attrs) {
        if (key === 'append_to') attrs.append_to.appendChild(el);
        else if (key === 'innerHTML') el.innerHTML = attrs.innerHTML;
        else if (key === 'clipPath') el.setAttribute('clip-path', `url(#${attrs[key]})`);
        else el.setAttribute(key, attrs[key]);
    }
    return el;
}

function sanitize(s) {
    return String(s).replaceAll(' ', '_').replaceAll(':', '_').replaceAll('.', '_');
}

// ── View Mode Definitions ───────────────────────────────────────

function formatWeek(date, ld, lang) {
    const end = dateUtils.add(date, 6, 'day');
    const startD = dateUtils.format(date, 'D', lang);
    const endD = dateUtils.format(end, 'D', lang);
    const startM = dateUtils.format(date, 'MMM', lang);
    const endM = dateUtils.format(end, 'MMM', lang);
    return startM === endM ? `${startD} - ${endD} ${startM}` : `${startD} ${startM} - ${endD} ${endM}`;
}

const VIEW_MODES = {
    Day: {
        name: 'Day',
        step: '1d',
        columnWidth: 45,
        padding: '14d',
        dateFormat: 'YYYY-MM-DD',
        lowerText: (d, ld, lang) => (!ld || d.getDate() !== ld.getDate()) ? dateUtils.format(d, 'D', lang) : '',
        upperText: (d, ld, lang) => {
            if (!ld) return dateUtils.format(d, 'MMMM YYYY', lang);
            if (d.getMonth() !== ld.getMonth() || d.getFullYear() !== ld.getFullYear()) return dateUtils.format(d, 'MMMM YYYY', lang);
            return '';
        },
        thickLine: d => d.getDay() === 1,
    },
    Week: {
        name: 'Week',
        step: '7d',
        columnWidth: 140,
        padding: '1m',
        dateFormat: 'YYYY-MM-DD',
        lowerText: formatWeek,
        upperText: (d, ld, lang) => {
            if (!ld) return dateUtils.format(d, 'MMMM YYYY', lang);
            if (d.getMonth() !== ld.getMonth() || d.getFullYear() !== ld.getFullYear()) return dateUtils.format(d, 'MMMM YYYY', lang);
            return '';
        },
        thickLine: d => d.getDate() >= 1 && d.getDate() <= 7,
    },
    Month: {
        name: 'Month',
        step: '1m',
        columnWidth: 120,
        padding: '2m',
        dateFormat: 'YYYY-MM',
        lowerText: (d, ld, lang) => dateUtils.format(d, 'MMMM', lang),
        upperText: (d, ld, lang) => (!ld || d.getFullYear() !== ld.getFullYear()) ? dateUtils.format(d, 'YYYY', lang) : '',
        thickLine: d => d.getMonth() % 3 === 0,
    },
};

// ── CodenziaGantt Class ─────────────────────────────────────────

class CodenziaGantt {

    constructor(container, tasks, options = {}) {
        this._setupContainer(container);
        this._setupOptions(options);
        this._setupTasks(tasks);
        this._setupDates();
        this.render();
        if (this.options.scrollTo) {
            // Defer scroll to after DOM paint
            requestAnimationFrame(() => this.scrollTo(this.options.scrollTo));
        }
    }

    // ── Setup ───────────────────────────────────────────────────

    _setupContainer(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (!element) throw new Error('CodenziaGantt: container element not found');

        // Create wrapper structure
        this.$container = document.createElement('div');
        this.$container.classList.add('cg-container');

        // Header (DOM divs for sticky scroll)
        this.$header = document.createElement('div');
        this.$header.classList.add('cg-header');
        this.$upperHeader = document.createElement('div');
        this.$upperHeader.classList.add('cg-upper-header');
        this.$lowerHeader = document.createElement('div');
        this.$lowerHeader.classList.add('cg-lower-header');
        this.$header.appendChild(this.$upperHeader);
        this.$header.appendChild(this.$lowerHeader);
        this.$container.appendChild(this.$header);

        // SVG
        this.$svg = svgCreate('svg', { class: 'cg-gantt' });
        this.$container.appendChild(this.$svg);

        element.innerHTML = '';
        element.appendChild(this.$container);
        this.$parent = element;
    }

    _setupOptions(options) {
        this.options = {
            rtl: document.documentElement.dir === 'rtl',
            viewMode: 'Day',
            barHeight: 37,
            barCornerRadius: 12,
            padding: 14,
            upperHeaderHeight: 45,
            lowerHeaderHeight: 30,
            language: 'en',
            containerHeight: 'auto',
            scrollTo: 'today',
            onClick: null,
            isWeekend: d => d.getDay() === 0 || d.getDay() === 6,
            ignoredDates: [],
            ignoredFunction: null,
            weekendColor: null,
            // Render a translucent baseline bar (planned_start..planned_end)
            // above the actual bar when both planned dates are set on a task.
            baselines: false,
            ...options,
        };

        this._viewMode = VIEW_MODES[this.options.viewMode] || VIEW_MODES.Day;
        this._updateConfig();
    }

    _updateConfig() {
        const { duration, scale } = dateUtils.parseDuration(this._viewMode.step);
        this._config = {
            step: duration,
            unit: scale,
            columnWidth: this.options.columnWidth || this._viewMode.columnWidth || 45,
            headerHeight: this.options.upperHeaderHeight + this.options.lowerHeaderHeight + 10,
        };
    }

    _setupTasks(tasks) {
        this.tasks = (tasks || []).map((t, i) => ({
            ...t,
            _start: dateUtils.parse(t.start),
            _end: dateUtils.parse(t.end),
            // Optional baselines (planned vs actual). Rendered when
            // options.baselines === true and both planned dates are present.
            _planned_start: t.planned_start ? dateUtils.parse(t.planned_start) : null,
            _planned_end: t.planned_end ? dateUtils.parse(t.planned_end) : null,
            _index: i,
        }));

        // Warn on duplicate task IDs — they corrupt getBar()/getTask() lookups
        // and used to collide on clipPath IDs (now keyed by _index instead).
        const seenIds = new Set();
        const duplicates = [];
        for (const t of this.tasks) {
            const id = String(t.id);
            if (seenIds.has(id)) duplicates.push(id);
            seenIds.add(id);
        }
        if (duplicates.length > 0) {
            console.warn('CodenziaGantt: duplicate task ids detected — getBar()/getTask() will return only the first match:', duplicates);
        }

        // Build parent-child dependency map (from 'dependencies' field)
        this._parentDepMap = {};
        this.tasks.forEach(t => {
            if (t.dependencies) {
                const deps = String(t.dependencies).split(',').map(s => s.trim()).filter(Boolean);
                deps.forEach(depId => {
                    if (!this._parentDepMap[depId]) this._parentDepMap[depId] = [];
                    this._parentDepMap[depId].push(t.id);
                });
            }
        });

        // Build task-to-task dependency map (from 'task_dependencies' field)
        this._taskDepMap = {};
        this.tasks.forEach(t => {
            if (t.task_dependencies) {
                const deps = String(t.task_dependencies).split(',').map(s => s.trim()).filter(Boolean);
                deps.forEach(depId => {
                    if (!this._taskDepMap[depId]) this._taskDepMap[depId] = [];
                    this._taskDepMap[depId].push(t.id);
                });
            }
        });
    }

    _setupDates() {
        // Find min/max dates from tasks
        let ganttStart = null, ganttEnd = null;
        if (!this.tasks.length) {
            ganttStart = new Date();
            ganttEnd = new Date();
        } else {
            for (const t of this.tasks) {
                if (!ganttStart || t._start < ganttStart) ganttStart = new Date(t._start);
                if (!ganttEnd || t._end > ganttEnd) ganttEnd = new Date(t._end);
            }
        }

        // Align to start of unit
        ganttStart = dateUtils.startOf(ganttStart, this._config.unit);
        ganttEnd = dateUtils.startOf(ganttEnd, this._config.unit);

        // Add padding
        const paddingStr = this._viewMode.padding || '7d';
        const pad = dateUtils.parseDuration(paddingStr);
        this.ganttStart = dateUtils.add(ganttStart, -pad.duration, pad.scale);
        this.ganttEnd = dateUtils.add(ganttEnd, pad.duration, pad.scale);
        this.ganttStart.setHours(0, 0, 0, 0);

        // Build dates array
        this.dates = [];
        let cur = new Date(this.ganttStart);
        while (cur <= this.ganttEnd) {
            this.dates.push(new Date(cur));
            cur = dateUtils.add(cur, this._config.step, this._config.unit);
        }
    }

    // ── Core coordinate helpers ─────────────────────────────────

    get gridWidth() {
        return this.dates.length * this._config.columnWidth;
    }

    get headerHeight() {
        return this._config.headerHeight;
    }

    get rowHeight() {
        return this.options.barHeight + this.options.padding;
    }

    /**
     * Convert a date to an x pixel coordinate.
     * In RTL, returns the position from the RIGHT edge.
     */
    _getX(date) {
        const diff = dateUtils.diff(date, this.ganttStart, this._config.unit) / this._config.step;
        const ltrX = diff * this._config.columnWidth;
        return this.options.rtl ? this.gridWidth - ltrX : ltrX;
    }

    /**
     * Get bar x position (left edge of the rect).
     * In LTR: x = start date position.
     * In RTL: x = end date position (since bar grows leftward visually, but SVG rect grows rightward).
     * Returns null if the task has missing or invalid dates.
     */
    _getBarX(task) {
        if (!task._start || !task._end) return null;

        // Reject inverted ranges (end < start) instead of silently
        // rendering with Math.abs() which produces a misleading bar.
        if (task._end < task._start) return null;

        if (this.options.rtl) {
            return this._getX(task._end);
        }
        return this._getX(task._start);
    }

    _getBarWidth(task) {
        if (!task._start || !task._end || task._end < task._start) return null;

        const startX = this._getX(task._start);
        const endX = this._getX(task._end);
        // abs() because in RTL the x-axis is flipped (end has lower x than start).
        // The date-order check above already prevents abs() from masking a real bug.
        return Math.max(Math.abs(endX - startX), this._config.columnWidth / 2);
    }

    _getY(index) {
        return this.options.padding / 2 + index * this.rowHeight;
    }

    // ── Render ──────────────────────────────────────────────────

    render() {
        this._clear();
        this._computeGridHeight();
        this._setupSVG();
        this._renderGrid();
        this._renderDateHeaders();
        this._renderHighlights();
        this._renderBars();
        this._renderDependencies();
        this._bindEvents();
    }

    _clear() {
        this.$svg.innerHTML = '';
        this.$upperHeader.innerHTML = '';
        this.$lowerHeader.innerHTML = '';
        // Remove old today line/dot
        this.$container.querySelectorAll('.cg-today-line, .cg-today-dot').forEach(el => el.remove());
    }

    _computeGridHeight() {
        const contentHeight = this.options.padding +
            this.rowHeight * this.tasks.length;
        const minHeight = this.options.containerHeight !== 'auto' ? this.options.containerHeight : 0;
        this.gridHeight = Math.max(contentHeight, minHeight);
    }

    _setupSVG() {
        this.$svg.setAttribute('width', this.gridWidth);
        this.$svg.setAttribute('height', this.gridHeight);
        if (this.options.containerHeight === 'auto') {
            this.$container.style.height = (this.gridHeight + this.headerHeight) + 'px';
        }
        this.$header.style.width = this.gridWidth + 'px';

        // SVG layers (connector = parent-child behind bars, arrow = task deps above bars)
        this._layers = {};
        ['grid', 'highlight', 'connector', 'bar', 'arrow'].forEach(name => {
            this._layers[name] = svgCreate('g', { class: `cg-layer-${name}`, append_to: this.$svg });
        });

        // Defs for clip paths and patterns
        this.$defs = svgCreate('defs', { append_to: this.$svg });

        // Hatch pattern for ignored dates
        this.$defs.innerHTML = `<pattern id="cg-hatch" patternUnits="userSpaceOnUse" width="4" height="4">
            <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style="stroke: var(--cg-ignored-hatch); stroke-width: 0.3" />
        </pattern>`;

        // Arrowhead marker for task dependency arrows
        const marker = svgCreate('marker', {
            id: 'cg-arrowhead',
            markerWidth: '8',
            markerHeight: '6',
            refX: '8',
            refY: '3',
            orient: 'auto',
            markerUnits: 'strokeWidth',
            append_to: this.$defs,
        });
        svgCreate('path', {
            d: 'M 0 0 L 8 3 L 0 6 Z',
            class: 'cg-arrowhead-fill',
            append_to: marker,
        });
    }

    // ── Grid ────────────────────────────────────────────────────

    _renderGrid() {
        const gw = this.gridWidth;
        const gh = this.gridHeight;

        // Background
        svgCreate('rect', {
            x: 0, y: 0, width: gw, height: gh,
            class: 'cg-grid-bg',
            append_to: this._layers.grid,
        });

        // Rows
        let rowIndex = 0;
        for (let y = 0; y < gh; y += this.rowHeight) {
            svgCreate('rect', {
                x: 0, y, width: gw, height: this.rowHeight,
                class: rowIndex % 2 === 0 ? 'cg-row' : 'cg-row-even',
                append_to: this._layers.grid,
            });
            rowIndex++;
        }

        // Horizontal lines
        for (let y = this.rowHeight; y < gh; y += this.rowHeight) {
            svgCreate('line', {
                x1: 0, y1: y, x2: gw, y2: y,
                class: 'cg-row-line',
                append_to: this._layers.grid,
            });
        }

        // Vertical ticks
        let tickLtrX = 0;
        for (const date of this.dates) {
            const colW = this._config.columnWidth;
            const drawX = this.options.rtl ? gw - tickLtrX - colW : tickLtrX;

            const isThick = this._viewMode.thickLine && this._viewMode.thickLine(date);
            svgCreate('line', {
                x1: drawX, y1: 0, x2: drawX, y2: gh,
                class: isThick ? 'cg-tick-thick' : 'cg-tick',
                append_to: this._layers.grid,
            });

            tickLtrX += colW;
        }
    }

    // ── Date Headers ────────────────────────────────────────────

    _renderDateHeaders() {
        let lastDate = null;
        let ltrX = 0;

        for (const date of this.dates) {
            const colW = this._config.columnWidth;
            const x = this.options.rtl ? this.gridWidth - ltrX - colW : ltrX;

            // Lower text (day numbers, week ranges, month names)
            const lowerText = typeof this._viewMode.lowerText === 'function'
                ? this._viewMode.lowerText(date, lastDate, this.options.language)
                : dateUtils.format(date, this._viewMode.lowerText, this.options.language);

            if (lowerText) {
                const formattedDate = sanitize(dateUtils.format(date, this._viewMode.dateFormat, this.options.language));
                const el = document.createElement('div');
                el.className = `cg-lower-text cg-date-${formattedDate}`;
                if (this.options.rtl) {
                    el.style.right = (this.gridWidth - x - colW) + 'px';
                    el.style.left = 'auto';
                } else {
                    el.style.left = x + 'px';
                }
                el.style.width = colW + 'px';
                el.innerText = lowerText;
                this.$lowerHeader.appendChild(el);
            }

            // Upper text (month names, years)
            const upperText = typeof this._viewMode.upperText === 'function'
                ? this._viewMode.upperText(date, lastDate, this.options.language)
                : '';

            if (upperText) {
                const el = document.createElement('div');
                el.className = 'cg-upper-text';
                if (this.options.rtl) {
                    // Position text so it ends at x + colW (right edge of column)
                    el.style.right = (this.gridWidth - x - colW) + 'px';
                    el.style.left = 'auto';
                } else {
                    el.style.left = x + 'px';
                }
                el.innerText = upperText;
                this.$upperHeader.appendChild(el);
            }

            lastDate = date;
            ltrX += colW;
        }
    }

    // ── Highlights ──────────────────────────────────────────────

    _renderHighlights() {
        this._renderWeekends();
        this._renderIgnoredDates();
        this._renderTodayLine();
    }

    _renderWeekends() {
        const dayWidth = this._config.columnWidth /
            dateUtils.convertScales(this._viewMode.step, 'day');

        for (let d = new Date(this.ganttStart); d <= this.ganttEnd; d.setDate(d.getDate() + 1)) {
            if (!this.options.isWeekend(d)) continue;

            const diffUnits = dateUtils.diff(d, this.ganttStart, this._config.unit) / this._config.step;
            let x = diffUnits * this._config.columnWidth;
            if (this.options.rtl) x = this.gridWidth - x - dayWidth;

            svgCreate('rect', {
                x: Math.round(x), y: 0,
                width: dayWidth, height: this.gridHeight,
                class: 'cg-weekend',
                append_to: this._layers.highlight,
            });
        }
    }

    _renderIgnoredDates() {
        this._ignoredPositions = [];
        const dayWidth = this._config.columnWidth /
            dateUtils.convertScales(this._viewMode.step, 'day');

        for (let d = new Date(this.ganttStart); d <= this.ganttEnd; d.setDate(d.getDate() + 1)) {
            const isIgnored = this.options.ignoredDates.some(id => id.getTime() === d.getTime()) ||
                (this.options.ignoredFunction && this.options.ignoredFunction(d));
            if (!isIgnored) continue;

            const diffDays = dateUtils.convertScales(dateUtils.diff(d, this.ganttStart) + 'd', this._config.unit) / this._config.step;
            let x = diffDays * this._config.columnWidth;
            if (this.options.rtl) x = this.gridWidth - x - this._config.columnWidth;

            this._ignoredPositions.push(x);
            svgCreate('rect', {
                x, y: 0,
                width: this._config.columnWidth, height: this.gridHeight,
                class: 'cg-ignored',
                append_to: this._layers.highlight,
            });
        }
    }

    _renderTodayLine() {
        const today = dateUtils.today();
        if (today < this.ganttStart || today > this.ganttEnd) return;

        const left = this._getX(today);

        // Vertical line in SVG
        svgCreate('line', {
            x1: left, y1: 0, x2: left, y2: this.gridHeight,
            class: 'cg-today-line-svg',
            append_to: this._layers.highlight,
        });

        // Dot at header — RTL flips the anchor side.
        const dot = document.createElement('div');
        dot.className = 'cg-today-dot';
        if (this.options.rtl) {
            dot.style.right = (this.gridWidth - left - 4) + 'px';
            dot.style.left = 'auto';
        } else {
            dot.style.left = (left - 4) + 'px';
        }
        dot.style.bottom = '0';
        this.$header.appendChild(dot);

        // Mark current date in lower header
        const formattedToday = sanitize(dateUtils.format(today, this._viewMode.dateFormat, this.options.language));
        const dateEl = this.$lowerHeader.querySelector(`.cg-date-${formattedToday}`);
        if (dateEl) dateEl.classList.add('cg-current-date');
    }

    // ── Bars ────────────────────────────────────────────────────

    _renderBars() {
        this._bars = [];
        for (const task of this.tasks) {
            const bar = this._renderBar(task);
            if (bar) this._bars.push(bar);
        }
    }

    _renderBar(task) {
        let x = this._getBarX(task);
        const y = this._getY(task._index);
        let width = this._getBarWidth(task);
        const height = this.options.barHeight;
        const r = Math.min(this.options.barCornerRadius, height / 2);
        const isRtl = this.options.rtl;

        // Skip tasks with missing or inverted dates (returned by getters as null).
        if (x === null || width === null) return null;

        // Clamp bar within grid boundaries
        if (x < 0) { width += x; x = 0; }
        if (x + width > this.gridWidth) { width = this.gridWidth - x; }
        if (width < 0) return null;

        // Use the array index for unique DOM ids — duplicate task.id values
        // would otherwise collide on clipPath IDs and bar lookups.
        const uid = task._index;

        // Group wrapper
        const group = svgCreate('g', {
            class: 'cg-bar-group',
            'data-id': task.id,
            'data-uid': uid,
            append_to: this._layers.bar,
        });

        // Optional baseline (planned vs actual). Rendered as a thin,
        // outlined rect above the main bar, sharing the y-band so the
        // visual variance between planned and actual is easy to read.
        if (this.options.baselines && task._planned_start && task._planned_end
            && task._planned_end >= task._planned_start) {
            const pStart = this._getX(task._planned_start);
            const pEnd = this._getX(task._planned_end);
            let pX = isRtl ? pEnd : pStart;
            let pWidth = Math.abs(pEnd - pStart);
            // Clamp to grid
            if (pX < 0) { pWidth += pX; pX = 0; }
            if (pX + pWidth > this.gridWidth) pWidth = this.gridWidth - pX;
            if (pWidth > 0) {
                const baselineHeight = 6;
                const baselineY = y - baselineHeight - 2;
                svgCreate('rect', {
                    x: pX,
                    y: baselineY,
                    width: pWidth,
                    height: baselineHeight,
                    rx: 2,
                    ry: 2,
                    class: 'cg-bar-baseline',
                    append_to: group,
                });
            }
        }

        // Bar background (with opacity for status color)
        const bar = svgCreate('rect', {
            x, y, width, height, rx: r, ry: r,
            class: 'cg-bar',
            append_to: group,
        });
        if (task.color) {
            bar.style.fill = task.color;
            bar.style.opacity = '0.35';
        }

        // Progress overlay (darker, full opacity)
        const progress = Math.min(Math.max(task.progress || 0, 0), 100);
        if (progress > 0) {
            const progressWidth = (width * progress) / 100;
            const progressX = isRtl ? x + width - progressWidth : x;
            const progressBar = svgCreate('rect', {
                x: progressX, y, width: progressWidth, height, rx: r, ry: r,
                class: 'cg-bar-progress',
                append_to: group,
            });
            if (task.color) {
                progressBar.style.fill = task.color;
                progressBar.style.filter = 'brightness(0.75)';
            }
        }

        // Label first, then avatar after the text
        // LTR: [label text...] [avatar]
        // RTL: [avatar] [...label text]
        const labelPad = 12;
        const avatarSize = 22;
        const avatarGap = 8;

        // Label position
        const labelX = isRtl ? x + width - labelPad : x + labelPad;

        // Clip group to bar boundaries so text doesn't overflow.
        // Index-based uid avoids collisions when multiple tasks share an id.
        const clipBarId = `cg-bar-clip-${uid}`;
        const clipBar = svgCreate('clipPath', { id: clipBarId, append_to: this.$defs });
        svgCreate('rect', { x, y, width, height, rx: r, ry: r, append_to: clipBar });

        const labelGroup = svgCreate('g', {
            clipPath: clipBarId,
            append_to: group,
        });

        const label = svgCreate('text', {
            x: labelX,
            y: y + height / 2,
            innerHTML: task.name,
            class: 'cg-bar-label',
            'text-anchor': isRtl ? 'end' : 'start',
            'direction': 'ltr',
            append_to: labelGroup,
        });

        // Avatar — positioned after the label text.
        // getBBox() can return zero-width on detached/un-rendered SVG text
        // in some browsers (Firefox especially). Defer measurement to
        // requestAnimationFrame so the text is in the DOM and laid out;
        // adjust the avatar position once we have a real width.
        if (task.avatar) {
            // Estimate width up-front so the avatar lands close to its final
            // position even if rAF doesn't fire (e.g. tab background).
            const estimatedTextWidth = Math.min((task.name || '').length * 7, width - labelPad * 2 - avatarSize - avatarGap);
            const initialBBox = (label.getBBox ? label.getBBox() : null) || { width: estimatedTextWidth };
            const computeAvatarX = (textWidth) => isRtl
                ? labelX - textWidth - avatarGap - avatarSize
                : labelX + textWidth + avatarGap;

            const avatarY = y + (height - avatarSize) / 2;

            // Clip path for circular avatar
            const clipId = `cg-avatar-${uid}`;
            const clipPath = svgCreate('clipPath', { id: clipId, append_to: this.$defs });
            const clipCircle = svgCreate('circle', {
                cx: computeAvatarX(initialBBox.width) + avatarSize / 2,
                cy: avatarY + avatarSize / 2,
                r: avatarSize / 2,
                append_to: clipPath,
            });

            const avatarImage = svgCreate('image', {
                x: computeAvatarX(initialBBox.width),
                y: avatarY,
                width: avatarSize,
                height: avatarSize,
                href: task.avatar,
                class: 'cg-bar-avatar',
                clipPath: clipId,
                append_to: labelGroup,
            });

            requestAnimationFrame(() => {
                if (!label.getBBox) return;
                const realBBox = label.getBBox();
                if (!realBBox.width || realBBox.width === initialBBox.width) return;
                const finalX = computeAvatarX(realBBox.width);
                avatarImage.setAttribute('x', finalX);
                clipCircle.setAttribute('cx', finalX + avatarSize / 2);
            });
        }

        return { task, group, bar, x, y, width, height };
    }

    // ── Dependencies ────────────────────────────────────────────

    _renderDependencies() {
        this._renderParentChildConnectors();
        this._renderTaskDependencyArrows();
    }

    // ── Parent-child bracket connectors ──

    _renderParentChildConnectors() {
        // Group children by parent ID
        const parentGroups = {};
        for (const task of this.tasks) {
            if (!task.dependencies) continue;
            const parentId = String(task.dependencies).trim();
            if (parentId === String(task.id)) continue;
            if (!parentGroups[parentId]) parentGroups[parentId] = [];
            parentGroups[parentId].push(task);
        }

        // Render a bracket for each parent with visible children
        for (const parentId of Object.keys(parentGroups)) {
            const parentBar = this._bars.find(b => String(b.task.id) === parentId);
            if (!parentBar) continue;

            const childBars = parentGroups[parentId]
                .map(child => this._bars.find(b => String(b.task.id) === String(child.id)))
                .filter(Boolean);
            if (!childBars.length) continue;

            this._renderBracket(parentBar, childBars);
        }
    }

    _renderBracket(parentBar, childBars) {
        const isRtl = this.options.rtl;
        const tickLen = 10;

        // Vertical line X: positioned just before the leftmost (LTR) / after rightmost (RTL) bar edge
        const allBars = [parentBar, ...childBars];
        const lineX = isRtl
            ? Math.max(...allBars.map(b => b.x + b.width)) + 14
            : Math.min(...allBars.map(b => b.x)) - 14;

        // Vertical span: from parent bar center to last child bar center
        const topY = parentBar.y + parentBar.height / 2;
        const bottomY = childBars[childBars.length - 1].y + childBars[childBars.length - 1].height / 2;

        // Vertical line
        svgCreate('line', {
            x1: lineX, y1: topY,
            x2: lineX, y2: bottomY,
            class: 'cg-parent-line',
            append_to: this._layers.arrow,
        });

        // Horizontal tick from vertical line to parent bar
        const parentTickEnd = isRtl ? parentBar.x + parentBar.width + 4 : parentBar.x - 4;
        svgCreate('line', {
            x1: lineX, y1: topY,
            x2: parentTickEnd, y2: topY,
            class: 'cg-parent-line',
            append_to: this._layers.arrow,
        });

        // Horizontal ticks from vertical line to each child bar
        for (const child of childBars) {
            const childY = child.y + child.height / 2;
            const childTickEnd = isRtl ? child.x + child.width + 4 : child.x - 4;

            svgCreate('line', {
                x1: lineX, y1: childY,
                x2: childTickEnd, y2: childY,
                class: 'cg-parent-line',
                append_to: this._layers.arrow,
            });

            // Dot at child endpoint
            svgCreate('circle', {
                cx: childTickEnd, cy: childY, r: 3,
                class: 'cg-parent-dot',
                append_to: this._layers.arrow,
            });
        }
    }

    // ── Task-to-task dependency arrows (solid, above bars) ──

    _renderTaskDependencyArrows() {
        for (const task of this.tasks) {
            if (!task.task_dependencies) continue;
            const deps = String(task.task_dependencies).split(',').map(s => s.trim()).filter(Boolean);
            for (const depId of deps) {
                if (String(depId) === String(task.id)) continue;
                const fromBar = this._bars.find(b => String(b.task.id) === String(depId));
                const toBar = this._bars.find(b => String(b.task.id) === String(task.id));
                if (fromBar && toBar) {
                    this._renderTaskDepArrow(fromBar, toBar);
                }
            }
        }
    }

    _renderTaskDepArrow(from, to) {
        const isRtl = this.options.rtl;

        // Start: end edge of "from" bar, vertically centered
        const startX = isRtl ? from.x - 2 : from.x + from.width + 2;
        const startY = from.y + from.height / 2;

        // End: start edge of "to" bar, vertically centered
        const endX = isRtl ? to.x + to.width + 2 : to.x - 2;
        const endY = to.y + to.height / 2;

        // S-curve using cubic bezier
        const dx = endX - startX;
        const cp1x = startX + dx * 0.4;
        const cp2x = endX - dx * 0.4;

        const path = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;

        svgCreate('path', {
            d: path,
            class: 'cg-dep-arrow',
            'marker-end': 'url(#cg-arrowhead)',
            append_to: this._layers.arrow,
        });
    }

    // ── Events ──────────────────────────────────────────────────

    _bindEvents() {
        if (!this.options.onClick) return;
        const self = this;

        this._bars.forEach(bar => {
            let startX = 0, startY = 0;

            bar.group.style.cursor = 'pointer';

            bar.group.addEventListener('mousedown', e => {
                startX = e.clientX;
                startY = e.clientY;
            });

            bar.group.addEventListener('mouseup', e => {
                const dx = Math.abs(e.clientX - startX);
                const dy = Math.abs(e.clientY - startY);
                if (dx > 5 || dy > 5) return;

                e.stopPropagation();
                self.options.onClick(bar.task, bar.group, e);
            });
        });
    }

    // ── Public API ──────────────────────────────────────────────

    changeViewMode(mode) {
        if (!VIEW_MODES[mode]) return;
        this._viewMode = VIEW_MODES[mode];
        this._updateConfig();
        this._setupDates();
        this.render();
        requestAnimationFrame(() => this.scrollTo(this.options.scrollTo || 'today'));
    }

    scrollTo(target) {
        if (!target) return;

        let date;
        if (target === 'today') {
            date = dateUtils.today();
        } else if (target === 'start') {
            date = this.ganttStart;
        } else if (target === 'end') {
            date = this.ganttEnd;
        } else if (typeof target === 'string') {
            date = dateUtils.parse(target);
        } else if (target instanceof Date) {
            date = target;
        } else {
            return;
        }

        if (date < this.ganttStart || date > this.ganttEnd) {
            const scrollEl = this._getScrollParent();
            // Scroll to the start of the timeline
            const startX = this._getX(this.ganttStart);
            scrollEl.scrollLeft = Math.max(0, startX - scrollEl.clientWidth / 2);
            return;
        }

        const scrollEl = this._getScrollParent();

        // _getX gives the pixel position of the date in the SVG
        // In LTR: early dates have small x, late dates have large x
        // In RTL: early dates have large x, late dates have small x
        const targetX = this._getX(date);

        // Scroll so targetX is centered in the viewport
        const scrollPos = targetX - scrollEl.clientWidth / 2;

        scrollEl.scrollTo({
            left: Math.max(0, scrollPos),
            behavior: 'smooth',
        });
    }

    scrollToCurrent() {
        this.scrollTo('today');
    }

    refresh(tasks) {
        this._setupTasks(tasks);
        this._setupDates();
        this.render();
    }

    /**
     * Export the chart SVG to a PNG data URL. Returns a Promise resolving
     * to the data URL string, or null if the chart has no SVG yet.
     *
     * Renders the SVG into an off-screen canvas at the requested DPR.
     * Note: SVG <foreignObject> nodes (none here) wouldn't render; we
     * only use native SVG primitives so the export is faithful.
     *
     * @param {object} [options]
     * @param {number} [options.scale=2]      DPR multiplier for sharper output.
     * @param {string} [options.background]   Optional fill color (e.g. '#ffffff').
     * @returns {Promise<string|null>}
     */
    async exportPNG({ scale = 2, background = null } = {}) {
        if (!this.$svg) return null;

        // Clone the SVG so we can serialize it without disturbing the live tree.
        const clone = this.$svg.cloneNode(true);
        const w = this.$svg.viewBox.baseVal.width || this.$svg.clientWidth || this.gridWidth;
        const h = this.$svg.viewBox.baseVal.height || this.$svg.clientHeight || this.gridHeight;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', String(w));
        clone.setAttribute('height', String(h));

        const xml = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        try {
            const img = await new Promise((resolve, reject) => {
                const im = new Image();
                im.onload = () => resolve(im);
                im.onerror = reject;
                im.src = url;
            });

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');

            if (background) {
                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            return canvas.toDataURL('image/png');
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    destroy() {
        // Notify external consumers (e.g. Alpine wrappers) so they can
        // tear down their own window/document listeners. The parent
        // is the right scope because the gantt instance is one-per-parent.
        if (this.$parent) {
            this.$parent.dispatchEvent(new CustomEvent('codenzia-gantt:destroy', {
                bubbles: false,
                detail: { instance: this },
            }));
            this.$parent.innerHTML = '';
        }
        this.$container = null;
        this.$svg = null;
        this.$header = null;
        this._bars = [];
        this.tasks = [];
    }

    _getScrollParent() {
        // Find the nearest scrollable ancestor of the container
        let el = this.$container.parentElement;
        while (el) {
            const style = getComputedStyle(el);
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') return el;
            el = el.parentElement;
        }
        return this.$container;
    }

    // ── Getters for external use ────────────────────────────────

    getTask(id) {
        return this.tasks.find(t => String(t.id) === String(id));
    }

    getBar(id) {
        return this._bars.find(b => String(b.task.id) === String(id));
    }
}

// Expose globally for Alpine/Livewire usage. The class is exported under
// both names — `FilamentGanttLite` (canonical for this package) and
// `CodenziaGantt` (compatibility with the Rubix/PMO origin codebase).
window.FilamentGanttLite = CodenziaGantt;
window.CodenziaGantt = window.CodenziaGantt || CodenziaGantt;
