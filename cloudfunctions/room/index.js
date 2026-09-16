const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

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
    createdAt: doc.createdAt,
  };
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

async function createRoom(user) {
  const occupied = await findByPlayer(user.id);
  if (occupied) {
    return fail('你已经在房间 ' + occupied._id + ' 里，请先离开');
  }

  const id = await uniqueCode();
  const now = Date.now();
  const room = {
    status: 'waiting',
    hostId: user.id,
    hostName: user.name,
    players: [{ id: user.id, name: user.name, avatar: user.avatar || '' }],
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

  room.players.push({ id: user.id, name: user.name, avatar: user.avatar || '' });
  if (room.players.length === 4) {
    startRoom(room);
  }
  room.updatedAt = Date.now();

  await db.collection('rooms').doc(room._id).update({
    data: {
      players: room.players,
      seats: room.seats,
      status: room.status,
      updatedAt: room.updatedAt,
    },
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

  room.players = room.players.filter((player) => player.id !== userId);
  if (room.seats) {
    Object.keys(room.seats).forEach((wind) => {
      if (room.seats[wind] === userId) {
        room.seats[wind] = null;
      }
    });
  }

  if (room.players.length === 0) {
    await db.collection('rooms').doc(room._id).remove();
    return ok({ dissolved: true, room: null });
  }

  room.updatedAt = Date.now();
  await db.collection('rooms').doc(room._id).update({
    data: {
      players: room.players,
      seats: room.seats,
      updatedAt: room.updatedAt,
    },
  });
  return ok({ dissolved: false, room: normalize(room) });
}

async function fillBots(code) {
  const room = await getDoc(code);
  if (!room) {
    return fail('房间不存在');
  }

  const names = ['测试南家', '测试西家', '测试北家'];
  let index = 0;
  while (room.players.length < 4 && index < names.length) {
    room.players.push({
      id: 'bot-' + room._id + '-' + index,
      name: names[index],
      avatar: '',
    });
    index += 1;
  }
  if (room.players.length === 4 && room.status === 'waiting') {
    startRoom(room);
  }
  room.updatedAt = Date.now();
  await db.collection('rooms').doc(room._id).update({
    data: {
      players: room.players,
      seats: room.seats,
      status: room.status,
      updatedAt: room.updatedAt,
    },
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
      return await fillBots(code);
    }
    return fail('未知操作');
  } catch (error) {
    return fail(error.message || '云函数错误');
  }
};
