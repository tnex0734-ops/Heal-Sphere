// =============================================
// Heal Sphere — Admin Dashboard Logic (Enhanced EHR)
// =============================================

let allAssessments = [];
let allPatients = [];
let activeSearchFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initPatientSearch();
  loadDashboard();
});

// --- Sidebar Mobile Toggle ---
function initSidebar() {
  const btn = document.getElementById('mobileSidebarBtn');
  const sidebar = document.getElementById('sidebar');

  if (btn) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !btn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// --- Patient Search ---
function initPatientSearch() {
  const input = document.getElementById('patientSearchInput');
  const clearBtn = document.getElementById('patientSearchClear');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    clearBtn.style.display = query ? 'block' : 'none';

    if (query.length === 0) {
      hidePatientSearchResults();
      return;
    }

    debounceTimer = setTimeout(() => {
      performPatientSearch(query);
    }, 350);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.patient-search-bar')) {
      hidePatientSearchResults();
    }
  });
}

async function performPatientSearch(query) {
  const resultsEl = document.getElementById('patientSearchResults');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<div class="search-result-loading">Searching...</div>';
  resultsEl.style.display = 'block';

  try {
    if (typeof searchPatients !== 'function') {
      resultsEl.innerHTML = '<div class="search-result-empty">Search unavailable (Firebase not connected)</div>';
      return;
    }

    let results = await searchPatients(query);

    // Apply filter
    if (activeSearchFilter === 'high') {
      results = results.filter(p => p.latestPriority === 'HIGH');
    } else if (activeSearchFilter === 'low') {
      results = results.filter(p => p.latestPriority === 'LOW');
    } else if (activeSearchFilter === 'followup') {
      // Would need visitType info from assessments
    } else if (activeSearchFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter(p => p.lastVisit && p.lastVisit.startsWith(today));
    } else if (activeSearchFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      results = results.filter(p => p.lastVisit && p.lastVisit >= weekAgo);
    }

    renderPatientSearchResults(results);
  } catch (err) {
    console.error('Search error:', err);
    resultsEl.innerHTML = '<div class="search-result-empty">Search error. Try again.</div>';
  }
}

function renderPatientSearchResults(results) {
  const resultsEl = document.getElementById('patientSearchResults');
  if (!resultsEl) return;

  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="search-result-empty">No patients found</div>';
    resultsEl.style.display = 'block';
    return;
  }

  resultsEl.innerHTML = results.slice(0, 8).map(p => {
    const riskClass = p.latestRiskScore >= 70 ? 'risk-pill-high' : p.latestRiskScore >= 40 ? 'risk-pill-medium' : 'risk-pill-low';
    const lastVisit = p.lastVisit ? new Date(p.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
    return `
      <div class="search-result-item" onclick="openPatientProfile('${esc(p.patientId)}')">
        <div class="search-result-avatar">${esc(p.name.charAt(0).toUpperCase())}</div>
        <div class="search-result-info">
          <div class="search-result-name">${esc(p.name)}</div>
          <div class="search-result-meta">${esc(p.patientId)} • ${p.age || '-'}y • Last: ${lastVisit}</div>
        </div>
        <div class="search-result-stats">
          ${p.latestRiskScore !== null ? `<span class="risk-pill ${riskClass}">${p.latestRiskScore}</span>` : ''}
          <span class="search-result-visits">${p.assessmentCount || 0} visit${(p.assessmentCount || 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  }).join('');

  resultsEl.style.display = 'block';
}

function hidePatientSearchResults() {
  const resultsEl = document.getElementById('patientSearchResults');
  if (resultsEl) resultsEl.style.display = 'none';
}

function clearPatientSearch() {
  const input = document.getElementById('patientSearchInput');
  const clearBtn = document.getElementById('patientSearchClear');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  hidePatientSearchResults();
}

function setSearchFilter(btn, filter) {
  activeSearchFilter = filter;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');

  const query = document.getElementById('patientSearchInput')?.value.trim();
  if (query) {
    performPatientSearch(query);
  } else {
    applyMainFilters();
  }
}

function openPatientProfile(patientId) {
  window.location.href = `/patient?id=${encodeURIComponent(patientId)}`;
}

// --- Load Dashboard ---
async function loadDashboard() {
  showLoading(true);

  try {
    if (typeof db === 'undefined') {
      showEmpty();
      return;
    }

    // Load data in parallel
    const [assessments, stats] = await Promise.all([
      getAssessments(),
      getAssessmentStats()
    ]);

    allAssessments = assessments;

    // Also load patients for patients section
    if (typeof getAllPatients === 'function') {
      const rawPatients = await getAllPatients();
      
      // Enrich patients with their latest assessment data for complete cross-sync
      allPatients = rawPatients.map(p => {
        const patientAssessments = allAssessments.filter(a => a.patientId === p.patientId);
        const latest = patientAssessments[0]; // Already sorted by createdAt descending
        return {
          ...p,
          latestRisk: latest ? latest.riskScore : null,
          latestPriority: latest ? latest.priority : null,
          assessmentCount: patientAssessments.length
        };
      });
    }

    renderStats(stats);
    renderCharts(stats);
    renderRecords(allAssessments);
    renderPatientsTable(allPatients);
  } catch (error) {
    console.error('Dashboard load error:', error);
    showEmpty();
  }

  showLoading(false);
}

// --- Render Stats (8 cards) ---
function renderStats(stats) {
  animateValue('statTotalPatients', stats.totalPatients || 0);
  animateValue('statTotal', stats.total);
  animateValue('statHigh', stats.high);
  animateValue('statAvgRisk', stats.avgRiskScore);
  animateValue('statToday', stats.todayCount);
  animateValue('statNewToday', stats.newPatientsToday || 0);
  animateValue('statFollowUp', stats.followUpCount || 0);
  animateValue('statReportsToday', stats.reportsToday || 0);
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;

  const duration = 800;
  const start = performance.now();

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * ease);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// --- Render Charts ---
function renderCharts(stats) {
  const total = stats.total || 1;

  setTimeout(() => {
    const highPct = Math.max((stats.high / total) * 100, 2);
    const medPct = Math.max((stats.medium / total) * 100, 2);
    const lowPct = Math.max((stats.low / total) * 100, 2);

    document.getElementById('chartBarHigh').style.height = highPct + '%';
    document.getElementById('chartBarMedium').style.height = medPct + '%';
    document.getElementById('chartBarLow').style.height = lowPct + '%';
  }, 300);

  setTimeout(() => {
    const gaugeArc = document.getElementById('gaugeArc');
    const gaugeValue = document.getElementById('gaugeValue');
    const maxDash = 251;
    const dashValue = (stats.avgRiskScore / 100) * maxDash;

    gaugeArc.style.strokeDasharray = `${dashValue} ${maxDash}`;
    gaugeValue.textContent = stats.avgRiskScore;

    if (stats.avgRiskScore >= 70) {
      gaugeArc.style.stroke = 'var(--danger)';
    } else if (stats.avgRiskScore >= 40) {
      gaugeArc.style.stroke = 'var(--secondary)';
    } else {
      gaugeArc.style.stroke = 'var(--success)';
    }
  }, 500);
}

// --- Render Records ---
function renderRecords(assessments) {
  const body = document.getElementById('recordsBody');
  const tableWrap = document.getElementById('recordsTableWrap');
  const empty = document.getElementById('recordsEmpty');

  if (!assessments || assessments.length === 0) {
    tableWrap.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  tableWrap.style.display = 'block';
  empty.style.display = 'none';
  body.innerHTML = '';

  assessments.forEach(a => {
    const row = document.createElement('tr');

    const date = a.createdAt ? new Date(a.createdAt) : new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const pLevel = (a.priority || 'MEDIUM').toLowerCase();
    const pClass = `priority-badge priority-badge-${pLevel}`;

    let riskClass = 'risk-pill-low';
    if (a.riskScore >= 70) riskClass = 'risk-pill-high';
    else if (a.riskScore >= 40) riskClass = 'risk-pill-medium';

    const conditions = (a.conditions || []).slice(0, 2).map(c =>
      `<span class="record-condition-tag">${esc(c.name)} <span class="conf">${c.confidence}%</span></span>`
    ).join('');

    const patientCell = (() => {
      if (!a.patientId) {
        return `<div class="record-patient-name" style="color:var(--text-muted);">—</div>`;
      }
      // Resolve patient name from loaded patient collection for real-time synchronization
      let name = a.patientName || 'Unknown';
      if (typeof allPatients !== 'undefined') {
        const found = allPatients.find(p => p.patientId === a.patientId);
        if (found && found.name) {
          name = found.name;
        }
      }
      return `<div class="record-patient-name">${esc(name)}</div><div class="record-patient-id" onclick="openPatientProfile('${esc(a.patientId)}')">${esc(a.patientId)}</div>`;
    })();

    row.innerHTML = `
      <td>
        <div class="record-date">${dateStr}</div>
        <div class="record-date-time">${timeStr}</div>
      </td>
      <td>${patientCell}</td>
      <td><div class="record-symptoms">${esc(a.symptoms || '-')}</div></td>
      <td><div class="record-conditions">${conditions || '-'}</div></td>
      <td><span class="${pClass}">${a.priority || 'MEDIUM'}</span></td>
      <td><span class="risk-pill ${riskClass}">${a.riskScore || 0}</span></td>
      <td>
        <div class="record-actions">
          <button class="action-btn" onclick="viewDetail('${a.id}')" title="View Details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          ${a.patientId ? `<button class="action-btn action-btn-profile" onclick="openPatientProfile('${esc(a.patientId)}')" title="Patient Profile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </button>` : ''}
          <button class="action-btn action-btn-delete" onclick="handleDelete('${a.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    `;

    body.appendChild(row);
  });
}

// --- Render Patients Table ---
function renderPatientsTable(patients) {
  const body = document.getElementById('patientsBody');
  if (!body) return;

  body.innerHTML = '';

  if (!patients || patients.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No patients found</td></tr>';
    return;
  }

  patients.forEach(p => {
    const row = document.createElement('tr');
    const lastVisit = p.lastVisit ? new Date(p.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

    let pRiskClass = 'risk-pill-low';
    if (p.latestRisk >= 70) pRiskClass = 'risk-pill-high';
    else if (p.latestRisk >= 40) pRiskClass = 'risk-pill-medium';

    row.innerHTML = `
      <td><span class="patient-id-badge">${esc(p.patientId)}</span></td>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${p.age || '-'} / ${p.gender || '-'}</td>
      <td>${esc(p.phone || '-')}</td>
      <td>${lastVisit}</td>
      <td><span class="risk-pill ${pRiskClass}">${p.latestRisk !== null ? p.latestRisk : '—'}</span></td>
      <td>
        <button class="action-btn action-btn-profile" onclick="openPatientProfile('${esc(p.patientId)}')" title="View Profile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    `;
    body.appendChild(row);
  });
}

function filterPatientTable() {
  applyMainFilters();
}

// --- Filters ---
function applyFilters() {
  applyMainFilters();
}

function applyMainFilters() {
  const filter = activeSearchFilter;
  const todayStr = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  // 1. Filter Assessments Records Table
  let filteredAssessments = [...allAssessments];

  if (filter === 'high') {
    filteredAssessments = filteredAssessments.filter(a => a.priority === 'HIGH' || (a.riskScore && a.riskScore >= 70));
  } else if (filter === 'low') {
    filteredAssessments = filteredAssessments.filter(a => a.priority === 'LOW' || (a.riskScore !== undefined && a.riskScore < 40));
  } else if (filter === 'followup') {
    filteredAssessments = filteredAssessments.filter(a => a.visitType === 'Follow-up');
  } else if (filter === 'today') {
    filteredAssessments = filteredAssessments.filter(a => a.createdAt && a.createdAt.startsWith(todayStr));
  } else if (filter === 'week') {
    filteredAssessments = filteredAssessments.filter(a => a.createdAt && a.createdAt >= weekAgoStr);
  }

  // Apply Priority Select Filter if set
  const prioritySelect = document.getElementById('filterPriority')?.value;
  if (prioritySelect) {
    filteredAssessments = filteredAssessments.filter(a => a.priority === prioritySelect);
  }

  // Apply Symptoms Search Filter if typed
  const searchInput = document.getElementById('filterSearch')?.value.toLowerCase().trim();
  if (searchInput) {
    filteredAssessments = filteredAssessments.filter(a =>
      (a.symptoms || '').toLowerCase().includes(searchInput) ||
      (a.patientName || '').toLowerCase().includes(searchInput) ||
      (a.conditions || []).some(c => c.name && c.name.toLowerCase().includes(searchInput))
    );
  }

  renderRecords(filteredAssessments);

  // 2. Filter Patients Table
  let filteredPatients = [...allPatients];

  if (filter === 'high') {
    filteredPatients = filteredPatients.filter(p => p.latestPriority === 'HIGH' || (p.latestRisk && p.latestRisk >= 70));
  } else if (filter === 'low') {
    filteredPatients = filteredPatients.filter(p => p.latestPriority === 'LOW' || (p.latestRisk !== undefined && p.latestRisk < 40));
  } else if (filter === 'followup') {
    filteredPatients = filteredPatients.filter(p => p.assessmentCount > 1 || p.latestPriority === 'Follow-up');
  } else if (filter === 'today') {
    filteredPatients = filteredPatients.filter(p => p.lastVisit && p.lastVisit.startsWith(todayStr));
  } else if (filter === 'week') {
    filteredPatients = filteredPatients.filter(p => p.lastVisit && p.lastVisit >= weekAgoStr);
  }

  // Apply Patient Table Text Filter if typed
  const patientTableSearch = document.getElementById('patientTableSearch')?.value.toLowerCase().trim();
  if (patientTableSearch) {
    filteredPatients = filteredPatients.filter(p =>
      (p.name || '').toLowerCase().includes(patientTableSearch) ||
      (p.patientId || '').toLowerCase().includes(patientTableSearch) ||
      (p.phone || '').includes(patientTableSearch)
    );
  }

  renderPatientsTable(filteredPatients);
}

// --- View Detail Modal ---
function viewDetail(id) {
  const a = allAssessments.find(r => r.id === id);
  if (!a) return;

  const modal = document.getElementById('modalOverlay');
  const body = document.getElementById('modalBody');

  const date = a.createdAt ? new Date(a.createdAt) : new Date();
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const pLevel = (a.priority || 'MEDIUM').toLowerCase();

  const conditionsHtml = (a.conditions || []).map(c => `
    <div class="detail-condition-item">
      <span class="detail-condition-name">${esc(c.name)}</span>
      <span class="detail-condition-conf">${c.confidence}%</span>
    </div>
  `).join('');

  const recsHtml = (a.recommendations || []).map(r => `<li>${esc(r)}</li>`).join('');

  const symptomsHtml = (a.extractedSymptoms || []).map(s =>
    `<span class="detail-tag">${esc(s)}</span>`
  ).join('');

  body.innerHTML = `
    <div class="detail-header">
      <span class="detail-priority priority-badge priority-badge-${pLevel}">${a.priority || 'MEDIUM'}</span>
      <span class="detail-date">${dateStr}</span>
    </div>

    ${a.patientName ? `
    <div class="detail-section">
      <div class="detail-section-title">Patient</div>
      <div class="detail-text">
        <strong>${esc(a.patientName)}</strong>
        ${a.patientId ? ` — <a href="/patient?id=${esc(a.patientId)}" class="patient-profile-link">${esc(a.patientId)}</a>` : ''}
        ${a.visitType ? ` — ${esc(a.visitType)}` : ''}
      </div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-title">Patient Input</div>
      <div class="detail-text">${esc(a.symptoms || '-')}</div>
    </div>

    ${a.medicalHistory ? `
    <div class="detail-section">
      <div class="detail-section-title">Medical History</div>
      <div class="detail-text" style="white-space:pre-line;">${esc(a.medicalHistory)}</div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-title">Vitals</div>
      <div class="detail-vitals-grid">
        <div class="detail-vital-item"><div class="detail-vital-label">Age</div><div class="detail-vital-value">${a.age || '-'}</div></div>
        <div class="detail-vital-item"><div class="detail-vital-label">Gender</div><div class="detail-vital-value">${a.gender || '-'}</div></div>
        <div class="detail-vital-item"><div class="detail-vital-label">BP</div><div class="detail-vital-value">${a.bloodPressure || '-'}</div></div>
        <div class="detail-vital-item"><div class="detail-vital-label">Temp °F</div><div class="detail-vital-value">${a.temperature || '-'}</div></div>
        <div class="detail-vital-item"><div class="detail-vital-label">Heart Rate</div><div class="detail-vital-value">${a.heartRate || '-'}</div></div>
        <div class="detail-vital-item"><div class="detail-vital-label">O₂ Sat</div><div class="detail-vital-value">${a.oxygenLevel || '-'}%</div></div>
      </div>
    </div>

    ${symptomsHtml ? `
    <div class="detail-section">
      <div class="detail-section-title">Extracted Symptoms</div>
      <div class="detail-tags">${symptomsHtml}</div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-title">Risk Score</div>
      <div class="detail-text" style="font-size:28px; font-weight:800; font-family:var(--font-heading); color:var(--text);">${a.riskScore || 0}<span style="font-size:14px; color:var(--text-muted);"> / 100</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Predicted Conditions</div>
      <div class="detail-conditions-list">${conditionsHtml || '<div class="detail-text">No conditions predicted</div>'}</div>
    </div>

    ${a.vitalSignsAssessment ? `
    <div class="detail-section">
      <div class="detail-section-title">Vital Signs Assessment</div>
      <div class="detail-text">${esc(a.vitalSignsAssessment)}</div>
    </div>` : ''}

    ${recsHtml ? `
    <div class="detail-section">
      <div class="detail-section-title">Recommendations</div>
      <ul class="detail-rec-list">${recsHtml}</ul>
    </div>` : ''}
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// --- Delete ---
async function handleDelete(id) {
  if (!confirm('Delete this assessment record?')) return;

  const success = await deleteAssessment(id);
  if (success) {
    allAssessments = allAssessments.filter(a => a.id !== id);
    renderRecords(allAssessments);

    const stats = await getAssessmentStats();
    renderStats(stats);
    renderCharts(stats);
  }
}

// --- View Toggle ---
function showRecordsView() {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('navRecords').classList.add('active');
  document.getElementById('patientsSection').style.display = 'none';
  document.getElementById('recordsSection').style.display = 'block';
  document.querySelector('.records-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showPatientsView() {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('navPatients').classList.add('active');
  document.getElementById('patientsSection').style.display = 'block';
  document.getElementById('recordsSection').style.display = 'none';
  document.getElementById('patientsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Helpers ---
function showLoading(show) {
  const loading = document.getElementById('recordsLoading');
  const empty = document.getElementById('recordsEmpty');

  if (show) {
    loading.style.display = 'block';
    empty.style.display = 'none';
    document.getElementById('recordsTableWrap').style.display = 'none';
  } else {
    loading.style.display = 'none';
  }
}

function showEmpty() {
  document.getElementById('recordsLoading').style.display = 'none';
  document.getElementById('recordsEmpty').style.display = 'block';
  document.getElementById('recordsTableWrap').style.display = 'none';
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
