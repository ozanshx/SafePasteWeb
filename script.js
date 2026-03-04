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

// Toast
const toast = document.getElementById('toast');

// State
let dictionary = new Map(); // original -> masked
let reverseDictionary = new Map(); // masked -> original
let counters = {
    ip: 1,
    host: 1,
    key: 1
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
    customKeywords: []
};

// --- Initialization ---
function init() {
    // Load config from local storage if exists
    const savedConfig = localStorage.getItem('safepaste_config');
    if (savedConfig) {
        currentConfig = JSON.parse(savedConfig);
        configMaskIp.checked = currentConfig.maskIp;
        configMaskHostname.checked = currentConfig.maskHostname;
        configCustomKeywords.value = currentConfig.customKeywords.join(', ');
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

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// --- Masking Core Logic ---
function handleMasking() {
    let text = sourceInput.value;
    if (!text) {
        showToast('Please enter text to mask.', true);
        return;
    }

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

    // Process Custom Keywords
    if (currentConfig.customKeywords && currentConfig.customKeywords.length > 0) {
        currentConfig.customKeywords.forEach(kw => {
            if (!kw) return;
            // Escape regex chars in keyword to match exact string
            const safeKw = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const kwRegex = new RegExp(`\\b${safeKw}\\b`, 'gi');
            text = text.replace(kwRegex, match => maskValue(match, 'key'));
        });
    }

    maskedOutput.value = text;
    renderMappingTable();
    showToast('Text successfully masked!');
}

function maskValue(original, type) {
    if (dictionary.has(original)) {
        return dictionary.get(original);
    }

    let prefix = 'IP_';
    if (type === 'host') prefix = 'HOST_';
    if (type === 'key') prefix = 'KEY_';

    const masked = `[${prefix}${counters[type]++}]`;
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
            counters = { ip: 1000, host: 1000, key: 1000 }; // Ensure no collisions for subsequent ops

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
    const keywordsRaw = configCustomKeywords.value;
    currentConfig.customKeywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);

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
