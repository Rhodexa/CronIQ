import { pickRandom } from '../core/shuffle.js';

export function pickQuestionFromPack(pack, askedQuestionIds) {
	const unseen = pack.questions.filter((question) => !askedQuestionIds.includes(question.id));
	if (unseen.length > 0) {
		return { question: pickRandom(unseen), exhausted: false };
	}
	return { question: pickRandom(pack.questions), exhausted: true };
}
