const FALLBACK_WINDOW = {
  screenWidth: 390,
  screenHeight: 844,
  pixelRatio: 2,
};

export function getWindowInfo() {
  if (typeof wx !== 'undefined' && typeof wx.getWindowInfo === 'function') {
    try {
      const info = wx.getWindowInfo();
      if (info && info.screenWidth) {
        return info;
      }
    } catch (error) {
      // JSBridge 尚未就绪时不要再调 getSystemInfoSync
    }
  }

  if (typeof window !== 'undefined' && window.innerWidth) {
    return {
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
    };
  }

  return FALLBACK_WINDOW;
}

export function whenWxReady(callback) {
  let tries = 0;

  const attempt = () => {
    if (typeof wx === 'undefined') {
      callback();
      return;
    }

    try {
      if (typeof wx.getWindowInfo === 'function') {
        const info = wx.getWindowInfo();
        if (info && info.screenWidth) {
          callback();
          return;
        }
      } else {
        callback();
        return;
      }
    } catch (error) {
      // jsbridge not ready
    }

    tries += 1;
    if (tries >= 60) {
      callback();
      return;
    }
    setTimeout(attempt, 32);
  };

  attempt();
}

export function askConfirm(title, content) {
  return new Promise((resolve) => {
    if (typeof wx !== 'undefined' && wx.showModal) {
      wx.showModal({
        title: title || '确认',
        content: content || '',
        confirmText: '确定',
        cancelText: '取消',
        success(res) {
          resolve(!!res.confirm);
        },
        fail() {
          resolve(false);
        },
      });
      return;
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      resolve(window.confirm((title || '') + (content ? '\n' + content : '')));
      return;
    }
    resolve(true);
  });
}

export function askText(options) {
  const title = (options && options.title) || '请输入';
  const value = (options && options.value) || '';
  const placeholder = (options && options.placeholder) || '';

  return new Promise((resolve) => {
    if (typeof wx !== 'undefined' && wx.showModal) {
      wx.showModal({
        title,
        content: value,
        editable: true,
        placeholderText: placeholder,
        confirmText: '确定',
        cancelText: '取消',
        success(res) {
          if (!res.confirm) {
            resolve(null);
            return;
          }
          resolve(String(res.content == null ? '' : res.content).trim());
        },
        fail() {
          resolve(null);
        },
      });
      return;
    }

    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const next = window.prompt(title, value);
      resolve(next == null ? null : String(next).trim());
      return;
    }

    resolve(null);
  });
}

function getMenuButtonRect() {
  if (typeof wx === 'undefined' || typeof wx.getMenuButtonBoundingClientRect !== 'function') {
    return null;
  }
  try {
    const rect = wx.getMenuButtonBoundingClientRect();
    if (rect && rect.width && rect.bottom) {
      return rect;
    }
  } catch (error) {
    // 部分基础库在游戏里没有胶囊按钮
  }
  return null;
}

export function getSafeInsets() {
  const info = getWindowInfo();
  const width = info.screenWidth || 0;
  const height = info.screenHeight || 0;
  const safe = info.safeArea || {};
  const menu = getMenuButtonRect();
  const top = Math.max(
    safe.top || 0,
    info.statusBarHeight || 0,
    menu ? menu.bottom : 0,
  );
  return {
    top,
    right: Math.max(0, width - (safe.right || width)),
    bottom: Math.max(0, height - (safe.bottom || height)),
    left: Math.max(0, safe.left || 0),
  };
}

export function createGameCanvas() {
  let canvas = null;
  if (typeof GameGlobal !== 'undefined' && GameGlobal.canvas) {
    canvas = GameGlobal.canvas;
  } else if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
    canvas = wx.createCanvas();
    if (typeof GameGlobal !== 'undefined') {
      GameGlobal.canvas = canvas;
    }
  } else if (typeof document !== 'undefined') {
    canvas = document.querySelector('canvas');
  }

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
