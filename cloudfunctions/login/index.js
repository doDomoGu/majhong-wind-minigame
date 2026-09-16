const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const name = (event && event.name) || ('玩家' + String(OPENID).slice(-4));

  return {
    ok: true,
    openid: OPENID,
    name,
  };
};
