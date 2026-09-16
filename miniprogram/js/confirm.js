import { theme } from './theme.js';
import { drawButton, drawGhostButton, drawText, fillRoundRect, hit } from './ui.js';

export function createConfirm() {
  return {
    visible: false,
    title: '确认',
    message: '',
    hits: {},
    resolve: null,
  };
}

export function openConfirm(dialog, title, message) {
  dialog.visible = true;
  dialog.title = title || '确认';
  dialog.message = message || '';
  return new Promise((resolve) => {
    dialog.resolve = resolve;
  });
}

function finish(dialog, result) {
  dialog.visible = false;
  const resolve = dialog.resolve;
  dialog.resolve = null;
  if (resolve) {
    resolve(result);
  }
}

export function drawConfirm(ctx, dialog, width, height) {
  dialog.hits = {};
  if (!dialog.visible) {
    return;
  }

  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, width, height);

  const panelW = Math.min(340, width - 40);
  const panelH = 220;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  fillRoundRect(ctx, x, y, panelW, panelH, 18, theme.bgRaised);

  drawText(ctx, dialog.title, x + panelW / 2, y + 36, {
    size: 18,
    weight: '700',
    align: 'center',
  });

  const lines = wrapText(ctx, dialog.message, panelW - 48, 15);
  lines.forEach((line, index) => {
    drawText(ctx, line, x + panelW / 2, y + 78 + index * 22, {
      size: 15,
      align: 'center',
      color: theme.muted,
    });
  });

  const btnY = y + panelH - 64;
  const btnW = (panelW - 48 - 12) / 2;
  const cancel = { x: x + 24, y: btnY, w: btnW, h: 44 };
  const ok = { x: x + 24 + btnW + 12, y: btnY, w: btnW, h: 44 };
  dialog.hits.cancel = cancel;
  dialog.hits.ok = ok;
  drawGhostButton(ctx, cancel, '取消');
  drawButton(ctx, ok, '确定');
}

export function tapConfirm(dialog, point) {
  if (!dialog.visible) {
    return false;
  }
  if (hit(point, dialog.hits.cancel || {})) {
    finish(dialog, false);
    return true;
  }
  if (hit(point, dialog.hits.ok || {})) {
    finish(dialog, true);
    return true;
  }
  return true;
}

function wrapText(ctx, text, maxWidth, size) {
  ctx.font = `400 ${size}px ${theme.font}`;
  const raw = String(text || '');
  if (!raw) {
    return [];
  }
  const lines = [];
  let current = '';
  Array.from(raw).forEach((ch) => {
    if (ch === '\n') {
      lines.push(current);
      current = '';
      return;
    }
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = next;
    }
  });
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 4);
}
