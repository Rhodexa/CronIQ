import { pickRandom } from '../core/shuffle.js';
import { pickQuestionFromPack } from './question-selector.js';

const POINTS_PER_CORRECT = 1;

// Group: { id, name, color, subscribedPackIds, score, askedQuestionIds }
// GameState: { groups, currentGroupIndex, currentQuestion, finished, createdAt, updatedAt }

export class GameEngine {
  constructor(state, packsById) {
    this.state = state;
    this.packsById = packsById;
  }

  static createInitialState(groups) {
    return {
      groups: groups.map((group) => ({ ...group, score: 0, askedQuestionIds: [] })),
      currentGroupIndex: 0,
      currentQuestion: null,
      finished: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  get currentGroup() {
    return this.state.groups[this.state.currentGroupIndex];
  }

  drawQuestion({ forcedPackId } = {}) {
    const group = this.currentGroup;
    const packId = forcedPackId || pickRandom(group.subscribedPackIds);
    const pack = this.packsById[packId];
    const { question, exhausted } = pickQuestionFromPack(pack, group.askedQuestionIds);
    if (exhausted) group.askedQuestionIds = [];
    this.state.currentQuestion = { question, sourcePackId: pack.id, groupId: group.id };
    this.state.updatedAt = Date.now();
    return this.state;
  }

  submitAnswer(isCorrect) {
    const group = this.currentGroup;
    if (this.state.currentQuestion) {
      group.askedQuestionIds.push(this.state.currentQuestion.question.id);
    }
    if (isCorrect) {
      group.score += POINTS_PER_CORRECT;
    } else {
      this.state.currentGroupIndex = (this.state.currentGroupIndex + 1) % this.state.groups.length;
    }
    this.state.currentQuestion = null;
    this.state.updatedAt = Date.now();
    return this.state;
  }

  setCurrentGroup(groupId) {
    const index = this.state.groups.findIndex((group) => group.id === groupId);
    if (index !== -1) {
      this.state.currentGroupIndex = index;
      this.state.currentQuestion = null;
      this.state.updatedAt = Date.now();
    }
    return this.state;
  }

  endGame() {
    this.state.finished = true;
    this.state.updatedAt = Date.now();
    return [...this.state.groups].sort((a, b) => b.score - a.score);
  }
}
