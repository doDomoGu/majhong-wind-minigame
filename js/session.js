function createPreviewUser() {
  return {
    id: 'wx-preview-local',
    name: '预览玩家',
    avatar: '',
  };
}

export function getLocalUser() {
  if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
    // 微信身份接入云开发后再换成 openid；现在先用可预览的本地用户。
  }
  return createPreviewUser();
}
