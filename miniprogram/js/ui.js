import { theme } from './theme.js';

export function hit(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
}

export function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, radius, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
}

export function drawText(ctx, text, x, y, options = {}) {
  ctx.fillStyle = options.color || theme.text;
  ctx.font = `${options.weight || '400'} ${options.size || 16}px ${theme.font}`;
  ctx.textAlign = options.align || 'left';
  ctx.textBaseline = options.baseline || 'middle';
  ctx.fillText(text, x, y);
}

export function drawButton(ctx, rect, label, options = {}) {
  const color = options.color || theme.gold;
  const textColor = options.textColor || '#1a2332';
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12, color);
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, {
    size: options.size || 17,
    weight: '600',
    align: 'center',
    color: textColor,
  });
}

export function drawGhostButton(ctx, rect, label, options = {}) {
  ctx.strokeStyle = options.border || theme.line;
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.stroke();
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, {
    size: options.size || 16,
    weight: '500',
    align: 'center',
    color: options.color || theme.text,
  });
}

export function drawAvatar(ctx, x, y, size, name) {
  fillRoundRect(ctx, x, y, size, size, size / 2, '#3c536c');
  drawText(ctx, (name || '?').slice(0, 1), x + size / 2, y + size / 2, {
    size: size * 0.42,
    weight: '600',
    align: 'center',
  });
}

export function drawToast(ctx, message, width, height) {
  if (!message) {
    return;
  }
  ctx.font = `400 15px ${theme.font}`;
  const textWidth = ctx.measureText(message).width;
  const w = Math.min(width - 48, textWidth + 40);
  const h = 44;
  const x = (width - w) / 2;
  const y = height * 0.18;
  fillRoundRect(ctx, x, y, w, h, 22, 'rgba(20, 28, 40, 0.92)');
  drawText(ctx, message, width / 2, y + h / 2, {
    size: 15,
    align: 'center',
  });
}

export function layoutColumn(width, height) {
  const w = Math.min(width, 390);
  const h = Math.min(height, 844);
  return {
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    w,
    h,
  };
}
