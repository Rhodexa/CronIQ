import { loadAllPacks } from '../core/packs-repository.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const scoreboardBarEl = document.getElementById('scoreboard-bar');
const turnIndicatorEl = document.getElementById('turn-indicator');
const feedbackMessageEl = document.getElementById('feedback-message');

const playSectionEl = document.getElementById('play-section');
const drawControlsEl = document.getElementById('draw-controls');
const packOverrideLabelEl = document.getElementById('pack-override-label');
const packOverrideSelectEl = document.getElementById('pack-override-select');
const drawQuestionButton = document.getElementById('draw-question-button');

const questionModal = document.getElementById('question-modal');
const questionTextEl = document.getElementById('question-text');
const optionsListEl = document.getElementById('options-list');
const continueButton = document.getElementById('continue-button');

const groupOverrideSelectEl = document.getElementById('group-override-select');
const overrideGroupButton = document.getElementById('override-group-button');
const finishGameButton = document.getElementById('finish-game-button');

const rankingSectionEl = document.getElementById('ranking-section');
const rankingListEl = document.getElementById('ranking-list');

let engine = null;
// The outcome of the answer just revealed, waiting for the GM to hit "Continuar"
// before it's actually committed to the engine (see revealAnswer/continueButton below).
let pendingIsCorrect = null;

function persist() {
	saveJSON('currentGame', engine.state);
}

function renderScoreChip(group, isCurrent) {
	const chip = document.createElement('li');
	chip.className = 'score-chip';
	chip.classList.toggle('is-current', isCurrent);
	chip.style.setProperty('--chip-color', group.color);

	const name = document.createElement('span');
	name.className = 'score-chip-name';
	name.textContent = group.name;

	const score = document.createElement('span');
	score.className = 'score-chip-value';
	score.textContent = group.score;

	chip.appendChild(name);
	chip.appendChild(score);
	return chip;
}

function renderScoreboard() {
	scoreboardBarEl.innerHTML = '';
	engine.state.groups.forEach((group, index) => {
		const isCurrent = index === engine.state.currentGroupIndex && !engine.state.finished;
		scoreboardBarEl.appendChild(renderScoreChip(group, isCurrent));
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

	const hasQuestion = Boolean(engine.state.currentQuestion);
	drawControlsEl.hidden = hasQuestion;

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

	if (!hasQuestion) {
		if (questionModal.open) questionModal.close();
		return;
	}

	feedbackMessageEl.textContent = '';
	continueButton.hidden = true;
	const { question } = engine.state.currentQuestion;
	questionTextEl.textContent = question.text;
	optionsListEl.innerHTML = '';
	question.options.forEach((optionText, index) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'option-button';
		button.textContent = optionText;
		button.style.setProperty('--option-chars', optionText.length);
		button.addEventListener('click', () => revealAnswer(index, question), { once: true });
		optionsListEl.appendChild(button);
	});
	if (!questionModal.open) questionModal.showModal();
}

function renderRanking() {
	rankingSectionEl.hidden = !engine.state.finished;
	playSectionEl.hidden = engine.state.finished;
	if (!engine.state.finished) return;

	const ranking = [...engine.state.groups].sort((a, b) => b.score - a.score);
	rankingListEl.innerHTML = '';
	ranking.forEach((group) => rankingListEl.appendChild(renderScoreChip(group, false)));
}

function render() {
	renderScoreboard();
	renderRanking();
	if (!engine.state.finished) {
		renderGroupOverrideSelect();
		renderPlayArea();
	} else if (questionModal.open) {
		questionModal.close();
	}
}

function revealAnswer(chosenIndex, question) {
	const isCorrect = chosenIndex === question.correctIndex;
	pendingIsCorrect = isCorrect;

	optionsListEl.querySelectorAll('.option-button').forEach((button, index) => {
		button.disabled = true;
		if (index === question.correctIndex) {
			button.classList.add('is-correct');
		} else if (index === chosenIndex) {
			button.classList.add('is-wrong');
		}
	});

	feedbackMessageEl.textContent = isCorrect
		? '¡Correcto!'
		: `Incorrecto. La respuesta correcta era: ${question.options[question.correctIndex]}`;
	continueButton.hidden = false;
}

continueButton.addEventListener('click', () => {
	engine.submitAnswer(pendingIsCorrect);
	persist();
	render();
});

drawQuestionButton.addEventListener('click', () => {
	const forcedPackId = packOverrideLabelEl.hidden ? undefined : packOverrideSelectEl.value;
	engine.drawQuestion({ forcedPackId });
	persist();
	render();
});

overrideGroupButton.addEventListener('click', () => {
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
