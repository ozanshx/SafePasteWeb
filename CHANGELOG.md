# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-03-06

### Added
- **Built-in `user@hostname` Masking:** Automatically detects SSH-style patterns like `root@servername` and masks only the hostname part after `@` as `[HOST_X]`, preserving the username.
- **Longest-Match-First Regex Engine:** Custom regex rules now use a smart matching engine that runs ALL rules independently, collects every possible match, and picks the longest match at each position. Short rules can no longer steal matches from longer ones, regardless of rule order.
- **PCRE `(?i)` Flag Support:** Custom regex patterns can use inline case-insensitive flags like `(?i)fb[a-z0-9]+` — the flag is automatically extracted and applied.
- **JS Literal Regex Format:** Patterns in `/pattern/flags` format are parsed correctly with flag merging.
- **Branding & Footer:** Added footer with version number, Changelog link, GitHub link, and author credit (ozanshx).
- **Favicon:** Added SafePaste favicon and logo from the Go desktop version.

### Fixed
- **Internal Hostname Masking:** Fixed hostname regex failing to match bare internal hostnames without TLDs (like `fb01svp269app21`). These are now caught by the `user@hostname` built-in masking.
- **Custom Keyword Substring Scanning:** Removed strict word boundary anchors (`\b`) from keyword matching, allowing keywords to be found inside longer strings.
- **Carriage Return Handling:** CRLF normalization ensures `$` anchors work correctly on Windows-pasted multiline text.

## [1.1.0] - 2026-03-05

### Added
- **Custom Labeled Regex Support:** Added a completely new layer of customizable configuration where users can define regex patterns using a dynamic table interface (Label and Regex columns). Matches are mapped directly to tags like `[LABEL_1]`.

### Fixed
- **Multiline Regex Engine Anchors:** Fixed an issue where regex anchors (`^` and `$`) failed to match on multiline entries pasted from Windows environments.
- **Carriage Return Eradication:** Added robust sanitization to strip all invisible `\r` carriage returns from configuration inputs and source text prior to regex execution, ensuring flawless multiline matching.
- **Regex Configuration Parser:** Replaced the fragile `::` string-parsing from a textarea with a robust, two-column dynamic table row system for configuring regex rules, preventing user input tracking problems.
