import { theme, ROOM_STATUS } from './theme.js';
import { bindPointer, createGameCanvas, eventPoint, resizeCanvas } from './platform.js';
import { getLocalUser } from './session.js';
import {
  addTestPlayers,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  seedDemoRooms,
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

  seedDemoRooms();

  const app = {
    user: getLocalUser(),
    room: null,
    viewMode: 'player',
    toastMessage: '',
    toastUntil: 0,
    keypad: createKeypad(),
    screen: null,
    screens: {},
    toast(message) {
      app.toastMessage = message;
      app.toastUntil = Date.now() + 2200;
    },
    askRoomCode(title) {
      return openKeypad(app.keypad, title);
    },
    goto(name) {
      app.screen = name;
      const next = app.screens[name];
      if (next && next.enter) {
        next.enter();
      }
    },
    createRoom() {
      try {
        app.room = createRoom(app.user);
        app.viewMode = 'player';
        app.goto('waiting');
        app.toast('已创建房间 ' + app.room.id);
      } catch (error) {
        app.toast(error.message);
      }
    },
    joinRoom(id) {
      try {
        app.room = joinRoom(id, app.user);
        app.viewMode = 'player';
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
    openRoomFromList(room) {
      if (room.status === ROOM_STATUS.waiting) {
        app.joinRoom(room.id);
        return;
      }
      app.enterPublic(room.id);
    },
    enterPublic(id) {
      const room = getRoom(id);
      if (!room) {
        app.toast('房间不存在');
        return;
      }
      app.room = room;
      app.viewMode = 'public';
      app.goto('table');
      app.toast('已进入公共视角');
    },
    leaveRoom() {
      if (!app.room) {
        app.goto('lobby');
        return;
      }
      const result = leaveRoom(app.room.id, app.user.id);
      app.room = null;
      app.viewMode = 'player';
      app.goto('lobby');
      app.screens.lobby.refreshList();
      app.toast(result && result.dissolved ? '房间已解散' : '已离开房间');
    },
    fillBots() {
      if (!app.room) {
        return;
      }
      try {
        app.room = addTestPlayers(app.room.id);
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

  if (typeof window !== 'undefined') {
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
