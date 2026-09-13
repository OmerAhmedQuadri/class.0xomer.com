const COHORTS_STORAGE_KEY = 'cfi_cohorts';
const STUDENTS_BY_COHORT_STORAGE_KEY = 'cfi_students_by_cohort';
const LAST_PROGRESS_BY_COHORT_STORAGE_KEY = 'cfi_lastProgress_by_cohort';
// Form data saved before cohorts existed; migrated into the first cohort that loads
const LEGACY_PROGRESS_STORAGE_KEY = 'cfi_lastProgress';
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
const studentPicker = document.getElementById('studentPicker');
const addStudentBtn = document.getElementById('addStudentBtn');
const toggleAllStudentsBtn = document.getElementById('toggleAllStudentsBtn');
const outputContent = document.getElementById('outputContent');
const copyBtn = document.getElementById('copyBtn');
const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
const themeToggle = document.getElementById('themeToggle');

let currentCohort = '';
let presentStudents = new Set();
let generatedUpdate = null; // { text, markdown } for the copy buttons

// ---- Storage ----

function readStorage(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) ?? fallback;
    } catch (error) {
        console.error(`Error reading ${key} from storage:`, error);
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Maps keyed by cohort name
function readCohortMap(key) {
    const map = readStorage(key, {});
    return typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function toNameList(value) {
    return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

function getStoredCohorts() {
    return toNameList(readStorage(COHORTS_STORAGE_KEY, []));
}

function getStoredStudents(cohort) {
    return toNameList(readCohortMap(STUDENTS_BY_COHORT_STORAGE_KEY)[cohort]);
}

function saveStudents(cohort, students) {
    const studentsByCohort = readCohortMap(STUDENTS_BY_COHORT_STORAGE_KEY);
    studentsByCohort[cohort] = students;
    writeStorage(STUDENTS_BY_COHORT_STORAGE_KEY, studentsByCohort);
}

function saveFormValues(cohort, values) {
    const progressByCohort = readCohortMap(LAST_PROGRESS_BY_COHORT_STORAGE_KEY);
    progressByCohort[cohort] = values;
    writeStorage(LAST_PROGRESS_BY_COHORT_STORAGE_KEY, progressByCohort);
}

function getFormValuesForCohort(cohort) {
    if (!cohort) return defaultFormValues();

    let saved = readCohortMap(LAST_PROGRESS_BY_COHORT_STORAGE_KEY)[cohort];
    if (!saved) {
        const legacy = readStorage(LEGACY_PROGRESS_STORAGE_KEY, null);
        if (legacy && typeof legacy === 'object') {
            saved = legacy;
            saveFormValues(cohort, legacy);
            localStorage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
        }
    }
    if (!saved || typeof saved !== 'object') return defaultFormValues();

    const values = { ...defaultFormValues(), ...saved };
    if (Array.isArray(saved.presentStudents)) {
        values.presentStudents = saved.presentStudents;
    } else if (Array.isArray(saved.absentees)) {
        // Older saves stored absentees instead of present students
        values.presentStudents = getStoredStudents(cohort).filter(name => !saved.absentees.includes(name));
    } else {
        values.presentStudents = [];
    }
    return values;
}

// ---- Cohorts ----

function setCohortDropdownOpen(isOpen) {
    cohortControls.classList.toggle('is-open', isOpen);
    cohortDropdownBtn.setAttribute('aria-expanded', isOpen);
}

function renderCohorts() {
    cohortDropdownLabel.textContent = currentCohort || 'Add cohort';
    cohortDropdownMenu.innerHTML = '';

    getStoredCohorts().forEach(cohort => {
        const isActive = cohort === currentCohort;
        const row = document.createElement('div');
        row.className = 'cohort-dropdown-item';
        row.classList.toggle('is-active', isActive);
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', isActive);

        const label = document.createElement('span');
        label.textContent = cohort;
        row.appendChild(label);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'cohort-dropdown-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${cohort}`;
        deleteBtn.setAttribute('aria-label', `Delete ${cohort}`);
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteCohort(cohort);
        });
        row.appendChild(deleteBtn);

        row.addEventListener('click', function() {
            selectCohort(cohort);
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

// Switch the form to a cohort ('' when there are none) and load its last saved values
function selectCohort(cohort) {
    currentCohort = cohort;
    renderCohorts();
    applyFormValues(getFormValuesForCohort(cohort));
    resetOutput();
}

function addCohort() {
    const name = (prompt('Enter cohort name:') || '').trim();
    if (!name) return;

    const cohorts = getStoredCohorts();
    const existing = cohorts.find(c => c.toLowerCase() === name.toLowerCase());
    if (!existing) {
        cohorts.push(name);
        writeStorage(COHORTS_STORAGE_KEY, cohorts);
    }
    selectCohort(existing || name);
    setCohortDropdownOpen(false);
}

function deleteCohort(cohort) {
    if (!confirm(`Delete cohort "${cohort}" and all its saved data?`)) return;

    const cohorts = getStoredCohorts().filter(c => c !== cohort);
    writeStorage(COHORTS_STORAGE_KEY, cohorts);
    [STUDENTS_BY_COHORT_STORAGE_KEY, LAST_PROGRESS_BY_COHORT_STORAGE_KEY].forEach(key => {
        const map = readCohortMap(key);
        delete map[cohort];
        writeStorage(key, map);
    });

    // Deleting another cohort keeps the current form as is
    if (cohorts.includes(currentCohort)) {
        renderCohorts();
    } else {
        selectCohort(cohorts[0] || '');
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

    getStoredStudents(currentCohort).forEach(name => {
        const item = document.createElement('div');
        item.className = 'student-picker-item';
        item.dataset.name = name;
        item.setAttribute('role', 'option');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'student-picker-name';
        nameSpan.textContent = name;
        item.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'student-picker-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${name}`;
        deleteBtn.setAttribute('aria-label', `Delete ${name}`);
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`Delete "${name}" from students list?`)) {
                deleteStudent(name);
            }
        });
        item.appendChild(deleteBtn);

        item.addEventListener('click', function() {
            if (presentStudents.has(name)) {
                presentStudents.delete(name);
            } else {
                presentStudents.add(name);
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
        const isPresent = presentStudents.has(item.dataset.name);
        item.classList.toggle('is-selected', isPresent);
        item.setAttribute('aria-selected', isPresent);
        anyPresent = anyPresent || isPresent;
    }
    toggleAllStudentsBtn.textContent = anyPresent ? 'Clear' : 'Select All';
}

function deleteStudent(name) {
    saveStudents(currentCohort, getStoredStudents(currentCohort).filter(student => student !== name));
    presentStudents.delete(name);
    renderStudents();
}

addStudentBtn.addEventListener('click', function() {
    if (!currentCohort) {
        alert('Please select a cohort first.');
        return;
    }
    const name = (prompt('Enter student name:') || '').trim();
    if (!name) return;

    const students = getStoredStudents(currentCohort);
    if (students.some(student => student.toLowerCase() === name.toLowerCase())) return;

    students.push(name);
    saveStudents(currentCohort, students);
    renderStudents();
});

toggleAllStudentsBtn.addEventListener('click', function() {
    const students = getStoredStudents(currentCohort);
    const anyPresent = students.some(name => presentStudents.has(name));
    presentStudents = new Set(anyPresent ? [] : students);
    updateStudentSelection();
});

// ---- Form ----

function autoResize(textarea) {
    textarea.style.height = 'auto';
    // scrollHeight leaves out the border, which border-box sizing counts in height
    textarea.style.height = textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight + 'px';
}

[topicsInput, tasksInput].forEach(textarea => {
    textarea.addEventListener('input', () => autoResize(textarea));
});

// Local date as YYYY-MM-DD (toISOString() gives the UTC date, which can be yesterday)
function todayDateString() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultFormValues() {
    return {
        week: '0',
        day: '1',
        sessionDate: todayDateString(),
        sessionTime: DEFAULT_SESSION_TIME,
        topics: '',
        tasks: '',
        presentStudents: []
    };
}

function readFormValues() {
    return {
        week: weekInput.value,
        day: dayInput.value,
        sessionDate: sessionDateInput.value,
        sessionTime: sessionTimeInput.value,
        topics: topicsInput.value,
        tasks: tasksInput.value,
        presentStudents: getStoredStudents(currentCohort).filter(name => presentStudents.has(name))
    };
}

function applyFormValues(values) {
    weekInput.value = values.week;
    dayInput.value = values.day;
    sessionDateInput.value = values.sessionDate;
    sessionTimeInput.value = values.sessionTime;
    topicsInput.value = values.topics;
    tasksInput.value = values.tasks;
    autoResize(topicsInput);
    autoResize(tasksInput);
    presentStudents = new Set(values.presentStudents);
    renderStudents();
}

document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all fields?')) {
        applyFormValues(defaultFormValues());
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

    if (hasContent) {
        lines.push(markdown ? '---' : '—');
    }
    if (markdown) {
        lines.push('**Team - Code For India Foundation**', '[Code For India](https://codeforindia.com)');
    } else {
        lines.push('Team - Code For India Foundation', 'https://codeforindia.com');
    }
    return lines.join('\n') + '\n';
}

function resetOutput() {
    generatedUpdate = null;
    outputContent.textContent = OUTPUT_PLACEHOLDER;
    copyBtn.hidden = true;
    copyMarkdownBtn.hidden = true;
}

progressForm.addEventListener('submit', function(e) {
    e.preventDefault();

    if (!currentCohort) {
        alert('Please select a cohort first.');
        return;
    }

    const values = readFormValues();
    const update = {
        cohort: currentCohort,
        week: values.week,
        day: values.day,
        attendance: values.presentStudents.length,
        sessionDate: formatSessionDate(values.sessionDate),
        sessionTime: values.sessionTime,
        topics: toListItems(values.topics),
        tasks: toListItems(values.tasks),
        absentees: getStoredStudents(currentCohort).filter(name => !presentStudents.has(name))
    };

    generatedUpdate = {
        text: formatUpdate(update, false),
        markdown: formatUpdate(update, true)
    };
    outputContent.textContent = generatedUpdate.text;
    copyBtn.hidden = false;
    copyMarkdownBtn.hidden = false;

    saveFormValues(currentCohort, values);
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
selectCohort(getStoredCohorts()[0] || '');
