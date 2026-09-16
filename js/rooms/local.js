import { ROOM_STATUS } from '../theme.js';

const rooms = new Map();
let seeded = false;

function randomRoomId() {
  let id = '';
  do {
    id = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(id));
  return id;
}

function cloneRoom(room) {
  return {
    ...room,
    players: room.players.map((player) => ({ ...player })),
    seats: room.seats ? { ...room.seats } : null,
  };
}

function startRoom(room) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  room.seats = {
    E: shuffled[0].id,
    S: shuffled[1].id,
    W: shuffled[2].id,
    N: shuffled[3].id,
  };
  room.status = ROOM_STATUS.playing;
}

export function seedDemoRooms() {
  if (seeded) {
    return;
  }
  seeded = true;

  rooms.set('1024', {
    id: '1024',
    status: ROOM_STATUS.waiting,
    hostId: 'demo-1',
    hostName: '东家阿诚',
    players: [
      { id: 'demo-1', name: '东家阿诚' },
      { id: 'demo-2', name: '南风小林' },
    ],
    seats: null,
    createdAt: Date.now() - 120000,
  });

  rooms.set('2048', {
    id: '2048',
    status: ROOM_STATUS.playing,
    hostId: 'demo-3',
    hostName: '雀桌老王',
    players: [
      { id: 'demo-3', name: '雀桌老王' },
      { id: 'demo-4', name: '西家小满' },
      { id: 'demo-5', name: '北风阿七' },
      { id: 'demo-6', name: '南家阿梅' },
    ],
    seats: { E: 'demo-3', S: 'demo-4', W: 'demo-5', N: 'demo-6' },
    createdAt: Date.now() - 800000,
  });

  rooms.set('4096', {
    id: '4096',
    status: ROOM_STATUS.finished,
    hostId: 'demo-7',
    hostName: '终局示例',
    players: [
      { id: 'demo-7', name: '终局示例' },
      { id: 'demo-8', name: '二位' },
      { id: 'demo-9', name: '三位' },
      { id: 'demo-10', name: '四位' },
    ],
    seats: { E: 'demo-7', S: 'demo-8', W: 'demo-9', N: 'demo-10' },
    createdAt: Date.now() - 3600000,
  });
}

export async function listRooms() {
  return [...rooms.values()]
    .map(cloneRoom)
    .sort((a, b) => {
      const rank = {
        [ROOM_STATUS.waiting]: 0,
        [ROOM_STATUS.playing]: 1,
        [ROOM_STATUS.finished]: 2,
      };
      return rank[a.status] - rank[b.status] || b.createdAt - a.createdAt;
    });
}

export async function getRoom(id) {
  const room = rooms.get(String(id));
  return room ? cloneRoom(room) : null;
}

export async function findMyRoom(userId) {
  return findRoomByUser(userId);
}

function findRoomByUser(userId) {
  const room = [...rooms.values()].find((item) => item.players.some((player) => player.id === userId));
  return room ? cloneRoom(room) : null;
}

export async function createRoom(user) {
  const existing = findRoomByUser(user.id);
  if (existing) {
    throw new Error('你已经在房间 ' + existing.id + ' 里，请先离开');
  }

  const id = randomRoomId();
  const room = {
    id,
    status: ROOM_STATUS.waiting,
    hostId: user.id,
    hostName: user.name,
    players: [{ id: user.id, name: user.name }],
    seats: null,
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return cloneRoom(room);
}

export async function joinRoom(id, user) {
  const room = rooms.get(String(id));
  if (!room) {
    throw new Error('房间不存在');
  }
  if (room.players.some((player) => player.id === user.id)) {
    return cloneRoom(room);
  }

  const occupied = findRoomByUser(user.id);
  if (occupied && occupied.id !== room.id) {
    throw new Error('你已经在房间 ' + occupied.id + ' 里，请先离开');
  }
  if (room.status !== ROOM_STATUS.waiting) {
    throw new Error('对局中不能再占座，请走公共视角');
  }
  if (room.players.length >= 4) {
    throw new Error('房间已满');
  }

  room.players.push({ id: user.id, name: user.name });
  if (room.players.length === 4) {
    startRoom(room);
  }
  return cloneRoom(room);
}

export async function leaveRoom(id, userId) {
  const room = rooms.get(String(id));
  if (!room) {
    return { dissolved: true, room: null };
  }

  if (room.status === ROOM_STATUS.waiting && room.hostId === userId) {
    rooms.delete(room.id);
    return { dissolved: true, room: null };
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
    rooms.delete(room.id);
    return { dissolved: true, room: null };
  }

  return { dissolved: false, room: cloneRoom(room) };
}

export async function addTestPlayers(id) {
  const room = rooms.get(String(id));
  if (!room) {
    throw new Error('房间不存在');
  }
  const names = ['测试南家', '测试西家', '测试北家'];
  let index = 0;
  while (room.players.length < 4 && index < names.length) {
    room.players.push({
      id: 'bot-' + room.id + '-' + index,
      name: names[index],
    });
    index += 1;
  }
  if (room.players.length === 4) {
    startRoom(room);
  }
  return cloneRoom(room);
}

export function watchRoom() {
  return { close() {} };
}
