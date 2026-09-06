import {
  loadAllPacks,
  savePack,
  deletePack,
  exportPack,
  importPackFromFile,
  createEmptyQuestion,
  validatePack,
} from '../core/packs-repository.js';

const packListEl = document.getElementById('pack-list');
const newPackButton = document.getElementById('new-pack-button');
const importInput = document.getElementById('import-pack-input');
const importErrorEl = document.getElementById('import-error');

const formSection = document.getElementById('pack-form-section');
const formTitle = document.getElementById('pack-form-title');
const form = document.getElementById('pack-form');
const nameInput = document.getElementById('pack-name-input');
const categoryInput = document.getElementById('pack-category-input');
const colorInput = document.getElementById('pack-color-input');
const questionListEl = document.getElementById('question-list');
const addQuestionButton = document.getElementById('add-question-button');
const cancelButton = document.getElementById('cancel-pack-button');
const formErrorsEl = document.getElementById('pack-form-errors');
const questionTemplate = document.getElementById('question-template');

let editingPackId = null;

async function refreshPackList() {
  const packs = await loadAllPacks();
  packListEl.innerHTML = '';
  packs.forEach((pack) => {
    const li = document.createElement('li');
    const label = pack.isBuiltin ? `${pack.name} (predeterminado)` : pack.name;

    const info = document.createElement('span');
    info.textContent = `${label} — ${pack.category} — ${pack.questions.length} preguntas`;
    li.appendChild(info);

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.textContent = 'Exportar';
    exportButton.addEventListener('click', () => exportPack(pack));
    li.appendChild(exportButton);

    if (!pack.isBuiltin) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', () => openPackForm(pack));
      li.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.addEventListener('click', () => {
        deletePack(pack.id);
        refreshPackList();
      });
      li.appendChild(deleteButton);
    }

    packListEl.appendChild(li);
  });
}

function addQuestionRow(question) {
  const fragment = questionTemplate.content.cloneNode(true);
  const li = fragment.querySelector('.question-item');
  const groupName = `correct-${crypto.randomUUID()}`;

  li.querySelector('.question-text-input').value = question.text;
  const optionInputs = li.querySelectorAll('.option-text-input');
  optionInputs.forEach((input, index) => {
    input.value = question.options[index];
  });
  const radios = li.querySelectorAll('.option-correct-radio');
  radios.forEach((radio, index) => {
    radio.name = groupName;
    radio.checked = index === question.correctIndex;
  });

  li.querySelector('.remove-question-button').addEventListener('click', () => li.remove());
  questionListEl.appendChild(li);
}

function openPackForm(pack) {
  editingPackId = pack ? pack.id : null;
  formTitle.textContent = pack ? `Editando: ${pack.name}` : 'Nuevo pack';
  nameInput.value = pack ? pack.name : '';
  categoryInput.value = pack ? pack.category : '';
  colorInput.value = pack ? pack.color : '#888888';
  questionListEl.innerHTML = '';
  formErrorsEl.hidden = true;

  const questions = pack ? pack.questions : [createEmptyQuestion()];
  questions.forEach(addQuestionRow);

  formSection.hidden = false;
}

function closePackForm() {
  formSection.hidden = true;
  editingPackId = null;
}

function readQuestionsFromForm() {
  return Array.from(questionListEl.querySelectorAll('.question-item')).map((li) => {
    const text = li.querySelector('.question-text-input').value;
    const options = Array.from(li.querySelectorAll('.option-text-input')).map((input) => input.value);
    const checkedRadio = li.querySelector('.option-correct-radio:checked');
    const correctIndex = checkedRadio ? Number(checkedRadio.value) : -1;
    return { text, options, correctIndex };
  });
}

newPackButton.addEventListener('click', () => openPackForm(null));
cancelButton.addEventListener('click', closePackForm);
addQuestionButton.addEventListener('click', () => addQuestionRow(createEmptyQuestion()));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const pack = {
    id: editingPackId,
    name: nameInput.value,
    category: categoryInput.value,
    color: colorInput.value,
    questions: readQuestionsFromForm(),
  };
  const errors = validatePack(pack);
  if (errors.length > 0) {
    formErrorsEl.hidden = false;
    formErrorsEl.textContent = errors.join(' ');
    return;
  }
  savePack(pack);
  closePackForm();
  refreshPackList();
});

importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  if (!file) return;
  importErrorEl.hidden = true;
  try {
    await importPackFromFile(file);
    refreshPackList();
  } catch (error) {
    importErrorEl.hidden = false;
    importErrorEl.textContent = error.message;
  }
  importInput.value = '';
});

refreshPackList();
