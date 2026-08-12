/*
 * Copyright 2026
 *
 * Date-only helpers used to select ResMed BRP files before their large EDF
 * payloads are read. Kept independent from the UI so the selection rules can
 * be tested without a browser.
 */
(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.GlasgowFileSelection = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function compactDateToISO(value) {
        if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return null;

        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(4, 6));
        const day = Number(value.slice(6, 8));
        const candidate = new Date(Date.UTC(year, month - 1, day));

        if (candidate.getUTCFullYear() !== year ||
            candidate.getUTCMonth() !== month - 1 ||
            candidate.getUTCDate() !== day) {
            return null;
        }

        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }

    function isISODate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        return compactDateToISO(value.replace(/-/g, '')) === value;
    }

    function addDays(date, amount) {
        if (!isISODate(date)) return null;

        const [year, month, day] = date.split('-').map(Number);
        const result = new Date(Date.UTC(year, month - 1, day + amount));
        return [
            result.getUTCFullYear(),
            String(result.getUTCMonth() + 1).padStart(2, '0'),
            String(result.getUTCDate()).padStart(2, '0')
        ].join('-');
    }

    function getRelativePath(file) {
        return String(
            (file && (file.webkitRelativePath || file._relativePath || file.relativePath)) || ''
        ).replace(/\\/g, '/');
    }

    function getFolderNightDate(file) {
        const path = getRelativePath(file);
        if (!path) return null;

        const segments = path.split('/').filter(Boolean);
        const directorySegments = segments.slice(0, -1);

        for (const segment of directorySegments) {
            const date = compactDateToISO(segment);
            if (date) return date;
        }

        // Also support the DATALOG/YYYY/MMDD layout used by some backups.
        for (let index = 0; index < directorySegments.length - 1; index++) {
            if (/^\d{4}$/.test(directorySegments[index]) && /^\d{4}$/.test(directorySegments[index + 1])) {
                const date = compactDateToISO(directorySegments[index] + directorySegments[index + 1]);
                if (date) return date;
            }
        }

        return null;
    }

    function getFileSleepNightDate(file) {
        const folderDate = getFolderNightDate(file);
        if (folderDate) return folderDate;

        const fileName = String((file && file.name) || '');
        const match = fileName.match(/(\d{8})_(\d{6})_BRP\.edf$/i);
        if (!match) return null;

        const sessionDate = compactDateToISO(match[1]);
        if (!sessionDate) return null;

        const hour = Number(match[2].slice(0, 2));
        if (hour > 23) return null;

        // Match the analyzer's existing sleep-night rule for individual files:
        // sessions before noon belong to the previous night.
        return hour < 12 ? addDays(sessionDate, -1) : sessionDate;
    }

    function getNightCoverage(files) {
        const dates = [];
        const undatedFiles = [];

        (files || []).forEach(file => {
            const date = getFileSleepNightDate(file);
            if (date) {
                dates.push(date);
            } else {
                undatedFiles.push(file);
            }
        });

        const uniqueDates = [...new Set(dates)].sort();
        return {
            dates: uniqueDates,
            firstDate: uniqueDates.length ? uniqueDates[0] : null,
            lastDate: uniqueDates.length ? uniqueDates[uniqueDates.length - 1] : null,
            undatedFiles
        };
    }

    function selectFilesByDateRange(files, startDate, endDate) {
        if (!isISODate(startDate) || !isISODate(endDate)) {
            throw new Error('Choose a valid start and end date.');
        }
        if (startDate > endDate) {
            throw new Error('The start date must be on or before the end date.');
        }

        const includedFiles = [];
        const outsideRangeFiles = [];
        const undatedFiles = [];

        (files || []).forEach(file => {
            const date = getFileSleepNightDate(file);
            if (!date) {
                undatedFiles.push(file);
            } else if (date >= startDate && date <= endDate) {
                includedFiles.push(file);
            } else {
                outsideRangeFiles.push(file);
            }
        });

        return { includedFiles, outsideRangeFiles, undatedFiles };
    }

    return {
        addDays,
        compactDateToISO,
        getFileSleepNightDate,
        getFolderNightDate,
        getNightCoverage,
        isISODate,
        selectFilesByDateRange
    };
}));
