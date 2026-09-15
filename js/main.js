/**
 * 创建主画布并返回 2D 上下文。
 * 微信环境使用 wx.createCanvas；浏览器预览使用已有 canvas。
 */
export function createGameCanvas() {
  const canvas = typeof wx !== 'undefined' && wx.createCanvas
    ? wx.createCanvas()
    : document.querySelector('canvas');

  const windowInfo = getWindowInfo();
  canvas.width = windowInfo.screenWidth;
  canvas.height = windowInfo.screenHeight;

  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.canvas = canvas;
  }

  return canvas;
}

function getWindowInfo() {
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
  };
}

/**
 * 在画布中央绘制欢迎文字
 */
export function renderWelcome(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, width, height);

  const fontFamily = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  ctx.fillStyle = '#f5f0e6';
  ctx.font = `bold 36px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1141242', width / 2, height / 2 - 28);

  ctx.fillStyle = '#8fa3b8';
  ctx.font = `20px ${fontFamily}`;
  ctx.fillText('空项目已就绪', width / 2, height / 2 + 22);
}
