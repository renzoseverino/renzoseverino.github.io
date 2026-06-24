const TOTAL_SECONDS = 30 * 60;
const letters = ["A", "B", "C", "D", "E"];

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
        <h3>${escapeHtml(question.question)}</h3>
      </div>
      ${question.image ? `<img src="${question.image}" alt="Grafico para la pregunta ${question.id}">` : ""}
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
      <p>${escapeHtml(question.question)}</p>
      <p class="answerLine"><strong>Tu respuesta:</strong> ${
        selected === null ? "Sin respuesta" : `${escapeHtml(question.choices[selected])}`
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
  if (Array.isArray(window.QUIZ_QUESTIONS)) {
    questions = window.QUIZ_QUESTIONS;
    return;
  }

  const response = await fetch("questions.json");
  if (!response.ok) {
    throw new Error("No se pudo cargar questions.json");
  }
  questions = await response.json();
}

function startQuiz() {
  submitted = false;
  remainingSeconds = TOTAL_SECONDS;
  currentQuestions = shuffle(questions);
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
  introEl.innerHTML = `<h2>No se pudo cargar la practica</h2><p>${error.message}</p>`;
});
