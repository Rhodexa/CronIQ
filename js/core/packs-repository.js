import { loadJSON, saveJSON } from './storage.js';
import { generateId, slugify } from './id.js';

const CUSTOM_PACKS_KEY = 'customPacks';
const BUILTIN_MANIFEST_URL = 'assets/packs/manifest.json';

// Pack: { id, name, category, color, questions }
// Question: { id, text, options: string[4], correctIndex }

let builtinPacksCache = null;

async function loadBuiltinPacks() {
  if (builtinPacksCache) return builtinPacksCache;
  const manifestResponse = await fetch(BUILTIN_MANIFEST_URL);
  const filenames = await manifestResponse.json();
  const packs = await Promise.all(
    filenames.map(async (filename) => {
      const response = await fetch(`assets/packs/${filename}`);
      const pack = await response.json();
      return { ...pack, isBuiltin: true };
    })
  );
  builtinPacksCache = packs;
  return packs;
}

function loadCustomPacks() {
  return loadJSON(CUSTOM_PACKS_KEY, {});
}

function saveCustomPacks(packsById) {
  saveJSON(CUSTOM_PACKS_KEY, packsById);
}

export async function loadAllPacks() {
  const builtin = await loadBuiltinPacks();
  const custom = loadCustomPacks();
  return [...builtin, ...Object.values(custom)];
}

export function validatePack(pack) {
  const errors = [];
  if (!pack.name || !pack.name.trim()) errors.push('El pack necesita un nombre.');
  if (!pack.category || !pack.category.trim()) errors.push('El pack necesita una categoría.');
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    errors.push('El pack necesita al menos una pregunta.');
  } else {
    pack.questions.forEach((question, index) => {
      const label = `Pregunta ${index + 1}`;
      if (!question.text || !question.text.trim()) errors.push(`${label}: falta el texto.`);
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        errors.push(`${label}: necesita exactamente 4 opciones.`);
      } else if (question.options.some((option) => !option || !option.trim())) {
        errors.push(`${label}: ninguna opción puede estar vacía.`);
      }
      if (
        typeof question.correctIndex !== 'number' ||
        question.correctIndex < 0 ||
        question.correctIndex > 3
      ) {
        errors.push(`${label}: falta marcar cuál opción es la correcta.`);
      }
    });
  }
  return errors;
}

export function savePack(pack) {
  const packWithId = {
    ...pack,
    id: pack.id || slugify(pack.name) || generateId(),
    questions: pack.questions.map((question) => ({ ...question, id: question.id || generateId() })),
  };
  const custom = loadCustomPacks();
  custom[packWithId.id] = packWithId;
  saveCustomPacks(custom);
  return packWithId;
}

export function deletePack(id) {
  const custom = loadCustomPacks();
  delete custom[id];
  saveCustomPacks(custom);
}

export function createEmptyQuestion() {
  return { id: generateId(), text: '', options: ['', '', '', ''], correctIndex: 0 };
}

export function createEmptyPack() {
  return { id: '', name: '', category: '', color: '#888888', questions: [] };
}

export function exportPack(pack) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pack.id || 'pack'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importPackFromFile(file) {
  const text = await file.text();
  const pack = JSON.parse(text);
  const errors = validatePack(pack);
  if (errors.length > 0) {
    throw new Error(`Pack inválido:\n${errors.join('\n')}`);
  }
  return savePack(pack);
}
