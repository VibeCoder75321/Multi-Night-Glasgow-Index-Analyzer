# Multi-Night Glasgow Index Analyzer

A comprehensive tool for analyzing multiple nights of ResMed PAP data to calculate weighted averages of Glasgow Index components and track trends over time. Now includes complete machine settings analysis including pressure data extraction.

## Features

- **Multi-Night Analysis**: Process multiple EDF files from different nights automatically
- **Complete Machine Analysis**: Extract machine type, IPAP, EPAP, pressure support, and PAP mode
- **Weighted Averages**: Calculate proper weighted averages when multiple sessions exist per night
- **Pressure Settings**: Analyze IPAP, EPAP, and pressure support trends alongside Glasgow Index
- **Trend Visualization**: Interactive charts showing Glasgow Index trends over time
- **Component Analysis**: Detailed breakdown of all 9 Glasgow Index components
- **Export Capabilities**: Export results to CSV including all pressure and machine data
- **Two Interface Options**: 
  - Web-based interface (`multi_night_analyzer.html`) - **Recommended**
  - Desktop application (`glasgow_analyzer.py`)

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

3. **For complete analysis**: Upload your entire ResMed SD card folder (recommended)
   - **Includes**: Machine type, IPAP, EPAP, pressure support, PAP mode extraction
   - **Files analyzed**: DATALOG/*.edf, STR.edf, Identification.tgt, SETTINGS/*
   
   **Alternative**: Upload individual BRP.edf files (Glasgow Index only)

### Desktop Application

1. Install Python 3.7 or higher

2. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python glasgow_analyzer.py
   ```

## Usage

### Data Requirements

#### Complete Analysis (Recommended)
Upload your entire ResMed SD card for comprehensive analysis including:

**Files Analyzed:**
- `DATALOG/*/YYYYMMDD_HHMMSS_BRP.edf` - Breathing/flow data (for Glasgow Index)
- `STR.edf` - Summary/settings data (for pressure settings and PAP mode)  
- `Identification.tgt` - Machine identification (for machine type)
- `SETTINGS/*.tgt` - Configuration files (future expansion)

**Data Extracted:**
- Glasgow Index components (9 breathing quality metrics)
- Machine Type (e.g., "AirCurve 10 VAuto", "AirSense 10 AutoSet")
- IPAP pressure values (inspiratory pressure)
- EPAP pressure values (expiratory pressure)  
- Pressure Support (IPAP - EPAP)
- PAP Mode (CPAP, APAP, BiPAP, etc.)

#### Glasgow Index Only
Alternatively, upload individual files with the naming convention:
- `YYYYMMDD_HHMMSS_BRP.edf` (breathing/flow data files only)

These files are typically found on your ResMed SD card in:
- `DATALOG/YYYY/MMDD/` folders

Or in OSCAR backup directories:
- `Profiles/[Profile]/ResMed_[Serial]/Backup/DATALOG/YYYY/`

### Web Interface Usage

1. **File Selection**: 
   - **Recommended**: Click "Choose Files" and select your entire SD card folder for complete analysis
   - **Alternative**: Upload individual BRP.edf files for Glasgow Index analysis only
   - The tool will automatically detect and process relevant files

2. **Processing**: 
   - Files are processed automatically after selection
   - Machine identification and pressure settings are extracted first
   - Progress is shown with a progress bar and status updates

3. **Results**:
   - Summary cards show key statistics including machine type
   - Interactive trend charts display Glasgow Index over time  
   - Component analysis charts for detailed breathing pattern analysis
   - Detailed table shows all components, pressure settings, and machine data per night
   - Export to CSV includes all extracted data for spreadsheet analysis

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

The tool now provides comprehensive pressure data analysis to help optimize your therapy:

### Pressure Support Analysis
- **Automatic calculation**: IPAP - EPAP for each night
- **Track pressure support trends** alongside Glasgow Index changes
- **Correlate pressure support levels** with specific GI components
- Compare nights with different pressure support settings to find optimal levels

### IPAP/EPAP Analysis  
- **Track individual pressure trends** over time
- **Identify optimal pressure ranges** for your breathing patterns
- **Correlate pressure changes** with Glasgow Index improvements
- **Balance OSA control** (AHI) with flow limitation reduction (GI)

### PAP Mode Analysis
- **Automatic detection** of CPAP, APAP, BiPAP, ASV modes
- **Compare effectiveness** between different PAP modes
- **Track mode changes** and their impact on breathing quality

### Machine Type Tracking
- **Automatic identification** of your PAP device model
- **Consistent data tracking** across machine upgrades or changes
- **Export compatibility** for sharing with healthcare providers

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

## Acknowledgments

- Original Glasgow Index algorithm by DaveSkvn
- EDF parsing based on European Data Format specification
- ResMed for providing accessible data format on SD cards