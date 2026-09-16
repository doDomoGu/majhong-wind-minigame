import { theme } from '../theme.js';
import { getSafeInsets } from '../platform.js';
import {
  WIND_LABEL,
  computeResults,
  formatDelta,
  formatRound,
  layoutWinds,
  playerWind,
  settleSummary,
} from '../game/rules.js';
import {
  drawAvatar,
  drawButton,
  drawGhostButton,
  drawText,
  fillRoundRect,
  hit,
  layoutColumn,
} from '../ui.js';

const REL_LABEL = {
  bottom: '自己',
  right: '下家',
  top: '对家',
  left: '上家',
};

function formatPt(pt) {
  const n = Number(pt) || 0;
  const sign = n > 0 ? '+' : '';
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return sign + String(Math.round(rounded));
  }
  return sign + rounded.toFixed(1);
}

function playerOf(room, id) {
  return (room.players || []).find((item) => item.id === id) || null;
}

function resultsOf(room) {
  const game = room.game;
  if (!game) {
    return [];
  }
  if (game.results && game.results.length) {
    return game.results;
  }
  if (game.phase === 'finished' && room.seats) {
    return computeResults(game, room.seats);
  }
  return [];
}

function canUndo(game) {
  return !!(game && game.history && game.history.length > 1);
}

export function createTableScreen(app) {
  const state = {
    hits: {},
    wizard: null,
    scoreMode: 'absolute',
  };

  function isPublic() {
    return app.viewMode === 'public';
  }

  function seated(room) {
    return !!(room && room.seats && app.user && Object.values(room.seats).includes(app.user.id));
  }

  function resetWizard() {
    state.wizard = null;
  }

  function dealerRiichiLocked(room) {
    const game = room.game;
    const dealerId = room.seats && game ? room.seats[game.dealerWind] : null;
    return !!(dealerId && game && game.riichi && game.riichi[dealerId]);
  }

  return {
    enter() {
      resetWizard();
      state.scoreMode = 'absolute';
    },
    draw(ctx, width, height) {
      const col = layoutColumn(width, height);
      const pad = 18;
      const room = app.room;
      const game = room && room.game;
      const insets = getSafeInsets();
      state.hits = {};

      if (!room) {
        return;
      }

      if (game && game.phase !== 'playing') {
        state.wizard = null;
      }

      fillRoundRect(ctx, col.x, col.y, col.w, col.h, 0, theme.bg);

      const title = isPublic() ? '公共视角' : '个人风向盘';
      drawText(ctx, title, col.x + pad, col.y + 48, {
        size: 22,
        weight: '700',
      });
      drawText(ctx, '房 ' + room.id, col.x + pad, col.y + 74, {
        size: 13,
        color: theme.muted,
      });

      const refreshBtn = {
        x: col.x + col.w - pad - 72,
        y: col.y + 32,
        w: 72,
        h: 36,
      };
      state.hits.refresh = refreshBtn;
      drawGhostButton(ctx, refreshBtn, '刷新', { size: 14, color: theme.gold, border: theme.gold });

      const bottomLimit = Math.min(col.y + col.h, height - insets.bottom) - 16;
      const leave = {
        x: col.x + pad,
        y: bottomLimit - 46,
        w: col.w - pad * 2,
        h: 46,
      };
      state.hits.leave = leave;

      if (!game) {
        drawText(ctx, '对局尚未开始', col.x + col.w / 2, col.y + col.h / 2, {
          size: 16,
          align: 'center',
          color: theme.muted,
        });
        drawButton(ctx, leave, isPublic() ? '离开公共视角' : '离开房间', {
          color: theme.danger,
          textColor: theme.text,
        });
        return;
      }

      const myWind = playerWind(room.seats, app.user && app.user.id);
      const layout = layoutWinds(app.viewMode, myWind);
      const phase = game.phase;
      const acting = !isPublic() && seated(room) && phase !== 'finished';
      const showResults = phase === 'finished';
      const actionRows = showResults ? 2 : acting ? (phase === 'settling' ? 2 : 1) : 0;
      const actionH = actionRows ? actionRows * 52 + 8 : 0;
      const tableBottom = leave.y - 12 - actionH;
      const tableTop = col.y + 96;
      const cx = col.x + col.w / 2;
      const cy = tableTop + (tableBottom - tableTop) / 2;
      const reachX = Math.min(122, col.w / 2 - 78);
      const reachY = Math.min(156, (tableBottom - tableTop) / 2 - 78);

      const diskR = 62;
      const disk = { x: cx - diskR, y: cy - diskR, w: diskR * 2, h: diskR * 2 };
      const canToggleScore = !isPublic() && seated(room) && !showResults;
      fillRoundRect(ctx, disk.x, disk.y, disk.w, disk.h, diskR, theme.card);
      if (canToggleScore) {
        state.hits.disk = disk;
      }
      drawText(ctx, formatRound(game), cx, cy - 16, {
        size: 24,
        weight: '700',
        align: 'center',
      });
      drawText(ctx, '本场 ' + game.honba + '  ·  供托 ' + game.kyotaku, cx, cy + 10, {
        size: 12,
        align: 'center',
        color: theme.muted,
      });
      drawText(ctx, '亲 ' + WIND_LABEL[game.dealerWind], cx, cy + 28, {
        size: 13,
        align: 'center',
        color: theme.gold,
      });
      if (canToggleScore) {
        drawText(ctx, state.scoreMode === 'diff' ? '分差' : '点数', cx, cy + 46, {
          size: 11,
          align: 'center',
          color: state.scoreMode === 'diff' ? theme.gold : theme.muted,
        });
      }

      const sides = showResults ? [] : [
        { side: 'bottom', wind: layout.bottom, x: cx - 107, y: cy + reachY - 10, w: 148, h: 94 },
        { side: 'top', wind: layout.top, x: cx - 74, y: cy - reachY - 84, w: 148, h: 94 },
        { side: 'left', wind: layout.left, x: cx - reachX - 56, y: cy - 50, w: 118, h: 100 },
        { side: 'right', wind: layout.right, x: cx + reachX - 62, y: cy - 50, w: 118, h: 100 },
      ];

      sides.forEach((pos) => {
        const playerId = room.seats ? room.seats[pos.wind] : null;
        const player = playerOf(room, playerId);
        const isDealer = game.dealerWind === pos.wind;
        const reached = !!(playerId && game.riichi && game.riichi[playerId]);
        const mine = playerId && app.user && playerId === app.user.id;
        const input = game.settle && playerId ? game.settle.inputs[playerId] : null;
        fillRoundRect(ctx, pos.x, pos.y, pos.w, pos.h, 14, mine ? theme.cardHover : theme.bgRaised);

        if (acting && phase === 'playing' && pos.side === 'bottom' && playerId) {
          const riichiBtn = {
            x: pos.x + pos.w + 8,
            y: pos.y,
            w: 58,
            h: pos.h,
          };
          state.hits.riichiSelf = { ...riichiBtn, playerId, reached };
          if (reached) {
            drawGhostButton(ctx, riichiBtn, '取消', { color: theme.gold, border: theme.gold, size: 15 });
          } else {
            drawButton(ctx, riichiBtn, '立直', { size: 15 });
          }
        }

        const name = player ? player.name : '空';
        drawAvatar(ctx, pos.x + pos.w / 2 - 16, pos.y + 8, 32, name);
        const windText = WIND_LABEL[pos.wind] + (isDealer ? '亲' : '');
        const rel = isPublic() ? '' : REL_LABEL[pos.side];
        drawText(ctx, windText + (rel ? ' · ' + rel : ''), pos.x + pos.w / 2, pos.y + 50, {
          size: 11,
          align: 'center',
          color: isDealer ? theme.gold : theme.muted,
        });
        drawText(ctx, name, pos.x + pos.w / 2, pos.y + 66, {
          size: 12,
          align: 'center',
          color: player ? theme.text : theme.muted,
        });
        const rawScore = playerId && game.scores ? game.scores[playerId] : null;
        const myScore = app.user && game.scores ? game.scores[app.user.id] : null;
        const useDiff = state.scoreMode === 'diff' && !mine && rawScore != null && myScore != null;
        const scoreText = rawScore == null
          ? '—'
          : (useDiff ? formatDelta(rawScore - myScore) : String(rawScore));
        let scoreColor = theme.text;
        if (useDiff) {
          if (rawScore > myScore) {
            scoreColor = theme.waiting;
          } else if (rawScore < myScore) {
            scoreColor = theme.danger;
          } else {
            scoreColor = theme.muted;
          }
        }
        drawText(ctx, scoreText, pos.x + pos.w / 2, pos.y + 82, {
          size: 13,
          weight: '600',
          align: 'center',
          color: scoreColor,
        });

        if (reached) {
          fillRoundRect(ctx, pos.x + 8, pos.y + pos.h - 7, pos.w - 16, 4, 2, theme.gold);
        }
        if (input && input.confirmed) {
          drawText(ctx, formatDelta(input.value), pos.x + pos.w - 8, pos.y + 14, {
            size: 11,
            align: 'right',
            color: theme.waiting,
          });
        } else if (phase === 'settling' && playerId) {
          drawText(ctx, '未交', pos.x + pos.w - 8, pos.y + 14, {
            size: 11,
            align: 'right',
            color: theme.danger,
          });
        }
      });

      let hint = '';
      if (phase === 'settling' && game.settle) {
        hint = game.settle.error || settleSummary(game);
      } else if (acting && phase === 'playing') {
        hint = state.scoreMode === 'diff'
          ? '点中间风盘回到点数'
          : '点右侧立直；点中间风盘看分差';
      } else if (isPublic()) {
        hint = '只读，不占座';
      }
      if (hint) {
        drawText(ctx, hint, cx, tableBottom - 2, {
          size: 12,
          align: 'center',
          color: game.settle && game.settle.error ? theme.danger : theme.muted,
        });
      }

      if (showResults) {
        const ranks = resultsOf(room);
        const panelH = Math.min(220, 56 + ranks.length * 28);
        const panelY = leave.y - 12 - panelH - (canUndo(game) && !isPublic() ? 56 : 0);
        fillRoundRect(ctx, col.x + pad, panelY, col.w - pad * 2, panelH, 14, theme.card);
        drawText(ctx, '半庄结束', col.x + col.w / 2, panelY + 22, {
          size: 16,
          weight: '700',
          align: 'center',
        });
        ranks.forEach((row, index) => {
          const player = playerOf(room, row.id);
          const y = panelY + 48 + index * 28;
          drawText(ctx, row.rank + '', col.x + pad + 18, y, {
            size: 15,
            weight: '700',
            color: row.rank === 1 ? theme.gold : theme.text,
          });
          drawText(ctx, player ? player.name : row.id, col.x + pad + 40, y, { size: 14 });
          drawText(ctx, String(row.score), col.x + col.w - pad - 88, y, {
            size: 14,
            align: 'right',
          });
          drawText(ctx, formatPt(row.pt) + ' pt', col.x + col.w - pad - 16, y, {
            size: 14,
            align: 'right',
            color: theme.gold,
          });
        });
        if (canUndo(game) && !isPublic() && seated(room)) {
          const undo = {
            x: col.x + pad,
            y: leave.y - 56,
            w: col.w - pad * 2,
            h: 44,
          };
          state.hits.undo = undo;
          drawGhostButton(ctx, undo, '撤销上一局');
        }
      } else if (acting && phase === 'playing') {
        const gap = 10;
        const btnW = (col.w - pad * 2 - gap) / 2;
        const settle = { x: col.x + pad, y: leave.y - 56, w: btnW, h: 44 };
        const undo = { x: col.x + pad + btnW + gap, y: leave.y - 56, w: btnW, h: 44 };
        state.hits.settle = settle;
        drawButton(ctx, settle, '发起结算');
        if (canUndo(game)) {
          state.hits.undo = undo;
          drawGhostButton(ctx, undo, '撤销上一局');
        } else {
          drawGhostButton(ctx, undo, '东 1 开局', { color: theme.muted, border: theme.line });
        }
      } else if (acting && phase === 'settling') {
        const mineInput = game.settle && game.settle.inputs[app.user.id];
        const suggested = mineInput ? mineInput.suggested : null;
        const hasSuggest = !!suggested;
        const gap = 10;
        const btnW = (col.w - pad * 2 - gap) / 2;
        const zero = { x: col.x + pad, y: leave.y - 56, w: btnW, h: 44 };
        const fill = { x: col.x + pad + btnW + gap, y: leave.y - 56, w: btnW, h: 44 };
        state.hits.zero = zero;
        state.hits.fill = fill;
        drawGhostButton(ctx, zero, '无变化');
        if (mineInput && mineInput.confirmed) {
          drawButton(ctx, fill, '改自己的分');
        } else if (hasSuggest) {
          drawButton(ctx, fill, '采用 ' + formatDelta(suggested));
        } else {
          drawButton(ctx, fill, '填写自己的分');
        }
      }

      const leaveLabel = isPublic()
        ? '离开公共视角'
        : (phase === 'finished' ? '回大厅' : '离开房间');
      drawButton(ctx, leave, leaveLabel, {
        color: theme.danger,
        textColor: theme.text,
      });

      if (state.wizard) {
        drawWizard(ctx, width, height, state, dealerRiichiLocked(room));
      }
    },
    async onTap(point) {
      const room = app.room;
      if (!room) {
        return;
      }

      if (state.wizard) {
        await handleWizardTap(point, state, app, room, dealerRiichiLocked(room));
        return;
      }

      if (hit(point, state.hits.disk || {})) {
        state.scoreMode = state.scoreMode === 'diff' ? 'absolute' : 'diff';
        return;
      }
      if (hit(point, state.hits.refresh || {})) {
        await app.refreshCurrent(true);
        return;
      }
      if (hit(point, state.hits.leave || {})) {
        if (isPublic()) {
          app.goto('lobby');
          return;
        }
        await app.leaveRoom();
        return;
      }
      if (hit(point, state.hits.undo || {})) {
        await app.undoSettle();
        return;
      }
      if (hit(point, state.hits.settle || {})) {
        state.wizard = { step: 'kind' };
        return;
      }
      if (hit(point, state.hits.zero || {})) {
        await app.submitSettle(0);
        return;
      }
      if (hit(point, state.hits.fill || {})) {
        const mineInput = room.game && room.game.settle && room.game.settle.inputs[app.user.id];
        if (mineInput && !mineInput.confirmed && mineInput.suggested) {
          await app.submitSettle(mineInput.suggested);
          return;
        }
        const value = await app.askDelta();
        if (value == null) {
          return;
        }
        await app.submitSettle(value);
        return;
      }

      if (hit(point, state.hits.riichiSelf || {})) {
        const target = state.hits.riichiSelf;
        if (target.reached) {
          const ok = await app.askYesNo('取消本次立直', '把 1000 从供托还回去。');
          if (ok) {
            await app.cancelRiichiSeat(target.playerId);
          }
        } else {
          const ok = await app.askYesNo('立直', '立刻 −1000，供托 +1000。');
          if (ok) {
            await app.riichiSeat(target.playerId);
          }
        }
      }
    },
  };
}

function drawWizard(ctx, width, height, state, dealerLocked) {
  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, width, height);
  const panelW = Math.min(340, width - 40);
  const panelH = 280;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  fillRoundRect(ctx, x, y, panelW, panelH, 18, theme.bgRaised);
  state.hits = {};

  if (state.wizard.step === 'kind') {
    drawText(ctx, '本局如何结束？', x + panelW / 2, y + 40, {
      size: 18,
      weight: '700',
      align: 'center',
    });
    const win = { x: x + 24, y: y + 80, w: panelW - 48, h: 48 };
    const draw = { x: x + 24, y: y + 140, w: panelW - 48, h: 48 };
    const cancel = { x: x + 24, y: y + 210, w: panelW - 48, h: 40 };
    state.hits.wizWin = win;
    state.hits.wizDraw = draw;
    state.hits.wizCancel = cancel;
    drawButton(ctx, win, '有人和牌');
    drawGhostButton(ctx, draw, '流局');
    drawGhostButton(ctx, cancel, '取消', { color: theme.muted });
    return;
  }

  const winKind = state.wizard.kind === 'win';
  drawText(ctx, winKind ? '和牌的人是亲家吗？' : '亲家是否听牌？', x + panelW / 2, y + 40, {
    size: 18,
    weight: '700',
    align: 'center',
  });
  if (!winKind && dealerLocked) {
    drawText(ctx, '亲家本局已立直，锁定听牌', x + panelW / 2, y + 72, {
      size: 13,
      align: 'center',
      color: theme.gold,
    });
  }
  const yes = { x: x + 24, y: y + 100, w: panelW - 48, h: 48 };
  const no = { x: x + 24, y: y + 160, w: panelW - 48, h: 48 };
  const cancel = { x: x + 24, y: y + 220, w: panelW - 48, h: 40 };
  state.hits.wizYes = yes;
  state.hits.wizNo = no;
  state.hits.wizCancel = cancel;
  drawButton(ctx, yes, winKind ? '亲家和了' : '亲家听牌');
  if (!winKind && dealerLocked) {
    drawGhostButton(ctx, no, '已锁定', { color: theme.muted, border: theme.line });
  } else {
    drawGhostButton(ctx, no, winKind ? '子家和了' : '亲家不听');
  }
  drawGhostButton(ctx, cancel, '返回', { color: theme.muted });
}

async function handleWizardTap(point, state, app, room, dealerLocked) {
  if (hit(point, state.hits.wizCancel || {})) {
    if (state.wizard.step === 'flag') {
      state.wizard = { step: 'kind' };
    } else {
      state.wizard = null;
    }
    return;
  }
  if (state.wizard.step === 'kind') {
    if (hit(point, state.hits.wizWin || {})) {
      state.wizard = { step: 'flag', kind: 'win' };
      return;
    }
    if (hit(point, state.hits.wizDraw || {})) {
      if (dealerLocked) {
        state.wizard = null;
        await app.startSettle('draw', true);
        return;
      }
      state.wizard = { step: 'flag', kind: 'draw' };
    }
    return;
  }
  if (hit(point, state.hits.wizYes || {})) {
    const kind = state.wizard.kind;
    state.wizard = null;
    await app.startSettle(kind, true);
    return;
  }
  if (hit(point, state.hits.wizNo || {})) {
    if (state.wizard.kind === 'draw' && dealerLocked) {
      return;
    }
    const kind = state.wizard.kind;
    state.wizard = null;
    await app.startSettle(kind, false);
  }
}
