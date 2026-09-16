import { theme } from '../theme.js';
import { WINDS } from '../rooms.js';
import {
  drawAvatar,
  drawButton,
  drawGhostButton,
  drawText,
  fillRoundRect,
  hit,
  layoutColumn,
} from '../ui.js';

export function createTableScreen(app) {
  const state = { hits: {} };

  return {
    enter() {},
    draw(ctx, width, height) {
      const col = layoutColumn(width, height);
      const pad = 20;
      const room = app.room;
      state.hits = {};

      if (!room) {
        return;
      }

      fillRoundRect(ctx, col.x, col.y, col.w, col.h, 0, theme.bg);

      const title = app.viewMode === 'public' ? '公共视角' : '个人风向盘';
      drawText(ctx, title, col.x + pad, col.y + 52, {
        size: 24,
        weight: '700',
      });
      drawText(ctx, '房 ' + room.id + '  ·  对局界面稍后实现', col.x + pad, col.y + 82, {
        size: 14,
        color: theme.muted,
      });

      const refreshBtn = {
        x: col.x + col.w - pad - 72,
        y: col.y + 36,
        w: 72,
        h: 36,
      };
      state.hits.refresh = refreshBtn;
      drawGhostButton(ctx, refreshBtn, '刷新', { size: 14, color: theme.gold, border: theme.gold });

      const centerX = col.x + col.w / 2;
      const centerY = col.y + col.h / 2 - 10;
      fillRoundRect(ctx, centerX - 64, centerY - 64, 128, 128, 64, theme.card);
      drawText(ctx, '东 1', centerX, centerY - 12, {
        size: 22,
        weight: '700',
        align: 'center',
      });
      drawText(ctx, '本场 0 · 供托 0', centerX, centerY + 16, {
        size: 12,
        align: 'center',
        color: theme.muted,
      });

      const reachX = Math.min(130, col.w / 2 - 70);
      const reachY = Math.min(148, col.h / 2 - 190);
      const positions = [
        { wind: 'S', x: centerX, y: centerY + reachY },
        { wind: 'W', x: centerX - reachX, y: centerY },
        { wind: 'N', x: centerX, y: centerY - reachY },
        { wind: 'E', x: centerX + reachX, y: centerY },
      ];

      // 公共视角按绝对座位；个人视角稍后会把自己转到下方。
      positions.forEach((pos) => {
        const meta = WINDS.find((item) => item.key === pos.wind);
        const playerId = room.seats ? room.seats[pos.wind] : null;
        const player = room.players.find((item) => item.id === playerId);
        fillRoundRect(ctx, pos.x - 54, pos.y - 36, 108, 72, 12, theme.bgRaised);
        drawAvatar(ctx, pos.x - 16, pos.y - 28, 32, player ? player.name : '?');
        drawText(ctx, meta.label + (player ? ' · ' + player.name : ' · 空'), pos.x, pos.y + 22, {
          size: 12,
          align: 'center',
          color: player ? theme.text : theme.muted,
        });
      });

      const leave = {
        x: col.x + pad,
        y: col.y + col.h - 88,
        w: col.w - pad * 2,
        h: 46,
      };
      state.hits.leave = leave;
      drawButton(ctx, leave, app.viewMode === 'public' ? '离开公共视角' : '离开房间', {
        color: theme.danger,
        textColor: theme.text,
      });
    },
    async onTap(point) {
      if (hit(point, state.hits.refresh || {})) {
        await app.refreshCurrent(true);
        return;
      }
      if (hit(point, state.hits.leave || {})) {
        if (app.viewMode === 'public') {
          app.goto('lobby');
          return;
        }
        app.leaveRoom();
      }
    },
  };
}
