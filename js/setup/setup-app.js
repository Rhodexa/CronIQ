import { loadAllPacks } from '../core/packs-repository.js';
import { generateId } from '../core/id.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const DEFAULT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
const DEFAULT_GROUP_COUNT = 2;

const groupListEl = document.getElementById('group-list');
const addGroupButton = document.getElementById('add-group-button');
const groupTemplate = document.getElementById('group-template');
const form = document.getElementById('setup-form');
const errorsEl = document.getElementById('setup-errors');

const packPickerDialog = document.getElementById('pack-picker-dialog');
const packPickerOptions = document.getElementById('pack-picker-options');
const packPickerConfirm = document.getElementById('pack-picker-confirm');

// pool: the packs chosen on pack-select.html, available to subscribe to in this game.
let pool = [];
// groups: subscribedPackIds lives here (edited through the dialog); name/color stay on their inputs.
let groups = [];
let editingGroupId = null;

function updatePackSummary(li, groupState) {
	const names = groupState.subscribedPackIds
		.map((id) => pool.find((pack) => pack.id === id)?.name)
		.filter(Boolean);
	li.querySelector('.pack-summary-text').textContent = names.length ? names.join(', ') : 'Elegir packs…';
}

function openPackPicker(groupId) {
	editingGroupId = groupId;
	const groupState = groups.find((group) => group.id === groupId);

	packPickerOptions.innerHTML = '';
	pool.forEach((pack) => {
		const label = document.createElement('label');
		label.className = 'pack-checkbox';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = pack.id;
		checkbox.checked = groupState.subscribedPackIds.includes(pack.id);
		checkbox.addEventListener('change', () => label.classList.toggle('selected', checkbox.checked));

		const checkIcon = document.createElement('span');
		checkIcon.className = 'check-icon';
		checkIcon.innerHTML =
			'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

		label.classList.toggle('selected', checkbox.checked);
		label.appendChild(checkbox);
		label.appendChild(checkIcon);
		label.append(` ${pack.name} (${pack.category})`);
		packPickerOptions.appendChild(label);
	});

	packPickerDialog.showModal();
}

packPickerConfirm.addEventListener('click', () => {
	const groupState = groups.find((group) => group.id === editingGroupId);
	groupState.subscribedPackIds = Array.from(packPickerOptions.querySelectorAll('input:checked')).map(
		(checkbox) => checkbox.value
	);
	const li = groupListEl.querySelector(`[data-group-id="${editingGroupId}"]`);
	updatePackSummary(li, groupState);
	packPickerDialog.close();
});

function addGroupRow() {
	const groupIndex = groupListEl.children.length;
	const fragment = groupTemplate.content.cloneNode(true);
	const li = fragment.querySelector('.group-item');

	const groupState = { id: generateId(), subscribedPackIds: [] };
	groups.push(groupState);
	li.dataset.groupId = groupState.id;

	li.querySelector('.group-name-input').value = `Grupo ${groupIndex + 1}`;
	const colorInput = li.querySelector('.group-color-input');
	colorInput.value = DEFAULT_COLORS[groupIndex % DEFAULT_COLORS.length];
	li.style.setProperty('--group-color', colorInput.value);
	colorInput.addEventListener('input', () => li.style.setProperty('--group-color', colorInput.value));

	li.querySelector('.pack-summary-button').addEventListener('click', () => openPackPicker(groupState.id));
	updatePackSummary(li, groupState);

	li.querySelector('.remove-group-button').addEventListener('click', () => {
		if (groupListEl.children.length > 1) {
			groups = groups.filter((group) => group.id !== groupState.id);
			li.remove();
		}
	});

	groupListEl.appendChild(li);
}

function readGroupsFromForm() {
	return Array.from(groupListEl.querySelectorAll('.group-item')).map((li) => {
		const groupState = groups.find((group) => group.id === li.dataset.groupId);
		return {
			id: groupState.id,
			name: li.querySelector('.group-name-input').value,
			color: li.querySelector('.group-color-input').value,
			subscribedPackIds: groupState.subscribedPackIds,
		};
	});
}

function validateGroups(formGroups) {
	const errors = [];
	if (formGroups.length < 2) errors.push('Necesitás al menos 2 grupos.');
	formGroups.forEach((group, index) => {
		if (!group.name.trim()) errors.push(`El grupo ${index + 1} necesita un nombre.`);
		if (group.subscribedPackIds.length === 0) {
			errors.push(`${group.name || `Grupo ${index + 1}`} necesita al menos un pack.`);
		}
	});
	return errors;
}

addGroupButton.addEventListener('click', addGroupRow);

form.addEventListener('submit', (event) => {
	event.preventDefault();
	const formGroups = readGroupsFromForm();
	const errors = validateGroups(formGroups);
	if (errors.length > 0) {
		errorsEl.hidden = false;
		errorsEl.textContent = errors.join(' ');
		return;
	}
	const gameState = GameEngine.createInitialState(formGroups);
	saveJSON('currentGame', gameState);
	window.location.href = 'game.html';
});

async function init() {
	const selectedPackIds = loadJSON('selectedPackIds', []);
	if (selectedPackIds.length === 0) {
		window.location.href = 'pack-select.html';
		return;
	}
	const allPacks = await loadAllPacks();
	pool = allPacks.filter((pack) => selectedPackIds.includes(pack.id));
	for (let i = 0; i < DEFAULT_GROUP_COUNT; i++) addGroupRow();
}

init();
