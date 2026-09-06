import { loadAllPacks, importPackFromFile } from '../core/packs-repository.js';
import { saveJSON } from '../core/storage.js';

const fileInput = document.getElementById('pack-file-input');
const importErrorEl = document.getElementById('import-error');
const listEl = document.getElementById('loaded-pack-list');
const continueButton = document.getElementById('continue-button');
const errorsEl = document.getElementById('pack-select-errors');

// Packs loaded for this game: built-in + anything already known from a previous
// session, plus whatever gets imported now. No pick-from-a-list step — you load
// what you want and remove what you don't, since there's no server keeping a catalog.
let loadedPacks = [];

function renderList() {
	listEl.innerHTML = '';
	loadedPacks.forEach((pack) => {
		const li = document.createElement('li');
		li.className = 'pack-checkbox';

		const label = document.createElement('span');
		label.textContent = `${pack.name} (${pack.category})`;
		li.appendChild(label);

		const removeButton = document.createElement('button');
		removeButton.type = 'button';
		removeButton.className = 'icon-button icon-button-danger';
		removeButton.setAttribute('aria-label', 'Quitar pack');
		removeButton.innerHTML =
			'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
		removeButton.addEventListener('click', () => {
			loadedPacks = loadedPacks.filter((loadedPack) => loadedPack.id !== pack.id);
			renderList();
		});
		li.appendChild(removeButton);

		listEl.appendChild(li);
	});
}

function addPack(pack) {
	if (loadedPacks.some((loadedPack) => loadedPack.id === pack.id)) return;
	loadedPacks.push(pack);
	renderList();
}

fileInput.addEventListener('change', async () => {
	importErrorEl.hidden = true;
	for (const file of fileInput.files) {
		try {
			addPack(await importPackFromFile(file));
		} catch (error) {
			importErrorEl.hidden = false;
			importErrorEl.textContent = error.message;
		}
	}
	fileInput.value = '';
});

continueButton.addEventListener('click', () => {
	if (loadedPacks.length === 0) {
		errorsEl.hidden = false;
		errorsEl.textContent = 'Cargá al menos un pack para continuar.';
		return;
	}
	saveJSON(
		'selectedPackIds',
		loadedPacks.map((pack) => pack.id)
	);
	window.location.href = 'game-setup.html';
});

async function init() {
	const packs = await loadAllPacks();
	packs.forEach(addPack);
}

init();
