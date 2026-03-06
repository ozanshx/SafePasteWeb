/**
 * SafePasteWeb Logic
 */

// DOM Elements
const sourceInput = document.getElementById('sourceInput');
const maskedOutput = document.getElementById('maskedOutput');
const unmaskInput = document.getElementById('unmaskInput');

// Mapping Table
const mappingTableBody = document.getElementById('mappingTableBody');

// Buttons
const maskBtn = document.getElementById('maskBtn');
const clearSourceBtn = document.getElementById('clearSourceBtn');
const copyMaskedBtn = document.getElementById('copyMaskedBtn');
const unmaskBtn = document.getElementById('unmaskBtn');
const copyUnmaskedBtn = document.getElementById('copyUnmaskedBtn');
const exportMapBtn = document.getElementById('exportMapBtn');
const importMapBtn = document.getElementById('importMapBtn');
const importMapFile = document.getElementById('importMapFile');

// Modal & Config Elements
const modal = document.getElementById('configModal');
const openModalBtn = document.getElementById('openConfigBtn');
const closeModalBtn = document.getElementById('closeConfigBtn');
const saveModalBtn = document.getElementById('saveConfigBtn');
const configMaskIp = document.getElementById('configMaskIp');
const configMaskHostname = document.getElementById('configMaskHostname');
const configCustomKeywords = document.getElementById('configCustomKeywords');
const regexRulesContainer = document.getElementById('regexRulesContainer');
const addRegexRuleBtn = document.getElementById('addRegexRuleBtn');

// Toast
const toast = document.getElementById('toast');

// State
let dictionary = new Map(); // original -> masked
let reverseDictionary = new Map(); // masked -> original
let counters = {
    ip: 1,
    host: 1,
    key: 1,
    regex: 1
};

const regexPatterns = {
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // Attempting a simple IPv6 matching pattern
    ipv6: /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b|\b(?:[A-F0-9]{1,4}:){1,7}:|\b::(?:[A-F0-9]{1,4}:){0,7}\b/gi,
    hostname: /(?:^|\s|\b)((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24})\b/g
};

// Configuration
let currentConfig = {
    maskIp: true,
    maskHostname: true,
    customKeywords: [],
    customRegexes: []
};

// --- Initialization ---
function init() {
    // Load config from local storage    // Load saved settings
    const savedConfig = localStorage.getItem('safepaste_config');
    if (savedConfig) {
        currentConfig = JSON.parse(savedConfig);
        configMaskIp.checked = currentConfig.maskIp;
        configMaskHostname.checked = currentConfig.maskHostname;
        configCustomKeywords.value = currentConfig.customKeywords.join(', ');
        if (currentConfig.customRegexes && currentConfig.customRegexes.length > 0) {
            currentConfig.customRegexes.forEach(r => {
                const label = typeof r === 'object' ? r.label : 'REGEX';
                const pattern = typeof r === 'object' ? r.pattern : String(r);
                addRegexRuleRow(label, pattern);
            });
        } else {
            addRegexRuleRow('', ''); // default empty row
        }
    }

    // Event Listeners
    maskBtn.addEventListener('click', handleMasking);
    clearSourceBtn.addEventListener('click', () => {
        sourceInput.value = '';
        maskedOutput.value = '';
    });
    copyMaskedBtn.addEventListener('click', () => copyToClipboard(maskedOutput.value));

    unmaskBtn.addEventListener('click', handleUnmasking);
    copyUnmaskedBtn.addEventListener('click', () => copyToClipboard(unmaskInput.value)); // It overrides the input area with unmasked text

    // Map exports/imports
    exportMapBtn.addEventListener('click', exportMapping);
    importMapBtn.addEventListener('click', () => importMapFile.click());
    importMapFile.addEventListener('change', importMapping);

    // Modal
    openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    saveModalBtn.addEventListener('click', saveConfig);
    addRegexRuleBtn.addEventListener('click', () => addRegexRuleRow('', ''));

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

function addRegexRuleRow(labelValue = '', patternValue = '') {
    const row = document.createElement('div');
    row.className = 'regex-rule-row';

    const lblInput = document.createElement('input');
    lblInput.type = 'text';
    lblInput.className = 'regex-label-input';
    lblInput.placeholder = 'Label (e.g. SICIL)';
    lblInput.value = labelValue;

    const patInput = document.createElement('input');
    patInput.type = 'text';
    patInput.className = 'regex-pattern-input';
    patInput.placeholder = 'Regex (e.g. ^FB[0-9]+$)';
    patInput.value = patternValue;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-icon btn-danger';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Remove Rule';
    delBtn.addEventListener('click', () => {
        row.remove();
    });

    row.appendChild(lblInput);
    row.appendChild(patInput);
    row.appendChild(delBtn);
    regexRulesContainer.appendChild(row);
}

// --- Masking Core Logic ---
function handleMasking() {
    try {
        let text = sourceInput.value;
        if (!text) {
            showToast('Please enter text to mask.', true);
            return;
        }

        // Normalize CRLF to LF to prevent \r breaking $ anchors in regex
        text = text.replace(/\r/g, '');

        // Process IP Masking
        if (currentConfig.maskIp) {
            text = text.replace(regexPatterns.ipv4, match => maskValue(match, 'ip'));
            text = text.replace(regexPatterns.ipv6, match => maskValue(match, 'ip'));
        }

        // Process Hostname Masking
        if (currentConfig.maskHostname) {
            text = text.replace(regexPatterns.hostname, (fullMatch, domain) => {
                // Avoid Double Masking if IP matched as a host
                if (regexPatterns.ipv4.test(domain)) return fullMatch;

                // The regex matches ` prefix + domain`. We only want to mask `domain`.
                return fullMatch.replace(domain, maskValue(domain, 'host'));
            });
        }

        // Process Custom Keywords (Internal Substring Allowed)
        if (currentConfig.customKeywords && currentConfig.customKeywords.length > 0) {
            currentConfig.customKeywords.forEach(kw => {
                if (!kw) return;
                // Escape regex chars in keyword to match exact string
                const safeKw = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                // Removed \b anchors to allow substring matching inside words as requested
                const kwRegex = new RegExp(safeKw, 'gi');
                text = text.replace(kwRegex, match => maskValue(match, 'key'));
            });
        }

        // Process Custom Regexes
        if (currentConfig.customRegexes && currentConfig.customRegexes.length > 0) {
            currentConfig.customRegexes.forEach(rule => {
                // handle both old string format and new object format gracefully
                const pattern = typeof rule === 'object' ? rule.pattern : rule;
                const label = typeof rule === 'object' ? rule.label : 'REGEX';

                if (!pattern || pattern.trim() === '') return;

                let regexPattern = pattern.trim();
                let regexFlags = 'gm'; // default global multiline

                // 1. Check for PCRE inline case-insensitive flag (?i)
                if (regexPattern.startsWith('(?i)')) {
                    regexPattern = regexPattern.substring(4);
                    if (!regexFlags.includes('i')) regexFlags += 'i';
                }

                // 2. Check for explicit JS literal format like /pattern/flags
                const literalMatch = regexPattern.match(/^\/(.+)\/([a-z]*)$/);
                if (literalMatch) {
                    regexPattern = literalMatch[1];
                    // merge user flags with 'g' and 'm', keeping unique chars
                    const userFlags = literalMatch[2];
                    regexFlags = Array.from(new Set((userFlags + 'gm').split(''))).join('');
                }

                try {
                    // Compile the RegExp with extracted flags
                    const rulesRegex = new RegExp(regexPattern, regexFlags);
                    text = text.replace(rulesRegex, match => {
                        if (!match) return match; // prevent empty match loop
                        return maskValue(match, 'regex', label);
                    });
                } catch (e) {
                    console.warn("Invalid regex provided by user:", pattern, e);
                }
            });
        }

        maskedOutput.value = text;
        renderMappingTable();
        showToast('Text successfully masked!');

    } catch (e) {
        alert("CRITICAL ERROR IN HANDLEMASKING:\n" + e.message + "\n" + e.stack);
    }
}

function maskValue(original, type, customLabel = null) {
    if (dictionary.has(original)) {
        return dictionary.get(original);
    }

    let prefix = 'IP_';
    let counterKey = type;

    if (type === 'host') {
        prefix = 'HOST_';
        counterKey = 'host';
    } else if (type === 'key') {
        prefix = 'KEY_';
        counterKey = 'key';
    } else if (type === 'regex') {
        prefix = customLabel ? `${customLabel}_` : 'REGEX_';
        counterKey = customLabel ? `regex_${customLabel}` : 'regex';
    }

    if (!counters[counterKey]) {
        counters[counterKey] = 1;
    }

    const masked = `[${prefix}${counters[counterKey]++}]`;
    dictionary.set(original, masked);
    reverseDictionary.set(masked, original);

    // Enable export once we have mappings
    exportMapBtn.disabled = false;

    return masked;
}

// --- Unmasking Core Logic ---
function handleUnmasking() {
    let text = unmaskInput.value;
    if (!text) {
        showToast('Please enter masked text to restore.', true);
        return;
    }

    text = text.replace(/\r/g, '');

    // Replace based on reverse dictionary
    if (reverseDictionary.size === 0) {
        showToast('No dictionary mapping available to restore.', true);
        return;
    }

    // Replace from [KEY_1] to original value
    let unmaskedText = text;
    reverseDictionary.forEach((origValue, maskedToken) => {
        // Need to escape bracket chars for RegExp
        const safeToken = maskedToken.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const tokenRegex = new RegExp(safeToken, 'g');
        unmaskedText = unmaskedText.replace(tokenRegex, origValue);
    });

    unmaskInput.value = unmaskedText;
    showToast('Text original values restored!');
}

// --- Display Logic ---
function renderMappingTable() {
    if (dictionary.size === 0) {
        mappingTableBody.innerHTML = '<tr><td colspan="2" class="empty-state">No mappings yet. Mask some text to generate dictionary.</td></tr>';
        return;
    }

    mappingTableBody.innerHTML = '';
    dictionary.forEach((masked, orig) => {
        const tr = document.createElement('tr');

        const tdToken = document.createElement('td');
        tdToken.className = 'token-cell';
        tdToken.textContent = masked;

        const tdOrig = document.createElement('td');
        tdOrig.textContent = orig;

        tr.appendChild(tdToken);
        tr.appendChild(tdOrig);
        mappingTableBody.appendChild(tr);
    });
}

// --- Mapping Table Import/Export ---
function exportMapping() {
    if (dictionary.size === 0) return;

    const obj = {};
    dictionary.forEach((val, key) => { obj[key] = val; });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "safepaste_mapping.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importMapping(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const obj = JSON.parse(event.target.result);

            // Clear current map
            dictionary.clear();
            reverseDictionary.clear();

            // Reconstruct map
            Object.keys(obj).forEach(key => {
                const val = obj[key];
                dictionary.set(key, val);
                reverseDictionary.set(val, key);
            });

            // Reset counters safely
            counters = { ip: 1000, host: 1000, key: 1000, regex: 1000 }; // Ensure no collisions for subsequent ops

            renderMappingTable();
            exportMapBtn.disabled = dictionary.size === 0;
            showToast('Mapping dictionary loaded successfully!');

        } catch (err) {
            showToast('Invalid mapping file. Please upload a valid JSON.', true);
        }

        // Reset file input
        e.target.value = '';
    };
    reader.readAsText(file);
}

// --- Utilities ---
function saveConfig() {
    currentConfig.maskIp = configMaskIp.checked;
    currentConfig.maskHostname = configMaskHostname.checked;

    // Parse custom keywords
    const keywordsRaw = configCustomKeywords.value.replace(/\r/g, '');
    currentConfig.customKeywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);

    // Parse custom regexes from table UI
    currentConfig.customRegexes = [];
    const rows = regexRulesContainer.querySelectorAll('.regex-rule-row');
    rows.forEach(row => {
        const lblInput = row.querySelector('.regex-label-input');
        const patInput = row.querySelector('.regex-pattern-input');

        const lbl = lblInput.value.replace(/\r/g, '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        const pat = patInput.value.replace(/\r/g, '').trim();

        if (pat) {
            currentConfig.customRegexes.push({
                label: lbl || 'REGEX',
                pattern: pat
            });
        }
    });

    // Save to local storage
    localStorage.setItem('safepaste_config', JSON.stringify(currentConfig));

    modal.classList.remove('active');
    showToast('Configuration saved!');
}

function copyToClipboard(text) {
    if (!text) {
        showToast('Nothing to copy.', true);
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        showToast('Failed to copy to clipboard.', true);
        console.error('Copy failed', err);
    });
}

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.background = isError ? 'var(--danger-color)' : 'var(--success-color)';
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
