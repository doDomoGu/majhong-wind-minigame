import { theme } from './theme.js';
import { drawButton, drawGhostButton, drawText, fillRoundRect, hit } from './ui.js';

export function createKeypad() {
  return {
    visible: false,
    mode: 'room',
    title: '输入房号',
    value: '',
    hits: {},
    resolve: null,
    reject: null,
  };
}

export function openKeypad(keypad, title, mode) {
  keypad.visible = true;
  keypad.mode = mode || 'room';
  keypad.title = title;
  keypad.value = '';
  return new Promise((resolve, reject) => {
    keypad.resolve = resolve;
    keypad.reject = reject;
  });
}

export function openScorePad(keypad, title) {
  return openKeypad(keypad, title || '本局点数变化', 'score');
}

export function closeKeypad(keypad, result) {
  keypad.visible = false;
  const resolve = keypad.resolve;
  keypad.resolve = null;
  keypad.reject = null;
  if (resolve) {
    resolve(result);
  }
}

export function drawKeypad(ctx, keypad, width, height) {
  keypad.hits = {};
  if (!keypad.visible) {
    return;
  }

  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, width, height);

  const panelW = Math.min(360, width - 32);
  const panelH = keypad.mode === 'score' ? 500 : 430;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  fillRoundRect(ctx, x, y, panelW, panelH, 20, theme.bgRaised);

  drawText(ctx, keypad.title, x + panelW / 2, y + 36, {
    size: 18,
    weight: '600',
    align: 'center',
  });

  fillRoundRect(ctx, x + 24, y + 64, panelW - 48, 52, 12, theme.card);
  const display = keypad.mode === 'score'
    ? (keypad.value || '0')
    : keypad.value.padEnd(4, '·');
  drawText(ctx, display, x + panelW / 2, y + 90, {
    size: 28,
    weight: '600',
    align: 'center',
    color: keypad.value ? theme.text : theme.muted,
  });

  const keys = keypad.mode === 'score'
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '删']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '删', '0', '确定'];
  const gap = 10;
  const gridX = x + 24;
  const gridY = y + 136;
  const gridW = panelW - 48;
  const keyW = (gridW - gap * 2) / 3;
  const keyH = 48;

  keys.forEach((key, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const rect = {
      x: gridX + col * (keyW + gap),
      y: gridY + row * (keyH + gap),
      w: keyW,
      h: keyH,
    };
    keypad.hits[key] = rect;
    if (key === '确定') {
      drawButton(ctx, rect, key, { size: 16 });
    } else {
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10, theme.card);
      drawText(ctx, key, rect.x + rect.w / 2, rect.y + rect.h / 2, {
        size: 18,
        weight: '500',
        align: 'center',
      });
    }
  });

  if (keypad.mode === 'score') {
    const ok = {
      x: x + 24,
      y: y + panelH - 118,
      w: panelW - 48,
      h: 44,
    };
    keypad.hits['确定'] = ok;
    drawButton(ctx, ok, '确定');
  }

  const cancel = {
    x: x + 24,
    y: y + panelH - 64,
    w: panelW - 48,
    h: 40,
  };
  keypad.hits.cancel = cancel;
  drawGhostButton(ctx, cancel, '取消');
}

export function tapKeypad(keypad, point) {
  if (!keypad.visible) {
    return false;
  }

  if (hit(point, keypad.hits.cancel || {})) {
    closeKeypad(keypad, null);
    return true;
  }

  const keys = keypad.mode === 'score'
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '删', '确定']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '删', '0', '确定'];
  keys.forEach((key) => {
    if (hit(point, keypad.hits[key] || {})) {
      applyKey(keypad, key);
    }
  });
  return true;
}

function applyKey(keypad, key) {
  if (key === '删') {
    keypad.value = keypad.value.slice(0, -1);
    return;
  }
  if (key === '确定') {
    if (keypad.mode === 'score') {
      const amount = keypad.value === '' || keypad.value === '-' || keypad.value === '+'
        ? 0
        : Number(keypad.value);
      if (!Number.isFinite(amount) || Math.round(amount) !== amount) {
        return;
      }
      closeKeypad(keypad, amount);
      return;
    }
    if (keypad.value.length === 4) {
      closeKeypad(keypad, keypad.value);
    }
    return;
  }
  if (keypad.mode === 'score') {
    if (key === '±') {
      if (keypad.value.charAt(0) === '-') {
        keypad.value = keypad.value.slice(1);
      } else {
        keypad.value = '-' + keypad.value;
      }
      return;
    }
    if (keypad.value.replace('-', '').length >= 7) {
      return;
    }
    keypad.value += key;
    return;
  }
  if (keypad.value.length < 4) {
    keypad.value += key;
  }
}
