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
  const result = unwrap(await callCloud('room', {
    action: 'fillBots',
    code: String(id),
  }));
  return result.room;
}

export function watchRoom(id, onChange) {
  return watchRoomDoc(id, onChange);
}
