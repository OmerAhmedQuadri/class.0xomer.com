const DATA_STORAGE_KEY = 'dailyProgress.data';
const DATA_VERSION = 2;
const THEME_STORAGE_KEY = 'theme';

const DEFAULT_SESSION_TIME = '1:30 PM - 4:30 PM';
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
const footerDetails = document.getElementById('footerDetails');
const footerPreview = document.getElementById('footerPreview');
const studentPicker = document.getElementById('studentPicker');
const addStudentBtn = document.getElementById('addStudentBtn');
const toggleAllStudentsBtn = document.getElementById('toggleAllStudentsBtn');
const outputContent = document.getElementById('outputContent');
const copyBtn = document.getElementById('copyBtn');
const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
const themeToggle = document.getElementById('themeToggle');

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

    footerInput.value = cohort ? cohort.footer : '';
    footerInput.disabled = !cohort;
    autoResize(footerInput);
    updateFooterPreview();

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
            // Start from the current cohort's footer, since new cohorts usually belong to the same institute
            const footer = findCohort(data, currentCohortId)?.footer || '';
            data.cohorts.push({ id, name, footer, students: [], lastSession: null });
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
    textarea.addEventListener('input', () => autoResize(textarea));
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
    updateFooterPreview();
});

// One-line summary shown beside the collapsed footer
function updateFooterPreview() {
    const lines = footerInput.value.split('\n').map(line => line.trim()).filter(Boolean);
    footerPreview.textContent = lines.length > 0 ? lines.join(' · ') : 'None';
}

// A collapsed textarea has no height to measure, so size it when the section opens
footerDetails.addEventListener('toggle', function() {
    if (footerDetails.open) {
        autoResize(footerInput);
    }
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

function formatUpdate(update, markdown) {
    const field = (label, value) => (markdown ? `**${label}:** ${value}` : `${label}: ${value}`);
    const lines = [
        `${markdown ? '## ' : ''}${update.cohort} - Daily Progress`,
        '',
        field('Week', update.week),
        field('Session', update.day),
        field('Attendance Count', update.attendance),
        field('Session Date', update.sessionDate),
        field('Session Time', update.sessionTime),
        ''
    ];

    const sections = [
        ['Topics Covered:', update.topics],
        ['Tasks & Todos:', update.tasks],
        ['Absentees:', update.absentees]
    ];
    let hasContent = false;
    sections.forEach(([title, items]) => {
        if (items.length === 0) return;
        lines.push(`${markdown ? '### ' : ''}${title}`);
        items.forEach(item => lines.push(`${markdown ? '-' : '•'} ${item}`));
        lines.push('');
        hasContent = true;
    });

    // The footer is used as written, in both formats
    const footer = update.footer.trim();
    if (footer) {
        if (hasContent) {
            lines.push(markdown ? '---' : '—');
        }
        lines.push(...footer.split('\n').map(line => line.trimEnd()));
    }

    // Without a footer the last section leaves a blank line; end with exactly one newline
    return lines.join('\n').replace(/\n*$/, '\n');
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

    generatedUpdate = {
        text: formatUpdate(update, false),
        markdown: formatUpdate(update, true)
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
