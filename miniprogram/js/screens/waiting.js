import { theme, ROOM_STATUS } from '../theme.js';
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

export function createWaitingScreen(app) {
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

      const header = layoutHeader(col, { pad });
      drawText(ctx, '等待开局', header.titleX, header.titleY, {
        size: 22,
        weight: '700',
      });
      drawText(ctx, '房号 ' + room.id + '  ·  ' + room.players.length + '/4', header.titleX, header.subY, {
        size: 15,
        color: theme.muted,
      });

      state.hits.refresh = header.refresh;
      drawGhostButton(ctx, header.refresh, '刷新', { size: 14, color: theme.gold, border: theme.gold });

      const slots = [0, 1, 2, 3];
      const gap = 12;
      const slotW = (col.w - pad * 2 - gap) / 2;
      const slotH = Math.min(110, Math.max(88, (col.h - (header.bottom - col.y) - 180) / 2));
      const gridY = header.bottom + 12;

      slots.forEach((index) => {
        const colIndex = index % 2;
        const row = Math.floor(index / 2);
        const x = col.x + pad + colIndex * (slotW + gap);
        const y = gridY + row * (slotH + gap);
        const player = room.players[index];
        fillRoundRect(ctx, x, y, slotW, slotH, 16, theme.card);

        if (player) {
          drawAvatar(ctx, x + slotW / 2 - 22, y + 18, 44, player.name);
          drawText(ctx, player.name, x + slotW / 2, y + 80, {
            size: 14,
            align: 'center',
          });
          if (player.id === room.hostId) {
            drawText(ctx, '房主', x + slotW / 2, y + 98, {
              size: 11,
              align: 'center',
              color: theme.gold,
            });
          }
        } else {
          drawText(ctx, '空位', x + slotW / 2, y + slotH / 2, {
            size: 15,
            align: 'center',
            color: theme.muted,
          });
        }
      });

      drawText(ctx, '满 4 人后随机入座并自动开局', col.x + col.w / 2, gridY + slotH * 2 + gap + 36, {
        size: 13,
        align: 'center',
        color: theme.muted,
      });

      const leave = {
        x: col.x + pad,
        y: col.y + col.h - 46,
        w: col.w - pad * 2,
        h: 46,
      };
      const need = Math.max(0, 4 - room.players.length);
      const canFill = room.status === ROOM_STATUS.waiting && need > 0;
      state.hits.leave = leave;
      if (canFill) {
        const fill = {
          x: col.x + pad,
          y: leave.y - 60,
          w: col.w - pad * 2,
          h: 46,
        };
        state.hits.fill = fill;
        drawGhostButton(ctx, fill, '调试：补齐测试玩家（差 ' + need + ' 人）', {
          color: theme.gold,
          border: theme.gold,
        });
      }
      drawButton(ctx, leave, '离开房间', {
        color: theme.danger,
        textColor: theme.text,
      });
    },
    async onTap(point) {
      if (hit(point, state.hits.refresh || {})) {
        await app.refreshCurrent(true);
        return;
      }
      if (hit(point, state.hits.fill || {})) {
        await app.fillBots();
        return;
      }
      if (hit(point, state.hits.leave || {})) {
        await app.leaveRoom();
      }
    },
  };
}
