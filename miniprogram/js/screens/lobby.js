import { STATUS_COLOR, STATUS_LABEL, theme } from '../theme.js';
import { listRooms } from '../rooms.js';
import {
  drawAvatar,
  drawButton,
  drawGhostButton,
  drawText,
  fillRoundRect,
  hit,
  layoutColumn,
  layoutHeader,
} from '../ui.js';

const CARD_H = 78;
const CARD_GAP = 10;

export function createLobbyScreen(app) {
  const state = {
    scroll: 0,
    rooms: [],
    hits: {},
    list: { x: 0, y: 0, w: 0, h: 0 },
  };

  function roomHasUser(room, userId) {
    return !!(room && userId && room.players && room.players.some((player) => player.id === userId));
  }

  async function refreshList(showToast) {
    try {
      state.rooms = await listRooms();
      const listed = state.rooms.find((room) => roomHasUser(room, app.user.id));
      app.myRoom = listed || null;
      if (!app.myRoom && app.refreshMyRoom) {
        await app.refreshMyRoom();
      }
      if (showToast) {
        app.toast('已刷新房间列表');
      }
    } catch (error) {
      app.toast(error.message);
    }
  }

  return {
    enter() {
      state.scroll = 0;
      refreshList(false);
    },
    refreshList,
    onDrag(dy) {
      const max = Math.max(0, state.rooms.length * (CARD_H + CARD_GAP) - state.list.h);
      state.scroll = Math.min(0, Math.max(-max, state.scroll + dy));
    },
    draw(ctx, width, height) {
      const col = layoutColumn(width, height);
      const pad = 20;
      state.hits = {};

      fillRoundRect(ctx, col.x, col.y, col.w, col.h, 0, theme.bg);

      const header = layoutHeader(col, { pad, avatar: true });
      drawText(ctx, '立直麻将 · 风向盘', header.titleX, header.titleY, {
        size: 22,
        weight: '700',
      });
      let subtitle = '选择或创建一个房间';
      if (!app.user.id) {
        subtitle = app.loginError || '正在登录微信…';
      } else if (app.myRoom) {
        subtitle = '你已在房间 ' + app.myRoom.id;
      }
      drawText(ctx, subtitle, header.titleX, header.subY, {
        size: 14,
        color: app.loginError && !app.user.id ? theme.danger : theme.muted,
      });

      state.hits.profile = header.profile;
      drawAvatar(ctx, header.avatar.x, header.avatar.y, header.avatar.w, app.user.name);
      drawText(ctx, app.user.name || '登录中', header.avatar.x + header.avatar.w / 2, header.avatar.y + 52, {
        size: 12,
        align: 'center',
        color: theme.muted,
      });
      if (app.user.id) {
        drawText(ctx, '点击改名', header.avatar.x + header.avatar.w / 2, header.avatar.y + 68, {
          size: 10,
          align: 'center',
          color: theme.gold,
        });
      }

      const bottomH = 156;
      state.list = {
        x: col.x + pad,
        y: header.bottom + 8,
        w: col.w - pad * 2,
        h: col.h - (header.bottom - col.y) - bottomH - 16,
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(state.list.x, state.list.y, state.list.w, state.list.h);
      ctx.clip();

      if (state.rooms.length === 0 && !app.myRoom) {
        drawText(ctx, '还没有房间，创建一个吧', state.list.x + state.list.w / 2, state.list.y + 80, {
          size: 15,
          align: 'center',
          color: theme.muted,
        });
      }

      state.rooms.forEach((room, index) => {
        const y = state.list.y + state.scroll + index * (CARD_H + CARD_GAP);
        if (y + CARD_H < state.list.y || y > state.list.y + state.list.h) {
          return;
        }
        const rect = { x: state.list.x, y, w: state.list.w, h: CARD_H };
        state.hits['room-' + room.id] = { ...rect, room };
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14, theme.card);

        drawText(ctx, '房 ' + room.id, rect.x + 18, rect.y + 28, {
          size: 20,
          weight: '700',
        });
        drawText(ctx, '创建者 ' + room.hostName, rect.x + 18, rect.y + 54, {
          size: 13,
          color: theme.muted,
        });

        const count = room.players.length + '/4';
        drawText(ctx, count, rect.x + rect.w - 18, rect.y + 28, {
          size: 18,
          weight: '600',
          align: 'right',
        });

        const label = STATUS_LABEL[room.status];
        const color = STATUS_COLOR[room.status];
        ctx.font = `500 12px ${theme.font}`;
        const pillW = ctx.measureText(label).width + 16;
        const pillX = rect.x + rect.w - 18 - pillW;
        fillRoundRect(ctx, pillX, rect.y + 46, pillW, 20, 10, color);
        drawText(ctx, label, pillX + pillW / 2, rect.y + 56, {
          size: 12,
          weight: '500',
          align: 'center',
          color: '#1a2332',
        });
      });
      ctx.restore();

      const btnY = col.y + col.h - bottomH + 8;
      const btnW = (col.w - pad * 2 - 12) / 2;
      const left = { x: col.x + pad, y: btnY, w: col.w - pad * 2, h: 48 };
      const join = { x: col.x + pad, y: btnY + 60, w: btnW, h: 44 };
      const watch = { x: col.x + pad + btnW + 12, y: btnY + 60, w: btnW, h: 44 };

      if (app.myRoom) {
        state.hits.back = left;
        state.hits.watch = { x: col.x + pad, y: btnY + 60, w: col.w - pad * 2, h: 44 };
        drawButton(ctx, left, '回到房间 ' + app.myRoom.id);
        drawGhostButton(ctx, state.hits.watch, '公共视角');
      } else {
        state.hits.create = left;
        state.hits.join = join;
        state.hits.watch = watch;
        drawButton(ctx, left, app.user.id ? '创建房间' : '登录后可创建房间');
        drawGhostButton(ctx, join, '输入房号加入');
        drawGhostButton(ctx, watch, '公共视角');
      }

      state.hits.refresh = header.refresh;
      drawGhostButton(ctx, header.refresh, '刷新', { size: 14, color: theme.gold, border: theme.gold });
    },
    async onTap(point) {
      if (hit(point, state.hits.profile || {})) {
        await app.editNickname();
        return;
      }
      if (hit(point, state.hits.refresh || {})) {
        await refreshList(true);
        return;
      }
      if (hit(point, state.hits.back || {})) {
        await app.returnToRoom();
        return;
      }
      if (hit(point, state.hits.create || {})) {
        await app.createRoom();
        return;
      }
      if (hit(point, state.hits.join || {})) {
        const code = await app.askRoomCode('输入房号加入');
        if (code) {
          await app.joinRoom(code);
        }
        return;
      }
      if (hit(point, state.hits.watch || {})) {
        const code = await app.askRoomCode('公共视角 · 输入房号');
        if (code) {
          await app.enterPublic(code);
        }
        return;
      }

      const roomHit = Object.values(state.hits).find((item) => item.room && hit(point, item));
      if (roomHit) {
        if (app.myRoom && roomHit.room.id === app.myRoom.id) {
          await app.returnToRoom();
          return;
        }
        if (app.myRoom) {
          app.toast('你已在房间 ' + app.myRoom.id + '，请先回到房间');
          return;
        }
        await app.openRoomFromList(roomHit.room);
      }
    },
  };
}
