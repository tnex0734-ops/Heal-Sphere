// =============================================
// HealSphere EHR — Frontend Application Logic
// =============================================

// Uploaded files state
let uploadedFiles = [];
let selectedSymptomTags = [];
let currentPatientId = null;
let currentLang = 'en';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initLanguageSelector();
  initVoiceInput();
  initPatientInfo();
  initMedicalHistory();
  initReportUpload();
  initSymptomSuggestions();
  initTriageForm();
  initAnimations();
  initCounters();
  initParticleSphere();
});

// --- Navbar ---
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      mobileMenuBtn.classList.toggle('active');
    });
  }

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });

        // Close mobile menu
        navLinks.classList.remove('mobile-open');
        mobileMenuBtn.classList.remove('active');
      }
    });
  });
}

// --- Language Selector & i18n Engine ---
const langCodes = { en: 'EN', es: 'ES', fr: 'FR', de: 'DE', hi: 'HI', zh: 'ZH', ar: 'AR' };
const voiceLangMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', hi: 'hi-IN', zh: 'zh-CN', ar: 'ar-SA' };

function initLanguageSelector() {
  const langBtn = document.getElementById('langBtn');
  const langDropdown = document.getElementById('langDropdown');

  if (!langBtn || !langDropdown) return;

  // Toggle dropdown
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle('open');
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    langDropdown.classList.remove('open');
  });

  // Prevent dropdown clicks from closing it
  langDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Language option buttons
  langDropdown.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      setLanguage(lang);
      langDropdown.classList.remove('open');
    });
  });

  // Restore saved language
  const savedLang = localStorage.getItem('healSphere_lang');
  if (savedLang && window.translations && window.translations[savedLang]) {
    setLanguage(savedLang);
  }
}

function setLanguage(lang) {
  if (!window.translations || !window.translations[lang]) return;

  currentLang = lang;
  localStorage.setItem('healSphere_lang', lang);

  // Update button label
  const langLabel = document.getElementById('langLabel');
  if (langLabel) langLabel.textContent = langCodes[lang] || lang.toUpperCase();

  // Update active state in dropdown
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
  });

  // Set RTL for Arabic
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

  // Apply translations to DOM
  applyTranslations(lang);
}

function applyTranslations(lang) {
  const t = window.translations[lang];
  if (!t) return;

  // data-i18n="key" → sets textContent (preserving child SVGs)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) {
      // If element has child SVGs, only replace the text node
      const svgs = el.querySelectorAll('svg');
      if (svgs.length > 0) {
        // Find first text node child
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            child.textContent = ' ' + t[key];
            break;
          }
        }
      } else {
        el.textContent = t[key];
      }
    }
  });

  // data-i18n-html="key" → sets innerHTML (for keys with embedded <span> tags)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (t[key] !== undefined) {
      // Preserve leading SVGs
      const leadingSvgs = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'svg') {
          leadingSvgs.push(child.outerHTML);
        }
      }
      el.innerHTML = (leadingSvgs.length ? leadingSvgs.join('') + '\n                ' : '') + t[key];
    }
  });

  // data-i18n-placeholder="key" → sets placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) {
      el.placeholder = t[key];
    }
  });
}

// --- Voice Input (Web Speech API) ---
function initVoiceInput() {
  const voiceBtn = document.getElementById('voiceBtn');
  const voiceStatus = document.getElementById('voiceStatus');
  const symptomInput = document.getElementById('symptomInput');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    voiceBtn.style.display = 'none';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let isListening = false;

  voiceBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      return;
    }

    recognition.lang = voiceLangMap[currentLang] || 'en-US';
    recognition.start();
    isListening = true;
    voiceBtn.classList.add('listening');
    voiceStatus.style.display = 'flex';
  });

  recognition.onresult = (event) => {
    let final = '';
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    if (final) {
      const existing = symptomInput.value;
      symptomInput.value = existing ? existing + ' ' + final : final;
    }
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceStatus.style.display = 'none';
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceStatus.style.display = 'none';
  };
}

// --- Patient Information ---
function initPatientInfo() {
  const dobInput = document.getElementById('dobInput');
  const ageInput = document.getElementById('ageInput');
  const patientNameInput = document.getElementById('patientNameInput');
  const patientIdDisplay = document.getElementById('patientIdDisplay');

  // Set max DOB to today
  if (dobInput) {
    dobInput.max = new Date().toISOString().split('T')[0];

    dobInput.addEventListener('change', () => {
      const dob = new Date(dobInput.value);
      if (!isNaN(dob)) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        if (ageInput) ageInput.value = age >= 0 ? age : '';
      }
    });
  }

  // Patient name lookup — check if existing patient
  if (patientNameInput) {
    let lookupTimeout;
    patientNameInput.addEventListener('input', () => {
      clearTimeout(lookupTimeout);
      const name = patientNameInput.value.trim();
      if (name.length < 3) return;

      lookupTimeout = setTimeout(async () => {
        if (typeof findPatientByName === 'function') {
          const matches = await findPatientByName(name);
          if (matches && matches.length > 0) {
            // Auto-fill with first exact match
            const exactMatch = matches.find(p => p.name.toLowerCase() === name.toLowerCase());
            if (exactMatch) {
              fillPatientData(exactMatch);
            }
          }
        }
      }, 600);
    });
  }

  // Check if patientId is in URL query parameters (e.g. from Patient Profile page)
  const params = new URLSearchParams(window.location.search);
  const urlPatientId = params.get('patientId');
  if (urlPatientId) {
    setTimeout(async () => {
      if (typeof findPatientByPatientId === 'function') {
        const patient = await findPatientByPatientId(urlPatientId);
        if (patient) {
          // Pre-fill name and other fields
          const nameInput = document.getElementById('patientNameInput');
          if (nameInput) nameInput.value = patient.name || '';
          fillPatientData(patient);
        }
      }
    }, 500);
  }
}

function fillPatientData(patient) {
  currentPatientId = patient.patientId;

  const fields = {
    'patientIdDisplay': patient.patientId,
    'phoneInput': patient.phone,
    'dobInput': patient.dob,
    'ageInput': patient.age,
    'genderInput': patient.gender,
    'medicalHistoryInput': patient.medicalHistory
  };

  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  }

  // Show toast
  showToast(`Returning patient found: ${patient.name}`, 'success');
}

// --- Medical History Chips ---
function initMedicalHistory() {
  const chips = document.querySelectorAll('.chip');
  const textarea = document.getElementById('medicalHistoryInput');
  if (!textarea) return;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const condition = chip.getAttribute('data-condition');
      chip.classList.toggle('active');

      if (chip.classList.contains('active')) {
        // Add to textarea
        const current = textarea.value;
        const line = `• ${condition}`;
        textarea.value = current ? current + '\n' + line : line;
      } else {
        // Remove from textarea
        const lines = textarea.value.split('\n').filter(l => !l.includes(condition));
        textarea.value = lines.join('\n');
      }
    });
  });
}

// --- Report Upload ---
function initReportUpload() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('reportFileInput');
  if (!uploadZone || !fileInput) return;

  // Drag & drop events
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });
}

function handleFiles(files) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 20 * 1024 * 1024; // 20MB

  files.forEach(file => {
    if (!allowed.includes(file.type)) {
      showToast(`${file.name}: unsupported format. Use PDF, JPG, or PNG.`, 'error');
      return;
    }
    if (file.size > maxSize) {
      showToast(`${file.name}: exceeds 20MB limit.`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileObj = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result,
        analysis: null
      };
      uploadedFiles.push(fileObj);
      renderUploadedFile(fileObj);
      // Auto-analyze immediately after upload
      analyzeReport(String(fileObj.id));
    };
    reader.readAsDataURL(file);
  });
}

function renderUploadedFile(fileObj) {
  const list = document.getElementById('uploadedFilesList');
  if (!list) return;

  const isPDF = fileObj.type === 'application/pdf';
  const icon = isPDF
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

  const item = document.createElement('div');
  item.className = 'upload-file-item';
  item.id = `file-item-${fileObj.id}`;
  item.innerHTML = `
    <div class="upload-file-icon">${icon}</div>
    <div class="upload-file-info">
      <div class="upload-file-name">${escapeHTML(fileObj.name)}</div>
      <div class="upload-file-status upload-status-analyzing">
        <span class="analyzing-spinner"></span> Analyzing & extracting details...
      </div>
    </div>
    <div class="upload-file-actions">
      <button type="button" class="analyze-btn loading" disabled>
        Analyzing...
      </button>
      <button type="button" class="remove-file-btn" onclick="removeFile('${fileObj.id}')" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  list.appendChild(item);
}

function removeFile(fileId) {
  uploadedFiles = uploadedFiles.filter(f => String(f.id) !== String(fileId));
  const item = document.getElementById(`file-item-${fileId}`);
  if (item) item.remove();
}

async function analyzeReport(fileId) {
  const fileObj = uploadedFiles.find(f => String(f.id) === String(fileId));
  if (!fileObj) return;

  const item = document.getElementById(`file-item-${fileId}`);
  const btn = item ? item.querySelector('.analyze-btn') : null;

  if (btn) {
    btn.textContent = 'Analyzing...';
    btn.classList.add('loading');
    btn.disabled = true;
  }

  try {
    const response = await fetch('/api/reports/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileObj.name,
        fileType: fileObj.type,
        fileDataUrl: fileObj.dataUrl
      })
    });

    const result = await response.json();
    fileObj.analysis = result;
    renderReportAnalysis(fileObj, result);

    // Update file item status
    const statusEl = item ? item.querySelector('.upload-file-status') : null;
    if (statusEl) {
      statusEl.className = 'upload-file-status upload-status-done';
      statusEl.innerHTML = '✔ Analyzed & Auto-filled';
    }

    if (btn) {
      btn.textContent = '✔ Analyzed';
      btn.disabled = true;
      btn.classList.remove('loading');
    }

    // Auto-fill form fields from extracted patient data
    const filledFields = autoFillFromReport(result);

    if (filledFields.length > 0) {
      showToast(`Auto-filled: ${filledFields.join(', ')}`, 'success');
    } else {
      showToast('Report analyzed. No patient details found to auto-fill.', 'success');
    }
  } catch (err) {
    console.error('Report analysis error:', err);
    if (btn) {
      btn.textContent = 'Retry Analysis';
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    showToast('Analysis failed. Check connection.', 'error');
  }
}

function renderReportAnalysis(fileObj, analysis) {
  const container = document.getElementById('reportAnalysisResults');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'report-analysis-card';

  let findingsHtml = '';
  if (analysis.findings && analysis.findings.length > 0) {
    const findingItems = analysis.findings.map(f => `
      <div class="analysis-finding-item">
        <div class="analysis-finding-label">${escapeHTML(f.name)}</div>
        <div class="analysis-finding-value">${escapeHTML(String(f.value))}</div>
        <div class="analysis-finding-status status-${(f.status || 'normal').toLowerCase()}">${escapeHTML(f.status || 'Normal')}</div>
      </div>
    `).join('');
    findingsHtml = `<div class="analysis-findings-grid">${findingItems}</div>`;
  }

  card.innerHTML = `
    <h4>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      AI Analysis: ${escapeHTML(fileObj.name)}
    </h4>
    ${analysis.summary ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">${escapeHTML(analysis.summary)}</p>` : ''}
    ${findingsHtml}
    ${analysis.risks && analysis.risks.length > 0 ? `<p style="margin-top:12px;font-size:13px;color:var(--danger);"><strong>⚠ Risk Indicators:</strong> ${analysis.risks.join(', ')}</p>` : ''}
    ${analysis.recommendations && analysis.recommendations.length > 0 ? `<p style="margin-top:8px;font-size:13px;color:var(--text-secondary);"><strong>Recommendations:</strong> ${analysis.recommendations.join('; ')}</p>` : ''}
  `;

  container.appendChild(card);
}

// --- Auto-Fill Form Fields from Report Analysis ---
function autoFillFromReport(analysis) {
  const patient = analysis.extractedPatient;
  if (!patient || typeof patient !== 'object') return [];

  const filledFields = [];

  // Helper: only fill if the target field is currently empty
  function fillIfEmpty(inputId, value, fieldLabel) {
    if (!value || value === 'null' || value === 'N/A') return false;
    const el = document.getElementById(inputId);
    if (!el) return false;
    // Don't overwrite user-entered data
    if (el.value && el.value.trim() !== '') return false;
    el.value = String(value);
    // Highlight the auto-filled field
    el.classList.add('auto-filled');
    setTimeout(() => el.classList.remove('auto-filled'), 3000);
    filledFields.push(fieldLabel);
    return true;
  }

  // Patient Name
  fillIfEmpty('patientNameInput', patient.name, 'Name');

  // Age
  if (patient.age) {
    fillIfEmpty('ageInput', patient.age, 'Age');
    // Temporarily make age editable since it wasn't auto-calculated from DOB
    const ageEl = document.getElementById('ageInput');
    if (ageEl && ageEl.readOnly && !document.getElementById('dobInput')?.value) {
      ageEl.readOnly = false;
      ageEl.classList.remove('form-input-readonly');
    }
  }

  // Gender
  if (patient.gender) {
    const genderEl = document.getElementById('genderInput');
    if (genderEl && !genderEl.value) {
      const genderMap = { 'male': 'Male', 'female': 'Female', 'other': 'Other', 'm': 'Male', 'f': 'Female' };
      const mapped = genderMap[patient.gender.toLowerCase()] || patient.gender;
      const options = Array.from(genderEl.options);
      const match = options.find(opt => opt.value.toLowerCase() === mapped.toLowerCase());
      if (match) {
        genderEl.value = match.value;
        genderEl.classList.add('auto-filled');
        setTimeout(() => genderEl.classList.remove('auto-filled'), 3000);
        filledFields.push('Gender');
      }
    }
  }

  // Date of Birth
  if (patient.dob) {
    const filled = fillIfEmpty('dobInput', patient.dob, 'DOB');
    if (filled) {
      // Trigger the DOB change handler to auto-calculate age
      const dobInput = document.getElementById('dobInput');
      if (dobInput) dobInput.dispatchEvent(new Event('change'));
    }
  }

  // Blood Pressure
  fillIfEmpty('bpInput', patient.bloodPressure, 'Blood Pressure');

  // Temperature
  fillIfEmpty('tempInput', patient.temperature, 'Temperature');

  // Heart Rate
  fillIfEmpty('hrInput', patient.heartRate, 'Heart Rate');

  // Oxygen Level
  fillIfEmpty('o2Input', patient.oxygenLevel, 'O₂ Saturation');

  // Symptoms — append to existing text
  if (patient.symptoms && patient.symptoms !== 'null') {
    const symptomEl = document.getElementById('symptomInput');
    if (symptomEl) {
      const existing = symptomEl.value.trim();
      if (!existing) {
        symptomEl.value = patient.symptoms;
        symptomEl.classList.add('auto-filled');
        setTimeout(() => symptomEl.classList.remove('auto-filled'), 3000);
        filledFields.push('Symptoms');
      } else if (!existing.toLowerCase().includes(patient.symptoms.toLowerCase().substring(0, 20))) {
        // Append if not already present
        symptomEl.value = existing + '\n' + patient.symptoms;
        symptomEl.classList.add('auto-filled');
        setTimeout(() => symptomEl.classList.remove('auto-filled'), 3000);
        filledFields.push('Symptoms (appended)');
      }
    }
  }

  // Medical History — append to existing
  if (patient.medicalHistory && patient.medicalHistory !== 'null') {
    const historyEl = document.getElementById('medicalHistoryInput');
    if (historyEl) {
      const existing = historyEl.value.trim();
      if (!existing) {
        historyEl.value = patient.medicalHistory;
        historyEl.classList.add('auto-filled');
        setTimeout(() => historyEl.classList.remove('auto-filled'), 3000);
        filledFields.push('Medical History');
      } else if (!existing.toLowerCase().includes(patient.medicalHistory.toLowerCase().substring(0, 20))) {
        historyEl.value = existing + '\n' + patient.medicalHistory;
        historyEl.classList.add('auto-filled');
        setTimeout(() => historyEl.classList.remove('auto-filled'), 3000);
        filledFields.push('Medical History (appended)');
      }
    }
  }

  return filledFields;
}

// --- Symptom Suggestions ---
const SYMPTOM_LIST = [
  'Chest Pain', 'Chest Tightness', 'Chest Burning', 'Chest Pressure',
  'Shortness of Breath', 'Difficulty Breathing', 'Wheezing',
  'Severe Headache', 'Mild Headache', 'Migraine',
  'Fever', 'High Fever', 'Chills',
  'Nausea', 'Vomiting', 'Diarrhea',
  'Abdominal Pain', 'Severe Abdominal Pain', 'Bloating',
  'Cough', 'Persistent Cough', 'Coughing Blood',
  'Fatigue', 'Weakness', 'Dizziness',
  'Rash', 'Itching', 'Swelling',
  'Joint Pain', 'Back Pain', 'Muscle Pain',
  'Blurred Vision', 'Eye Pain',
  'Sore Throat', 'Runny Nose', 'Sneezing',
  'Heart Palpitations', 'Irregular Heartbeat',
  'Blood in Urine', 'Frequent Urination', 'UTI',
  'Numbness', 'Tingling', 'Paralysis',
  'Seizure', 'Fainting', 'Loss of Consciousness',
  'Anxiety', 'Insomnia', 'Depression',
  'Weight Loss', 'Swollen Legs', 'Sweating'
];

function initSymptomSuggestions() {
  const textarea = document.getElementById('symptomInput');
  const suggestionsBox = document.getElementById('symptomSuggestions');
  if (!textarea || !suggestionsBox) return;

  let debounceTimer;

  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const text = textarea.value;
      // Get last word being typed
      const lastWord = text.split(/[\s,;]+/).pop().trim();

      if (lastWord.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
      }

      const matches = SYMPTOM_LIST.filter(s =>
        s.toLowerCase().startsWith(lastWord.toLowerCase()) &&
        !selectedSymptomTags.includes(s)
      ).slice(0, 6);

      if (matches.length === 0) {
        suggestionsBox.style.display = 'none';
        return;
      }

      suggestionsBox.innerHTML = matches.map(m =>
        `<div class="symptom-suggestion-item" onclick="selectSymptomSuggestion('${escapeHTML(m)}')">${escapeHTML(m)}</div>`
      ).join('');
      suggestionsBox.style.display = 'block';
    }, 200);
  });

  // Hide suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!textarea.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = 'none';
    }
  });
}

function selectSymptomSuggestion(symptom) {
  const textarea = document.getElementById('symptomInput');
  const suggestionsBox = document.getElementById('symptomSuggestions');
  if (!textarea) return;

  // Replace last word in textarea
  const words = textarea.value.split(/([\s,;]+)/);
  words.pop();
  const base = words.join('');
  textarea.value = base ? base + ' ' + symptom + ', ' : symptom + ', ';

  suggestionsBox.style.display = 'none';
  addSymptomTag(symptom);
  textarea.focus();
}

function addSymptomTag(symptom) {
  if (selectedSymptomTags.includes(symptom)) return;
  selectedSymptomTags.push(symptom);

  const container = document.getElementById('symptomTagsContainer');
  if (!container) return;

  const tag = document.createElement('span');
  tag.className = 'symptom-tag-selected';
  tag.dataset.symptom = symptom;
  tag.innerHTML = `${escapeHTML(symptom)} <button type="button" class="symptom-tag-remove" onclick="removeSymptomTag('${escapeHTML(symptom)}')">×</button>`;
  container.appendChild(tag);
}

function removeSymptomTag(symptom) {
  selectedSymptomTags = selectedSymptomTags.filter(s => s !== symptom);
  const container = document.getElementById('symptomTagsContainer');
  if (!container) return;
  const tags = container.querySelectorAll('.symptom-tag-selected');
  tags.forEach(tag => {
    if (tag.dataset.symptom === symptom) tag.remove();
  });
}

// --- Triage Form ---
function initTriageForm() {
  const form = document.getElementById('triageForm');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const patientName = document.getElementById('patientNameInput')?.value.trim();
    const symptoms = document.getElementById('symptomInput').value.trim();

    if (!patientName) {
      shakeElement(document.getElementById('patientNameInput'));
      showToast('Please enter the patient name.', 'error');
      return;
    }
    if (!symptoms) {
      shakeElement(document.getElementById('symptomInput'));
      showToast('Please describe the symptoms.', 'error');
      return;
    }

    const medicalHistory = document.getElementById('medicalHistoryInput')?.value.trim();
    const reportAnalysisSummary = uploadedFiles
      .filter(f => f.analysis)
      .map(f => `Report (${f.name}): ${f.analysis.summary || ''} Findings: ${(f.analysis.findings || []).map(fi => `${fi.name}: ${fi.value} (${fi.status})`).join(', ')}`)
      .join('\n');

    const data = {
      lang: currentLang,
      patientName,
      patientId: currentPatientId || '',
      visitType: document.getElementById('visitTypeInput')?.value || 'First Visit',
      phone: document.getElementById('phoneInput')?.value.trim() || '',
      dob: document.getElementById('dobInput')?.value || '',
      symptoms,
      age: document.getElementById('ageInput').value || undefined,
      gender: document.getElementById('genderInput').value || undefined,
      bloodPressure: document.getElementById('bpInput').value || undefined,
      temperature: document.getElementById('tempInput').value || undefined,
      heartRate: document.getElementById('hrInput').value || undefined,
      oxygenLevel: document.getElementById('o2Input').value || undefined,
      medicalHistory: medicalHistory || '',
      reportAnalysis: reportAnalysisSummary || ''
    };

    // Show loading
    showLoading();
    submitBtn.classList.add('btn-loading');

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      showResults(result);

      // Save to Firebase if available
      if (typeof savePatient === 'function' && typeof saveAssessment === 'function') {
        try {
          // Save or update patient
          const patientResult = await savePatient({
            patientId: currentPatientId || '',
            name: patientName,
            phone: data.phone,
            dob: data.dob,
            age: data.age || null,
            gender: data.gender || '',
            medicalHistory: medicalHistory || ''
          });

          if (patientResult) {
            currentPatientId = patientResult.patientId;

            // Update Patient ID display
            const pidEl = document.getElementById('patientIdDisplay');
            if (pidEl) pidEl.value = currentPatientId;

            // Save uploaded reports first
            const reportIds = [];
            for (const fileObj of uploadedFiles) {
              if (typeof saveReport === 'function') {
                const reportId = await saveReport({
                  patientId: currentPatientId,
                  assessmentId: '',
                  fileName: fileObj.name,
                  fileType: fileObj.type,
                  fileSize: fileObj.size,
                  fileDataUrl: fileObj.dataUrl,
                  analysis: fileObj.analysis
                });
                if (reportId) reportIds.push(reportId);
              }
            }

            // Save assessment
            const assessmentId = await saveAssessment(
              { ...data, patientId: currentPatientId, reportIds },
              result
            );
            console.log('✅ Assessment saved:', assessmentId, '| Patient:', currentPatientId);
            showToast(`Record saved for ${patientName} (${currentPatientId})`, 'success');
          }
        } catch (saveErr) {
          console.error('Save error:', saveErr);
        }
      }
    } catch (error) {
      console.error('Triage request error:', error);
      showResults({
        conditions: [{ name: 'Service Error', confidence: 0, description: 'Could not connect to the triage service. Please check your connection and try again.' }],
        priority: 'MEDIUM',
        priorityReason: 'Unable to assess — please consult a healthcare professional',
        riskScore: 50,
        recommendations: ['Please try again', 'If experiencing severe symptoms, call emergency services'],
        immediateActions: ['Seek medical attention if symptoms are severe'],
        extractedSymptoms: [],
        vitalSignsAssessment: 'Unable to assess',
        disclaimer: 'Service temporarily unavailable.',
      });
    } finally {
      submitBtn.classList.remove('btn-loading');
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      // Reset EHR state
      uploadedFiles = [];
      selectedSymptomTags = [];
      currentPatientId = null;
      const filesList = document.getElementById('uploadedFilesList');
      if (filesList) filesList.innerHTML = '';
      const analysisResults = document.getElementById('reportAnalysisResults');
      if (analysisResults) analysisResults.innerHTML = '';
      const tagsContainer = document.getElementById('symptomTagsContainer');
      if (tagsContainer) tagsContainer.innerHTML = '';
      document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
      showEmpty();
    });
  }
}

// --- Display States ---
function showLoading() {
  document.getElementById('resultsEmpty').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'none';
  document.getElementById('resultsLoading').style.display = 'block';

  // Animate loading steps
  const steps = ['step1', 'step2', 'step3'];
  steps.forEach(id => {
    document.getElementById(id).className = 'loading-step';
  });
  document.getElementById('step1').classList.add('active');

  setTimeout(() => {
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step1').classList.add('done');
    document.getElementById('step2').classList.add('active');
  }, 1500);

  setTimeout(() => {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step2').classList.add('done');
    document.getElementById('step3').classList.add('active');
  }, 3000);
}

function showEmpty() {
  document.getElementById('resultsEmpty').style.display = 'block';
  document.getElementById('resultsContent').style.display = 'none';
  document.getElementById('resultsLoading').style.display = 'none';
}

function showResults(data) {
  document.getElementById('resultsEmpty').style.display = 'none';
  document.getElementById('resultsLoading').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'block';

  // Scroll to results on mobile
  if (window.innerWidth <= 1024) {
    const resultsPanel = document.getElementById('resultsPanel');
    setTimeout(() => {
      resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }

  renderPriority(data.priority, data.priorityReason);
  renderRiskScore(data.riskScore);
  renderVitals(data.vitalSignsAssessment);
  renderSymptomTags(data.extractedSymptoms);
  renderConditions(data.conditions);
  renderRecommendations(data.recommendations);
  renderActions(data.immediateActions);
  renderDisclaimer(data.disclaimer);
}

// --- Render Functions ---
function renderPriority(level, reason) {
  const banner = document.getElementById('priorityBanner');
  const label = document.getElementById('priorityLabel');
  const reasonEl = document.getElementById('priorityReason');

  // Remove existing classes
  banner.className = 'priority-banner';

  const levelLower = (level || 'medium').toLowerCase();
  banner.classList.add(`priority-${levelLower}-banner`);
  label.textContent = level || 'MEDIUM';
  reasonEl.textContent = reason || '-';
}

function renderRiskScore(score) {
  const value = score || 0;
  const valueEl = document.getElementById('riskValue');
  const bar = document.getElementById('riskBar');

  valueEl.textContent = value;

  // Set bar color based on score
  if (value >= 70) {
    bar.style.background = 'var(--danger)';
    valueEl.style.color = 'var(--danger)';
  } else if (value >= 40) {
    bar.style.background = 'var(--warning)';
    valueEl.style.color = 'var(--warning)';
  } else {
    bar.style.background = 'var(--success)';
    valueEl.style.color = 'var(--success)';
  }

  // Animate bar
  setTimeout(() => {
    bar.style.width = value + '%';
  }, 100);
}

function renderVitals(assessment) {
  const section = document.getElementById('vitalsSection');
  const text = document.getElementById('vitalsText');

  if (!assessment || assessment === 'Unable to assess') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  text.textContent = assessment;
}

function renderSymptomTags(symptoms) {
  const container = document.getElementById('symptomTags');
  const section = document.getElementById('symptomsSection');
  container.innerHTML = '';

  if (!symptoms || symptoms.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  symptoms.forEach(symptom => {
    const tag = document.createElement('span');
    tag.className = 'symptom-tag';
    tag.textContent = symptom;
    container.appendChild(tag);
  });
}

function renderConditions(conditions) {
  const container = document.getElementById('conditionsList');
  container.innerHTML = '';

  if (!conditions || conditions.length === 0) return;

  conditions.forEach((condition, i) => {
    const card = document.createElement('div');
    card.className = 'condition-card';

    // Color based on confidence
    if (condition.confidence >= 70) {
      card.style.borderLeftColor = 'var(--danger)';
    } else if (condition.confidence >= 40) {
      card.style.borderLeftColor = 'var(--warning)';
    } else {
      card.style.borderLeftColor = 'var(--primary)';
    }

    card.innerHTML = `
      <div class="condition-header">
        <span class="condition-name">${escapeHTML(condition.name)}</span>
        <span class="condition-confidence">${condition.confidence}%</span>
      </div>
      <p class="condition-desc">${escapeHTML(condition.description)}</p>
      <div class="condition-bar-bg">
        <div class="condition-bar" style="width: 0%"></div>
      </div>
    `;

    container.appendChild(card);

    // Animate confidence bar
    setTimeout(() => {
      card.querySelector('.condition-bar').style.width = condition.confidence + '%';
      if (condition.confidence >= 70) {
        card.querySelector('.condition-bar').style.background = 'var(--danger)';
      } else if (condition.confidence >= 40) {
        card.querySelector('.condition-bar').style.background = 'var(--warning)';
      }
    }, 200 + i * 150);
  });
}

function renderRecommendations(recs) {
  const list = document.getElementById('recommendationsList');
  list.innerHTML = '';

  if (!recs || recs.length === 0) return;

  recs.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    list.appendChild(li);
  });
}

function renderActions(actions) {
  const list = document.getElementById('actionsList');
  const section = document.getElementById('actionsSection');
  list.innerHTML = '';

  if (!actions || actions.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  actions.forEach(action => {
    const li = document.createElement('li');
    li.textContent = action;
    list.appendChild(li);
  });
}

function renderDisclaimer(text) {
  const el = document.getElementById('disclaimer');
  el.textContent = text || 'This is an AI-assisted triage tool for demonstration purposes only. Always consult a qualified healthcare professional.';
}

// --- Animations ---
function initAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
  });
}

// --- Counter Animation ---
function initCounters() {
  const counters = document.querySelectorAll('.stat-number[data-count]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-count'));
  const duration = 1500;
  const start = performance.now();

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(target * ease);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// --- Utilities ---
function shakeElement(el) {
  if (!el) return;
  el.style.animation = 'shake 0.5s ease-in-out';
  el.style.borderColor = 'var(--danger)';
  setTimeout(() => {
    el.style.animation = '';
    el.style.borderColor = '';
  }, 1000);
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  // Remove any existing toast
  const existing = document.querySelector('.hs-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `hs-toast hs-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Particle Sphere (WebGL via Three.js) ---
function initParticleSphere() {
  const container = document.getElementById('particle-sphere-container');
  if (!container) return;

  const width = container.clientWidth || 140;
  const height = container.clientHeight || 140;

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 2.7; // Position camera for a good sphere visual size
  
  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Parse color (Olive green color from theme)
  const sphereColorStr = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4A5D3E'; 
  const baseColor = new THREE.Color(sphereColorStr);

  // Fibonacci Sphere distribution
  const particlesCount = 4000;
  const vertices = [];
  const basePositions = [];
  const displacements = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const sphereRadius = 0.85;

  for (let i = 0; i < particlesCount; i++) {
    const y = 1 - (i / (particlesCount - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;

    const posX = x * sphereRadius;
    const posY = y * sphereRadius;
    const posZ = z * sphereRadius;

    vertices.push(posX, posY, posZ);
    basePositions.push(new THREE.Vector3(posX, posY, posZ));
    displacements.push(new THREE.Vector3(0, 0, 0));
  }

  // Create Points Geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  // Set colors
  const colors = [];
  for (let i = 0; i < particlesCount; i++) {
    colors.push(baseColor.r, baseColor.g, baseColor.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Texture helper for smooth glowing circles instead of square points
  const createPointTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Radial gradient
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, `rgba(${Math.floor(baseColor.r*255)}, ${Math.floor(baseColor.g*255)}, ${Math.floor(baseColor.b*255)}, 0.9)`);
    grad.addColorStop(0.7, `rgba(${Math.floor(baseColor.r*255)}, ${Math.floor(baseColor.g*255)}, ${Math.floor(baseColor.b*255)}, 0.4)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  // Material
  const material = new THREE.PointsMaterial({
    size: 0.075,
    map: createPointTexture(),
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
    vertexColors: true
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // Interactive controls
  const mouse = { x: 999, y: 999 }; // Offscreen initially
  const targetRotation = { x: 0, y: 0 };
  const rotation = { x: 0, y: 0 };
  const dragVelocity = { x: 0, y: 0 };
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Track mouse coordinates normalized -1 to +1 relative to container
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  container.addEventListener('mouseleave', () => {
    mouse.x = 999;
    mouse.y = 999;
  });

  // Track touch for mobile
  container.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = container.getBoundingClientRect();
      const touch = e.touches[0];
      mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    mouse.x = 999;
    mouse.y = 999;
  });

  // Mouse Dragging for manual rotation
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    dragVelocity.x = 0;
    dragVelocity.y = 0;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    targetRotation.y += dx * 0.005;
    targetRotation.x += dy * 0.005;
    
    dragVelocity.x = dx * 0.005;
    dragVelocity.y = dy * 0.005;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Handle Resize
  const handleResize = () => {
    const w = container.clientWidth || 140;
    const h = container.clientHeight || 140;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  // Animation Loop & Hover states
  const baseAutoRotateSpeed = 0.006;
  const hoverAutoRotateSpeed = 0.022;
  const rotationSmoothing = 0.08;
  const repulsionRadius = 0.55;
  const repulsionForce = 0.7;
  const returnForce = 0.02;
  const friction = 0.93;

  let currentScale = 1.0;
  let currentAutoRotateSpeed = baseAutoRotateSpeed;

  const animate = () => {
    requestAnimationFrame(animate);

    const isHovering = mouse.x !== 999;
    const targetScale = isHovering ? 1.25 : 1.0;
    const targetSpeed = isHovering ? hoverAutoRotateSpeed : baseAutoRotateSpeed;

    // Smoothly scale the points on hover
    currentScale += (targetScale - currentScale) * 0.08;
    points.scale.set(currentScale, currentScale, currentScale);

    // Smoothly speed up rotation on hover
    currentAutoRotateSpeed += (targetSpeed - currentAutoRotateSpeed) * 0.08;

    // Apply auto rotation when not dragging
    if (!isDragging) {
      targetRotation.y += currentAutoRotateSpeed;
      // Decay throw momentum
      targetRotation.y += dragVelocity.x;
      targetRotation.x += dragVelocity.y;
      dragVelocity.x *= 0.95;
      dragVelocity.y *= 0.95;
    }

    // Smooth rotation lerping
    rotation.x += (targetRotation.x - rotation.x) * rotationSmoothing;
    rotation.y += (targetRotation.y - rotation.y) * rotationSmoothing;

    points.rotation.x = rotation.x;
    points.rotation.y = rotation.y;
    points.updateMatrixWorld(true);

    // Repulsion physics calculation
    const positionsAttr = geometry.attributes.position;
    const tempPos = new THREE.Vector3();
    
    // Project mouse coordinates to 3D world space relative to camera
    const cursor3D = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);

    for (let i = 0; i < particlesCount; i++) {
      const basePos = basePositions[i];
      const disp = displacements[i];

      // Calculate particle rotated world position
      tempPos.copy(basePos).add(disp).applyMatrix4(points.matrixWorld);

      // Apply cursor force on front layer (z > 0)
      if (mouse.x !== 999 && tempPos.z > 0) {
        // Project particle 3D position to 2D normalized screen space
        const projected = tempPos.clone().project(camera);
        const dist = Math.sqrt((mouse.x - projected.x) ** 2 + (mouse.y - projected.y) ** 2);

        if (dist < repulsionRadius) {
          const force = (repulsionRadius - dist) / repulsionRadius;
          const radialDir = tempPos.clone().sub(cursor3D).normalize();
          
          // Convert world repulsion back to points local coordinate space
          radialDir.applyMatrix4(new THREE.Matrix4().copy(points.matrixWorld).invert());
          disp.addScaledVector(radialDir, force * repulsionForce * 0.06);
        }
      }

      // Physics decay (friction and return spring)
      disp.multiplyScalar(friction);
      disp.addScaledVector(basePos.clone().sub(tempPos.copy(basePos).add(disp)), returnForce);

      // Update geometry position
      tempPos.copy(basePos).add(disp);
      positionsAttr.setXYZ(i, tempPos.x, tempPos.y, tempPos.z);
    }
    
    positionsAttr.needsUpdate = true;
    renderer.render(scene, camera);
  };

  animate();
}
