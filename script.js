const DATA_STORAGE_KEY = 'dailyProgress.data';
const DATA_VERSION = 2;
const THEME_STORAGE_KEY = 'theme';
const OPEN_SECTIONS_STORAGE_KEY = 'dailyProgress.openSections';

const DEFAULT_SESSION_TIME = '1:30 PM - 4:30 PM';
// Form fields that can be hidden from the output, in form order
const OUTPUT_FIELDS = ['cohort', 'week', 'day', 'sessionDate', 'sessionTime', 'topics', 'tasks', 'students', 'footer'];
const OUTPUT_PLACEHOLDER = 'Fill in the form and click "Generate Update" to see the output here.';
// Bullets or numbering pasted into topics/tasks; the output adds its own
const LIST_MARKER = /^(?:[•*-]|\d+[.)])\s+/;

const progressForm = document.getElementById('progressForm');
const cohortControls = document.getElementById('cohortControls');
const cohortDropdownBtn = document.getElementById('cohortDropdownBtn');
const cohortDropdownMenu = document.getElementById('cohortDropdownMenu');
const cohortDropdownLabel = document.getElementById('cohortDropdownLabel');
const weekInput = document.getElementById('week');
const dayInput = document.getElementById('day');
const sessionDateInput = document.getElementById('sessionDate');
const sessionTimeInput = document.getElementById('sessionTime');
const topicsInput = document.getElementById('topics');
const tasksInput = document.getElementById('tasks');
const footerInput = document.getElementById('footer');
const topicsPreview = document.getElementById('topicsPreview');
const tasksPreview = document.getElementById('tasksPreview');
const studentsPreview = document.getElementById('studentsPreview');
const footerPreview = document.getElementById('footerPreview');
const collapsibles = document.querySelectorAll('details.collapsible');
const studentPicker = document.getElementById('studentPicker');
const addStudentBtn = document.getElementById('addStudentBtn');
const toggleAllStudentsBtn = document.getElementById('toggleAllStudentsBtn');
const outputContent = document.getElementById('outputContent');
const copyBtn = document.getElementById('copyBtn');
const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
const themeToggle = document.getElementById('themeToggle');
const eyeButtons = document.querySelectorAll('.eye-btn');

let currentCohortId = '';
let presentStudentIds = new Set();
let generatedUpdate = null; // { text, markdown } for the copy buttons

// ---- Storage ----
//
// All data is saved under one key:
// {
//   version: 2,
//   cohorts: [{
//     id, name, footer,
//     hiddenFields: ['week', ...], (fields left out of the output)
//     students: [{ id, name }],
//     lastSession: { week, day, sessionDate, sessionTime, topics, tasks, presentStudentIds } or null
//   }]
// }

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Trim and collapse repeated spaces, so " A26 " is stored and compared as "A26"
function cleanName(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function sameName(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}

function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function readJSON(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Error reading ${key} from storage:`, error);
        return null;
    }
}

// Drop anything malformed or duplicated so the rest of the code can trust the shape
function normalizeData(raw) {
    const cohorts = [];
    (Array.isArray(raw?.cohorts) ? raw.cohorts : []).forEach(cohort => {
        const name = cleanName(cohort?.name);
        if (!isObject(cohort) || !cohort.id || !name || cohorts.some(c => sameName(c.name, name))) return;

        const students = [];
        (Array.isArray(cohort.students) ? cohort.students : []).forEach(student => {
            const studentName = cleanName(student?.name);
            if (!isObject(student) || !student.id || !studentName || students.some(s => sameName(s.name, studentName))) return;
            students.push({ id: String(student.id), name: studentName });
        });

        cohorts.push({
            id: String(cohort.id),
            name,
            footer: typeof cohort.footer === 'string' ? cohort.footer : '',
            hiddenFields: Array.isArray(cohort.hiddenFields) ? OUTPUT_FIELDS.filter(field => cohort.hiddenFields.includes(field)) : [],
            students,
            lastSession: isObject(cohort.lastSession) ? cohort.lastSession : null
        });
    });
    return { version: DATA_VERSION, cohorts };
}

function loadData() {
    const stored = readJSON(DATA_STORAGE_KEY);
    return stored ? normalizeData(stored) : migrateLegacyData() || normalizeData(null);
}

function saveData(data) {
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

// Re-read before each change so edits made in another open tab aren't overwritten
function updateData(change) {
    const data = loadData();
    change(data);
    saveData(data);
    return data;
}

function findCohort(data, id) {
    return data.cohorts.find(cohort => cohort.id === id);
}

function currentStudents() {
    return findCohort(loadData(), currentCohortId)?.students || [];
}

// ---- One-time migration from the storage format used before version 2 ----

const LEGACY_STORAGE_KEYS = {
    cohorts: 'cfi_cohorts',
    studentsByCohort: 'cfi_students_by_cohort',
    progressByCohort: 'cfi_lastProgress_by_cohort',
    progress: 'cfi_lastProgress', // single form saved before cohorts existed
    authenticated: 'cfi_authenticated'
};
// The footer used to be hardcoded, so migrated cohorts keep it and their updates don't change
const LEGACY_FOOTER = 'Team - Code For India Foundation\nhttps://codeforindia.com';

function migrateLegacyData() {
    const keys = Object.values(LEGACY_STORAGE_KEYS);
    if (keys.every(key => localStorage.getItem(key) === null)) return null;

    const cohortNames = readJSON(LEGACY_STORAGE_KEYS.cohorts);
    const studentsByCohort = readJSON(LEGACY_STORAGE_KEYS.studentsByCohort) || {};
    const progressByCohort = readJSON(LEGACY_STORAGE_KEYS.progressByCohort) || {};
    const legacyProgress = readJSON(LEGACY_STORAGE_KEYS.progress);

    const data = normalizeData({
        cohorts: (Array.isArray(cohortNames) ? cohortNames : []).map((name, index) => {
            const studentNames = Array.isArray(studentsByCohort[name]) ? studentsByCohort[name] : [];
            const students = studentNames.map(studentName => ({ id: createId(), name: studentName }));

            let progress = progressByCohort[name];
            // The old app moved the pre-cohort form into whichever cohort opened first
            if (!isObject(progress) && index === 0) progress = legacyProgress;

            return {
                id: createId(),
                name,
                footer: LEGACY_FOOTER,
                students,
                lastSession: isObject(progress) ? legacySession(progress, students) : null
            };
        })
    });

    saveData(data);
    keys.forEach(key => localStorage.removeItem(key));
    return data;
}

function legacySession(progress, students) {
    let presentNames = [];
    if (Array.isArray(progress.presentStudents)) {
        presentNames = progress.presentStudents;
    } else if (Array.isArray(progress.absentees)) {
        // Even older saves stored absentees instead of present students
        presentNames = students.map(student => student.name).filter(name => !progress.absentees.includes(name));
    }
    return {
        week: progress.week,
        day: progress.day,
        sessionDate: progress.sessionDate,
        sessionTime: progress.sessionTime,
        topics: progress.topics,
        tasks: progress.tasks,
        presentStudentIds: students.filter(student => presentNames.includes(student.name)).map(student => student.id)
    };
}

// ---- Cohorts ----

function setCohortDropdownOpen(isOpen) {
    cohortControls.classList.toggle('is-open', isOpen);
    cohortDropdownBtn.setAttribute('aria-expanded', isOpen);
}

function renderCohorts(data) {
    const current = findCohort(data, currentCohortId);
    cohortDropdownLabel.textContent = current ? current.name : 'Add cohort';
    cohortDropdownMenu.innerHTML = '';

    data.cohorts.forEach(cohort => {
        const isActive = cohort.id === currentCohortId;
        const row = document.createElement('div');
        row.className = 'cohort-dropdown-item';
        row.classList.toggle('is-active', isActive);
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', isActive);

        const label = document.createElement('span');
        label.textContent = cohort.name;
        row.appendChild(label);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'cohort-dropdown-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${cohort.name}`;
        deleteBtn.setAttribute('aria-label', `Delete ${cohort.name}`);
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteCohort(cohort.id);
        });
        row.appendChild(deleteBtn);

        row.addEventListener('click', function() {
            selectCohort(cohort.id);
            setCohortDropdownOpen(false);
        });
        cohortDropdownMenu.appendChild(row);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'cohort-dropdown-add';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add cohort';
    addBtn.addEventListener('click', addCohort);
    addWrap.appendChild(addBtn);
    cohortDropdownMenu.appendChild(addWrap);
}

// Switch the form to a cohort ('' when there are none) and load its last session
function selectCohort(id) {
    const data = loadData();
    const cohort = findCohort(data, id);
    currentCohortId = cohort ? cohort.id : '';
    renderCohorts(data);
    renderHiddenFields();

    footerInput.value = cohort ? cohort.footer : '';
    footerInput.disabled = !cohort;
    autoResize(footerInput);

    applySessionValues(sessionValuesFor(cohort));
    resetOutput();
}

function addCohort() {
    const name = cleanName(prompt('Enter cohort name:'));
    if (!name) return;

    const existing = loadData().cohorts.find(cohort => sameName(cohort.name, name));
    if (existing) {
        alert(`A cohort named "${existing.name}" already exists.`);
        selectCohort(existing.id);
    } else {
        const id = createId();
        updateData(data => {
            // Start from the current cohort's footer and hidden fields, since new cohorts usually belong to the same institute
            const current = findCohort(data, currentCohortId);
            data.cohorts.push({
                id,
                name,
                footer: current ? current.footer : '',
                hiddenFields: current ? [...current.hiddenFields] : [],
                students: [],
                lastSession: null
            });
        });
        selectCohort(id);
    }
    setCohortDropdownOpen(false);
}

function deleteCohort(id) {
    const cohort = findCohort(loadData(), id);
    if (!cohort || !confirm(`Delete cohort "${cohort.name}" and all its saved data?`)) return;

    const data = updateData(d => {
        d.cohorts = d.cohorts.filter(c => c.id !== id);
    });

    // Deleting another cohort keeps the current form as is
    if (findCohort(data, currentCohortId)) {
        renderCohorts(data);
    } else {
        selectCohort(data.cohorts[0]?.id || '');
    }
}

cohortDropdownBtn.addEventListener('click', function() {
    setCohortDropdownOpen(!cohortControls.classList.contains('is-open'));
});

document.addEventListener('click', function(e) {
    if (!cohortControls.contains(e.target)) {
        setCohortDropdownOpen(false);
    }
});

// ---- Students ----

// Custom picker instead of a native <select multiple>, which forces a blue highlight
function renderStudents() {
    studentPicker.innerHTML = '';

    currentStudents().forEach(student => {
        const item = document.createElement('div');
        item.className = 'student-picker-item';
        item.dataset.id = student.id;
        item.setAttribute('role', 'option');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'student-picker-name';
        nameSpan.textContent = student.name;
        item.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'student-picker-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${student.name}`;
        deleteBtn.setAttribute('aria-label', `Delete ${student.name}`);
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`Delete "${student.name}" from students list?`)) {
                deleteStudent(student.id);
            }
        });
        item.appendChild(deleteBtn);

        item.addEventListener('click', function() {
            if (presentStudentIds.has(student.id)) {
                presentStudentIds.delete(student.id);
            } else {
                presentStudentIds.add(student.id);
            }
            updateStudentSelection();
        });
        studentPicker.appendChild(item);
    });

    updateStudentSelection();
}

function updateStudentSelection() {
    let anyPresent = false;
    for (const item of studentPicker.children) {
        const isPresent = presentStudentIds.has(item.dataset.id);
        item.classList.toggle('is-selected', isPresent);
        item.setAttribute('aria-selected', isPresent);
        anyPresent = anyPresent || isPresent;
    }
    toggleAllStudentsBtn.textContent = anyPresent ? 'Clear' : 'Select All';
    updatePreviews();
}

function deleteStudent(id) {
    updateData(data => {
        const cohort = findCohort(data, currentCohortId);
        if (!cohort) return;
        cohort.students = cohort.students.filter(student => student.id !== id);
        if (Array.isArray(cohort.lastSession?.presentStudentIds)) {
            cohort.lastSession.presentStudentIds = cohort.lastSession.presentStudentIds.filter(studentId => studentId !== id);
        }
    });
    presentStudentIds.delete(id);
    renderStudents();
}

addStudentBtn.addEventListener('click', function() {
    if (!currentCohortId) {
        alert('Please select a cohort first.');
        return;
    }
    const name = cleanName(prompt('Enter student name:'));
    if (!name) return;

    const existing = currentStudents().find(student => sameName(student.name, name));
    if (existing) {
        alert(`"${existing.name}" is already in this cohort.`);
        return;
    }

    updateData(data => {
        findCohort(data, currentCohortId)?.students.push({ id: createId(), name });
    });
    renderStudents();
});

toggleAllStudentsBtn.addEventListener('click', function() {
    const ids = currentStudents().map(student => student.id);
    const anyPresent = ids.some(id => presentStudentIds.has(id));
    presentStudentIds = new Set(anyPresent ? [] : ids);
    updateStudentSelection();
});

// ---- Form ----

function autoResize(textarea) {
    textarea.style.height = 'auto';
    // scrollHeight leaves out the border, which border-box sizing counts in height
    textarea.style.height = textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight + 'px';
}

[topicsInput, tasksInput, footerInput].forEach(textarea => {
    textarea.addEventListener('input', function() {
        autoResize(textarea);
        updatePreviews();
    });
});

// Local date as YYYY-MM-DD (toISOString() gives the UTC date, which can be yesterday)
function todayDateString() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultSessionValues() {
    return {
        week: '0',
        day: '1',
        sessionDate: todayDateString(),
        sessionTime: DEFAULT_SESSION_TIME,
        topics: '',
        tasks: '',
        presentStudentIds: []
    };
}

// Saved values replace the defaults field by field, so partial or older saves still load
function sessionValuesFor(cohort) {
    const values = defaultSessionValues();
    const saved = cohort?.lastSession || {};
    Object.keys(values).forEach(key => {
        if (saved[key] !== undefined && saved[key] !== null) values[key] = saved[key];
    });
    if (!Array.isArray(values.presentStudentIds)) values.presentStudentIds = [];
    return values;
}

function readSessionValues() {
    return {
        week: weekInput.value,
        day: dayInput.value,
        sessionDate: sessionDateInput.value,
        sessionTime: sessionTimeInput.value,
        topics: topicsInput.value,
        tasks: tasksInput.value,
        presentStudentIds: currentStudents().map(student => student.id).filter(id => presentStudentIds.has(id))
    };
}

function applySessionValues(values) {
    weekInput.value = values.week;
    dayInput.value = values.day;
    sessionDateInput.value = values.sessionDate;
    sessionTimeInput.value = values.sessionTime;
    topicsInput.value = values.topics;
    tasksInput.value = values.tasks;
    autoResize(topicsInput);
    autoResize(tasksInput);
    presentStudentIds = new Set(values.presentStudentIds);
    renderStudents();
}

// The footer belongs to the cohort, so it's saved as you type rather than on Generate
footerInput.addEventListener('input', function() {
    updateData(data => {
        const cohort = findCohort(data, currentCohortId);
        if (cohort) cohort.footer = footerInput.value;
    });
});

// ---- Collapsible sections ----

// One-line summaries shown beside collapsed sections
function updatePreviews() {
    const summarize = (items, emptyText) => (items.length > 0 ? items.join(' · ') : emptyText);
    topicsPreview.textContent = summarize(toListItems(topicsInput.value), 'None');
    tasksPreview.textContent = summarize(toListItems(tasksInput.value), 'None');
    footerPreview.textContent = summarize(footerInput.value.split('\n').map(line => line.trim()).filter(Boolean), 'None');

    const total = studentPicker.children.length;
    const present = studentPicker.querySelectorAll('.is-selected').length;
    studentsPreview.textContent = total > 0 ? `${present} of ${total} present` : 'No students';
}

// Which sections are open is a per-browser preference, like the theme, kept for the next visit
function readOpenSections() {
    const saved = readJSON(OPEN_SECTIONS_STORAGE_KEY);
    return isObject(saved) ? saved : {};
}

collapsibles.forEach(section => {
    const savedOpen = readOpenSections()[section.id];
    if (typeof savedOpen === 'boolean') {
        section.open = savedOpen;
    }

    section.addEventListener('toggle', function() {
        // A collapsed textarea has no height to measure, so size it when the section opens
        if (section.open) {
            section.querySelectorAll('textarea').forEach(autoResize);
        }
        const openSections = readOpenSections();
        openSections[section.id] = section.open;
        localStorage.setItem(OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
    });

    // Buttons in the header row (eye, Add, Select All) shouldn't open or close the section.
    // Check the event path rather than e.target.closest(): the eye swaps its icon when clicked,
    // which detaches the clicked <svg> before the event reaches the summary.
    section.querySelector('summary').addEventListener('click', function(e) {
        if (e.composedPath().some(node => node instanceof HTMLButtonElement)) {
            e.preventDefault();
        }
    });
});

document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all fields? The footer is kept.')) {
        applySessionValues(defaultSessionValues());
        resetOutput();
    }
});

// ---- Output ----

function toListItems(text) {
    return text.split('\n')
        .map(line => line.trim().replace(LIST_MARKER, ''))
        .filter(Boolean);
}

function formatSessionDate(value) {
    if (!value) return '';
    const date = new Date(value + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Builds the update as blocks of lines separated by blank lines, leaving out hidden fields
function formatUpdate(update, hidden, markdown) {
    const show = key => !hidden.has(key);
    const field = (label, value) => (markdown ? `**${label}:** ${value}` : `${label}: ${value}`);
    const title = `${show('cohort') ? `${update.cohort} - ` : ''}Daily Progress`;

    const blocks = [
        [`${markdown ? '## ' : ''}${title}`],
        [
            show('week') && field('Week', update.week),
            show('day') && field('Session', update.day),
            show('students') && field('Attendance Count', update.attendance),
            show('sessionDate') && field('Session Date', update.sessionDate),
            show('sessionTime') && field('Session Time', update.sessionTime)
        ].filter(Boolean)
    ];

    const sections = [
        ['topics', 'Topics Covered:', update.topics],
        ['tasks', 'Tasks & Todos:', update.tasks],
        ['students', 'Absentees:', update.absentees]
    ].filter(([key, , items]) => show(key) && items.length > 0);
    sections.forEach(([, heading, items]) => {
        blocks.push([`${markdown ? '### ' : ''}${heading}`, ...items.map(item => `${markdown ? '-' : '•'} ${item}`)]);
    });

    // The footer is used as written, in both formats
    const footer = show('footer') ? update.footer.trim() : '';
    if (footer) {
        const footerLines = footer.split('\n').map(line => line.trimEnd());
        blocks.push(sections.length > 0 ? [markdown ? '---' : '—', ...footerLines] : footerLines);
    }

    return blocks.filter(block => block.length > 0).map(block => block.join('\n')).join('\n\n') + '\n';
}

function resetOutput() {
    generatedUpdate = null;
    outputContent.textContent = OUTPUT_PLACEHOLDER;
    copyBtn.hidden = true;
    copyMarkdownBtn.hidden = true;
}

progressForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const cohort = findCohort(loadData(), currentCohortId);
    if (!cohort) {
        alert('Please select a cohort first.');
        return;
    }

    const values = readSessionValues();
    const update = {
        cohort: cohort.name,
        week: values.week,
        day: values.day,
        attendance: values.presentStudentIds.length,
        sessionDate: formatSessionDate(values.sessionDate),
        sessionTime: values.sessionTime,
        topics: toListItems(values.topics),
        tasks: toListItems(values.tasks),
        absentees: cohort.students.filter(student => !presentStudentIds.has(student.id)).map(student => student.name),
        footer: footerInput.value
    };

    // Hidden fields are applied here, so toggling an eye later waits for the next Generate
    const hidden = currentHiddenFields();
    generatedUpdate = {
        text: formatUpdate(update, hidden, false),
        markdown: formatUpdate(update, hidden, true)
    };
    outputContent.textContent = generatedUpdate.text;
    copyBtn.hidden = false;
    copyMarkdownBtn.hidden = false;

    updateData(data => {
        const saved = findCohort(data, cohort.id);
        if (saved) saved.lastSession = values;
    });
});

function copyToClipboard(button, text) {
    navigator.clipboard.writeText(text).then(function() {
        // Keep the real label so a second click within 2s doesn't leave "Copied!" behind
        button.dataset.label = button.dataset.label || button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(function() {
            button.textContent = button.dataset.label;
            button.classList.remove('copied');
        }, 2000);
    }).catch(function(err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually.');
    });
}

copyBtn.addEventListener('click', () => copyToClipboard(copyBtn, generatedUpdate.text));
copyMarkdownBtn.addEventListener('click', () => copyToClipboard(copyMarkdownBtn, generatedUpdate.markdown));

// ---- Hiding fields from the output ----

const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function currentHiddenFields() {
    return new Set(findCohort(loadData(), currentCohortId)?.hiddenFields || []);
}

// Hidden fields stay editable in the form but look faded
function renderHiddenFields() {
    const hidden = currentHiddenFields();
    eyeButtons.forEach(button => {
        const isHidden = hidden.has(button.dataset.field);
        const name = button.closest('.label-row').firstElementChild.textContent.replace(/\s*[:(].*$/, '');
        button.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
        button.title = isHidden ? `Show ${name} in the output` : `Hide ${name} from the output`;
        button.setAttribute('aria-label', `Hide ${name} from the output`);
        button.setAttribute('aria-pressed', isHidden);
        button.disabled = !currentCohortId;
        button.closest('.form-group').classList.toggle('is-output-hidden', isHidden);
    });
}

eyeButtons.forEach(button => {
    button.addEventListener('click', function() {
        const field = button.dataset.field;
        updateData(data => {
            const cohort = findCohort(data, currentCohortId);
            if (!cohort) return;
            const hidden = new Set(cohort.hiddenFields);
            if (hidden.has(field)) {
                hidden.delete(field);
            } else {
                hidden.add(field);
            }
            cohort.hiddenFields = OUTPUT_FIELDS.filter(key => hidden.has(key));
        });
        renderHiddenFields();
    });
});

// ---- Theme and logout ----

function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-mode', isLight);
    themeToggle.querySelector('.theme-icon').textContent = isLight ? '🌙' : '☀️';
}

themeToggle.addEventListener('click', function() {
    const theme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        logout();
        window.location.href = 'login/';
    }
});

// ---- Init ----

applyTheme(localStorage.getItem(THEME_STORAGE_KEY));
selectCohort(loadData().cohorts[0]?.id || '');
