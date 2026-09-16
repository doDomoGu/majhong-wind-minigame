import { isCloudReady, callCloud } from './cloud.js';

const PREVIEW_KEY = 'riichi-player-name';

function fallbackName(openid) {
  return '玩家' + String(openid).slice(-4);
}

function readPreviewName() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(PREVIEW_KEY) || '';
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(PREVIEW_KEY) || '';
    }
  } catch (error) {
    // ignore
  }
  return '';
}

function writePreviewName(name) {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(PREVIEW_KEY, name);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREVIEW_KEY, name);
    }
  } catch (error) {
    // ignore
  }
}

function createPreviewUser() {
  return {
    id: 'wx-preview-local',
    name: readPreviewName() || '预览玩家',
    avatar: '',
  };
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.login) {
      resolve();
      return;
    }
    wx.login({
      success() {
        resolve();
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || 'wx.login 失败'));
      },
    });
  });
}

export async function loginUser() {
  if (!isCloudReady()) {
    return createPreviewUser();
  }

  await wxLogin();
  const result = await callCloud('login', {});
  if (!result || !result.ok || !result.openid) {
    throw new Error((result && result.error) || '微信登录失败，请先上传并部署 login 云函数');
  }

  return {
    id: result.openid,
    name: result.name || fallbackName(result.openid),
    avatar: '',
  };
}

export async function updatePlayerName(name) {
  if (!isCloudReady()) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) {
      throw new Error('请输入昵称');
    }
    if (clean.length > 12) {
      throw new Error('昵称最多 12 个字');
    }
    writePreviewName(clean);
    return {
      id: 'wx-preview-local',
      name: clean,
      avatar: '',
    };
  }

  const result = await callCloud('login', {
    action: 'updateName',
    name,
  });
  if (!result || !result.ok) {
    throw new Error((result && result.error) || '保存昵称失败');
  }
  return {
    id: result.openid,
    name: result.name,
    avatar: '',
  };
}
