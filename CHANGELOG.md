# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-03-05

### Added
- **Custom Labeled Regex Support:** Added a completely new layer of customizable configuration where users can define regex patterns using a dynamic table interface (Label and Regex columns). Matches are mapped directly to tags like `[LABEL_1]`.

### Fixed
- **Multiline Regex Engine Anchors:** Fixed an issue where regex anchors (`^` and `$`) failed to match on multiline entries pasted from Windows environments.
- **Carriage Return Eradication:** Added robust sanitization to strip all invisible `\r` carriage returns from configuration inputs and source text prior to regex execution, ensuring flawless multiline matching.
- **Regex Configuration Parser:** Replaced the fragile `::` string-parsing from a textarea with a robust, two-column dynamic table row system for configuring regex rules, preventing user input tracking problems.
