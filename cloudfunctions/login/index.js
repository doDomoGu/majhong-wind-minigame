const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const NAME_MAX = 12;

function fail(error) {
  return { ok: false, error };
}

function ok(payload) {
  return Object.assign({ ok: true }, payload);
}

function fallbackName(openid) {
  return '玩家' + String(openid).slice(-4);
}

function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

async function getPlayer(openid) {
  try {
    const res = await db.collection('players').doc(openid).get();
    return res.data || null;
  } catch (error) {
    return null;
  }
}

async function getOrCreate(openid) {
  const existing = await getPlayer(openid);
  if (existing) {
    return ok({
      openid,
      name: existing.name || fallbackName(openid),
    });
  }

  const now = Date.now();
  const name = fallbackName(openid);
  await db.collection('players').doc(openid).set({
    data: {
      name,
      createdAt: now,
      updatedAt: now,
    },
  });
  return ok({ openid, name });
}

async function syncRoomName(openid, name) {
  const res = await db.collection('rooms').where({
    'players.id': openid,
  }).limit(1).get();
  const room = res.data[0];
  if (!room) {
    return;
  }

  const data = {
    players: (room.players || []).map((player) => {
      if (player.id !== openid) {
        return player;
      }
      return Object.assign({}, player, { name });
    }),
    updatedAt: Date.now(),
  };
  if (room.hostId === openid) {
    data.hostName = name;
  }
  await db.collection('rooms').doc(room._id).update({ data });
}

async function updateName(openid, rawName) {
  const name = cleanName(rawName);
  if (!name) {
    return fail('请输入昵称');
  }
  if (name.length > NAME_MAX) {
    return fail('昵称最多 ' + NAME_MAX + ' 个字');
  }

  const now = Date.now();
  const existing = await getPlayer(openid);
  if (existing) {
    await db.collection('players').doc(openid).update({
      data: {
        name,
        updatedAt: now,
      },
    });
  } else {
    await db.collection('players').doc(openid).set({
      data: {
        name,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  try {
    await syncRoomName(openid, name);
  } catch (error) {
    // 房间同步失败不影响资料保存
  }

  return ok({ openid, name });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return fail('未拿到 openid，请在开发者工具登录测试号或用真机打开');
  }

  try {
    if (event && event.action === 'updateName') {
      return await updateName(OPENID, event.name);
    }
    return await getOrCreate(OPENID);
  } catch (error) {
    return fail(error.message || '登录失败');
  }
};
