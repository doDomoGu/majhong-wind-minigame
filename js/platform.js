export function getWindowInfo() {
  if (typeof wx !== 'undefined') {
    if (wx.getWindowInfo) {
      return wx.getWindowInfo();
    }
    if (wx.getSystemInfoSync) {
      return wx.getSystemInfoSync();
    }
  }

  return {
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

export function createGameCanvas() {
  const canvas = typeof wx !== 'undefined' && wx.createCanvas
    ? wx.createCanvas()
    : document.querySelector('canvas');

  const info = getWindowInfo();
  const dpr = info.pixelRatio || 1;
  const width = info.screenWidth;
  const height = info.screenHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.canvas = canvas;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { canvas, ctx, width, height, dpr };
}

export function resizeCanvas(canvas, ctx) {
  const info = getWindowInfo();
  const dpr = info.pixelRatio || 1;
  const width = info.screenWidth;
  const height = info.screenHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

export function eventPoint(event, canvas, logicalWidth, logicalHeight) {
  const source = event.touches && event.touches[0]
    ? event.touches[0]
    : event.changedTouches && event.changedTouches[0]
      ? event.changedTouches[0]
      : event;

  if (canvas.getBoundingClientRect) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((source.clientX - rect.left) / rect.width) * logicalWidth,
      y: ((source.clientY - rect.top) / rect.height) * logicalHeight,
    };
  }

  return { x: source.clientX, y: source.clientY };
}

export function bindPointer(canvas, handlers) {
  const start = { x: 0, y: 0, at: 0, active: false, lastY: 0 };

  const down = (event) => {
    if (event.preventDefault) {
      event.preventDefault();
    }
    const point = handlers.point(event);
    start.x = point.x;
    start.y = point.y;
    start.lastY = point.y;
    start.at = Date.now();
    start.active = true;
    if (handlers.onDown) {
      handlers.onDown(point);
    }
  };

  const move = (event) => {
    if (!start.active) {
      return;
    }
    if (event.preventDefault) {
      event.preventDefault();
    }
    const point = handlers.point(event);
    const dy = point.y - start.lastY;
    start.lastY = point.y;
    if (handlers.onMove) {
      handlers.onMove(point, dy);
    }
    if (handlers.onDrag) {
      handlers.onDrag(dy);
    }
  };

  const up = (event) => {
    if (!start.active) {
      return;
    }
    start.active = false;
    const point = handlers.point(event);
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const elapsed = Date.now() - start.at;
    if (handlers.onUp) {
      handlers.onUp(point);
    }
    if (Math.hypot(dx, dy) < 12 && elapsed < 500 && handlers.onTap) {
      handlers.onTap(point);
    }
  };

  const canUseDomEvents = canvas && typeof canvas.addEventListener === 'function';
  const canUseWxTouch = typeof wx !== 'undefined' && typeof wx.onTouchStart === 'function';

  // 真机小游戏 canvas 没有 DOM 的 addEventListener，必须用 wx.onTouch*。
  if (!canUseDomEvents && canUseWxTouch) {
    wx.onTouchStart(down);
    wx.onTouchMove(move);
    wx.onTouchEnd(up);
    if (wx.onTouchCancel) {
      wx.onTouchCancel(up);
    }
    return;
  }

  if (!canUseDomEvents) {
    return;
  }

  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up);
  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', up);
}
