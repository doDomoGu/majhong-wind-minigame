import { theme, ROOM_STATUS } from './theme.js';
import { bindPointer, createGameCanvas, eventPoint, resizeCanvas } from './platform.js';
import { initCloud } from './cloud.js';
import { loginUser } from './session.js';
import {
  addTestPlayers,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  seedDemoRooms,
  watchRoom,
} from './rooms.js';
import { createKeypad, drawKeypad, openKeypad, tapKeypad } from './keypad.js';
import { drawToast } from './ui.js';
import { createLobbyScreen } from './screens/lobby.js';
import { createWaitingScreen } from './screens/waiting.js';
import { createTableScreen } from './screens/table.js';

let started = false;

export function startApp() {
  if (started) {
    return;
  }
  started = true;
  const { canvas, ctx } = createGameCanvas();
  let width = 0;
  let height = 0;

  const app = {
    user: { id: '', name: '登录中', avatar: '' },
    room: null,
    viewMode: 'player',
    toastMessage: '',
    toastUntil: 0,
    keypad: createKeypad(),
    screen: null,
    screens: {},
    roomWatcher: null,
    toast(message) {
      app.toastMessage = message;
      app.toastUntil = Date.now() + 2200;
    },
    askRoomCode(title) {
      return openKeypad(app.keypad, title);
    },
    subscribeRoom(id) {
      if (app.roomWatcher && app.roomWatcher.close) {
        app.roomWatcher.close();
      }
      app.roomWatcher = watchRoom(id, (room) => {
        if (!room) {
          if (app.screen !== 'lobby') {
            app.room = null;
            app.goto('lobby');
            app.toast('房间已解散');
          }
          return;
        }
        app.room = room;
        if (room.status === ROOM_STATUS.playing && app.screen === 'waiting' && app.viewMode === 'player') {
          app.goto('table');
          app.toast('满员，已随机入座');
        }
      });
    },
    unsubscribeRoom() {
      if (app.roomWatcher && app.roomWatcher.close) {
        app.roomWatcher.close();
      }
      app.roomWatcher = null;
    },
    goto(name) {
      if (name === 'lobby') {
        app.unsubscribeRoom();
      }
      app.screen = name;
      const next = app.screens[name];
      if (next && next.enter) {
        next.enter();
      }
    },
    async createRoom() {
      try {
        app.room = await createRoom(app.user);
        app.viewMode = 'player';
        app.goto('waiting');
        app.subscribeRoom(app.room.id);
        app.toast('已创建房间 ' + app.room.id);
      } catch (error) {
        app.toast(error.message);
      }
    },
    async joinRoom(id) {
      try {
        app.room = await joinRoom(id, app.user);
        app.viewMode = 'player';
        app.subscribeRoom(app.room.id);
        if (app.room.status === ROOM_STATUS.playing) {
          app.goto('table');
          app.toast('满员，已随机入座');
          return;
        }
        app.goto('waiting');
      } catch (error) {
        app.toast(error.message);
      }
    },
    async openRoomFromList(room) {
      if (room.status === ROOM_STATUS.waiting) {
        await app.joinRoom(room.id);
        return;
      }
      await app.enterPublic(room.id);
    },
    async enterPublic(id) {
      try {
        const room = await getRoom(id);
        if (!room) {
          app.toast('房间不存在');
          return;
        }
        app.room = room;
        app.viewMode = 'public';
        app.goto('table');
        app.subscribeRoom(room.id);
        app.toast('已进入公共视角');
      } catch (error) {
        app.toast(error.message);
      }
    },
    async leaveRoom() {
      if (!app.room) {
        app.goto('lobby');
        return;
      }
      try {
        const result = await leaveRoom(app.room.id, app.user.id);
        app.room = null;
        app.viewMode = 'player';
        app.goto('lobby');
        app.toast(result && result.dissolved ? '房间已解散' : '已离开房间');
      } catch (error) {
        app.toast(error.message);
      }
    },
    async fillBots() {
      if (!app.room) {
        return;
      }
      try {
        app.room = await addTestPlayers(app.room.id);
        if (app.room.status === ROOM_STATUS.playing) {
          app.goto('table');
          app.toast('满员，已随机入座');
        }
      } catch (error) {
        app.toast(error.message);
      }
    },
  };

  app.screens = {
    lobby: createLobbyScreen(app),
    waiting: createWaitingScreen(app),
    table: createTableScreen(app),
  };

  function applySize() {
    const next = resizeCanvas(canvas, ctx);
    width = next.width;
    height = next.height;
  }

  applySize();
  app.goto('lobby');
  boot();

  async function boot() {
    const cloudOn = await initCloud();
    try {
      app.user = await loginUser();
    } catch (error) {
      app.toast(error.message);
    }

    if (cloudOn) {
      app.toast('已连接云开发 · ' + app.user.name);
    } else {
      seedDemoRooms();
      app.toast('本地预览（未连接云）');
    }

    if (app.screens.lobby.refreshList) {
      await app.screens.lobby.refreshList();
    }
  }

  bindPointer(canvas, {
    point: (event) => eventPoint(event, canvas, width, height),
    onDrag: (dy) => {
      if (app.keypad.visible) {
        return;
      }
      const current = app.screens[app.screen];
      if (current && current.onDrag) {
        current.onDrag(dy);
      }
    },
    onTap: async (point) => {
      if (app.keypad.visible) {
        tapKeypad(app.keypad, point);
        return;
      }
      const current = app.screens[app.screen];
      if (current && current.onTap) {
        await current.onTap(point);
      }
    },
  });

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', applySize);
  }
  if (typeof wx !== 'undefined' && wx.onWindowResize) {
    wx.onWindowResize(applySize);
  }

  function loop() {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    const current = app.screens[app.screen];
    if (current) {
      current.draw(ctx, width, height);
    }

    drawKeypad(ctx, app.keypad, width, height);

    if (Date.now() < app.toastUntil) {
      drawToast(ctx, app.toastMessage, width, height);
    }

    requestAnimationFrame(loop);
  }

  loop();
}
