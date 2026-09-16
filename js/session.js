import { isCloudReady, callCloud } from './cloud.js';

function createPreviewUser() {
  return {
    id: 'wx-preview-local',
    name: '预览玩家',
    avatar: '',
  };
}

export async function loginUser() {
  if (!isCloudReady()) {
    return createPreviewUser();
  }

  const result = await callCloud('login', {});
  if (!result || !result.ok || !result.openid) {
    throw new Error((result && result.error) || '微信登录失败');
  }

  return {
    id: result.openid,
    name: result.name || ('玩家' + String(result.openid).slice(-4)),
    avatar: '',
  };
}
