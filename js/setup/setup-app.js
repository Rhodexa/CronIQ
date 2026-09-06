import { loadAllPacks } from '../core/packs-repository.js';
import { generateId } from '../core/id.js';
import { saveJSON } from '../core/storage.js';
import { GameEngine } from '../engine/game-engine.js';

const DEFAULT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
const DEFAULT_GROUP_COUNT = 2;

const groupListEl = document.getElementById('group-list');
const addGroupButton = document.getElementById('add-group-button');
const groupTemplate = document.getElementById('group-template');
const form = document.getElementById('setup-form');
const errorsEl = document.getElementById('setup-errors');

let availablePacks = [];

function addGroupRow() {
  const groupIndex = groupListEl.children.length;
  const fragment = groupTemplate.content.cloneNode(true);
  const li = fragment.querySelector('.group-item');

  li.querySelector('.group-name-input').value = `Grupo ${groupIndex + 1}`;
  const colorInput = li.querySelector('.group-color-input');
  colorInput.value = DEFAULT_COLORS[groupIndex % DEFAULT_COLORS.length];
  li.style.setProperty('--group-color', colorInput.value);
  colorInput.addEventListener('input', () => li.style.setProperty('--group-color', colorInput.value));

  const fieldset = li.querySelector('.group-packs-fieldset');
  availablePacks.forEach((pack) => {
    const label = document.createElement('label');
    label.className = 'pack-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'group-pack-checkbox';
    checkbox.value = pack.id;
    label.appendChild(checkbox);
    label.append(` ${pack.name} (${pack.category})`);
    fieldset.appendChild(label);
  });

  li.querySelector('.remove-group-button').addEventListener('click', () => {
    if (groupListEl.children.length > 1) li.remove();
  });

  groupListEl.appendChild(li);
}

function readGroupsFromForm() {
  return Array.from(groupListEl.querySelectorAll('.group-item')).map((li) => ({
    id: generateId(),
    name: li.querySelector('.group-name-input').value,
    color: li.querySelector('.group-color-input').value,
    subscribedPackIds: Array.from(li.querySelectorAll('.group-pack-checkbox:checked')).map(
      (checkbox) => checkbox.value
    ),
  }));
}

function validateGroups(groups) {
  const errors = [];
  if (groups.length < 2) errors.push('Necesitás al menos 2 grupos.');
  groups.forEach((group, index) => {
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
  const groups = readGroupsFromForm();
  const errors = validateGroups(groups);
  if (errors.length > 0) {
    errorsEl.hidden = false;
    errorsEl.textContent = errors.join(' ');
    return;
  }
  const gameState = GameEngine.createInitialState(groups);
  saveJSON('currentGame', gameState);
  window.location.href = 'game.html';
});

async function init() {
  availablePacks = await loadAllPacks();
  for (let i = 0; i < DEFAULT_GROUP_COUNT; i++) addGroupRow();
}

init();
