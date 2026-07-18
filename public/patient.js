// =============================================
// HealSphere — Patient Profile Logic
// =============================================

let patientData = null;
let patientAssessments = [];
let patientReports = [];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  loadProfile();
});

// --- Sidebar Mobile Toggle ---
function initSidebar() {
  const btn = document.getElementById('mobileSidebarBtn');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !btn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// --- Load Profile ---
async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get('id');

  if (!patientId) {
    showNotFound();
    return;
  }

  try {
    if (typeof getPatientProfile === 'function') {
      const profile = await getPatientProfile(patientId);
      if (!profile) {
        showNotFound();
        return;
      }

      patientData = profile;
      patientAssessments = profile.assessments || [];
      patientReports = profile.reports || [];

      renderPatientCard(profile);
      renderOverview(profile);
      renderTimeline(patientAssessments);
      renderReportsTimeline(patientReports);
      renderVitalsHistory(patientAssessments);
      renderAIInsights(profile);

      document.title = `${profile.name} — Heal Sphere`;
    } else {
      showNotFound();
    }
  } catch (err) {
    console.error('Profile load error:', err);
    showNotFound();
  }

  document.getElementById('profileLoading').style.display = 'none';
  document.getElementById('profileContent').style.display = 'block';
}

function showNotFound() {
  document.getElementById('profileLoading').style.display = 'none';
  document.getElementById('profileNotFound').style.display = 'flex';
}

// --- Render Patient Card ---
function renderPatientCard(profile) {
  const name = profile.name || 'Unknown Patient';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('patientAvatar').textContent = initials;
  document.getElementById('patientName').textContent = name;

  const metas = [
    ['patientIdMeta', profile.patientId, 'ID'],
    ['patientAgeMeta', profile.age ? `${profile.age} years` : null, 'Age'],
    ['patientGenderMeta', profile.gender, ''],
    ['patientPhoneMeta', profile.phone, '📞']
  ];

  metas.forEach(([id, val, prefix]) => {
    const el = document.getElementById(id);
    if (el && val) {
      el.textContent = prefix ? `${prefix}: ${val}` : val;
      el.style.display = '';
    } else if (el) {
      el.style.display = 'none';
    }
  });

  // Priority tags
  const tagsEl = document.getElementById('patientTags');
  if (tagsEl && profile.currentPriority && profile.currentPriority !== 'N/A') {
    const pLevel = profile.currentPriority.toLowerCase();
    tagsEl.innerHTML = `<span class="priority-badge priority-badge-${pLevel}">${profile.currentPriority}</span>`;
  }

  // Stats
  document.getElementById('pStatVisits').textContent = profile.totalVisits || 0;
  document.getElementById('pStatReports').textContent = profile.totalReports || 0;

  const riskEl = document.getElementById('pStatRisk');
  riskEl.textContent = profile.currentRisk || '—';
  if (profile.currentRisk >= 70) riskEl.style.color = 'var(--danger)';
  else if (profile.currentRisk >= 40) riskEl.style.color = 'var(--warning)';
  else riskEl.style.color = 'var(--success)';

  document.getElementById('pStatPriority').textContent = profile.currentPriority || '—';

  // Pre-fill new assessment link with patient name if possible
  const newAssessmentBtn = document.getElementById('newAssessmentBtn');
  if (newAssessmentBtn) {
    newAssessmentBtn.href = `/?patientId=${encodeURIComponent(profile.patientId)}`;
  }
}

// --- Render Overview Tab ---
function renderOverview(profile) {
  const latestAssessment = patientAssessments[0];
  const latestEl = document.getElementById('overviewLatestAssessment');
  const vitalsEl = document.getElementById('overviewLatestVitals');
  const historyEl = document.getElementById('overviewMedicalHistory');

  if (latestAssessment) {
    const date = new Date(latestAssessment.createdAt || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const pLevel = (latestAssessment.priority || 'MEDIUM').toLowerCase();

    latestEl.innerHTML = `
      <div class="overview-assessment">
        <div class="overview-assessment-header">
          <span class="priority-badge priority-badge-${pLevel}">${latestAssessment.priority || 'MEDIUM'}</span>
          <span class="overview-date">${date}</span>
        </div>
        <p class="overview-symptoms">${esc(latestAssessment.symptoms || '-')}</p>
        ${latestAssessment.conditions && latestAssessment.conditions.length > 0 ? `
          <div class="overview-conditions">
            ${latestAssessment.conditions.slice(0, 2).map(c =>
              `<span class="record-condition-tag">${esc(c.name)} <span class="conf">${c.confidence}%</span></span>`
            ).join('')}
          </div>` : ''}
        <div class="risk-score-mini">
          Risk Score: <strong>${latestAssessment.riskScore || 0}</strong>/100
        </div>
      </div>
    `;

    vitalsEl.innerHTML = `
      <div class="vitals-mini-grid">
        ${renderVitalMiniItem('Blood Pressure', latestAssessment.bloodPressure)}
        ${renderVitalMiniItem('Temperature', latestAssessment.temperature ? `${latestAssessment.temperature}°F` : null)}
        ${renderVitalMiniItem('Heart Rate', latestAssessment.heartRate ? `${latestAssessment.heartRate} bpm` : null)}
        ${renderVitalMiniItem('O₂ Sat', latestAssessment.oxygenLevel ? `${latestAssessment.oxygenLevel}%` : null)}
      </div>
    `;
  }

  if (profile.medicalHistory) {
    historyEl.innerHTML = `<pre class="medical-history-text">${esc(profile.medicalHistory)}</pre>`;
  }
}

function renderVitalMiniItem(label, value) {
  if (!value) return '';
  return `
    <div class="vital-mini-item">
      <div class="vital-mini-label">${label}</div>
      <div class="vital-mini-value">${esc(String(value))}</div>
    </div>
  `;
}

// --- Render Assessment Timeline ---
function renderTimeline(assessments) {
  const container = document.getElementById('assessmentTimeline');
  if (!container) return;

  if (!assessments || assessments.length === 0) {
    container.innerHTML = '<p class="no-data-text">No assessments recorded for this patient</p>';
    return;
  }

  // Populate compare dropdowns if 2+ assessments
  if (assessments.length >= 2) {
    document.getElementById('compareControls').style.display = 'flex';
    const sel1 = document.getElementById('compareSelect1');
    const sel2 = document.getElementById('compareSelect2');

    assessments.forEach((a, i) => {
      const date = new Date(a.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const opt1 = new Option(`Visit ${i + 1} — ${date}`, a.id);
      const opt2 = new Option(`Visit ${i + 1} — ${date}`, a.id);
      sel1.add(opt1);
      sel2.add(opt2);
    });
  }

  container.innerHTML = assessments.map((a, i) => {
    const date = new Date(a.createdAt || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = new Date(a.createdAt || '').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const pLevel = (a.priority || 'MEDIUM').toLowerCase();

    const conditions = (a.conditions || []).map(c =>
      `<span class="record-condition-tag">${esc(c.name)} <span class="conf">${c.confidence}%</span></span>`
    ).join('');

    const symptoms = (a.extractedSymptoms || []).map(s =>
      `<span class="detail-tag">${esc(s)}</span>`
    ).join('');

    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-card-header">
            <div>
              <div class="timeline-date">${date} at ${time}</div>
              <div class="timeline-visit-type">${esc(a.visitType || 'Assessment')}</div>
            </div>
            <div class="timeline-badges">
              <span class="priority-badge priority-badge-${pLevel}">${a.priority || 'MEDIUM'}</span>
              <span class="risk-pill ${a.riskScore >= 70 ? 'risk-pill-high' : a.riskScore >= 40 ? 'risk-pill-medium' : 'risk-pill-low'}">${a.riskScore || 0}</span>
            </div>
          </div>
          <div class="timeline-symptoms">${esc(a.symptoms || '-')}</div>
          ${symptoms ? `<div class="detail-tags">${symptoms}</div>` : ''}
          ${conditions ? `<div class="timeline-conditions">${conditions}</div>` : ''}
          ${a.vitalSignsAssessment ? `<div class="timeline-vitals-note">${esc(a.vitalSignsAssessment)}</div>` : ''}
          ${a.recommendations && a.recommendations.length > 0 ? `
            <details class="timeline-recs">
              <summary>Recommendations (${a.recommendations.length})</summary>
              <ul>${a.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            </details>
          ` : ''}
          ${i < assessments.length - 1 ? `
            <button class="compare-prev-btn" onclick="quickCompare('${a.id}', '${assessments[i + 1].id}')">
              Compare with Previous Visit →
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// --- Render Reports Timeline ---
function renderReportsTimeline(reports) {
  const container = document.getElementById('reportsTimeline');
  if (!container) return;

  if (!reports || reports.length === 0) {
    container.innerHTML = '<p class="no-data-text">No reports uploaded for this patient</p>';
    return;
  }

  container.innerHTML = reports.map(r => {
    const date = r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    const isPDF = r.fileType === 'application/pdf';
    const fileIcon = isPDF
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

    const analysisHtml = r.analysis ? `
      <div class="report-card-analysis">
        <h4>AI Analysis</h4>
        <p>${esc(r.analysis.summary || '')}</p>
        ${r.analysis.findings && r.analysis.findings.length > 0 ? `
          <div class="analysis-findings-grid">
            ${r.analysis.findings.map(f => `
              <div class="analysis-finding-item">
                <div class="analysis-finding-label">${esc(f.name)}</div>
                <div class="analysis-finding-value">${esc(String(f.value))}</div>
                <div class="analysis-finding-status status-${(f.status || 'normal').toLowerCase()}">${esc(f.status || 'Normal')}</div>
              </div>
            `).join('')}
          </div>` : ''}
        ${r.analysis.risks && r.analysis.risks.length > 0 ? `
          <p class="report-risk-text">⚠ Risk: ${r.analysis.risks.join(', ')}</p>` : ''}
      </div>
    ` : `<div class="report-card-no-analysis">Report uploaded but not yet analyzed</div>`;

    return `
      <div class="report-card">
        <div class="report-card-header">
          <div class="report-card-icon">${fileIcon}</div>
          <div class="report-card-info">
            <div class="report-card-name">${esc(r.fileName)}</div>
            <div class="report-card-date">${date}</div>
            <span class="report-status-badge ${r.status === 'analyzed' ? 'analyzed' : 'uploaded'}">${r.status === 'analyzed' ? '✔ Analyzed' : 'Uploaded'}</span>
          </div>
          <div class="report-card-actions">
            ${r.fileDataUrl ? `<a href="${r.fileDataUrl}" download="${esc(r.fileName)}" class="action-btn" title="Download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>` : ''}
            <button class="action-btn action-btn-delete" onclick="handleReportDelete('${r.id}')" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${analysisHtml}
      </div>
    `;
  }).join('');
}

// --- Render Vitals History Table ---
function renderVitalsHistory(assessments) {
  const container = document.getElementById('vitalsHistoryTable');
  if (!container) return;

  const withVitals = assessments.filter(a =>
    a.bloodPressure || a.temperature || a.heartRate || a.oxygenLevel
  );

  if (withVitals.length === 0) {
    container.innerHTML = '<p class="no-data-text">No vitals data recorded across assessments</p>';
    return;
  }

  container.innerHTML = `
    <div class="vitals-table-wrap">
      <table class="vitals-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Visit Type</th>
            <th>Blood Pressure</th>
            <th>Temperature</th>
            <th>Heart Rate</th>
            <th>O₂ Sat</th>
            <th>Risk Score</th>
          </tr>
        </thead>
        <tbody>
          ${withVitals.map(a => {
            const date = new Date(a.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const riskClass = a.riskScore >= 70 ? 'risk-pill-high' : a.riskScore >= 40 ? 'risk-pill-medium' : 'risk-pill-low';
            return `
              <tr>
                <td>${date}</td>
                <td>${esc(a.visitType || 'Assessment')}</td>
                <td>${a.bloodPressure ? esc(a.bloodPressure) : '<span class="no-data">—</span>'}</td>
                <td>${a.temperature ? `${a.temperature}°F` : '<span class="no-data">—</span>'}</td>
                <td>${a.heartRate ? `${a.heartRate} bpm` : '<span class="no-data">—</span>'}</td>
                <td>${a.oxygenLevel ? `${a.oxygenLevel}%` : '<span class="no-data">—</span>'}</td>
                <td><span class="risk-pill ${riskClass}">${a.riskScore || 0}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- Render AI Insights ---
function renderAIInsights(profile) {
  const panel = document.getElementById('insightsPanel');
  if (!panel) return;

  const assessments = patientAssessments;

  if (assessments.length === 0) {
    panel.innerHTML = '<p class="no-data-text">No assessment data available for AI insights</p>';
    return;
  }

  // Generate insights from existing data
  const latest = assessments[0];
  const allConditions = {};
  let totalRisk = 0;
  let highRiskCount = 0;

  assessments.forEach(a => {
    totalRisk += a.riskScore || 0;
    if (a.riskScore >= 70) highRiskCount++;
    (a.conditions || []).forEach(c => {
      allConditions[c.name] = (allConditions[c.name] || 0) + 1;
    });
  });

  const avgRisk = Math.round(totalRisk / assessments.length);
  const topConditions = Object.entries(allConditions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const trend = assessments.length >= 2
    ? (assessments[0].riskScore > assessments[1].riskScore ? '↑ Worsening' : assessments[0].riskScore < assessments[1].riskScore ? '↓ Improving' : '→ Stable')
    : 'Insufficient data for trend';

  const trendColor = trend.startsWith('↑') ? 'var(--danger)' : trend.startsWith('↓') ? 'var(--success)' : 'var(--text-secondary)';

  panel.innerHTML = `
    <div class="insights-grid">
      <div class="insight-card">
        <h4>📈 Health Trend</h4>
        <div class="insight-value" style="color:${trendColor};">${trend}</div>
        <p>Based on ${assessments.length} visit${assessments.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="insight-card">
        <h4>⚠️ High Risk Visits</h4>
        <div class="insight-value">${highRiskCount} / ${assessments.length}</div>
        <p>Visits with risk score ≥ 70</p>
      </div>
      <div class="insight-card">
        <h4>📊 Average Risk Score</h4>
        <div class="insight-value" style="color:${avgRisk >= 70 ? 'var(--danger)' : avgRisk >= 40 ? 'var(--warning)' : 'var(--success)'};">${avgRisk}/100</div>
        <p>Across all visits</p>
      </div>
      <div class="insight-card">
        <h4>📋 Total Visits</h4>
        <div class="insight-value">${assessments.length}</div>
        <p>Since ${new Date(assessments[assessments.length - 1].createdAt || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
      </div>
    </div>

    ${topConditions.length > 0 ? `
    <div class="insight-conditions-section">
      <h4>🔬 Most Frequent Predicted Conditions</h4>
      <div class="insight-conditions-list">
        ${topConditions.map(([name, count]) => `
          <div class="insight-condition-item">
            <span class="insight-condition-name">${esc(name)}</span>
            <span class="insight-condition-count">${count} visit${count !== 1 ? 's' : ''}</span>
            <div class="insight-condition-bar">
              <div class="insight-condition-bar-fill" style="width:${Math.round((count / assessments.length) * 100)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${profile.medicalHistory ? `
    <div class="insight-history-section">
      <h4>📌 Pre-existing Conditions</h4>
      <p style="white-space:pre-line;color:var(--text-secondary);font-size:14px;">${esc(profile.medicalHistory)}</p>
    </div>` : ''}
  `;
}

// --- Comparison ---
function compareAssessments() {
  const id1 = document.getElementById('compareSelect1').value;
  const id2 = document.getElementById('compareSelect2').value;
  if (!id1 || !id2 || id1 === id2) {
    alert('Please select two different assessments to compare.');
    return;
  }
  quickCompare(id1, id2);
}

function quickCompare(id1, id2) {
  const a1 = patientAssessments.find(a => a.id === id1);
  const a2 = patientAssessments.find(a => a.id === id2);
  if (!a1 || !a2) return;

  const panel = document.getElementById('comparePanel');
  const content = document.getElementById('compareContent');

  const date1 = new Date(a1.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const date2 = new Date(a2.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function diff(v1, v2, higherIsBetter = false) {
    if (!v1 || !v2) return '';
    const n1 = parseFloat(v1);
    const n2 = parseFloat(v2);
    if (isNaN(n1) || isNaN(n2)) return '';
    if (n1 === n2) return '<span class="diff-stable">→</span>';
    const improved = higherIsBetter ? n1 > n2 : n1 < n2;
    return improved
      ? `<span class="diff-improved">↓ ${Math.abs(n1 - n2).toFixed(1)}</span>`
      : `<span class="diff-worsened">↑ ${Math.abs(n1 - n2).toFixed(1)}</span>`;
  }

  content.innerHTML = `
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Current (${date1})</th>
            <th>Previous (${date2})</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Priority</td>
            <td><span class="priority-badge priority-badge-${(a1.priority || 'MEDIUM').toLowerCase()}">${a1.priority || '—'}</span></td>
            <td><span class="priority-badge priority-badge-${(a2.priority || 'MEDIUM').toLowerCase()}">${a2.priority || '—'}</span></td>
            <td></td>
          </tr>
          <tr>
            <td>Risk Score</td>
            <td><strong>${a1.riskScore || '—'}</strong></td>
            <td><strong>${a2.riskScore || '—'}</strong></td>
            <td>${diff(a1.riskScore, a2.riskScore)}</td>
          </tr>
          <tr>
            <td>Blood Pressure</td>
            <td>${esc(a1.bloodPressure || '—')}</td>
            <td>${esc(a2.bloodPressure || '—')}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Temperature</td>
            <td>${a1.temperature ? `${a1.temperature}°F` : '—'}</td>
            <td>${a2.temperature ? `${a2.temperature}°F` : '—'}</td>
            <td>${diff(a1.temperature, a2.temperature)}</td>
          </tr>
          <tr>
            <td>Heart Rate</td>
            <td>${a1.heartRate ? `${a1.heartRate} bpm` : '—'}</td>
            <td>${a2.heartRate ? `${a2.heartRate} bpm` : '—'}</td>
            <td>${diff(a1.heartRate, a2.heartRate)}</td>
          </tr>
          <tr>
            <td>O₂ Saturation</td>
            <td>${a1.oxygenLevel ? `${a1.oxygenLevel}%` : '—'}</td>
            <td>${a2.oxygenLevel ? `${a2.oxygenLevel}%` : '—'}</td>
            <td>${diff(a1.oxygenLevel, a2.oxygenLevel, true)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="compare-symptoms">
      <div>
        <h4>Current Symptoms</h4>
        <p>${esc(a1.symptoms || '—')}</p>
        ${a1.conditions && a1.conditions.length > 0 ? `
          <h5>Conditions</h5>
          ${a1.conditions.map(c => `<span class="record-condition-tag">${esc(c.name)} <span class="conf">${c.confidence}%</span></span>`).join('')}` : ''}
      </div>
      <div>
        <h4>Previous Symptoms</h4>
        <p>${esc(a2.symptoms || '—')}</p>
        ${a2.conditions && a2.conditions.length > 0 ? `
          <h5>Conditions</h5>
          ${a2.conditions.map(c => `<span class="record-condition-tag">${esc(c.name)} <span class="conf">${c.confidence}%</span></span>`).join('')}` : ''}
      </div>
    </div>
    <div class="compare-legend">
      <span class="diff-improved">↓ Improved</span>
      <span class="diff-stable">→ Stable</span>
      <span class="diff-worsened">↑ Worsened</span>
    </div>
  `;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideCompare() {
  document.getElementById('comparePanel').style.display = 'none';
}

// --- Tab Switching ---
function switchTab(tabId, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(`tab-${tabId}`).style.display = 'block';
}

// --- Report Delete ---
async function handleReportDelete(reportId) {
  if (!confirm('Delete this report? This cannot be undone.')) return;
  if (typeof deleteReport === 'function') {
    const success = await deleteReport(reportId);
    if (success) {
      patientReports = patientReports.filter(r => r.id !== reportId);
      renderReportsTimeline(patientReports);
    }
  }
}

// --- Utility ---
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
