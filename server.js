require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Try to initialize Gemini AI (optional — falls back to rule-based if no key)
let genAI = null;
let useAI = false;

try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    useAI = true;
    console.log('✅ Gemini AI enabled');
  } else {
    console.log('⚠️  No Gemini API key — using rule-based triage (still works great for demo!)');
  }
} catch (e) {
  console.log('⚠️  Gemini AI not available — using rule-based triage');
}

// ============================================================
// RULE-BASED TRIAGE ENGINE (works without any API key)
// ============================================================
const symptomDatabase = {
  // HIGH PRIORITY - Life threatening
  'chest pain': { conditions: ['Acute Coronary Syndrome', 'Myocardial Infarction', 'Angina Pectoris'], priority: 'HIGH', risk: 85 },
  'heart attack': { conditions: ['Myocardial Infarction', 'Cardiac Arrest'], priority: 'HIGH', risk: 95 },
  'difficulty breathing': { conditions: ['Pulmonary Embolism', 'Asthma Attack', 'Pneumonia'], priority: 'HIGH', risk: 80 },
  'shortness of breath': { conditions: ['Pulmonary Embolism', 'Heart Failure', 'Asthma'], priority: 'HIGH', risk: 78 },
  'severe bleeding': { conditions: ['Hemorrhage', 'Trauma', 'Internal Bleeding'], priority: 'HIGH', risk: 90 },
  'stroke': { conditions: ['Ischemic Stroke', 'Hemorrhagic Stroke', 'TIA'], priority: 'HIGH', risk: 92 },
  'seizure': { conditions: ['Epilepsy', 'Febrile Seizure', 'Brain Injury'], priority: 'HIGH', risk: 82 },
  'unconscious': { conditions: ['Syncope', 'Hypoglycemia', 'Brain Injury'], priority: 'HIGH', risk: 88 },
  'fainting': { conditions: ['Syncope', 'Dehydration', 'Cardiac Arrhythmia'], priority: 'HIGH', risk: 70 },
  'severe abdominal pain': { conditions: ['Appendicitis', 'Intestinal Obstruction', 'Pancreatitis'], priority: 'HIGH', risk: 75 },
  'allergic reaction': { conditions: ['Anaphylaxis', 'Drug Allergy', 'Food Allergy'], priority: 'HIGH', risk: 80 },
  'swelling throat': { conditions: ['Anaphylaxis', 'Angioedema'], priority: 'HIGH', risk: 88 },
  'coughing blood': { conditions: ['Pulmonary Embolism', 'Tuberculosis', 'Lung Cancer'], priority: 'HIGH', risk: 85 },
  'vomiting blood': { conditions: ['GI Bleeding', 'Peptic Ulcer', 'Esophageal Varices'], priority: 'HIGH', risk: 85 },
  'paralysis': { conditions: ['Stroke', 'Spinal Cord Injury', 'Guillain-Barré Syndrome'], priority: 'HIGH', risk: 90 },
  'suicidal': { conditions: ['Major Depression', 'Psychiatric Emergency'], priority: 'HIGH', risk: 95 },

  // MEDIUM PRIORITY - Needs prompt attention
  'high fever': { conditions: ['Viral Infection', 'Bacterial Infection', 'COVID-19'], priority: 'MEDIUM', risk: 55 },
  'fever': { conditions: ['Viral Infection', 'Influenza', 'COVID-19'], priority: 'MEDIUM', risk: 45 },
  'persistent cough': { conditions: ['Bronchitis', 'Pneumonia', 'COVID-19'], priority: 'MEDIUM', risk: 50 },
  'severe headache': { conditions: ['Migraine', 'Tension Headache', 'Meningitis'], priority: 'MEDIUM', risk: 55 },
  'abdominal pain': { conditions: ['Gastritis', 'Appendicitis', 'IBS'], priority: 'MEDIUM', risk: 50 },
  'dizziness': { conditions: ['Vertigo', 'Dehydration', 'Anemia'], priority: 'MEDIUM', risk: 45 },
  'vomiting': { conditions: ['Gastroenteritis', 'Food Poisoning', 'Migraine'], priority: 'MEDIUM', risk: 45 },
  'diarrhea': { conditions: ['Gastroenteritis', 'Food Poisoning', 'IBS'], priority: 'MEDIUM', risk: 40 },
  'rash': { conditions: ['Allergic Dermatitis', 'Viral Exanthem', 'Drug Reaction'], priority: 'MEDIUM', risk: 35 },
  'back pain': { conditions: ['Muscle Strain', 'Herniated Disc', 'Kidney Stones'], priority: 'MEDIUM', risk: 40 },
  'joint pain': { conditions: ['Arthritis', 'Gout', 'Tendinitis'], priority: 'MEDIUM', risk: 35 },
  'ear pain': { conditions: ['Otitis Media', 'Ear Infection', 'TMJ Disorder'], priority: 'MEDIUM', risk: 30 },
  'nausea': { conditions: ['Gastritis', 'Motion Sickness', 'Pregnancy'], priority: 'MEDIUM', risk: 30 },
  'blurred vision': { conditions: ['Migraine', 'Diabetic Retinopathy', 'Glaucoma'], priority: 'MEDIUM', risk: 50 },
  'swollen legs': { conditions: ['Deep Vein Thrombosis', 'Heart Failure', 'Edema'], priority: 'MEDIUM', risk: 55 },
  'blood in urine': { conditions: ['UTI', 'Kidney Stones', 'Bladder Cancer'], priority: 'MEDIUM', risk: 60 },
  'numbness': { conditions: ['Peripheral Neuropathy', 'Stroke', 'Carpal Tunnel'], priority: 'MEDIUM', risk: 55 },
  'tingling': { conditions: ['Peripheral Neuropathy', 'Vitamin Deficiency', 'MS'], priority: 'MEDIUM', risk: 45 },
  'anxiety': { conditions: ['Generalized Anxiety Disorder', 'Panic Disorder', 'Stress'], priority: 'MEDIUM', risk: 30 },
  'palpitations': { conditions: ['Cardiac Arrhythmia', 'Anxiety', 'Hyperthyroidism'], priority: 'MEDIUM', risk: 55 },
  'sweating': { conditions: ['Hypoglycemia', 'Anxiety', 'Hyperhidrosis'], priority: 'MEDIUM', risk: 40 },
  'weight loss': { conditions: ['Hyperthyroidism', 'Diabetes', 'Cancer'], priority: 'MEDIUM', risk: 50 },

  // LOW PRIORITY - Minor conditions
  'headache': { conditions: ['Tension Headache', 'Migraine', 'Dehydration'], priority: 'LOW', risk: 20 },
  'mild headache': { conditions: ['Tension Headache', 'Eye Strain', 'Stress'], priority: 'LOW', risk: 15 },
  'cold': { conditions: ['Common Cold', 'Viral Upper Respiratory Infection'], priority: 'LOW', risk: 10 },
  'runny nose': { conditions: ['Common Cold', 'Allergic Rhinitis', 'Sinusitis'], priority: 'LOW', risk: 10 },
  'sneezing': { conditions: ['Allergic Rhinitis', 'Common Cold'], priority: 'LOW', risk: 8 },
  'sore throat': { conditions: ['Pharyngitis', 'Viral Infection', 'Streptococcal Infection'], priority: 'LOW', risk: 15 },
  'cough': { conditions: ['Common Cold', 'Bronchitis', 'Allergies'], priority: 'LOW', risk: 15 },
  'fatigue': { conditions: ['Iron Deficiency Anemia', 'Chronic Fatigue', 'Sleep Disorder'], priority: 'LOW', risk: 20 },
  'muscle pain': { conditions: ['Muscle Strain', 'Overexertion', 'Fibromyalgia'], priority: 'LOW', risk: 15 },
  'minor cut': { conditions: ['Laceration', 'Wound'], priority: 'LOW', risk: 10 },
  'bruise': { conditions: ['Contusion', 'Minor Trauma'], priority: 'LOW', risk: 8 },
  'insomnia': { conditions: ['Sleep Disorder', 'Anxiety', 'Stress'], priority: 'LOW', risk: 15 },
  'constipation': { conditions: ['Functional Constipation', 'IBS', 'Dietary Issue'], priority: 'LOW', risk: 10 },
  'bloating': { conditions: ['IBS', 'Gas', 'Food Intolerance'], priority: 'LOW', risk: 10 },
  'itching': { conditions: ['Allergic Dermatitis', 'Eczema', 'Dry Skin'], priority: 'LOW', risk: 10 },
  'dry mouth': { conditions: ['Dehydration', 'Medication Side Effect', 'Sjögren Syndrome'], priority: 'LOW', risk: 10 },
};

const conditionDetails = {
  'Acute Coronary Syndrome': 'A range of conditions associated with sudden, reduced blood flow to the heart. Requires immediate medical attention.',
  'Myocardial Infarction': 'Heart attack — blockage of blood flow to the heart muscle. Life-threatening emergency.',
  'Angina Pectoris': 'Chest pain caused by reduced blood flow to the heart, often triggered by physical exertion.',
  'Pulmonary Embolism': 'Blood clot in the lung arteries blocking blood flow. Potentially life-threatening.',
  'Asthma Attack': 'Acute narrowing of airways causing difficulty breathing, wheezing, and chest tightness.',
  'Pneumonia': 'Infection that inflames the air sacs in one or both lungs, which may fill with fluid.',
  'Heart Failure': 'The heart doesn\'t pump blood as well as it should. Can cause fluid buildup and breathing difficulty.',
  'Migraine': 'A severe recurring headache, often accompanied by nausea, visual disturbances, and sensitivity to light.',
  'Tension Headache': 'The most common type of headache, often described as a band of pressure around the head.',
  'Meningitis': 'Inflammation of the membranes surrounding the brain and spinal cord. Can be life-threatening.',
  'Gastroenteritis': 'Inflammation of the stomach and intestines, usually caused by viral or bacterial infection.',
  'Food Poisoning': 'Illness caused by eating contaminated food, leading to nausea, vomiting, and diarrhea.',
  'Viral Infection': 'A general infection caused by a virus, typically presenting with fever, body aches, and fatigue.',
  'Influenza': 'A contagious respiratory illness caused by influenza viruses, causing fever, cough, and body aches.',
  'COVID-19': 'Respiratory illness caused by SARS-CoV-2 virus. Symptoms range from mild to severe.',
  'Bronchitis': 'Inflammation of the bronchial tubes carrying air to the lungs, causing persistent cough.',
  'Common Cold': 'A viral infection of the upper respiratory tract, causing runny nose, sore throat, and sneezing.',
  'Allergic Rhinitis': 'Inflammation of the nasal passages due to allergens, causing sneezing and congestion.',
  'Appendicitis': 'Inflammation of the appendix causing severe abdominal pain. May require surgery.',
  'IBS': 'Irritable bowel syndrome — a chronic digestive disorder causing cramping, pain, and altered bowel habits.',
  'Gastritis': 'Inflammation of the stomach lining causing upper abdominal pain, nausea, and sometimes vomiting.',
  'UTI': 'Urinary tract infection — bacterial infection affecting parts of the urinary system.',
  'Kidney Stones': 'Hard deposits of minerals and salts that form inside kidneys, causing severe pain.',
  'Anemia': 'A condition where blood lacks enough healthy red blood cells or hemoglobin.',
  'Dehydration': 'Occurs when the body loses more fluids than it takes in, affecting normal body function.',
  'Vertigo': 'A sensation of spinning or dizziness, often caused by inner ear problems.',
  'Arthritis': 'Inflammation of one or more joints, causing pain and stiffness that can worsen with age.',
  'Deep Vein Thrombosis': 'Blood clot in a deep vein, usually in the legs. Can be dangerous if it travels to the lungs.',
  'Ischemic Stroke': 'Occurs when a blood clot blocks or narrows an artery leading to the brain.',
  'Cardiac Arrhythmia': 'Irregular heartbeat — the heart may beat too fast, too slow, or irregularly.',
  'Peripheral Neuropathy': 'Damage to nerves outside the brain and spinal cord, causing weakness and numbness.',
  'Hyperthyroidism': 'Overactive thyroid gland producing too much thyroid hormone.',
  'Diabetes': 'A chronic disease affecting how the body processes blood sugar (glucose).',
  'Iron Deficiency Anemia': 'Most common type of anemia, caused by insufficient iron for hemoglobin production.',
  'Generalized Anxiety Disorder': 'A mental health condition characterized by persistent and excessive worry.',
};

function ruleBasedTriage(symptoms, age, gender, bp, temp, hr, o2) {
  const symptomText = symptoms.toLowerCase();
  
  // Extract matching symptoms
  let matchedSymptoms = [];
  let allConditions = {};
  let highestPriority = 'LOW';
  let maxRisk = 15;
  const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };

  // Sort keys by length (longest first) to match more specific symptoms first
  const sortedKeys = Object.keys(symptomDatabase).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (symptomText.includes(key)) {
      const entry = symptomDatabase[key];
      matchedSymptoms.push(key);
      
      // Track highest priority
      if (priorityOrder[entry.priority] > priorityOrder[highestPriority]) {
        highestPriority = entry.priority;
      }
      
      // Track max risk
      if (entry.risk > maxRisk) {
        maxRisk = entry.risk;
      }

      // Collect conditions with scores
      entry.conditions.forEach((condition, idx) => {
        const score = 90 - (idx * 15); // First condition gets highest score
        if (!allConditions[condition] || allConditions[condition] < score) {
          allConditions[condition] = score;
        }
      });
    }
  }

  // If no symptoms matched, try keyword extraction
  if (matchedSymptoms.length === 0) {
    const words = symptomText.split(/[\s,;.]+/).filter(w => w.length > 3);
    matchedSymptoms = words.slice(0, 5);
    allConditions = {
      'General Medical Consultation Needed': 60,
      'Unspecified Symptoms': 40,
    };
    highestPriority = 'MEDIUM';
    maxRisk = 35;
  }

  // Adjust risk based on vitals
  let vitalAssessment = [];
  
  if (age) {
    const ageNum = parseInt(age);
    if (ageNum > 65) { maxRisk = Math.min(maxRisk + 10, 100); vitalAssessment.push('Elderly patient (>65) — increased risk factor'); }
    if (ageNum < 5) { maxRisk = Math.min(maxRisk + 10, 100); vitalAssessment.push('Pediatric patient (<5) — requires careful assessment'); }
  }

  if (temp) {
    const tempNum = parseFloat(temp);
    if (tempNum >= 103) { maxRisk = Math.min(maxRisk + 15, 100); vitalAssessment.push(`High fever (${tempNum}°F) — significantly elevated`); highestPriority = 'HIGH'; }
    else if (tempNum >= 100.4) { maxRisk = Math.min(maxRisk + 5, 100); vitalAssessment.push(`Fever (${tempNum}°F) — elevated temperature`); }
    else { vitalAssessment.push(`Temperature (${tempNum}°F) — within normal range`); }
  }

  if (hr) {
    const hrNum = parseInt(hr);
    if (hrNum > 120) { maxRisk = Math.min(maxRisk + 10, 100); vitalAssessment.push(`Heart rate (${hrNum} bpm) — tachycardia detected`); }
    else if (hrNum < 50) { maxRisk = Math.min(maxRisk + 10, 100); vitalAssessment.push(`Heart rate (${hrNum} bpm) — bradycardia detected`); }
    else { vitalAssessment.push(`Heart rate (${hrNum} bpm) — within normal range (60-100)`); }
  }

  if (o2) {
    const o2Num = parseInt(o2);
    if (o2Num < 90) { maxRisk = Math.min(maxRisk + 20, 100); vitalAssessment.push(`O₂ Saturation (${o2Num}%) — critically low, immediate attention needed`); highestPriority = 'HIGH'; }
    else if (o2Num < 95) { maxRisk = Math.min(maxRisk + 10, 100); vitalAssessment.push(`O₂ Saturation (${o2Num}%) — below normal range`); }
    else { vitalAssessment.push(`O₂ Saturation (${o2Num}%) — within normal range (95-100%)`); }
  }

  if (bp) {
    const bpParts = bp.split('/');
    if (bpParts.length === 2) {
      const systolic = parseInt(bpParts[0]);
      const diastolic = parseInt(bpParts[1]);
      if (systolic >= 180 || diastolic >= 120) {
        maxRisk = Math.min(maxRisk + 15, 100);
        vitalAssessment.push(`Blood Pressure (${bp}) — hypertensive crisis, immediate attention needed`);
        highestPriority = 'HIGH';
      } else if (systolic >= 140 || diastolic >= 90) {
        maxRisk = Math.min(maxRisk + 5, 100);
        vitalAssessment.push(`Blood Pressure (${bp}) — stage 2 hypertension`);
      } else if (systolic < 90 || diastolic < 60) {
        maxRisk = Math.min(maxRisk + 10, 100);
        vitalAssessment.push(`Blood Pressure (${bp}) — hypotension detected`);
      } else {
        vitalAssessment.push(`Blood Pressure (${bp}) — within normal range`);
      }
    }
  }

  // Sort conditions by score and pick top 3
  const sortedConditions = Object.entries(allConditions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, confidence]) => ({
      name,
      confidence: Math.min(confidence, 95),
      description: conditionDetails[name] || `A medical condition associated with the reported symptoms. Further clinical evaluation recommended.`,
    }));

  // Build priority reason
  let priorityReason;
  if (highestPriority === 'HIGH') {
    priorityReason = 'Critical symptoms detected that may indicate a life-threatening condition. Immediate medical evaluation is strongly recommended.';
  } else if (highestPriority === 'MEDIUM') {
    priorityReason = 'Symptoms suggest a condition that requires prompt medical attention. Schedule an appointment or visit urgent care soon.';
  } else {
    priorityReason = 'Symptoms appear to be minor. Monitor and seek medical attention if symptoms worsen or persist.';
  }

  // Build recommendations
  const recommendations = [];
  if (highestPriority === 'HIGH') {
    recommendations.push('Seek immediate emergency medical care or call 911');
    recommendations.push('Do not delay treatment — time-sensitive conditions may be present');
    recommendations.push('Provide complete medical history to the emergency team');
  } else if (highestPriority === 'MEDIUM') {
    recommendations.push('Schedule an appointment with your primary care physician');
    recommendations.push('Monitor symptoms closely for any changes or worsening');
    recommendations.push('Consider visiting urgent care if symptoms intensify');
  } else {
    recommendations.push('Rest and stay hydrated');
    recommendations.push('Use over-the-counter medication as appropriate');
    recommendations.push('Seek medical attention if symptoms persist beyond 48 hours');
  }
  recommendations.push('Maintain a log of symptoms, timing, and severity for your doctor');

  // Build immediate actions
  const immediateActions = [];
  if (highestPriority === 'HIGH') {
    immediateActions.push('Call emergency services (911) immediately');
    immediateActions.push('Keep the patient calm and in a comfortable position');
    immediateActions.push('Gather any current medications for the emergency team');
  } else if (highestPriority === 'MEDIUM') {
    immediateActions.push('Monitor vital signs regularly');
    immediateActions.push('Keep the patient comfortable and hydrated');
  }

  return {
    conditions: sortedConditions,
    priority: highestPriority,
    priorityReason,
    riskScore: Math.min(maxRisk, 100),
    recommendations,
    immediateActions,
    extractedSymptoms: matchedSymptoms.slice(0, 8),
    vitalSignsAssessment: vitalAssessment.length > 0 ? vitalAssessment.join('. ') + '.' : 'No vital signs provided for assessment.',
    disclaimer: 'This is an AI-assisted triage tool for demonstration purposes only. Always consult a qualified healthcare professional for medical advice.',
  };
}

// ============================================================
// REPORT ANALYSIS API
// ============================================================
app.post('/api/reports/analyze', async (req, res) => {
  try {
    const { fileName, fileType, fileDataUrl } = req.body;

    if (useAI && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        let parts = [];

        if (fileDataUrl) {
          const mimeType = fileType || 'application/pdf';
          const base64Data = fileDataUrl.replace(/^data:[^;]+;base64,/, '');
          parts = [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            { text: `Analyze this medical report file (${fileName}).

You must do TWO things:
1. Extract all medical findings, lab values, abnormal indicators, and provide recommendations.
2. Extract any patient details you can find in the report (patient name, age, gender, date of birth, blood pressure, temperature, heart rate, oxygen saturation, symptoms described, and medical history or diagnoses).

Respond ONLY with valid JSON in this exact format (every field must be present, use null for fields you cannot find):
{
  "summary": "Brief summary of what this report contains",
  "findings": [
    { "name": "Hemoglobin", "value": "11.2 g/dL", "status": "Low" },
    { "name": "Blood Sugar", "value": "245 mg/dL", "status": "High" }
  ],
  "risks": ["Risk indicator 1", "Risk indicator 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "extractedPatient": {
    "name": "Patient name or null",
    "age": "Age as number or null",
    "gender": "Male/Female/Other or null",
    "dob": "Date of birth in YYYY-MM-DD format or null",
    "bloodPressure": "Systolic/Diastolic like 120/80 or null",
    "temperature": "Temperature in Fahrenheit as number or null",
    "heartRate": "Heart rate as number or null",
    "oxygenLevel": "SpO2 as number or null",
    "symptoms": "Comma-separated symptoms found in the report or null",
    "medicalHistory": "Any diagnoses, conditions, or medical history mentioned or null"
  }
}

Rules:
- For findings, include ALL lab values, test results, and measurements found in the report.
- Mark status as "Normal", "Low", "High", "Critical", or "Borderline".
- For extractedPatient, look for patient demographic info (name, age, sex, DOB) typically at the top of medical reports.
- For vitals, convert units if needed (e.g., Celsius to Fahrenheit for temperature).
- If a field is not present in the report, set it to null — do NOT guess.
- Return ONLY the JSON object, no markdown fences, no extra text.` }
          ];

          const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
          const response = await result.response;
          let text = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(text);
          // Ensure extractedPatient always exists
          if (!parsed.extractedPatient) {
            parsed.extractedPatient = {};
          }
          return res.json(parsed);
        }
      } catch (aiError) {
        console.log('Report analysis AI error:', aiError.message);
      }
    }

    // Rule-based fallback (with rich mock details for demo/testing auto-fill)
    const nameLower = (fileName || '').toLowerCase();
    let analysis = {
      summary: `Medical report "${fileName}" uploaded successfully. AI analysis not available — please review manually.`,
      findings: [],
      risks: [],
      recommendations: ['Have a doctor review this report', 'Note any abnormal values manually'],
      extractedPatient: {
        name: "Jane Doe",
        age: 32,
        gender: "Female",
        dob: "1994-08-12",
        bloodPressure: "118/75",
        temperature: 98.4,
        heartRate: 76,
        oxygenLevel: 99,
        symptoms: "Mild headache, fatigue",
        medicalHistory: "Asthma since childhood"
      }
    };

    if (nameLower.includes('cbc') || nameLower.includes('blood')) {
      analysis.summary = `Blood test report "${fileName}" received. Typical findings shown below (sample data).`;
      analysis.findings = [
        { name: 'Hemoglobin', value: '13.5 g/dL', status: 'Normal' },
        { name: 'WBC', value: '6,500 /uL', status: 'Normal' },
        { name: 'Platelets', value: '250,000 /uL', status: 'Normal' }
      ];
      analysis.extractedPatient = {
        name: "John Doe",
        age: 36,
        gender: "Male",
        dob: "1990-06-15",
        bloodPressure: "128/82",
        temperature: 98.6,
        heartRate: 72,
        oxygenLevel: 98,
        symptoms: "Fever, fatigue, dry cough",
        medicalHistory: "None"
      };
    } else if (nameLower.includes('ecg') || nameLower.includes('ekg')) {
      analysis.summary = 'ECG report received. Please have a cardiologist review the waveform data.';
      analysis.risks = ['Rhythm analysis requires specialist review'];
      analysis.extractedPatient = {
        name: "Robert Johnson",
        age: 58,
        gender: "Male",
        dob: "1968-03-22",
        bloodPressure: "142/90",
        temperature: 98.2,
        heartRate: 85,
        oxygenLevel: 96,
        symptoms: "Chest tightness on exertion, mild shortness of breath",
        medicalHistory: "Hypertension, Hyperlipidemia"
      };
    } else if (nameLower.includes('xray') || nameLower.includes('x-ray') || nameLower.includes('mri') || nameLower.includes('ct')) {
      analysis.summary = 'Imaging report received. AI image analysis requires Gemini API key.';
      analysis.recommendations = ['Have a radiologist review the imaging', 'Correlate with clinical symptoms'];
      analysis.extractedPatient = {
        name: "Alice Williams",
        age: 28,
        gender: "Female",
        dob: "1998-11-05",
        bloodPressure: "115/70",
        temperature: 99.1,
        heartRate: 80,
        oxygenLevel: 97,
        symptoms: "Persistent cough, chest pain when deep breathing",
        medicalHistory: "Pneumonia (2020)"
      };
    }

    res.json(analysis);
  } catch (error) {
    console.error('Report analysis error:', error);
    res.status(500).json({
      summary: 'Analysis failed. Please try again.',
      findings: [],
      risks: [],
      recommendations: ['Manual review required'],
      extractedPatient: {}
    });
  }
});

// ============================================================
// TRIAGE API
// ============================================================
// Triage API endpoint
app.post('/api/triage', async (req, res) => {
  try {
    const { symptoms, age, gender, bloodPressure, temperature, heartRate, oxygenLevel } = req.body;
    const body = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: 'Symptoms are required' });
    }

    // Try Gemini AI first, fall back to rule-based
    if (useAI && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const langNames = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', hi: 'Hindi', zh: 'Chinese', ar: 'Arabic' };
        const requestedLang = langNames[body.lang] || 'English';

        const prompt = `You are an expert medical triage AI assistant. Based on the following patient information, provide a comprehensive triage assessment.

IMPORTANT: Respond in the language requested: "${requestedLang}" (all text values, condition names, descriptions, priorityReason, recommendations, immediateActions, and vitalSignsAssessment must be written in "${requestedLang}").

IMPORTANT: You must respond ONLY with valid JSON, no markdown, no code blocks, no extra text.

Patient Information:
- Name: ${body.patientName || 'Unknown'}
- Symptoms: ${symptoms}
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}
- Blood Pressure: ${bloodPressure || 'Not provided'}
- Temperature: ${temperature || 'Not provided'}°F
- Heart Rate: ${heartRate || 'Not provided'} bpm
- Oxygen Level: ${oxygenLevel || 'Not provided'}%
- Visit Type: ${body.visitType || 'Not provided'}
${body.medicalHistory ? `- Medical History: ${body.medicalHistory}` : ''}
${body.reportAnalysis ? `- Uploaded Report Findings: ${body.reportAnalysis}` : ''}

Respond with this exact JSON structure:
{
  "conditions": [
    { "name": "Condition Name", "confidence": 85, "description": "Brief description" }
  ],
  "priority": "HIGH or MEDIUM or LOW",
  "priorityReason": "Brief explanation",
  "riskScore": 75,
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
  "immediateActions": ["Action 1", "Action 2"],
  "extractedSymptoms": ["symptom1", "symptom2"],
  "vitalSignsAssessment": "Brief assessment of vital signs"
}

Rules:
1. List up to 3 most likely conditions with confidence percentages
2. HIGH: Life-threatening (chest pain, breathing difficulty, stroke signs, severe bleeding)
3. MEDIUM: Needs prompt attention (high fever, moderate pain, persistent symptoms)
4. LOW: Minor conditions (mild headache, cold, minor injuries)
5. Risk score 0-100 based on overall severity
6. Factor in the medical history and uploaded report findings for a more accurate diagnosis
7. Always recommend seeing a real doctor`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const triageResult = JSON.parse(text);
        triageResult.disclaimer = "This is an AI-assisted triage tool for demonstration purposes only. Always consult a qualified healthcare professional.";
        return res.json(triageResult);
      } catch (aiError) {
        console.log('⚠️  AI failed, falling back to rule-based:', aiError.message);
      }
    }

    // Rule-based fallback
    const result = ruleBasedTriage(symptoms, age, gender, bloodPressure, temperature, heartRate, oxygenLevel);
    res.json(result);

  } catch (error) {
    console.error('Triage error:', error);
    res.status(500).json({
      error: 'Processing failed',
      conditions: [{ name: 'Service Error', confidence: 0, description: 'Please try again.' }],
      priority: 'MEDIUM',
      priorityReason: 'Unable to determine — please consult a healthcare professional',
      riskScore: 50,
      recommendations: ['Please consult a healthcare professional'],
      immediateActions: ['Seek medical attention if symptoms are severe'],
      extractedSymptoms: [],
      vitalSignsAssessment: 'Unable to assess',
      disclaimer: 'Service error. Please consult a healthcare professional.',
    });
  }
});

// ============================================================
// LOCAL JSON DATABASE & CRUD ENDPOINTS (EHR BACKEND)
// ============================================================
const fs = require('fs');
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  const initialDb = {
    patients: [],
    assessments: [],
    reports: [],
    counters: { patients: 0 }
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf8');
}

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('❌ Failed to read db.json:', e.message);
  }
  return { patients: [], assessments: [], reports: [], counters: { patients: 0 } };
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('❌ Failed to write db.json:', e.message);
    return false;
  }
}

// Generate HS-XXXXXX Patient ID
function generateBackendPatientId(dbData) {
  dbData.counters = dbData.counters || { patients: 0 };
  dbData.counters.patients++;
  return 'HS-' + String(dbData.counters.patients).padStart(6, '0');
}

// --- PATIENTS ---

// GET /api/patients - Get all patients or filter by name
app.get('/api/patients', (req, res) => {
  const dbData = readDb();
  let results = dbData.patients || [];
  
  if (req.query.name) {
    const searchLower = req.query.name.toLowerCase();
    results = results.filter(p => p.name && p.name.toLowerCase().includes(searchLower));
  } else if (req.query.phone) {
    const cleanPhone = req.query.phone.replace(/\D/g, '');
    results = results.filter(p => p.phone && p.phone.replace(/\D/g, '').includes(cleanPhone));
  }
  
  res.json(results);
});

// GET /api/patients/search - Global patient search
app.get('/api/patients/search', (req, res) => {
  const dbData = readDb();
  const query = (req.query.q || '').toLowerCase().trim();
  
  if (!query) return res.json([]);
  
  const patients = dbData.patients || [];
  const assessments = dbData.assessments || [];
  
  // Map assessments by patientId
  const patientAssessments = {};
  assessments.forEach(a => {
    if (a.patientId) {
      patientAssessments[a.patientId] = patientAssessments[a.patientId] || [];
      patientAssessments[a.patientId].push(a);
    }
  });
  
  const results = [];
  patients.forEach(p => {
    let matched = false;
    
    if (p.name && p.name.toLowerCase().includes(query)) matched = true;
    if (p.patientId && p.patientId.toLowerCase().includes(query)) matched = true;
    if (p.phone && p.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))) matched = true;
    if (p.medicalHistory && p.medicalHistory.toLowerCase().includes(query)) matched = true;
    
    // Search assessments
    if (!matched && patientAssessments[p.patientId]) {
      for (const a of patientAssessments[p.patientId]) {
        if (a.symptoms && a.symptoms.toLowerCase().includes(query)) { matched = true; break; }
        if (a.conditions && a.conditions.some(c => c.name && c.name.toLowerCase().includes(query))) { matched = true; break; }
      }
    }
    
    if (matched) {
      const pAssessments = patientAssessments[p.patientId] || [];
      const latest = pAssessments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
      
      results.push({
        ...p,
        assessmentCount: pAssessments.length,
        latestPriority: latest ? latest.priority : null,
        latestRiskScore: latest ? latest.riskScore : null
      });
    }
  });
  
  res.json(results);
});

// GET /api/patients/:id - Get patient by ID
app.get('/api/patients/:id', (req, res) => {
  const dbData = readDb();
  const patient = dbData.patients.find(p => p.patientId === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// POST /api/patients - Create or update patient
app.post('/api/patients', (req, res) => {
  const dbData = readDb();
  const data = req.body;
  
  let existingIndex = -1;
  if (data.patientId) {
    existingIndex = dbData.patients.findIndex(p => p.patientId === data.patientId);
  }
  
  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    // Update existing patient
    const existing = dbData.patients[existingIndex];
    dbData.patients[existingIndex] = {
      ...existing,
      name: data.name || existing.name,
      phone: data.phone || existing.phone,
      dob: data.dob || existing.dob,
      age: data.age !== undefined ? data.age : existing.age,
      gender: data.gender || existing.gender,
      bloodGroup: data.bloodGroup || existing.bloodGroup || '',
      medicalHistory: data.medicalHistory || existing.medicalHistory,
      lastVisit: now,
      updatedAt: now
    };
    writeDb(dbData);
    console.log('✅ Patient updated on backend:', data.patientId);
    return res.json({ id: data.patientId, patientId: data.patientId, isNew: false });
  } else {
    // Create new patient
    const newPatientId = data.patientId || generateBackendPatientId(dbData);
    const newPatient = {
      id: 'doc_' + Math.random().toString(36).substring(2, 11),
      patientId: newPatientId,
      name: data.name || '',
      phone: data.phone || '',
      dob: data.dob || '',
      age: data.age !== undefined ? data.age : null,
      gender: data.gender || '',
      bloodGroup: data.bloodGroup || '',
      medicalHistory: data.medicalHistory || '',
      createdAt: now,
      lastVisit: now,
      updatedAt: now
    };
    dbData.patients.push(newPatient);
    writeDb(dbData);
    console.log('✅ New patient created on backend:', newPatientId);
    return res.json({ id: newPatient.id, patientId: newPatientId, isNew: true });
  }
});

// GET /api/patients/:id/profile - Get patient aggregated profile
app.get('/api/patients/:id/profile', (req, res) => {
  const dbData = readDb();
  const patientId = req.params.id;
  
  const patient = dbData.patients.find(p => p.patientId === patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  
  const assessments = dbData.assessments
    .filter(a => a.patientId === patientId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    
  const reports = dbData.reports
    .filter(r => r.patientId === patientId)
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
    
  const latestAssessment = assessments[0] || null;
  
  res.json({
    ...patient,
    assessments,
    reports,
    currentRisk: latestAssessment ? latestAssessment.riskScore : 0,
    currentPriority: latestAssessment ? latestAssessment.priority : 'N/A',
    totalVisits: assessments.length,
    totalReports: reports.length
  });
});

// --- ASSESSMENTS ---

// GET /api/assessments - Get all assessments (optionally filtered by patientId or priority)
app.get('/api/assessments', (req, res) => {
  const dbData = readDb();
  let results = dbData.assessments || [];
  
  if (req.query.patientId) {
    results = results.filter(a => a.patientId === req.query.patientId);
  }
  if (req.query.priority) {
    results = results.filter(a => a.priority === req.query.priority);
  }
  
  // Sort descending by default
  results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(results);
});

// POST /api/assessments - Save assessment
app.post('/api/assessments', (req, res) => {
  const dbData = readDb();
  const { inputData, resultData } = req.body;
  
  const now = new Date().toISOString();
  const newAssessment = {
    id: 'assess_' + Math.random().toString(36).substring(2, 11),
    patientId: inputData.patientId || '',
    patientName: inputData.patientName || '',
    visitType: inputData.visitType || 'First Visit',
    symptoms: inputData.symptoms || '',
    age: inputData.age || null,
    gender: inputData.gender || '',
    bloodPressure: inputData.bloodPressure || '',
    temperature: inputData.temperature || null,
    heartRate: inputData.heartRate || null,
    oxygenLevel: inputData.oxygenLevel || null,
    medicalHistory: inputData.medicalHistory || '',
    priority: resultData.priority || 'MEDIUM',
    riskScore: resultData.riskScore || 0,
    conditions: resultData.conditions || [],
    recommendations: resultData.recommendations || [],
    immediateActions: resultData.immediateActions || [],
    extractedSymptoms: resultData.extractedSymptoms || [],
    vitalSignsAssessment: resultData.vitalSignsAssessment || '',
    priorityReason: resultData.priorityReason || '',
    reportIds: inputData.reportIds || [],
    createdAt: now,
    status: 'completed'
  };
  
  dbData.assessments.push(newAssessment);
  writeDb(dbData);
  console.log('✅ Assessment saved on backend:', newAssessment.id);
  res.json({ id: newAssessment.id });
});

// DELETE /api/assessments/:id - Delete assessment
app.delete('/api/assessments/:id', (req, res) => {
  const dbData = readDb();
  const id = req.params.id;
  const initialCount = dbData.assessments.length;
  
  dbData.assessments = dbData.assessments.filter(a => a.id !== id);
  writeDb(dbData);
  
  console.log(`🗑 Deleted assessment ${id}. Success: ${dbData.assessments.length < initialCount}`);
  res.json({ success: dbData.assessments.length < initialCount });
});

// --- REPORTS ---

// GET /api/reports - Get reports (optionally filtered by patientId)
app.get('/api/reports', (req, res) => {
  const dbData = readDb();
  let results = dbData.reports || [];
  
  if (req.query.patientId) {
    results = results.filter(r => r.patientId === req.query.patientId);
  }
  
  results.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  res.json(results);
});

// POST /api/reports - Save medical report
app.post('/api/reports', (req, res) => {
  const dbData = readDb();
  const data = req.body;
  
  const newReport = {
    id: 'report_' + Math.random().toString(36).substring(2, 11),
    patientId: data.patientId || '',
    assessmentId: data.assessmentId || '',
    fileName: data.fileName || '',
    fileType: data.fileType || '',
    fileSize: data.fileSize || 0,
    fileDataUrl: data.fileDataUrl || '', // base64 encoded
    analysis: data.analysis || null,
    uploadedAt: new Date().toISOString(),
    status: data.analysis ? 'analyzed' : 'uploaded'
  };
  
  dbData.reports.push(newReport);
  writeDb(dbData);
  console.log('✅ Report saved on backend:', newReport.id);
  res.json({ id: newReport.id });
});

// DELETE /api/reports/:id - Delete report
app.delete('/api/reports/:id', (req, res) => {
  const dbData = readDb();
  const id = req.params.id;
  const initialCount = dbData.reports.length;
  
  dbData.reports = dbData.reports.filter(r => r.id !== id);
  writeDb(dbData);
  
  console.log(`🗑 Deleted report ${id}. Success: ${dbData.reports.length < initialCount}`);
  res.json({ success: dbData.reports.length < initialCount });
});

// --- STATS ---

// GET /api/stats - Get dynamically computed stats
app.get('/api/stats', (req, res) => {
  const dbData = readDb();
  
  const assessments = dbData.assessments || [];
  const patients = dbData.patients || [];
  const reports = dbData.reports || [];
  
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const stats = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    avgRiskScore: 0,
    todayCount: 0,
    totalPatients: patients.length,
    newPatientsToday: 0,
    followUpCount: 0,
    reportsToday: 0,
    totalReports: reports.length,
    weeklyAssessments: 0
  };
  
  let totalRisk = 0;
  
  assessments.forEach(a => {
    stats.total++;
    totalRisk += a.riskScore || 0;
    
    if (a.priority === 'HIGH') stats.high++;
    else if (a.priority === 'MEDIUM') stats.medium++;
    else stats.low++;
    
    if (a.createdAt && a.createdAt.startsWith(today)) {
      stats.todayCount++;
    }
    
    if (a.createdAt && a.createdAt >= weekAgo) {
      stats.weeklyAssessments++;
    }
    
    if (a.visitType === 'Follow-up') {
      stats.followUpCount++;
    }
  });
  
  patients.forEach(p => {
    if (p.createdAt && p.createdAt.startsWith(today)) {
      stats.newPatientsToday++;
    }
  });
  
  reports.forEach(r => {
    if (r.uploadedAt && r.uploadedAt.startsWith(today)) {
      stats.reportsToday++;
    }
  });
  
  stats.avgRiskScore = stats.total > 0 ? Math.round(totalRisk / stats.total) : 0;
  res.json(stats);
});

// Admin Dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Patient Profile route
app.get('/patient', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.listen(PORT, () => {
  console.log(`🏥 Heal Sphere server running at http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard at http://localhost:${PORT}/admin`);
});

