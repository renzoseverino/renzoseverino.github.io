const form = document.querySelector('#quiz');
const review = document.querySelector('#review');
const numeric = document.querySelector('#q4');
const send = document.querySelector('#send');
const edit = document.querySelector('#edit');
const status = document.querySelector('#submission-status');
let submission = null;
let waiting = false;
let completed = false;
let timeout;
let transport;

function configuredEndpoint() {
  const endpoint = window.QUIZ_CONFIG?.endpoint || '';
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) ? endpoint : '';
}

if (!configuredEndpoint()) {
  send.disabled = true;
  status.textContent = 'El envío aún no está habilitado.';
}

function parseRate(value) {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

form.addEventListener('input', () => {
  numeric.setCustomValidity('');
  const answers = new FormData(form);
  const count = ['q1', 'q2', 'q3', 'q4', 'q5'].filter(key => String(answers.get(key) || '').trim()).length;
  document.querySelector('#progress').textContent = `${count} de 5 preguntas respondidas`;
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  if (!Number.isFinite(parseRate(numeric.value)) || parseRate(numeric.value) <= 0) {
    numeric.setCustomValidity('Ingresa un número positivo; puedes usar punto o coma decimal.');
    numeric.reportValidity();
    return;
  }
  const list = document.querySelector('#review-answers');
  list.replaceChildren();
  for (let index = 1; index <= 5; index += 1) {
    const term = document.createElement('dt');
    term.textContent = `Pregunta ${index}`;
    const description = document.createElement('dd');
    if (index === 4) {
      description.textContent = `TTS = ${data.get('q4').trim()}`;
    } else {
      const selected = form.querySelector(`input[name="q${index}"]:checked`);
      description.textContent = selected.closest('label').querySelector(index === 1 ? '.option-heading' : 'span').textContent.trim();
    }
    list.append(term, description);
  }
  form.hidden = true;
  review.hidden = false;
  review.focus();
  review.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

edit.addEventListener('click', () => {
  review.hidden = true;
  form.hidden = false;
  form.querySelector('input[name="q1"]:checked').focus();
});

function finishAttempt(ok) {
  clearTimeout(timeout);
  waiting = false;
  if (ok) {
    completed = true;
    status.textContent = 'Respuestas enviadas. Gracias por participar.';
    send.hidden = true;
    edit.hidden = true;
    transport?.remove();
  } else {
    status.textContent = 'No se pudo confirmar el envío. Reintenta sin cerrar esta página; tus respuestas se conservarán.';
    send.disabled = false;
    send.textContent = 'Reintentar envío';
  }
}

send.addEventListener('click', () => {
  const endpoint = configuredEndpoint();
  if (!endpoint || waiting || completed) return;
  if (!submission) {
    const data = new FormData(form);
    submission = {
      quizId: window.QUIZ_CONFIG.quizId,
      submissionId: crypto.randomUUID(),
      answers: Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5'].map(key => [key, key === 'q4' ? parseRate(data.get(key)) : data.get(key)])),
    };
  }
  waiting = true;
  send.disabled = true;
  edit.disabled = true;
  send.textContent = 'Enviando…';
  status.textContent = 'Enviando tus respuestas…';
  // A form POST avoids cross-origin fetch restrictions. Success requires a
  // matching receipt from Google, not just an iframe load or network request.
  transport?.remove();
  transport = document.createElement('iframe');
  transport.name = `receipt-${submission.submissionId}`;
  transport.hidden = true;
  transport.title = 'Confirmación de envío';
  document.body.append(transport);
  const post = document.createElement('form');
  post.method = 'POST';
  post.action = endpoint;
  post.target = transport.name;
  post.hidden = true;
  const payload = document.createElement('input');
  payload.type = 'hidden';
  payload.name = 'payload';
  payload.value = JSON.stringify(submission);
  post.append(payload);
  document.body.append(post);
  timeout = setTimeout(() => finishAttempt(false), 60000);
  post.submit();
  post.remove();
});

window.addEventListener('message', event => {
  let origin;
  try { origin = new URL(event.origin); } catch { return; }
  const googleOrigin = origin.protocol === 'https:' && (origin.hostname === 'script.google.com' || origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('.script.googleusercontent.com') || /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(origin.hostname));
  const receipt = event.data;
  if (!googleOrigin || !submission || completed || receipt?.type !== 'quiz-receipt' || receipt.submissionId !== submission.submissionId || typeof receipt.ok !== 'boolean') return;
  finishAttempt(receipt.ok);
});
