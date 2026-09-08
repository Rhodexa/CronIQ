import { loadAllPacks } from '../core/packs-repository.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const REVEAL_SUSPENSE_MS = 1000;
const DRAW_SUSPENSE_MS = 900;

const teamCardListEl = document.getElementById('team-card-list');
const scoreWheelEl = document.getElementById('score-wheel');
const scoreWheelLegendEl = document.getElementById('score-wheel-legend');
const feedbackMessageEl = document.getElementById('feedback-message');

const playSectionEl = document.getElementById('play-section');
const drawControlsEl = document.getElementById('draw-controls');
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

function renderScoreWheel() {
	const groups = engine.state.groups;
	const totalScore = groups.reduce((sum, group) => sum + group.score, 0);
	const maxScore = Math.max(...groups.map((group) => group.score));
	const leaders = groups.filter((group) => group.score === maxScore);
	const isTie = maxScore === 0 || leaders.length > 1;

	if (totalScore === 0) {
		// A colored 50/50 split at 0-0 reads as if everyone already has points.
		// Stay neutral until someone actually scores.
		scoreWheelEl.style.background = 'var(--color-surface-raised)';
	} else {
		let cumulativePercent = 0;
		const stops = groups.map((group) => {
			const start = cumulativePercent;
			cumulativePercent += (group.score / totalScore) * 100;
			return `${group.color} ${start}% ${cumulativePercent}%`;
		});
		scoreWheelEl.style.background = `conic-gradient(${stops.join(', ')})`;
	}

	scoreWheelLegendEl.innerHTML = '';
	groups.forEach((group) => {
		const li = document.createElement('li');
		li.className = 'score-wheel-legend-item';
		li.classList.toggle('is-leading', !isTie && group.score === maxScore);

		const crown = document.createElement('span');
		crown.className = 'score-wheel-crown';
		crown.innerHTML =
			'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 19h18l-1.5-9-5 4-3-8-3 8-5-4z"></path></svg>';
		li.appendChild(crown);

		const value = document.createElement('span');
		value.className = 'score-wheel-legend-value';
		value.style.color = group.color;
		value.textContent = group.score;
		li.appendChild(value);

		const name = document.createElement('span');
		name.className = 'score-wheel-legend-name';
		name.textContent = group.name;
		li.appendChild(name);

		scoreWheelLegendEl.appendChild(li);
	});
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

	const name = document.createElement('span');
	name.className = 'team-card-name';
	name.textContent = group.name;
	li.appendChild(name);

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
	confirmButton.hidden = false;
	confirmButton.textContent = 'Confirmar';
	confirmButton.classList.remove('button-primary');
	confirmButton.classList.add('button-ghost');
	confirmButton.disabled = true;
}

function showDrawSuspense(group) {
	feedbackMessageEl.textContent = '';
	questionModal.style.setProperty('--current-team-color', group.color);
	questionTextEl.textContent = '¿Qué te va a tocar…?';
	questionTextEl.classList.add('is-suspense');
	optionsListEl.innerHTML = '';
	for (let i = 0; i < 4; i++) {
		const placeholder = document.createElement('div');
		placeholder.className = 'option-placeholder';
		optionsListEl.appendChild(placeholder);
	}
	confirmButton.hidden = true;
	questionModal.scrollTop = 0;
	if (!questionModal.open) questionModal.showModal();
}

function renderPlayArea() {
	const group = engine.currentGroup;
	questionModal.style.setProperty('--current-team-color', group.color);

	const hasQuestion = Boolean(engine.state.currentQuestion);
	drawControlsEl.hidden = hasQuestion;

	if (!hasQuestion) {
		if (questionModal.open) questionModal.close();
		return;
	}

	feedbackMessageEl.textContent = '';
	resetConfirmButton();
	questionTextEl.classList.remove('is-suspense');
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
	renderScoreWheel();
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
	drawQuestionButton.disabled = true;
	showDrawSuspense(engine.currentGroup);
	setTimeout(() => {
		drawQuestionButton.disabled = false;
		engine.drawQuestion();
		persist();
		render();
	}, DRAW_SUSPENSE_MS);
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
