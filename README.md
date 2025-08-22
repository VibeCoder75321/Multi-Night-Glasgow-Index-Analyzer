# Multi-Night Glasgow Index Analyzer

A comprehensive tool for analyzing multiple nights of ResMed PAP data to calculate weighted averages of Glasgow Index components and track trends over time.

## Features

- **Multi-Night Analysis**: Process multiple EDF files from different nights automatically
- **Weighted Averages**: Calculate proper weighted averages when multiple sessions exist per night
- **Trend Visualization**: Interactive charts showing Glasgow Index trends over time
- **Component Analysis**: Detailed breakdown of all 9 Glasgow Index components
- **Export Capabilities**: Export results to CSV or JSON formats
- **Web-based interface**: (`multi_night_analyzer.html`)


## Glasgow Index Components

The tool analyzes 9 key components of flow limitations:

1. **Skew**: Asymmetrical inspiration flow patterns
2. **Spike**: Unexpectedly narrow, tall inspirations
3. **Flat Top**: Plateau-shaped inspiration peaks
4. **Top Heavy**: Inspirations spending too much time at high flow rates
5. **Multi Peak**: Multiple peaks within single inspirations
6. **No Pause**: Missing pause between expiration and next inspiration
7. **Inspir Rate**: Elevated inspiration rate (>20/min)
8. **Multi Breath**: Multiple inspirations per expiration
9. **Variable Amp**: Inconsistent inspiration amplitude

## Installation & Setup

### Web Interface

1. Place all files in the same directory:
   - `multi_night_analyzer.html`
   - `EDFFile.js`
   - `FlowLimits.js`

2. Open `multi_night_analyzer.html` in a modern web browser

3. Select multiple BRP.edf files or drag and drop them onto the interface



## Usage

### Data Requirements

The tool processes ResMed EDF files with the naming convention:
- `YYYYMMDD_HHMMSS_BRP.edf` (breathing/flow data files)

These files are typically found on your ResMed SD card in:
- `DATALOG/YYYY/MMDD/` folders

Or in OSCAR backup directories:
- `Profiles/[Profile]/ResMed_[Serial]/Backup/DATALOG/YYYY/`

### Web Interface Usage

1. **File Selection**: 
   - Click "Select Files" or drag and drop BRP.edf files
   - The tool will automatically filter for breathing data files

2. **Processing**: 
   - Files are processed automatically after selection
   - Progress is shown with a progress bar

3. **Results**:
   - Summary cards show key statistics
   - Interactive trend charts display Glasgow Index over time
   - Detailed table shows all components for each night

### Desktop Application Usage

1. **File Selection**:
   - Use "Select Folder" to process all EDF files in a directory tree
   - Use "Select Files" to choose individual files

2. **Analysis**:
   - Click "Analyze" to process selected files
   - Progress is shown in the status bar

3. **Results**:
   - **Summary Tab**: Overview statistics and component averages
   - **Trends Tab**: Interactive matplotlib charts
   - **Details Tab**: Comprehensive results table

4. **Export**:
   - Export to CSV for spreadsheet analysis
   - Export to JSON for programmatic use

## Understanding Results

### Glasgow Index Interpretation

- **0.0 - 0.2**: Excellent breathing quality
- **0.2 - 1.0**: Good breathing quality  
- **1.0 - 2.0**: Fair breathing quality (minor flow limitations)
- **2.0 - 3.0**: Poor breathing quality (significant flow limitations)
- **3.0+**: Very poor breathing quality (severe flow limitations)

### Night Grouping Logic

The tool intelligently groups sessions into sleep nights based on start time:

- **Evening sessions (6:00 PM - 11:59 PM)**: Belong to the current calendar date's sleep night
- **Morning sessions (12:00 AM - 11:59 AM)**: Belong to the **previous** calendar date's sleep night  
- **Afternoon sessions (12:00 PM - 5:59 PM)**: Belong to the current calendar date (unusual timing)

**Example**: 
- Session starting 10:30 PM on Aug 19 → "Aug 19 night"
- Session starting 2:15 AM on Aug 20 → "Aug 19 night" (same sleep period)
- Session starting 6:45 AM on Aug 20 → "Aug 19 night" (same sleep period)

This ensures that sleep sessions crossing midnight are properly grouped as a single night.

### Weighted Averages

When multiple sessions exist for a single sleep night, the tool calculates duration-weighted averages:

```
Weighted GI = Σ(Session_GI × Session_Duration) / Total_Duration
```

This ensures longer sessions have appropriate influence on the nightly average.

### Trend Analysis

Use the trend charts to identify:
- **Overall improvement/deterioration** in breathing quality
- **Seasonal patterns** or therapy adjustments
- **Component-specific issues** that may need attention
- **Correlation with therapy changes** (pressure, EPR, etc.)

## Therapy Optimization

The tool can help identify how changes impact your Glasgow Index:

### Pressure Support (EPR) Analysis
- Compare nights with different EPR settings
- Higher EPR often reduces skew and variable amplitude
- May help with flat top and top heavy components

### Pressure Level Analysis  
- Track how pressure changes affect overall GI
- Identify optimal pressure ranges for your breathing patterns
- Balance OSA control (AHI) with flow limitation reduction

### Rise Time Analysis
- Correlate rise time settings with spike values
- Faster rise times may reduce spike but increase other components

## Technical Notes

### File Processing
- Each EDF file is parsed using the European Data Format specification
- Flow data is extracted and converted to L/min
- Sampling rate is typically 25 Hz (40ms per sample)

### Algorithm Implementation
- Based on the original Glasgow Index algorithm by DaveSkvn
- Implements all 9 component calculations with original thresholds
- Maintains compatibility with single-file analysis tools

### Performance
- Web interface: Suitable for 10-50 files
- Desktop application: Can handle hundreds of files efficiently
- Processing time: ~1-5 seconds per file depending on duration

## Troubleshooting

### Common Issues

1. **"No flow data found"**: 
   - Ensure you're using BRP.edf files (not PLD or SAD files)
   - Check file isn't corrupted

2. **"Incorrect file format"**:
   - Verify files are genuine ResMed EDF format
   - Some third-party tools may create incompatible files

3. **Missing data points**:
   - Very short sessions (<5 minutes) may not provide reliable results
   - Ensure files contain actual sleep data, not just brief machine tests

### Browser Compatibility (Web Interface)
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- Internet Explorer: Not supported

## Contributing

This tool is based on the open-source Glasgow Index algorithm. Contributions and improvements are welcome.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Disclaimer

This is not a medical product. It has not been reviewed or approved by any physician or regulator. It cannot be used to diagnose any form of sleep disordered breathing. It is intended for those making changes to their sleep routine and looking to create a benchmark against which they can assess any improvements.

## Attribution
This project builds on **GlasgowIndex** by DaveSkvn (GPL-3.0).  
Original: https://github.com/DaveSkvn/GlasgowIndex

We have modified and extended the code (multi-night parser and aggregation).
Changes are documented in [CHANGELOG.md]. Our code is licensed under GPL-3.0.
See [LICENSE](./LICENSE) for details.


