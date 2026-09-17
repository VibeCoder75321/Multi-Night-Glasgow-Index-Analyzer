const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const selection = require('../DateRangeFilter.js');

// Run the actual page functions, capturing the Chart.js configuration and DOM
// output without requiring a CDN or uploading patient data.
const html = fs.readFileSync(path.join(__dirname, '../multi_night_analyzer.html'), 'utf8');
const script = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];

function loadPage() {
    const elements = new Map();
    const charts = {};
    const blobs = [];
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            value: '', checked: false, innerHTML: '', children: [], style: {},
            addEventListener() {},
            getContext() { return id; },
            appendChild(child) { this.children.push(child); },
            removeChild() {}, setAttribute() {}, click() {}, download: ''
        });
        return elements.get(id);
    }
    element('dateRangeSelect').value = 'all';
    element('smoothingSelect').value = 'none';
    element('comp_skew').checked = true;
    const page = vm.createContext({
        Date, console, GlasgowFileSelection: selection, Blob,
        URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; } },
        document: {
            getElementById: element,
            createElement: () => ({ style: {}, download: '', setAttribute() {}, click() {} }),
            body: element('body')
        },
        setTimeout(callback) { callback(); },
        Chart: function (id, config) {
            charts[id] = config;
            this.destroy = () => {};
        }
    });
    page.window = page;
    vm.runInContext(script, page);
    return { page, element, charts, blobs };
}

function nights(dates) {
    return dates.map((date, index) => ({
        date, startTime: '22:00', duration: 6, sessions: 1,
        machineType: 'Test', ipap: 'N/A', epap: 'N/A', pressureSupport: 'N/A',
        easyBreathe: 'N/A', riseTime: 'N/A', trigger: 'N/A', cycle: 'N/A',
        weightedGI: Object.fromEntries([
            'overall', 'skew', 'spike', 'flatTop', 'topHeavy', 'multiPeak',
            'noPause', 'inspirRate', 'multiBreath', 'ampVar'
        ].map(name => [name, (index + 1) / 10]))
    }));
}

for (const timezone of ['UTC', 'America/Los_Angeles', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
    test(`chart and table dates agree in ${timezone}`, async () => {
        const previousTZ = process.env.TZ;
        process.env.TZ = timezone;
        try {
            const { page, element, charts, blobs } = loadPage();
            const dates = ['2025-09-01', '2025-09-02', '2025-09-03'];
            const data = nights(dates);
            page.createTrendsChart(data);
            page.createComponentsChart(data);
            page.createResultsTable(data);

            assert.equal(element('customStartDate').value, dates[0]);
            assert.equal(element('customEndDate').value, dates[2]);
            assert.equal(element('customStartDate').max, dates[2]);
            assert.equal(element('customEndDate').min, dates[0]);

            for (const chart of Object.values(charts)) {
                assert.deepEqual(chart.data.labels, dates);
                const tick = chart.options.scales.x.ticks.callback;
                const labels = dates.map((date, i) => tick.call({ getLabelForValue: () => date }, i));
                assert.deepEqual(labels, ['Sep 1', 'Sep 2', 'Sep 3']);
                assert.equal(chart.options.plugins.tooltip.callbacks.title([{ label: dates[0] }]), 'Night: 2025-09-01');
            }
            const rows = element('resultsTableBody').children;
            dates.forEach((date, i) => assert.ok(rows[i].innerHTML.includes(`<td>${date}</td>`)));
            page.exportNightlyCSV();
            const csv = await blobs[0].text();
            dates.forEach(date => assert.ok(csv.includes(`"${date}"`)));

            element('dateRangeSelect').value = 'custom';
            element('customStartDate').value = dates[0];
            element('customEndDate').value = dates[1];
            page.updateAllCharts();
            for (const chart of Object.values(charts)) {
                assert.deepEqual(chart.data.labels, dates.slice(0, 2));
                assert.ok(chart.options.plugins.title.text.includes('Custom: Sep 1, 2025 to Sep 2, 2025'));
            }

            // Month/year boundaries, leap day, and both US DST transitions.
            for (const [start, end] of [
                ['2025-08-31', '2025-09-01'], ['2025-12-31', '2026-01-01'],
                ['2024-02-29', '2024-03-01'], ['2025-03-08', '2025-03-09'],
                ['2025-11-01', '2025-11-02']
            ]) {
                element('customStartDate').value = start;
                element('customEndDate').value = end;
                const boundaryData = nights([selection.addDays(start, -1), start, end, selection.addDays(end, 1)]);
                assert.deepEqual(page.filterByDateRange(boundaryData, 'custom').map(n => n.date), [start, end]);
                element('customStartDate').value = end;
                assert.deepEqual(page.filterByDateRange(boundaryData, 'custom').map(n => n.date), [end]);
            }
            assert.equal(page.formatDateLabel('2024-02-29'), 'Feb 29, 2024');
            assert.equal(page.formatDateLabel('2026-01-01', false), 'Jan 1');

            // A date-only cutoff includes that night even when the current time
            // is later in the day. Fix the clock to cross the spring DST change.
            const RealDate = Date;
            page.Date = class extends RealDate {
                constructor(...args) { super(...(args.length ? args : [2025, 2, 10, 18])); }
            };
            assert.deepEqual(page.filterByDateRange(nights(['2025-03-08', '2025-03-09', '2025-03-10']), '1').map(n => n.date), ['2025-03-09', '2025-03-10']);
        } finally {
            if (previousTZ === undefined) delete process.env.TZ;
            else process.env.TZ = previousTZ;
        }
    });
}
