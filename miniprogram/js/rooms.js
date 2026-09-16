import { isCloudReady } from './cloud.js';
import * as cloudRooms from './rooms/cloud.js';
import * as localRooms from './rooms/local.js';

export const WINDS = [
  { key: 'E', label: '东' },
  { key: 'S', label: '南' },
  { key: 'W', label: '西' },
  { key: 'N', label: '北' },
];

function api() {
  return isCloudReady() ? cloudRooms : localRooms;
}

export function seedDemoRooms() {
  if (!isCloudReady()) {
    localRooms.seedDemoRooms();
  }
}

export function listRooms() {
  return api().listRooms();
}

export function getRoom(id) {
  return api().getRoom(id);
}

export function findMyRoom(userId) {
  return api().findMyRoom(userId);
}

export function createRoom(user) {
  return api().createRoom(user);
}

export function joinRoom(id, user) {
  return api().joinRoom(id, user);
}

export function leaveRoom(id, userId) {
  return api().leaveRoom(id, userId);
}

export function addTestPlayers(id, userId) {
  return api().addTestPlayers(id, userId);
}

export function watchRoom(id, onChange) {
  return api().watchRoom(id, onChange);
}

export function renameLocalPlayer(userId, name) {
  if (!isCloudReady()) {
    localRooms.renamePlayer(userId, name);
  }
}

export function playRiichi(id, userId, targetId) {
  return api().playRiichi(id, userId, targetId);
}

export function playCancelRiichi(id, userId, targetId) {
  return api().playCancelRiichi(id, userId, targetId);
}

export function playStartSettle(id, userId, kind, dealerFlag) {
  return api().playStartSettle(id, userId, kind, dealerFlag);
}

export function playSubmitSettle(id, userId, value) {
  return api().playSubmitSettle(id, userId, value);
}

export function playUndo(id, userId) {
  return api().playUndo(id, userId);
}
