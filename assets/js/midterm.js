const TOTAL_SECONDS = 30 * 60;
const QUESTIONS_PER_ATTEMPT = 8;
const letters = ["A", "B", "C", "D", "E"];
const linkedQuestions = [
  { source: "2025-II", first: 3, second: 4 },
  { source: "2026-I", first: 5, second: 6 },
  { source: "2026-I", first: 7, second: 8 },
];

const timerEl = document.querySelector("#timer");
const introEl = document.querySelector("#intro");
const startBtn = document.querySelector("#startBtn");
const quizForm = document.querySelector("#quizForm");
const questionsEl = document.querySelector("#questions");
const resultsEl = document.querySelector("#results");
const resultListEl = document.querySelector("#resultList");
const retryBtn = document.querySelector("#retryBtn");

let questions = [];
let currentQuestions = [];
let timerId = null;
let remainingSeconds = TOTAL_SECONDS;
let submitted = false;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sameSourceQuestion(question, source, sourceQuestion) {
  return question.source === source && question.sourceQuestion === sourceQuestion;
}

function findQuestion(source, sourceQuestion) {
  return questions.find((question) => sameSourceQuestion(question, source, sourceQuestion));
}

function getLinkedSecond(question) {
  const link = linkedQuestions.find(({ source, first }) => sameSourceQuestion(question, source, first));
  return link ? findQuestion(link.source, link.second) : null;
}

function drawQuestionSet() {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const selected = [];
    const selectedIds = new Set();

    for (const question of shuffle(questions)) {
      if (selectedIds.has(question.id)) continue;

      const linkedSecond = getLinkedSecond(question);
      if (linkedSecond && selectedIds.has(linkedSecond.id)) continue;

      const group = linkedSecond && !selectedIds.has(linkedSecond.id)
        ? [question, linkedSecond]
        : [question];

      if (selected.length + group.length > QUESTIONS_PER_ATTEMPT) continue;

      group.forEach((item) => {
        selected.push(item);
        selectedIds.add(item.id);
      });

      if (selected.length === QUESTIONS_PER_ATTEMPT) return selected;
    }
  }

  throw new Error("No se pudo seleccionar un conjunto válido de preguntas.");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNotation(value) {
  return value
    .replaceAll("QD", "Q<sub>D</sub>")
    .replaceAll("QS", "Q<sub>S</sub>");
}

function renderTextBlock(value) {
  return String(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${formatNotation(escapeHtml(paragraph))}</p>`)
    .join("");
}

function updateTimer() {
  timerEl.textContent = formatTime(remainingSeconds);
  if (remainingSeconds <= 0) {
    submitQuiz();
    return;
  }
  remainingSeconds -= 1;
}

function renderQuiz() {
  questionsEl.innerHTML = "";
  currentQuestions.forEach((question, questionIndex) => {
    const article = document.createElement("article");
    article.className = "question";

    const choices = question.choices
      .map((choice, choiceIndex) => {
        const inputId = `q${question.id}_${choiceIndex}`;
        return `
          <label class="choice" for="${inputId}">
            <input id="${inputId}" type="radio" name="q${question.id}" value="${choiceIndex}">
            <span class="letter">${letters[choiceIndex]}</span>
            <span>${escapeHtml(choice)}</span>
          </label>
        `;
      })
      .join("");

    article.innerHTML = `
      <div class="questionHeader">
        <span class="number">${questionIndex + 1}</span>
        <div class="questionText">${renderTextBlock(question.question)}</div>
      </div>
      ${question.image ? `<img src="${escapeHtml(question.image)}" alt="Gráfico para la pregunta ${questionIndex + 1}">` : ""}
      <div class="choices">${choices}</div>
    `;

    questionsEl.appendChild(article);
  });
}

function getSelectedAnswer(question) {
  const selected = quizForm.querySelector(`input[name="q${question.id}"]:checked`);
  return selected ? Number(selected.value) : null;
}

function submitQuiz() {
  if (submitted) return;
  submitted = true;
  clearInterval(timerId);
  quizForm.classList.add("locked");
  quizForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = true;
  });

  resultListEl.innerHTML = "";
  currentQuestions.forEach((question, index) => {
    const selected = getSelectedAnswer(question);
    const isCorrect = selected === question.answer;
    const item = document.createElement("article");
    item.className = "resultItem";
    item.innerHTML = `
      <span class="resultStatus ${isCorrect ? "correct" : "incorrect"}">
        ${isCorrect ? "Correcta" : "Incorrecta"}
      </span>
      <h3>Pregunta ${index + 1}</h3>
      <div class="questionText">${renderTextBlock(question.question)}</div>
      <p class="answerLine"><strong>Tu respuesta:</strong> ${
        selected === null ? "Sin respuesta" : escapeHtml(question.choices[selected])
      }</p>
      <p class="answerLine"><strong>Respuesta correcta:</strong> ${
        escapeHtml(question.choices[question.answer])
      }</p>
    `;
    resultListEl.appendChild(item);
  });

  resultsEl.classList.remove("hidden");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadQuestions() {
  if (Array.isArray(window.PARCIAL_QUESTIONS)) {
    questions = window.PARCIAL_QUESTIONS;
    return;
  }

  const response = await fetch("assets/data/midterm.json");
  if (!response.ok) {
    throw new Error("No se pudo cargar midterm.json");
  }
  questions = await response.json();
}

function startQuiz() {
  submitted = false;
  remainingSeconds = TOTAL_SECONDS;
  currentQuestions = drawQuestionSet();
  introEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  quizForm.classList.remove("hidden", "locked");
  quizForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = false;
  });
  renderQuiz();
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

startBtn.addEventListener("click", startQuiz);
retryBtn.addEventListener("click", () => {
  clearInterval(timerId);
  quizForm.reset();
  startQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

quizForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuiz();
});

loadQuestions().catch((error) => {
  introEl.innerHTML = `<h2>No se pudo cargar la práctica</h2><p>${escapeHtml(error.message)}</p>`;
});
