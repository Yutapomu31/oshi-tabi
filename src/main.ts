import './style.css';
import { createGreeting } from './greeting.ts';
import {
  createCameraController,
  facingModeLabel,
  unsupportedMessage,
  type CameraState,
} from './camera.ts';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const heading = document.createElement('h1');
  heading.textContent = createGreeting('推し旅');
  app.append(heading);

  setUpCamera(app);
}

/** カメラの表示部分（ボタン・映像・案内文）を作る */
function setUpCamera(container: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'camera';

  const controls = document.createElement('div');
  controls.className = 'camera-controls';

  const startButton = createButton('カメラを起動');
  const stopButton = createButton('カメラを停止');
  const switchButton = createButton('切り替え');
  controls.append(startButton, stopButton, switchButton);

  // 案内文は読み上げソフトにも伝わるようにする
  const message = document.createElement('p');
  message.className = 'camera-message';
  message.setAttribute('role', 'status');

  // iPhone の Safari で全画面にならず、その場で再生されるように playsInline と muted を付ける
  const video = document.createElement('video');
  video.className = 'camera-video';
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.hidden = true;

  section.append(controls, message, video);
  container.append(section);

  // HTTPS でないページなどでは mediaDevices がない
  const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
  const notSupported = unsupportedMessage({
    isSecureContext: window.isSecureContext,
    hasGetUserMedia: typeof mediaDevices?.getUserMedia === 'function',
  });
  if (notSupported !== null || mediaDevices === undefined) {
    message.textContent = notSupported;
    startButton.disabled = true;
    stopButton.disabled = true;
    switchButton.disabled = true;
    return;
  }

  const render = (state: CameraState): void => {
    startButton.disabled = state.status !== 'idle';
    stopButton.disabled = state.status === 'idle';
    switchButton.disabled = state.status === 'starting';
    switchButton.textContent = `切り替え（今：${facingModeLabel(state.facingMode)}）`;
    if (state.status === 'starting') {
      message.textContent =
        'カメラを起動しています。許可を求められたら「許可」を選んでください。';
    } else {
      message.textContent = state.message ?? '';
    }
  };

  const camera = createCameraController({
    getUserMedia: (constraints) => mediaDevices.getUserMedia(constraints),
    onStream: (stream) => {
      video.srcObject = stream;
      video.hidden = false;
      // 自動再生が止められた場合も画面は壊さない（映像が出ないだけ）
      video.play().catch(() => undefined);
    },
    onClear: () => {
      video.pause();
      video.srcObject = null;
      video.hidden = true;
    },
    onChange: render,
  });

  startButton.addEventListener('click', () => {
    void camera.start();
  });
  stopButton.addEventListener('click', () => {
    camera.stop('user');
  });
  switchButton.addEventListener('click', () => {
    void camera.switchFacingMode();
  });

  // タブの切り替えなどで画面が隠れたら止める。戻っても自動では再起動しない
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      camera.stop('hidden');
    }
  });
  // ページを離れるとき（閉じる・別のページへ移る）にも止める
  window.addEventListener('pagehide', () => {
    camera.stop('pagehide');
  });

  render(camera.getState());
}

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  return button;
}
