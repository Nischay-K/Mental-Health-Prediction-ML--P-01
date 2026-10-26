/* ==========================================================
   Configuration
   Change API_BASE_URL if your FastAPI server runs elsewhere.
   ========================================================== */
const API_BASE_URL = 'https://mental-health-prediction-ml-p-01.onrender.com';
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;
const REQUEST_TIMEOUT_MS = 15000;

/* Field definitions mirror the backend StudentData model exactly. */
const FIELDS = [
  { name: 'Age', type: 'int', min: 10, max: 100, label: 'Age' },
  { name: 'Gender', type: 'choice', options: ['Male', 'Female'], label: 'Gender' },
  { name: 'Country', type: 'text', label: 'Country' },
  { name: 'Academic_Level', type: 'choice', options: ['Undergraduate', 'Graduate', 'High School'], label: 'Academic level' },
  {
    name: 'Most_Used_Platform', type: 'choice', label: 'Most used platform',
    options: ['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter', 'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat'],
  },
  { name: 'Purpose_Of_Use', type: 'choice', options: ['Networking', 'Education', 'Entertainment', 'News'], label: 'Purpose of use' },
  { name: 'Avg_Daily_Usage_Hours', type: 'float', min: 0, max: 24, label: 'Average daily usage' },
  { name: 'Daily_Unlocks', type: 'int', min: 0, label: 'Daily unlocks' },
  { name: 'Study_Hours', type: 'float', min: 0, max: 24, label: 'Study hours' },
  { name: 'Physical_Activity_Hours', type: 'float', min: 0, max: 24, label: 'Physical activity hours' },
  { name: 'Sleep_Hours_Per_Night', type: 'float', min: 0, max: 24, label: 'Sleep hours' },
  { name: 'Stress_Level', type: 'choice', options: ['Medium', 'Low', 'Very High', 'High'], label: 'Stress level' },
];

/* ---------- DOM references ---------- */
const form = document.getElementById('predict-form');
const predictBtn = document.getElementById('predict-btn');
const predictBtnLabel = predictBtn.querySelector('.btn-label');
const resetBtn = document.getElementById('reset-btn');
const newPredictionBtn = document.getElementById('new-prediction-btn');
const formError = document.getElementById('form-error');
const resultPanels = {
  empty: document.getElementById('result-empty'),
  loading: document.getElementById('result-loading'),
  success: document.getElementById('result-success'),
};
const scoreValue = document.getElementById('score-value');

let isSubmitting = false;

/* ---------- Reading and validating form values ---------- */
function readRawValue(field) {
  if (field.type === 'choice' && document.querySelector(`input[type="radio"][name="${field.name}"]`)) {
    const checked = form.querySelector(`input[name="${field.name}"]:checked`);
    return checked ? checked.value : '';
  }
  return form.elements[field.name].value.trim();
}

/* Returns { value } on success or { error } on failure. */
function parseField(field) {
  const raw = readRawValue(field);
  if (raw === '') return { error: `${field.label} is required.` };

  if (field.type === 'text') return { value: raw };

  if (field.type === 'choice') {
    return field.options.includes(raw) ? { value: raw } : { error: `Choose a valid ${field.label.toLowerCase()}.` };
  }

  const number = Number(raw);
  if (!Number.isFinite(number)) return { error: `${field.label} must be a number.` };
  if (field.type === 'int' && !Number.isInteger(number)) return { error: `${field.label} must be a whole number.` };
  if (field.min !== undefined && number < field.min) return { error: `${field.label} must be at least ${field.min}.` };
  if (field.max !== undefined && number > field.max) return { error: `${field.label} must be at most ${field.max}.` };
  return { value: number };
}

function validateForm() {
  const payload = {};
  let firstInvalidName = null;

  FIELDS.forEach((field) => {
    const result = parseField(field);
    if (result.error) {
      setFieldError(field.name, result.error);
      firstInvalidName = firstInvalidName || field.name;
    } else {
      setFieldError(field.name, '');
      payload[field.name] = result.value;
    }
  });

  return { payload, isValid: firstInvalidName === null, firstInvalidName };
}

/* ---------- Field error display ---------- */
function setFieldError(name, message) {
  const wrapper = form.querySelector(`[data-field="${name}"]`);
  const errorEl = document.getElementById(`${name}-error`);
  if (!wrapper || !errorEl) return;
  errorEl.textContent = message;
  wrapper.classList.toggle('invalid', Boolean(message));
}

function clearAllErrors() {
  FIELDS.forEach((field) => setFieldError(field.name, ''));
  hideFormError();
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideFormError() {
  formError.textContent = '';
  formError.hidden = true;
}

function focusField(name) {
  const target = form.querySelector(`[name="${name}"]`);
  if (target) target.focus();
}

/* ---------- Result panel states ---------- */
function showResultState(state) {
  Object.entries(resultPanels).forEach(([key, el]) => { el.hidden = key !== state; });
}

function setLoading(loading) {
  isSubmitting = loading;
  predictBtn.disabled = loading;
  predictBtn.classList.toggle('is-loading', loading);
  predictBtn.setAttribute('aria-busy', String(loading));
  predictBtnLabel.textContent = loading ? 'Predicting…' : 'Predict score';
}

/* ---------- API ---------- */
class ApiError extends Error {}

/* Turns a FastAPI 422 body into field-level messages. */
function applyValidationErrors(detail) {
  if (!Array.isArray(detail)) return false;
  let applied = false;
  detail.forEach((item) => {
    const fieldName = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
    if (FIELDS.some((f) => f.name === fieldName)) {
      setFieldError(fieldName, typeof item.msg === 'string' ? item.msg : 'Invalid value.');
      applied = true;
    }
  });
  return applied;
}

async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.');
    }
    throw new ApiError(`Could not reach the prediction server at ${API_BASE_URL}. Check that it is running and try again.`);
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }

  if (response.status === 422) {
    const shown = applyValidationErrors(body && body.detail);
    throw new ApiError(shown
      ? 'The server rejected some values. Please correct the highlighted fields.'
      : 'The server rejected the submitted values. Please review the form and try again.');
  }
  if (!response.ok) {
    throw new ApiError(response.status >= 500
      ? 'The prediction server ran into a problem. Please try again later.'
      : `The request could not be completed (status ${response.status}).`);
  }

  const score = body ? body.predicted_mental_health_score : undefined;
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new ApiError('The server returned an unexpected response, so no score could be shown.');
  }
  return score;
}

/* ---------- Event handlers ---------- */
async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  hideFormError();
  const { payload, isValid, firstInvalidName } = validateForm();
  if (!isValid) {
    showResultState('empty');
    showFormError('Please fix the highlighted fields and try again.');
    focusField(firstInvalidName);
    return;
  }

  setLoading(true);
  showResultState('loading');

  try {
    const score = await requestPrediction(payload);
    scoreValue.textContent = score.toFixed(2);
    showResultState('success');
  } catch (err) {
    showResultState('empty');
    showFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

function resetEverything() {
  clearAllErrors();
  scoreValue.textContent = '–';
  showResultState('empty');
}

form.addEventListener('submit', handleSubmit);
/* The native reset runs first; clear leftovers right after. */
form.addEventListener('reset', () => setTimeout(resetEverything, 0));
newPredictionBtn.addEventListener('click', () => {
  form.reset();
  focusField(FIELDS[0].name);
});

/* Clear a field's error as soon as the user edits it. */
form.addEventListener('input', (event) => {
  const name = event.target.name;
  if (name) setFieldError(name, '');
});
