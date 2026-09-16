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

function formatCloudError(name, error) {
  const raw = (error && (error.errMsg || error.message)) || '';
  if (/FUNCTION_NOT_FOUND|FunctionName|not found|找不到/i.test(raw)) {
    return '请先上传并部署 ' + name + ' 云函数';
  }
  return raw || ('调用 ' + name + ' 失败');
}

export async function callCloud(name, data) {
  if (!ready) {
    throw new Error('云开发未就绪');
  }

  let res;
  try {
    res = await new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data: data || {},
        success: resolve,
        fail: reject,
      });
    });
  } catch (error) {
    throw new Error(formatCloudError(name, error));
  }

  if (!res || res.result === undefined || res.result === null) {
    throw new Error('云函数 ' + name + ' 无返回，请先上传并部署');
  }
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
    game: doc.game || null,
    createdAt: doc.createdAt,
  };
}
