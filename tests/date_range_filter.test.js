const test = require('node:test');
const assert = require('node:assert/strict');

const selection = require('../DateRangeFilter.js');

function file(name, webkitRelativePath = '') {
    return { name, webkitRelativePath };
}

test('uses the SD-card folder as the authoritative sleep-night date', () => {
    const brp = file(
        '20250820_021500_BRP.edf',
        'RESMED/DATALOG/20250819/20250820_021500_BRP.edf'
    );

    assert.equal(selection.getFolderNightDate(brp), '2025-08-19');
    assert.equal(selection.getFileSleepNightDate(brp), '2025-08-19');
});

test('supports DATALOG folders split into year and month-day', () => {
    const brp = file(
        '20250820_021500_BRP.edf',
        'Backup/DATALOG/2025/0819/20250820_021500_BRP.edf'
    );

    assert.equal(selection.getFolderNightDate(brp), '2025-08-19');
});

test('applies the existing before-noon rule to individual files', () => {
    assert.equal(
        selection.getFileSleepNightDate(file('20260301_071500_BRP.edf')),
        '2026-02-28'
    );
    assert.equal(
        selection.getFileSleepNightDate(file('20260301_221500_BRP.edf')),
        '2026-03-01'
    );
});

test('calculates recent-day presets with UTC-safe date arithmetic', () => {
    assert.equal(selection.addDays('2026-03-01', -29), '2026-01-31');
    assert.equal(selection.addDays('2024-03-01', -1), '2024-02-29');
});

test('rejects impossible dates and invalid session hours', () => {
    assert.equal(selection.getFileSleepNightDate(file('20260230_221500_BRP.edf')), null);
    assert.equal(selection.getFileSleepNightDate(file('20260228_251500_BRP.edf')), null);
});

test('reports available nights and files that cannot be dated', () => {
    const files = [
        file('20250821_220000_BRP.edf'),
        file('20250820_220000_BRP.edf'),
        file('20250821_230000_BRP.edf'),
        file('renamed_BRP.edf')
    ];

    assert.deepEqual(selection.getNightCoverage(files), {
        dates: ['2025-08-20', '2025-08-21'],
        firstDate: '2025-08-20',
        lastDate: '2025-08-21',
        undatedFiles: [files[3]]
    });
});

test('selects an inclusive date range before processing', () => {
    const files = [
        file('20250819_220000_BRP.edf'),
        file('20250820_220000_BRP.edf'),
        file('20250821_220000_BRP.edf'),
        file('renamed_BRP.edf')
    ];

    const result = selection.selectFilesByDateRange(files, '2025-08-20', '2025-08-21');

    assert.deepEqual(result.includedFiles, [files[1], files[2]]);
    assert.deepEqual(result.outsideRangeFiles, [files[0]]);
    assert.deepEqual(result.undatedFiles, [files[3]]);
});

test('requires a complete, ordered date range', () => {
    assert.throws(
        () => selection.selectFilesByDateRange([], '', '2025-08-21'),
        /valid start and end date/
    );
    assert.throws(
        () => selection.selectFilesByDateRange([], '2025-08-22', '2025-08-21'),
        /start date must be on or before the end date/
    );
});
