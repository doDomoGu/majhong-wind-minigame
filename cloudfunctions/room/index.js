const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const gameLogic = require('./gameLogic');

function fail(error) {
  return { ok: false, error };
}

function ok(payload) {
  return Object.assign({ ok: true }, payload);
}

function normalize(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: doc._id,
    status: doc.status,
    hostId: doc.hostId,
    hostName: doc.hostName,
    players: doc.players || [],
    seats: doc.seats || null,
    game: doc.game || null,
    createdAt: doc.createdAt,
  };
}

function isBot(player) {
  return !!(player && player.id && String(player.id).indexOf('bot-') === 0);
}

function removePlayerAndBots(room, userId) {
  room.players = room.players.filter((player) => player.id !== userId && !isBot(player));
  if (room.seats) {
    Object.keys(room.seats).forEach((wind) => {
      const seatId = room.seats[wind];
      if (!seatId || seatId === userId || String(seatId).indexOf('bot-') === 0) {
        room.seats[wind] = null;
      }
    });
  }
  if (room.status === 'playing' && room.players.length < 4) {
    room.status = 'waiting';
    room.seats = null;
    room.game = null;
  }
}

function startRoom(room) {
  const shuffled = room.players.slice().sort(() => Math.random() - 0.5);
  room.seats = {
    E: shuffled[0].id,
    S: shuffled[1].id,
    W: shuffled[2].id,
    N: shuffled[3].id,
  };
  room.status = 'playing';
  room.game = gameLogic.createInitialGame(room.players);
}

function roomUpdate(data) {
  const next = Object.assign({}, data);
  ['seats', 'game'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = _.set(next[key]);
    }
  });
  return next;
}

async function savePlayingRoom(room) {
  if (room.game && room.game.phase === 'finished') {
    room.status = 'finished';
  }
  room.updatedAt = Date.now();
  await db.collection('rooms').doc(room._id).update({
    data: roomUpdate({
      players: room.players,
      seats: room.seats,
      status: room.status,
      game: room.game,
      updatedAt: room.updatedAt,
    }),
  });
}

function requireSeated(room, userId) {
  if (!room.game) {
    throw new Error('对局尚未开始');
  }
  if (gameLogic.seatedIds(room.seats).indexOf(userId) < 0) {
    throw new Error('你不在这桌');
  }
}

async function playRiichi(code, userId, targetId) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  requireSeated(room, userId);
  gameLogic.applyRiichi(room.game, targetId || userId);
  await savePlayingRoom(room);
  return ok({ room: normalize(room) });
}

async function playCancelRiichi(code, userId, targetId) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  requireSeated(room, userId);
  gameLogic.cancelRiichi(room.game, targetId || userId);
  await savePlayingRoom(room);
  return ok({ room: normalize(room) });
}

async function playStartSettle(code, userId, kind, dealerFlag) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  requireSeated(room, userId);
  gameLogic.startSettle(room.game, room.seats, kind, dealerFlag);
  await savePlayingRoom(room);
  return ok({ room: normalize(room) });
}

async function playSubmitSettle(code, userId, value) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  requireSeated(room, userId);
  const status = gameLogic.submitSettle(room.game, room.seats, userId, value);
  await savePlayingRoom(room);
  return ok({ room: normalize(room), settleStatus: status });
}

async function playUndo(code, userId) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  requireSeated(room, userId);
  gameLogic.undoLastHand(room.game);
  room.status = 'playing';
  await savePlayingRoom(room);
  return ok({ room: normalize(room) });
}

async function getDoc(code) {
  try {
    const res = await db.collection('rooms').doc(String(code)).get();
    return res.data || null;
  } catch (error) {
    return null;
  }
}

async function findByPlayer(userId) {
  const res = await db.collection('rooms').where({
    'players.id': userId,
  }).limit(1).get();
  return res.data[0] || null;
}

async function uniqueCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const existing = await getDoc(code);
    if (!existing) {
      return code;
    }
  }
  throw new Error('无法分配房号');
}

async function listRooms() {
  const res = await db.collection('rooms').limit(50).get();
  const rooms = res.data.map(normalize).sort((a, b) => {
    const rank = { waiting: 0, playing: 1, finished: 2 };
    return (rank[a.status] - rank[b.status]) || (b.createdAt - a.createdAt);
  });
  return ok({ rooms });
}

async function resolvePlayerName(user) {
  try {
    const res = await db.collection('players').doc(user.id).get();
    if (res.data && res.data.name) {
      return res.data.name;
    }
  } catch (error) {
    // 资料表未建或没有记录时，用客户端传来的名字
  }
  return user.name || ('玩家' + String(user.id).slice(-4));
}

async function createRoom(user) {
  const occupied = await findByPlayer(user.id);
  if (occupied) {
    return fail('你已经在房间 ' + occupied._id + ' 里，请先离开');
  }

  const id = await uniqueCode();
  const now = Date.now();
  const name = await resolvePlayerName(user);
  const room = {
    status: 'waiting',
    hostId: user.id,
    hostName: name,
    players: [{ id: user.id, name, avatar: user.avatar || '' }],
    seats: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('rooms').doc(id).set({ data: room });
  return ok({ room: normalize(Object.assign({ _id: id }, room)) });
}

async function joinRoom(code, user) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  if (room.players.some((player) => player.id === user.id)) {
    return ok({ room: normalize(room) });
  }

  const occupied = await findByPlayer(user.id);
  if (occupied && occupied._id !== room._id) {
    return fail('你已经在房间 ' + occupied._id + ' 里，请先离开');
  }
  if (room.status !== 'waiting') {
    return fail('对局中不能再占座，请走公共视角');
  }
  if (room.players.length >= 4) {
    return fail('房间已满');
  }

  const name = await resolvePlayerName(user);
  room.players.push({ id: user.id, name, avatar: user.avatar || '' });
  if (room.players.length === 4) {
    startRoom(room);
  }
  room.updatedAt = Date.now();

  await db.collection('rooms').doc(room._id).update({
    data: roomUpdate({
      players: room.players,
      seats: room.seats,
      status: room.status,
      game: room.game || null,
      updatedAt: room.updatedAt,
    }),
  });
  return ok({ room: normalize(room) });
}

async function leaveRoom(code, userId) {
  const room = await getDoc(code);
  if (!room) {
    return ok({ dissolved: true, room: null });
  }

  if (room.status === 'waiting' && room.hostId === userId) {
    await db.collection('rooms').doc(room._id).remove();
    return ok({ dissolved: true, room: null });
  }

  removePlayerAndBots(room, userId);

  if (room.players.length === 0) {
    await db.collection('rooms').doc(room._id).remove();
    return ok({ dissolved: true, room: null });
  }

  room.updatedAt = Date.now();
  await db.collection('rooms').doc(room._id).update({
    data: roomUpdate({
      players: room.players,
      seats: room.seats,
      status: room.status,
      game: room.game || null,
      updatedAt: room.updatedAt,
    }),
  });
  return ok({ dissolved: false, room: normalize(room) });
}

async function fillBots(code, userId) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }
  if (room.status !== 'waiting') {
    return fail('对局已开始');
  }
  if (!userId || !room.players.some((player) => player.id === userId)) {
    return fail('你不在这个房间');
  }

  const names = ['测试南家', '测试西家', '测试北家'];
  const used = {};
  room.players.forEach((player) => {
    used[player.id] = true;
  });
  let index = 0;
  while (room.players.length < 4 && index < names.length) {
    const botId = 'bot-' + room._id + '-' + index;
    if (!used[botId]) {
      room.players.push({
        id: botId,
        name: names[index],
        avatar: '',
      });
      used[botId] = true;
    }
    index += 1;
  }
  if (room.players.length === 4) {
    startRoom(room);
  }
  room.updatedAt = Date.now();
  await db.collection('rooms').doc(room._id).update({
    data: roomUpdate({
      players: room.players,
      seats: room.seats,
      status: room.status,
      game: room.game || null,
      updatedAt: room.updatedAt,
    }),
  });
  return ok({ room: normalize(room) });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = {
    id: OPENID,
    name: (event && event.name) || ('玩家' + String(OPENID).slice(-4)),
    avatar: (event && event.avatar) || '',
  };
  const action = event && event.action;
  const code = event && event.code;

  try {
    if (action === 'list') {
      return await listRooms();
    }
    if (action === 'mine') {
      const room = await findByPlayer(user.id);
      return ok({ room: normalize(room) });
    }
    if (action === 'get') {
      const room = await getDoc(code);
      return room ? ok({ room: normalize(room) }) : fail('房间不存在');
    }
    if (action === 'create') {
      return await createRoom(user);
    }
    if (action === 'join') {
      return await joinRoom(code, user);
    }
    if (action === 'leave') {
      return await leaveRoom(code, user.id);
    }
    if (action === 'fillBots') {
      return await fillBots(code, user.id);
    }
    if (action === 'riichi') {
      return await playRiichi(code, user.id, event.targetId);
    }
    if (action === 'cancelRiichi') {
      return await playCancelRiichi(code, user.id, event.targetId);
    }
    if (action === 'startSettle') {
      return await playStartSettle(code, user.id, event.kind, event.dealerFlag);
    }
    if (action === 'submitSettle') {
      return await playSubmitSettle(code, user.id, event.value);
    }
    if (action === 'undoSettle') {
      return await playUndo(code, user.id);
    }
    return fail('未知操作');
  } catch (error) {
    return fail(error.message || '云函数错误');
  }
};
