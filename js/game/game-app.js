import { loadAllPacks } from '../core/packs-repository.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const REVEAL_SUSPENSE_MS = 1000;

const teamCardListEl = document.getElementById('team-card-list');
const feedbackMessageEl = document.getElementById('feedback-message');

const playSectionEl = document.getElementById('play-section');
const drawControlsEl = document.getElementById('draw-controls');
const packOverrideLabelEl = document.getElementById('pack-override-label');
const packOverrideSelectEl = document.getElementById('pack-override-select');
const drawQuestionButton = document.getElementById('draw-question-button');

const questionModal = document.getElementById('question-modal');
const questionTextEl = document.getElementById('question-text');
const optionsListEl = document.getElementById('options-list');
const confirmButton = document.getElementById('confirm-button');

const finishGameButton = document.getElementById('finish-game-button');

const rankingSectionEl = document.getElementById('ranking-section');
const rankingListEl = document.getElementById('ranking-list');

let engine = null;
let activeQuestion = null;
let selectedIndex = null;
let pendingIsCorrect = null;
// 'picking' (choosing, Confirmar disabled/enabled) -> 'revealing' (suspense delay,
// nothing clickable) -> 'revealed' (Confirmar has become Continuar).
let revealPhase = 'picking';

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

function renderTeamCard(group, isCurrent) {
	const li = document.createElement('li');
	li.className = 'team-card';
	li.classList.toggle('is-current', isCurrent);
	li.style.setProperty('--group-color', group.color);

	const checkButton = document.createElement('button');
	checkButton.type = 'button';
	checkButton.className = 'team-card-check';
	checkButton.setAttribute('aria-label', `Es el turno de ${group.name}`);
	checkButton.innerHTML =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
	checkButton.addEventListener('click', () => {
		engine.setCurrentGroup(group.id);
		persist();
		render();
	});
	li.appendChild(checkButton);

	const info = document.createElement('div');
	info.className = 'team-card-info';
	const name = document.createElement('span');
	name.className = 'team-card-name';
	name.textContent = group.name;
	const score = document.createElement('span');
	score.className = 'team-card-score';
	score.innerHTML = `<strong>${group.score}</strong> punto(s)`;
	info.appendChild(name);
	info.appendChild(score);
	li.appendChild(info);

	return li;
}

function renderTeamCards() {
	teamCardListEl.innerHTML = '';
	engine.state.groups.forEach((group, index) => {
		const isCurrent = index === engine.state.currentGroupIndex && !engine.state.finished;
		teamCardListEl.appendChild(renderTeamCard(group, isCurrent));
	});
}

function resetConfirmButton() {
	revealPhase = 'picking';
	selectedIndex = null;
	confirmButton.textContent = 'Confirmar';
	confirmButton.classList.remove('button-primary');
	confirmButton.classList.add('button-ghost');
	confirmButton.disabled = true;
}

function renderPlayArea() {
	const group = engine.currentGroup;
	questionModal.style.setProperty('--current-team-color', group.color);

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
	resetConfirmButton();
	// A long previous question can leave the dialog scrolled; a shorter one
	// afterwards would otherwise reopen still scrolled past its own top.
	questionModal.scrollTop = 0;
	activeQuestion = engine.state.currentQuestion.question;
	questionTextEl.textContent = activeQuestion.text;
	optionsListEl.innerHTML = '';
	activeQuestion.options.forEach((optionText, index) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'option-button';
		button.textContent = optionText;
		button.style.setProperty('--option-chars', optionText.length);
		button.addEventListener('click', () => selectOption(index));
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
	renderTeamCards();
	renderRanking();
	if (!engine.state.finished) {
		renderPlayArea();
	} else if (questionModal.open) {
		questionModal.close();
	}
}

function selectOption(index) {
	if (revealPhase !== 'picking') return;
	selectedIndex = index;
	optionsListEl.querySelectorAll('.option-button').forEach((button, i) => {
		button.classList.toggle('is-selected', i === index);
	});
	confirmButton.disabled = false;
}

function startReveal() {
	revealPhase = 'revealing';
	confirmButton.disabled = true;
	optionsListEl.querySelectorAll('.option-button').forEach((button) => (button.disabled = true));

	const isCorrect = selectedIndex === activeQuestion.correctIndex;
	pendingIsCorrect = isCorrect;

	if (!isCorrect) {
		optionsListEl.children[selectedIndex].classList.remove('is-selected');
		optionsListEl.children[selectedIndex].classList.add('is-wrong');
	}

	// Same suspense delay whether or not the pick was right — revealing the
	// correct tile instantly on a correct guess would undercut the tension.
	setTimeout(() => {
		optionsListEl.querySelectorAll('.option-button').forEach((button) => button.classList.remove('is-selected'));
		optionsListEl.children[activeQuestion.correctIndex].classList.add('is-correct');
		feedbackMessageEl.textContent = isCorrect
			? '¡Correcto!'
			: `Incorrecto. La respuesta correcta era: ${activeQuestion.options[activeQuestion.correctIndex]}`;

		revealPhase = 'revealed';
		confirmButton.textContent = 'Continuar';
		confirmButton.classList.remove('button-ghost');
		confirmButton.classList.add('button-primary');
		confirmButton.disabled = false;
		// The correct tile lifting via transform can nudge the dialog's scroll
		// position (some browsers count transforms toward scrollable overflow).
		questionModal.scrollTop = 0;
	}, REVEAL_SUSPENSE_MS);
}

confirmButton.addEventListener('click', () => {
	if (revealPhase === 'picking') {
		if (selectedIndex !== null) startReveal();
	} else if (revealPhase === 'revealed') {
		engine.submitAnswer(pendingIsCorrect);
		persist();
		render();
	}
});

drawQuestionButton.addEventListener('click', () => {
	const forcedPackId = packOverrideLabelEl.hidden ? undefined : packOverrideSelectEl.value;
	engine.drawQuestion({ forcedPackId });
	persist();
	render();
});

finishGameButton.addEventListener('click', () => {
	if (!confirm('¿Seguro que querés finalizar la partida?')) return;
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
