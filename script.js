function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.form-group textarea').forEach(ta => {
        autoResize(ta);
        ta.addEventListener('input', () => autoResize(ta));
    });
});

const COHORTS_STORAGE_KEY = 'cfi_cohorts';
const STUDENTS_BY_COHORT_STORAGE_KEY = 'cfi_students_by_cohort';
const LAST_PROGRESS_BY_COHORT_STORAGE_KEY = 'cfi_lastProgress_by_cohort';

const cohortControls = document.getElementById('cohortControls');
const cohortDropdownBtn = document.getElementById('cohortDropdownBtn');
const cohortDropdownMenu = document.getElementById('cohortDropdownMenu');
const cohortDropdownLabel = document.getElementById('cohortDropdownLabel');
let currentCohort = '';

function getStoredCohorts() {
    const raw = localStorage.getItem(COHORTS_STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cleaned = parsed.map(item => String(item || '').trim()).filter(Boolean);
        return cleaned;
    } catch (error) {
        console.error('Error reading cohorts from storage:', error);
        return [];
    }
}

function saveCohorts(cohorts) {
    localStorage.setItem(COHORTS_STORAGE_KEY, JSON.stringify(cohorts));
}

function renderCohorts(selectedCohort) {
    if (!cohortDropdownMenu || !cohortDropdownLabel) return;
    const cohorts = getStoredCohorts();
    currentCohort = selectedCohort || cohorts[0] || '';
    cohortDropdownLabel.textContent = currentCohort || 'Add cohort';
    cohortDropdownMenu.innerHTML = '';

    cohorts.forEach(cohort => {
        const row = document.createElement('div');
        row.className = `cohort-dropdown-item${cohort === currentCohort ? ' is-active' : ''}`;

        const label = document.createElement('span');
        label.textContent = cohort;
        row.appendChild(label);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'cohort-dropdown-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${cohort}`;
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteCohort(cohort);
        });
        row.appendChild(deleteBtn);

        row.addEventListener('click', function() {
            selectCohort(cohort);
            closeCohortDropdown();
        });
        cohortDropdownMenu.appendChild(row);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'cohort-dropdown-add';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add cohort';
    addBtn.addEventListener('click', function() {
        addCohort();
    });
    addWrap.appendChild(addBtn);
    cohortDropdownMenu.appendChild(addWrap);
}

function getStudentsByCohort() {
    const raw = localStorage.getItem(STUDENTS_BY_COHORT_STORAGE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.error('Error reading students-by-cohort from storage:', error);
        return {};
    }
}

function saveStudentsByCohort(map) {
    localStorage.setItem(STUDENTS_BY_COHORT_STORAGE_KEY, JSON.stringify(map));
}

function getStoredStudents(cohort) {
    const studentsByCohort = getStudentsByCohort();
    const list = studentsByCohort[cohort];
    if (Array.isArray(list)) {
        return list.map(name => String(name || '').trim()).filter(Boolean);
    }

    // New cohorts start empty
    studentsByCohort[cohort] = [];
    saveStudentsByCohort(studentsByCohort);
    return [];
}

function saveStudents(cohort, students) {
    const studentsByCohort = getStudentsByCohort();
    studentsByCohort[cohort] = students;
    saveStudentsByCohort(studentsByCohort);
}

function getCurrentCohort() {
    return currentCohort || '';
}

function closeCohortDropdown() {
    if (!cohortControls || !cohortDropdownBtn) return;
    cohortControls.classList.remove('is-open');
    cohortDropdownBtn.setAttribute('aria-expanded', 'false');
}

function openCohortDropdown() {
    if (!cohortControls || !cohortDropdownBtn) return;
    cohortControls.classList.add('is-open');
    cohortDropdownBtn.setAttribute('aria-expanded', 'true');
}

function toggleCohortDropdown() {
    if (!cohortControls) return;
    if (cohortControls.classList.contains('is-open')) {
        closeCohortDropdown();
    } else {
        openCohortDropdown();
    }
}

function selectCohort(cohort) {
    currentCohort = cohort;
    renderCohorts(cohort);
    renderStudents(getStoredStudents(cohort));
    loadFormDataForCohort(cohort);
    document.getElementById('outputContent').textContent = 'Fill in the form and click "Generate Update" to see the output here.';
    document.getElementById('copyBtn').style.display = 'none';
    document.getElementById('copyMarkdownBtn').style.display = 'none';
}

function addCohort() {
    const name = prompt('Enter cohort name:');
    if (!name) return;
    const normalized = name.trim();
    if (!normalized) return;

    const cohorts = getStoredCohorts();
    const existing = cohorts.find(c => c.toLowerCase() === normalized.toLowerCase());
    if (existing) {
        selectCohort(existing);
        closeCohortDropdown();
        return;
    }

    cohorts.push(normalized);
    saveCohorts(cohorts);
    selectCohort(normalized);
    closeCohortDropdown();
}

function deleteCohort(cohort) {
    const cohorts = getStoredCohorts();
    const shouldDelete = confirm(`Delete cohort "${cohort}" and all its saved data?`);
    if (!shouldDelete) return;

    const updatedCohorts = cohorts.filter(c => c !== cohort);
    saveCohorts(updatedCohorts);

    const studentsByCohort = getStudentsByCohort();
    delete studentsByCohort[cohort];
    saveStudentsByCohort(studentsByCohort);

    const progressByCohort = getLastProgressByCohort();
    delete progressByCohort[cohort];
    saveLastProgressByCohort(progressByCohort);

    const nextCohort = updatedCohorts.includes(currentCohort) ? currentCohort : updatedCohorts[0];
    if (nextCohort) {
        selectCohort(nextCohort);
    } else {
        currentCohort = '';
        renderCohorts('');
        renderStudents([]);
        applyDefaultFormValues();
        document.getElementById('outputContent').textContent = 'Fill in the form and click "Generate Update" to see the output here.';
        document.getElementById('copyBtn').style.display = 'none';
        document.getElementById('copyMarkdownBtn').style.display = 'none';
    }
}

function deleteStudent(studentName) {
    const cohort = getCurrentCohort();
    const students = getStoredStudents(cohort);
    const filtered = students.filter(name => name !== studentName);
    saveStudents(cohort, filtered);
    renderStudents(filtered);
    updateAttendanceCount();
}

// Custom absentees picker (replaces native select styling - browser forces blue highlight)
function initAbsenteesPicker() {
    const students = getStoredStudents(getCurrentCohort());
    renderStudents(students);
}

function renderStudents(students) {
    const select = document.getElementById('absentees');
    const picker = document.getElementById('absenteesPicker');
    if (!select || !picker) return;

    const previouslySelected = new Set(
        Array.from(select.selectedOptions).map(option => option.value)
    );

    select.innerHTML = '';
    picker.innerHTML = '';

    students.forEach(studentName => {
        const option = document.createElement('option');
        option.value = studentName;
        option.textContent = studentName;
        option.selected = previouslySelected.has(studentName);
        select.appendChild(option);

        const item = document.createElement('div');
        item.className = 'absentees-picker-item';
        item.dataset.value = studentName;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.selected);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'absentees-picker-name';
        nameSpan.textContent = studentName;
        item.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'absentees-picker-delete-btn';
        deleteBtn.title = `Delete ${studentName}`;
        deleteBtn.setAttribute('aria-label', `Delete ${studentName}`);
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const shouldDelete = confirm(`Delete "${studentName}" from students list?`);
            if (!shouldDelete) return;
            deleteStudent(studentName);
        });
        item.appendChild(deleteBtn);

        item.addEventListener('click', function(e) {
            e.preventDefault();
            option.selected = !option.selected;
            item.classList.toggle('is-selected', option.selected);
            item.setAttribute('aria-selected', option.selected);
            updateAttendanceCount();
            updateClearBtnLabel();
            select.dispatchEvent(new Event('change'));
        });
        if (option.selected) item.classList.add('is-selected');
        picker.appendChild(item);
    });
    updateClearBtnLabel();
}

function updateClearBtnLabel() {
    if (!absenteesClearBtn) return;
    const select = document.getElementById('absentees');
    if (!select) return;
    const anySelected = Array.from(select.options).some(opt => opt.selected);
    absenteesClearBtn.textContent = anySelected ? 'Clear' : 'Select All';
}

const absenteesClearBtn = document.getElementById('absenteesClearBtn');
if (absenteesClearBtn) {
    absenteesClearBtn.addEventListener('click', function() {
        const select = document.getElementById('absentees');
        if (!select) return;
        const anySelected = Array.from(select.options).some(opt => opt.selected);
        Array.from(select.options).forEach(opt => { opt.selected = !anySelected; });
        syncAbsenteesPickerFromSelect();
        updateAttendanceCount();
        updateClearBtnLabel();
    });
}

const addStudentBtn = document.getElementById('addStudentBtn');
if (addStudentBtn) {
    addStudentBtn.addEventListener('click', function() {
        const name = prompt('Enter student name:');
        if (!name) return;
        const normalized = name.trim();
        if (!normalized) return;

        const cohort = getCurrentCohort();
        const students = getStoredStudents(cohort);
        const exists = students.some(student => student.toLowerCase() === normalized.toLowerCase());
        if (exists) return;

        students.push(normalized);
        saveStudents(cohort, students);
        renderStudents(students);
        updateAttendanceCount();
    });
}

if (cohortDropdownBtn) {
    cohortDropdownBtn.addEventListener('click', function() {
        toggleCohortDropdown();
    });
}

document.addEventListener('click', function(event) {
    if (!cohortControls) return;
    if (!cohortControls.contains(event.target)) {
        closeCohortDropdown();
    }
});

function syncAbsenteesPickerFromSelect() {
    const select = document.getElementById('absentees');
    const picker = document.getElementById('absenteesPicker');
    if (!select || !picker) return;
    Array.from(select.options).forEach((opt, i) => {
        const item = picker.children[i];
        if (item && item.dataset.value === opt.value) {
            item.classList.toggle('is-selected', opt.selected);
            item.setAttribute('aria-selected', opt.selected);
        }
    });
}

// Theme toggle functionality
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('themeToggle').innerHTML = '<span class="theme-icon">🌙</span>';
    } else {
        document.body.classList.remove('light-mode');
        document.getElementById('themeToggle').innerHTML = '<span class="theme-icon">☀️</span>';
    }
}

document.getElementById('themeToggle').addEventListener('click', function() {
    const isLightMode = document.body.classList.contains('light-mode');
    
    if (isLightMode) {
        // Switch to dark mode
        document.body.classList.remove('light-mode');
        this.innerHTML = '<span class="theme-icon">☀️</span>';
        localStorage.setItem('theme', 'dark');
    } else {
        // Switch to light mode
        document.body.classList.add('light-mode');
        this.innerHTML = '<span class="theme-icon">🌙</span>';
        localStorage.setItem('theme', 'light');
    }
});

// Initialize theme on page load
initTheme();

function getLastProgressByCohort() {
    const raw = localStorage.getItem(LAST_PROGRESS_BY_COHORT_STORAGE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.error('Error reading last-progress-by-cohort from storage:', error);
        return {};
    }
}

function saveLastProgressByCohort(map) {
    localStorage.setItem(LAST_PROGRESS_BY_COHORT_STORAGE_KEY, JSON.stringify(map));
}

// Save form data to localStorage
function saveFormData() {
    const cohort = getCurrentCohort();
    if (!cohort) return;
    const formData = {
        week: document.getElementById('week').value,
        day: document.getElementById('day').value,
        sessionDate: document.getElementById('sessionDate').value,
        sessionTime: document.getElementById('sessionTime').value,
        topics: document.getElementById('topics').value,
        tasks: document.getElementById('tasks').value,
        presentStudents: Array.from(document.getElementById('absentees').selectedOptions).map(option => option.value)
    };
    const progressByCohort = getLastProgressByCohort();
    progressByCohort[cohort] = formData;
    saveLastProgressByCohort(progressByCohort);
}

function applyDefaultFormValues() {
    document.getElementById('week').value = '0';
    document.getElementById('day').value = '1';
    document.getElementById('sessionTime').value = '1:30 PM - 4:30 PM';
    document.getElementById('topics').value = '';
    document.getElementById('tasks').value = '';
    document.getElementById('sessionDate').value = new Date().toISOString().split('T')[0];

    const absenteesSelectEl = document.getElementById('absentees');
    Array.from(absenteesSelectEl.options).forEach(option => {
        option.selected = false;
    });
    syncAbsenteesPickerFromSelect();
    updateAttendanceCount();
    updateClearBtnLabel();
}

// Load form data for selected cohort
function loadFormDataForCohort(cohort) {
    const progressByCohort = getLastProgressByCohort();
    const formData = progressByCohort[cohort];

    if (!formData) {
        // Legacy fallback from older single form storage
        const legacyRaw = localStorage.getItem('cfi_lastProgress');
        if (legacyRaw) {
            try {
                const legacyFormData = JSON.parse(legacyRaw);
                if (legacyFormData && typeof legacyFormData === 'object') {
                    progressByCohort[cohort] = legacyFormData;
                    saveLastProgressByCohort(progressByCohort);
                    localStorage.removeItem('cfi_lastProgress');
                    return loadFormDataForCohort(cohort);
                }
            } catch (error) {
                console.error('Error reading legacy form data:', error);
            }
        }
        applyDefaultFormValues();
        return false;
    }

    if (formData.week !== undefined) document.getElementById('week').value = formData.week;
    if (formData.day !== undefined) document.getElementById('day').value = formData.day;
    if (formData.sessionDate) document.getElementById('sessionDate').value = formData.sessionDate;
    if (formData.sessionTime) document.getElementById('sessionTime').value = formData.sessionTime;
    if (formData.topics !== undefined) document.getElementById('topics').value = formData.topics;
    if (formData.tasks !== undefined) document.getElementById('tasks').value = formData.tasks;

    const absenteesSelectEl = document.getElementById('absentees');
    Array.from(absenteesSelectEl.options).forEach(option => {
        option.selected = false;
    });

    if (formData.presentStudents && Array.isArray(formData.presentStudents)) {
        Array.from(absenteesSelectEl.options).forEach(option => {
            option.selected = formData.presentStudents.includes(option.value);
        });
    } else if (formData.absentees && Array.isArray(formData.absentees)) {
        Array.from(absenteesSelectEl.options).forEach(option => {
            option.selected = !formData.absentees.includes(option.value);
        });
    }

    syncAbsenteesPickerFromSelect();
    updateAttendanceCount();
    updateClearBtnLabel();
    return true;
}

// Attendance calculation based on present selections
const absenteesSelect = document.getElementById('absentees');

function updateAttendanceCount() {
    const selectedPresent = Array.from(absenteesSelect.selectedOptions).length;
    return selectedPresent;
}

// Update attendance when absentees selection changes
absenteesSelect.addEventListener('change', updateAttendanceCount);

// Set up cohorts and load selected cohort data
(function() {
    const cohorts = getStoredCohorts();
    const initialCohort = cohorts[0];
    if (initialCohort) {
        selectCohort(initialCohort);
    } else {
        renderCohorts('');
        renderStudents([]);
        applyDefaultFormValues();
    }
})();

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear authentication from localStorage
        localStorage.removeItem('cfi_authenticated');
        // Redirect to login page
        window.location.href = 'login/';
    }
});

document.getElementById('progressForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form values
    const cohort = getCurrentCohort();
    if (!cohort) {
        alert('Please select a cohort first.');
        return;
    }
    const week = document.getElementById('week').value;
    const day = document.getElementById('day').value;
    const sessionDate = document.getElementById('sessionDate').value;
    const sessionTime = document.getElementById('sessionTime').value;
    const topicsText = document.getElementById('topics').value;
    const tasksText = document.getElementById('tasks').value;
    const absenteesSelect = document.getElementById('absentees');
    const presentStudents = Array.from(absenteesSelect.selectedOptions).map(option => option.value);
    const attendance = presentStudents.length;
    const allStudents = Array.from(absenteesSelect.options).map(option => option.value);
    const absentees = allStudents.filter(name => !presentStudents.includes(name));
    
    // Process topics - split by newline and format as bullet points
    const topics = topicsText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            // Remove existing bullet points if present
            return line.replace(/^[•\-\*]\s*/, '').trim();
        });
    
    // Process tasks - split by newline and format as numbered list
    const tasks = tasksText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            // Remove existing numbering if present
            return line.replace(/^\d+\.\s*/, '').trim();
        });
    
    // Generate output
    let output = `${cohort} - Daily Progress\n\n`;
    output += `Week: ${week}\n`;
    output += `Session: ${day}\n`;
    output += `Attendance Count: ${attendance}\n`;
    
    // Format date for display
    let formattedDate = '';
    if (sessionDate) {
        const dateObj = new Date(sessionDate + 'T00:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        formattedDate = dateObj.toLocaleDateString('en-US', options);
    }
    
    output += `Session Date: ${formattedDate || sessionDate}\n`;
    output += `Session Time: ${sessionTime}\n\n`;
    
    if (topics.length > 0) {
        output += 'Topics Covered:\n';
        topics.forEach(topic => {
            output += `• ${topic}\n`;
        });
        output += '\n';
    }
    
    if (tasks.length > 0) {
        output += 'Tasks & Todos:\n';
        tasks.forEach((task, index) => {
            output += `• ${task}\n`;
        });
        output += '\n';
    }
    
    if (absentees.length > 0) {
        output += 'Absentees:\n';
        absentees.forEach(name => {
            output += `• ${name}\n`;
        });
        output += '\n';
    }
    
    const hasContent = topics.length > 0 || tasks.length > 0 || absentees.length > 0;
    if (hasContent) {
        output += '—\n';
    }
    output += 'Team - Code For India Foundation\n';
    output += 'https://codeforindia.com\n';
    
    // Display output
    document.getElementById('outputContent').textContent = output;
    document.getElementById('copyBtn').style.display = 'block';
    document.getElementById('copyMarkdownBtn').style.display = 'block';
    
    // Save form data to localStorage after successful generation
    saveFormData();
});

// Copy to clipboard functionality
document.getElementById('copyBtn').addEventListener('click', function() {
    const outputText = document.getElementById('outputContent').textContent;
    
    navigator.clipboard.writeText(outputText).then(function() {
        const btn = document.getElementById('copyBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#218838';
        
        setTimeout(function() {
            btn.textContent = originalText;
            btn.style.background = '#28a745';
        }, 2000);
    }).catch(function(err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually.');
    });
});

// Copy markdown functionality
document.getElementById('copyMarkdownBtn').addEventListener('click', function() {
    const outputText = document.getElementById('outputContent').textContent;
    
    // Convert plain text to markdown format
    let markdown = outputText
        .replace(/^Team CFI - Daily Progress Update$/gm, '## Team CFI - Daily Progress Update')
        .replace(/^Week: (.+)$/gm, '**Week:** $1')
        .replace(/^Session: (.+)$/gm, '**Session:** $1')
        .replace(/^Attendance Count: (.+)$/gm, '**Attendance Count:** $1')
        .replace(/^Session Date: (.+)$/gm, '**Session Date:** $1')
        .replace(/^Session Time: (.+)$/gm, '**Session Time:** $1')
        .replace(/^Topics Covered:$/gm, '### Topics Covered:')
        .replace(/^• (.+)$/gm, '- $1')
        .replace(/^Tasks & Action Items:$/gm, '### Tasks & Action Items:')
        .replace(/^(\d+)\. (.+)$/gm, '$1. $2')
        .replace(/^Absentees:$/gm, '### Absentees:')
        .replace(/^—$/gm, '---')
        .replace(/^Team CFI$/gm, '**Team CFI**')
        .replace(/^Code For India Foundation$/gm, 'Code For India Foundation')
        .replace(/^(https:\/\/codeforindia\.com)$/gm, '[Code For India](https://codeforindia.com)');
    
    navigator.clipboard.writeText(markdown).then(function() {
        const btn = document.getElementById('copyMarkdownBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#138496';
        
        setTimeout(function() {
            btn.textContent = originalText;
            btn.style.background = '#17a2b8';
        }, 2000);
    }).catch(function(err) {
        console.error('Failed to copy markdown: ', err);
        alert('Failed to copy markdown to clipboard. Please select and copy manually.');
    });
});

// Clear fields functionality
document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all fields?')) {
        document.getElementById('week').value = '0';
        document.getElementById('day').value = '1';
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('sessionDate').value = today;
        document.getElementById('sessionTime').value = '1:30 PM - 4:30 PM';
        document.getElementById('topics').value = '';
        document.getElementById('tasks').value = '';
        // Clear absentees selection (no default selections)
        const absenteesSelect = document.getElementById('absentees');
        Array.from(absenteesSelect.options).forEach(option => {
            option.selected = false;
        });
        syncAbsenteesPickerFromSelect();
        // Update attendance count after clearing absentees
        updateAttendanceCount();
        document.getElementById('outputContent').textContent = 'Fill in the form and click "Generate Update" to see the output here.';
        document.getElementById('copyBtn').style.display = 'none';
        document.getElementById('copyMarkdownBtn').style.display = 'none';
    }
});
