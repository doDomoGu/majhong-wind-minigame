import { callCloud, watchRoomDoc } from '../cloud.js';

function unwrap(result) {
  if (!result || !result.ok) {
    throw new Error((result && result.error) || '云开发请求失败');
  }
  return result;
}

export async function listRooms() {
  const result = unwrap(await callCloud('room', { action: 'list' }));
  return result.rooms || [];
}

export async function findMyRoom() {
  const result = unwrap(await callCloud('room', { action: 'mine' }));
  return result.room || null;
}

export async function getRoom(id) {
  const result = unwrap(await callCloud('room', { action: 'get', code: String(id) }));
  return result.room;
}

export async function createRoom(user) {
  const result = unwrap(await callCloud('room', {
    action: 'create',
    name: user.name,
    avatar: user.avatar,
  }));
  return result.room;
}

export async function joinRoom(id, user) {
  const result = unwrap(await callCloud('room', {
    action: 'join',
    code: String(id),
    name: user.name,
    avatar: user.avatar,
  }));
  return result.room;
}

export async function leaveRoom(id) {
  const result = unwrap(await callCloud('room', {
    action: 'leave',
    code: String(id),
  }));
  return { dissolved: result.dissolved, room: result.room || null };
}

export async function addTestPlayers(id) {
  try {
    const result = unwrap(await callCloud('room', {
      action: 'fillBots',
      code: String(id),
    }));
    return result.room;
  } catch (error) {
    const message = error && error.message;
    if (message === '未知操作') {
      throw new Error('请重新上传并部署 room 云函数后再试补齐');
    }
    throw error;
  }
}

export async function playRiichi(id, userId, targetId) {
  const result = unwrap(await callCloud('room', {
    action: 'riichi',
    code: String(id),
    targetId: targetId || userId,
  }));
  return result.room;
}

export async function playCancelRiichi(id, userId, targetId) {
  const result = unwrap(await callCloud('room', {
    action: 'cancelRiichi',
    code: String(id),
    targetId: targetId || userId,
  }));
  return result.room;
}

export async function playStartSettle(id, userId, kind, dealerFlag) {
  const result = unwrap(await callCloud('room', {
    action: 'startSettle',
    code: String(id),
    kind,
    dealerFlag: !!dealerFlag,
  }));
  return result.room;
}

export async function playSubmitSettle(id, userId, value) {
  const result = unwrap(await callCloud('room', {
    action: 'submitSettle',
    code: String(id),
    value,
  }));
  return result.room;
}

export async function playUndo(id, userId) {
  const result = unwrap(await callCloud('room', {
    action: 'undoSettle',
    code: String(id),
  }));
  return result.room;
}

export function watchRoom(id, onChange) {
  return watchRoomDoc(id, onChange);
}
