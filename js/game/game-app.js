import { loadAllPacks } from '../core/packs-repository.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const scoreboardListEl = document.getElementById('scoreboard-list');
const turnIndicatorEl = document.getElementById('turn-indicator');
const feedbackMessageEl = document.getElementById('feedback-message');

const playSectionEl = document.getElementById('play-section');
const drawControlsEl = document.getElementById('draw-controls');
const packOverrideLabelEl = document.getElementById('pack-override-label');
const packOverrideSelectEl = document.getElementById('pack-override-select');
const drawQuestionButton = document.getElementById('draw-question-button');

const questionDisplayEl = document.getElementById('question-display');
const questionTextEl = document.getElementById('question-text');
const optionsListEl = document.getElementById('options-list');

const groupOverrideSelectEl = document.getElementById('group-override-select');
const overrideGroupButton = document.getElementById('override-group-button');
const finishGameButton = document.getElementById('finish-game-button');

const rankingSectionEl = document.getElementById('ranking-section');
const rankingListEl = document.getElementById('ranking-list');

let engine = null;
let lastFeedback = '';

function persist() {
  saveJSON('currentGame', engine.state);
}

function renderScoreboard() {
  scoreboardListEl.innerHTML = '';
  engine.state.groups.forEach((group, index) => {
    const li = document.createElement('li');
    li.style.color = group.color;
    li.textContent = `${group.name}: ${group.score} punto(s)`;
    if (index === engine.state.currentGroupIndex && !engine.state.finished) {
      li.textContent += ' (turno actual)';
    }
    scoreboardListEl.appendChild(li);
  });
}

function renderGroupOverrideSelect() {
  groupOverrideSelectEl.innerHTML = '';
  engine.state.groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    groupOverrideSelectEl.appendChild(option);
  });
  groupOverrideSelectEl.value = engine.currentGroup.id;
}

function renderPlayArea() {
  const group = engine.currentGroup;
  turnIndicatorEl.textContent = `Le toca a: ${group.name}`;
  feedbackMessageEl.textContent = lastFeedback;

  const hasQuestion = Boolean(engine.state.currentQuestion);
  drawControlsEl.hidden = hasQuestion;
  questionDisplayEl.hidden = !hasQuestion;

  packOverrideLabelEl.hidden = group.subscribedPackIds.length <= 1;
  if (!packOverrideLabelEl.hidden) {
    packOverrideSelectEl.innerHTML = '';
    group.subscribedPackIds.forEach((packId) => {
      const pack = engine.packsById[packId];
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = pack.name;
      packOverrideSelectEl.appendChild(option);
    });
  }

  if (hasQuestion) {
    const { question } = engine.state.currentQuestion;
    questionTextEl.textContent = question.text;
    optionsListEl.innerHTML = '';
    question.options.forEach((optionText, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = optionText;
      button.addEventListener('click', () => answerQuestion(index === question.correctIndex, question));
      li.appendChild(button);
      optionsListEl.appendChild(li);
    });
  }
}

function renderRanking() {
  rankingSectionEl.hidden = !engine.state.finished;
  playSectionEl.hidden = engine.state.finished;
  if (!engine.state.finished) return;

  const ranking = [...engine.state.groups].sort((a, b) => b.score - a.score);
  rankingListEl.innerHTML = '';
  ranking.forEach((group) => {
    const li = document.createElement('li');
    li.style.color = group.color;
    li.textContent = `${group.name}: ${group.score} punto(s)`;
    rankingListEl.appendChild(li);
  });
}

function render() {
  renderScoreboard();
  renderRanking();
  if (!engine.state.finished) {
    renderGroupOverrideSelect();
    renderPlayArea();
  }
}

function answerQuestion(isCorrect, question) {
  lastFeedback = isCorrect
    ? '¡Correcto!'
    : `Incorrecto. La respuesta correcta era: ${question.options[question.correctIndex]}`;
  engine.submitAnswer(isCorrect);
  persist();
  render();
}

drawQuestionButton.addEventListener('click', () => {
  lastFeedback = '';
  const forcedPackId = packOverrideLabelEl.hidden ? undefined : packOverrideSelectEl.value;
  engine.drawQuestion({ forcedPackId });
  persist();
  render();
});

overrideGroupButton.addEventListener('click', () => {
  lastFeedback = '';
  engine.setCurrentGroup(groupOverrideSelectEl.value);
  persist();
  render();
});

finishGameButton.addEventListener('click', () => {
  engine.endGame();
  persist();
  render();
});

async function init() {
  const savedState = loadJSON('currentGame');
  if (!savedState) {
    window.location.href = 'game-setup.html';
    return;
  }
  const packs = await loadAllPacks();
  const packsById = Object.fromEntries(packs.map((pack) => [pack.id, pack]));
  engine = new GameEngine(savedState, packsById);
  render();
}

init();
