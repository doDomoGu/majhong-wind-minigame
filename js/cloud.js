import { CLOUD_ENV } from './config.js';

let inited = false;
let ready = false;

export function isCloudReady() {
  return ready;
}

export async function initCloud() {
  if (inited) {
    return ready;
  }
  inited = true;

  if (!CLOUD_ENV || typeof wx === 'undefined' || !wx.cloud) {
    ready = false;
    return false;
  }

  try {
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    });
    ready = true;
    return true;
  } catch (error) {
    console.error('cloud init failed', error);
    ready = false;
    return false;
  }
}

export async function callCloud(name, data) {
  if (!ready) {
    throw new Error('云开发未就绪');
  }
  const res = await wx.cloud.callFunction({ name, data: data || {} });
  return res.result;
}

export function watchRoomDoc(id, onChange) {
  if (!ready || !id) {
    return { close() {} };
  }

  const db = wx.cloud.database();
  return db.collection('rooms').doc(String(id)).watch({
    onChange(snapshot) {
      const docs = snapshot.docs || [];
      if (!docs.length) {
        onChange(null);
        return;
      }
      onChange(normalizeRoom(docs[0]));
    },
    onError(error) {
      console.error('watch room', error);
    },
  });
}

export function normalizeRoom(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: doc.id || doc._id,
    status: doc.status,
    hostId: doc.hostId,
    hostName: doc.hostName,
    players: doc.players || [],
    seats: doc.seats || null,
    createdAt: doc.createdAt,
  };
}
