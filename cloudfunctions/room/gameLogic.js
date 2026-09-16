const WIND_ORDER = ['E', 'S', 'W', 'N'];
const WIND_LABEL = { E: '东', S: '南', W: '西', N: '北' };

function isBotId(id) {
  return !!(id && String(id).indexOf('bot-') === 0);
}

function seatedIds(seats) {
  if (!seats) {
    return [];
  }
  return WIND_ORDER.map((wind) => seats[wind]).filter(Boolean);
}

function playerWind(seats, playerId) {
  if (!seats || !playerId) {
    return null;
  }
  return WIND_ORDER.find((wind) => seats[wind] === playerId) || null;
}

function formatRound(game) {
  if (!game) {
    return '东 1';
  }
  return WIND_LABEL[game.roundWind] + ' ' + game.kyoku;
}

function formatDelta(value) {
  const n = Number(value) || 0;
  if (n > 0) {
    return '+' + n;
  }
  return String(n);
}

function layoutWinds(viewMode, myWind) {
  if (viewMode === 'public' || !myWind) {
    return { bottom: 'E', right: 'S', top: 'W', left: 'N' };
  }
  const index = WIND_ORDER.indexOf(myWind);
  const at = (offset) => WIND_ORDER[(index + offset + 4) % 4];
  return {
    bottom: at(0),
    right: at(1),
    top: at(2),
    left: at(3),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotGame(game) {
  return clone({
    roundWind: game.roundWind,
    kyoku: game.kyoku,
    honba: game.honba,
    kyotaku: game.kyotaku,
    dealerWind: game.dealerWind,
    scores: game.scores,
    riichi: emptyRiichi(game.scores),
    phase: 'playing',
    settle: null,
  });
}

function emptyRiichi(scores) {
  const riichi = {};
  Object.keys(scores || {}).forEach((id) => {
    riichi[id] = false;
  });
  return riichi;
}

function createInitialGame(players) {
  const scores = {};
  (players || []).forEach((player) => {
    scores[player.id] = 25000;
  });
  const game = {
    roundWind: 'E',
    kyoku: 1,
    honba: 0,
    kyotaku: 0,
    dealerWind: 'E',
    scores,
    riichi: emptyRiichi(scores),
    phase: 'playing',
    settle: null,
    results: null,
    history: [],
  };
  game.history = [snapshotGame(game)];
  return game;
}

function ensurePlayer(game, playerId) {
  if (!playerId || game.scores[playerId] == null) {
    throw new Error('该座位没有玩家');
  }
}

function applyRiichi(game, playerId) {
  if (!game || game.phase !== 'playing') {
    throw new Error('现在不能立直');
  }
  ensurePlayer(game, playerId);
  if (game.riichi[playerId]) {
    throw new Error('本局已经立直');
  }
  if (game.scores[playerId] < 1000) {
    throw new Error('点数不足 1000');
  }
  game.scores[playerId] -= 1000;
  game.kyotaku += 1000;
  game.riichi[playerId] = true;
}

function cancelRiichi(game, playerId) {
  if (!game || game.phase !== 'playing') {
    throw new Error('现在不能取消立直');
  }
  ensurePlayer(game, playerId);
  if (!game.riichi[playerId]) {
    throw new Error('本局尚未立直');
  }
  game.scores[playerId] += 1000;
  game.kyotaku = Math.max(0, game.kyotaku - 1000);
  game.riichi[playerId] = false;
}

const SCORE_HANDS = [
  { name: '30符1番', koRon: 1000, oyaRon: 1500, koTsumoKo: 300, koTsumoOya: 500, oyaTsumo: 500 },
  { name: '40符1番', koRon: 1300, oyaRon: 2000, koTsumoKo: 400, koTsumoOya: 700, oyaTsumo: 700 },
  { name: '30符2番', koRon: 2000, oyaRon: 2900, koTsumoKo: 500, koTsumoOya: 1000, oyaTsumo: 1000 },
  { name: '40符2番', koRon: 2600, oyaRon: 3900, koTsumoKo: 700, koTsumoOya: 1300, oyaTsumo: 1300 },
  { name: '30符3番', koRon: 3900, oyaRon: 5800, koTsumoKo: 1000, koTsumoOya: 2000, oyaTsumo: 2000 },
  { name: '40符3番', koRon: 5200, oyaRon: 7700, koTsumoKo: 1300, koTsumoOya: 2600, oyaTsumo: 2600 },
  { name: '满贯', koRon: 8000, oyaRon: 12000, koTsumoKo: 2000, koTsumoOya: 4000, oyaTsumo: 4000 },
  { name: '跳满', koRon: 12000, oyaRon: 18000, koTsumoKo: 3000, koTsumoOya: 6000, oyaTsumo: 6000 },
  { name: '倍满', koRon: 16000, oyaRon: 24000, koTsumoKo: 4000, koTsumoOya: 8000, oyaTsumo: 8000 },
  { name: '三倍满', koRon: 24000, oyaRon: 36000, koTsumoKo: 6000, koTsumoOya: 12000, oyaTsumo: 12000 },
];

const HAND_BAG = [0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6, 6, 6, 7, 8, 9];

function pickItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function emptyDeltas(ids) {
  const deltas = {};
  ids.forEach((id) => {
    deltas[id] = 0;
  });
  return deltas;
}

function simulateWinDeltas(game, seats, dealerFlag) {
  const ids = seatedIds(seats);
  const dealerId = seats[game.dealerWind];
  const winners = dealerFlag
    ? ids.filter((id) => id === dealerId)
    : ids.filter((id) => id !== dealerId);
  const winnerId = pickItem(winners.length ? winners : ids);
  const others = ids.filter((id) => id !== winnerId);
  const isTsumo = Math.random() < 0.5;
  const ronFromId = isTsumo ? null : pickItem(others);
  const hand = SCORE_HANDS[pickItem(HAND_BAG)];
  const honba = game.honba || 0;
  const kyotaku = game.kyotaku || 0;
  const winnerIsDealer = winnerId === dealerId;
  const deltas = emptyDeltas(ids);

  if (ronFromId) {
    const ron = winnerIsDealer ? hand.oyaRon : hand.koRon;
    const extra = 300 * honba;
    deltas[winnerId] += ron + extra + kyotaku;
    deltas[ronFromId] -= ron + extra;
  } else if (winnerIsDealer) {
    const pay = hand.oyaTsumo + 100 * honba;
    others.forEach((id) => {
      deltas[id] -= pay;
      deltas[winnerId] += pay;
    });
    deltas[winnerId] += kyotaku;
  } else {
    others.forEach((id) => {
      const pay = (id === dealerId ? hand.koTsumoOya : hand.koTsumoKo) + 100 * honba;
      deltas[id] -= pay;
      deltas[winnerId] += pay;
    });
    deltas[winnerId] += kyotaku;
  }

  const winWind = WIND_LABEL[playerWind(seats, winnerId)] || '';
  let scenario;
  if (ronFromId) {
    const fromWind = WIND_LABEL[playerWind(seats, ronFromId)] || '';
    scenario = fromWind + '放铳 · ' + winWind + ' ' + hand.name;
  } else {
    scenario = '自摸 · ' + winWind + ' ' + hand.name;
  }
  return { deltas, scenario };
}

function simulateDrawDeltas(game, seats, dealerFlag) {
  const ids = seatedIds(seats);
  const dealerId = seats[game.dealerWind];
  const tenpai = new Set();
  ids.forEach((id) => {
    if (game.riichi && game.riichi[id]) {
      tenpai.add(id);
    }
  });
  if (dealerFlag && dealerId) {
    tenpai.add(dealerId);
  } else if (dealerId) {
    tenpai.delete(dealerId);
  }

  const free = ids.filter((id) => {
    if (id === dealerId) {
      return false;
    }
    return !(game.riichi && game.riichi[id]);
  });
  free.forEach((id) => {
    if (Math.random() < 0.5) {
      tenpai.add(id);
    }
  });

  const tenpaiIds = ids.filter((id) => tenpai.has(id));
  const notenIds = ids.filter((id) => !tenpai.has(id));
  const deltas = emptyDeltas(ids);
  if (tenpaiIds.length > 0 && tenpaiIds.length < 4) {
    const pot = 3000;
    const gain = Math.round(pot / tenpaiIds.length);
    const pay = Math.round(pot / notenIds.length);
    tenpaiIds.forEach((id) => {
      deltas[id] = gain;
    });
    notenIds.forEach((id) => {
      deltas[id] = -pay;
    });
  }

  return {
    deltas,
    scenario: '流局罚符 · 听牌' + tenpaiIds.length + '家',
  };
}

function simulateSettle(game, seats, kind, dealerFlag) {
  const ids = seatedIds(seats);
  if (!ids.some(isBotId)) {
    return { deltas: emptyDeltas(ids), scenario: '' };
  }
  if (kind === 'win') {
    return simulateWinDeltas(game, seats, dealerFlag);
  }
  return simulateDrawDeltas(game, seats, dealerFlag);
}

function startSettle(game, seats, kind, dealerFlag) {
  if (!game || game.phase !== 'playing') {
    throw new Error('现在不能发起结算');
  }
  if (kind !== 'win' && kind !== 'draw') {
    throw new Error('请选择有人和牌或流局');
  }

  const dealerId = seats && seats[game.dealerWind];
  let flag = !!dealerFlag;
  if (kind === 'draw' && dealerId && game.riichi[dealerId]) {
    flag = true;
  }

  const simulated = simulateSettle(game, seats, kind, flag);
  const inputs = {};
  seatedIds(seats).forEach((id) => {
    const value = simulated.deltas[id] || 0;
    inputs[id] = {
      value: isBotId(id) ? value : 0,
      confirmed: isBotId(id),
      suggested: value,
    };
  });

  game.phase = 'settling';
  game.settle = {
    kind,
    dealerFlag: flag,
    inputs,
    error: '',
    scenario: simulated.scenario || '',
  };
}

function submitSettle(game, seats, playerId, value) {
  if (!game || !game.settle) {
    throw new Error('还没有发起结算');
  }
  ensurePlayer(game, playerId);
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.round(amount) !== amount) {
    throw new Error('请输入整数点数');
  }

  game.settle.inputs[playerId] = { value: amount, confirmed: true };
  game.settle.error = '';

  const ids = seatedIds(seats);
  const allIn = ids.every((id) => game.settle.inputs[id] && game.settle.inputs[id].confirmed);
  if (!allIn) {
    return 'pending';
  }
  return applySettle(game, seats);
}

function applySettle(game, seats) {
  const ids = seatedIds(seats);
  const sum = ids.reduce((total, id) => total + Number(game.settle.inputs[id].value || 0), 0);

  if (game.settle.kind === 'win') {
    if (sum !== game.kyotaku) {
      game.settle.error = '四家合计 ' + formatDelta(sum) + '，和牌时应等于供托 ' + game.kyotaku;
      unlockHumans(game, ids);
      return 'retry';
    }
  } else if (sum !== 0) {
    game.settle.error = '四家合计 ' + formatDelta(sum) + '，流局应为 0；供托仍有 ' + game.kyotaku + '，不能分掉';
    unlockHumans(game, ids);
    return 'retry';
  }

  ids.forEach((id) => {
    game.scores[id] += Number(game.settle.inputs[id].value || 0);
  });

  const renchan = !!game.settle.dealerFlag;
  if (game.settle.kind === 'win') {
    game.kyotaku = 0;
    if (renchan) {
      game.honba += 1;
    } else {
      game.honba = 0;
      if (rotateDealer(game)) {
        finishGame(game, seats);
        return 'finished';
      }
    }
  } else {
    game.honba += 1;
    if (!renchan && rotateDealer(game)) {
      finishGame(game, seats);
      return 'finished';
    }
  }

  game.phase = 'playing';
  game.settle = null;
  game.riichi = emptyRiichi(game.scores);
  game.history.push(snapshotGame(game));
  return 'ok';
}

function unlockHumans(game, ids) {
  ids.forEach((id) => {
    if (!isBotId(id) && game.settle.inputs[id]) {
      game.settle.inputs[id].confirmed = false;
    }
  });
}

function rotateDealer(game) {
  if (game.roundWind === 'S' && game.kyoku === 4) {
    return true;
  }
  const index = WIND_ORDER.indexOf(game.dealerWind);
  game.dealerWind = WIND_ORDER[(index + 1) % 4];
  if (game.roundWind === 'E' && game.kyoku === 4) {
    game.roundWind = 'S';
    game.kyoku = 1;
  } else {
    game.kyoku += 1;
  }
  return false;
}

function oyaDistance(seats, playerId) {
  const wind = playerWind(seats, playerId);
  const index = WIND_ORDER.indexOf(wind);
  return index < 0 ? 99 : index;
}

function pickFirstPlace(scores, seats) {
  return Object.keys(scores).sort((a, b) => {
    if (scores[b] !== scores[a]) {
      return scores[b] - scores[a];
    }
    return oyaDistance(seats, a) - oyaDistance(seats, b);
  })[0];
}

function splitUma(ranked, scores, seats) {
  const umaList = [50, 10, -10, -30];
  const result = {};
  let index = 0;
  while (index < ranked.length) {
    let end = index + 1;
    while (end < ranked.length && scores[ranked[end]] === scores[ranked[index]]) {
      end += 1;
    }
    const group = ranked.slice(index, end);
    const umaSum = umaList.slice(index, end).reduce((total, item) => total + item, 0);
    const share = Math.trunc(umaSum / group.length);
    let rem = umaSum - share * group.length;
    group.forEach((id) => {
      result[id] = share;
    });
    const byOya = group.slice().sort((a, b) => oyaDistance(seats, a) - oyaDistance(seats, b));
    let cursor = 0;
    while (rem > 0 && byOya.length) {
      result[byOya[cursor % byOya.length]] += 1;
      rem -= 1;
      cursor += 1;
    }
    while (rem < 0 && byOya.length) {
      result[byOya[cursor % byOya.length]] -= 1;
      rem += 1;
      cursor += 1;
    }
    index = end;
  }
  return result;
}

function computeResults(game, seats) {
  const scores = clone(game.scores);
  const ranked = Object.keys(scores).sort((a, b) => {
    if (scores[b] !== scores[a]) {
      return scores[b] - scores[a];
    }
    return oyaDistance(seats, a) - oyaDistance(seats, b);
  });
  const uma = splitUma(ranked, scores, seats);
  let rank = 1;
  return ranked.map((id, index) => {
    if (index > 0 && scores[id] < scores[ranked[index - 1]]) {
      rank = index + 1;
    }
    const umaValue = uma[id] || 0;
    return {
      id,
      rank,
      score: scores[id],
      uma: umaValue,
      pt: (scores[id] - 30000) / 1000 + umaValue,
    };
  });
}

function finishGame(game, seats) {
  if (game.kyotaku > 0) {
    const first = pickFirstPlace(game.scores, seats);
    if (first) {
      game.scores[first] += game.kyotaku;
    }
    game.kyotaku = 0;
  }
  game.phase = 'finished';
  game.settle = null;
  game.riichi = emptyRiichi(game.scores);
  game.results = computeResults(game, seats);
  game.history.push(snapshotGame(game));
}

function undoLastHand(game) {
  if (!game || !game.history || game.history.length <= 1) {
    throw new Error('已经是东 1 开局');
  }
  game.history.pop();
  const prev = clone(game.history[game.history.length - 1]);
  game.roundWind = prev.roundWind;
  game.kyoku = prev.kyoku;
  game.honba = prev.honba;
  game.kyotaku = prev.kyotaku;
  game.dealerWind = prev.dealerWind;
  game.scores = prev.scores;
  game.riichi = emptyRiichi(prev.scores);
  game.phase = 'playing';
  game.settle = null;
  game.results = null;
}

function settleSummary(game) {
  if (!game || !game.settle) {
    return '';
  }
  let text = '';
  if (game.settle.kind === 'win') {
    text = game.settle.dealerFlag ? '有人和牌 · 亲家' : '有人和牌 · 子家';
  } else {
    text = game.settle.dealerFlag ? '流局 · 亲家听牌' : '流局 · 亲家不听';
  }
  if (game.settle.scenario) {
    text += ' · ' + game.settle.scenario;
  }
  return text;
}


module.exports = {
  WIND_ORDER,
  WIND_LABEL,
  isBotId,
  seatedIds,
  playerWind,
  formatRound,
  formatDelta,
  layoutWinds,
  clone,
  snapshotGame,
  createInitialGame,
  applyRiichi,
  cancelRiichi,
  startSettle,
  submitSettle,
  computeResults,
  undoLastHand,
  settleSummary,
};
