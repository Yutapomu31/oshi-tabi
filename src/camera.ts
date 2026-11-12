/**
 * カメラの起動・停止と、エラー時の案内文を扱う。
 *
 * ブラウザの部品（navigator.mediaDevices など）は外から渡す作りにして、
 * Vitest で偽物を渡してテストできるようにしている。
 *
 * MVP の決まり：
 * - カメラはユーザーがボタンを押したときだけ起動する（自動では起動・再起動しない）
 * - 音声は要求しない
 * - 映像はどこにも送らない（画面に表示するだけ）
 */

/** カメラの向き。user は前面（自撮り側）、environment は背面 */
export type FacingMode = 'user' | 'environment';

/** 止める対象のトラック（MediaStreamTrack のうち、使う部分だけ） */
export interface CameraTrack {
  stop(): void;
  addEventListener(type: 'ended', listener: () => void): void;
}

/** カメラの映像（MediaStream のうち、使う部分だけ） */
export interface CameraStream {
  getTracks(): CameraTrack[];
}

/** idle：止まっている／starting：起動中（許可の確認中を含む）／active：映像が出ている */
export type CameraStatus = 'idle' | 'starting' | 'active';

/** カメラを止めた理由 */
export type StopReason = 'user' | 'hidden' | 'pagehide' | 'ended';

export interface CameraState {
  status: CameraStatus;
  facingMode: FacingMode;
  /** 画面に出す案内文。なければ null */
  message: string | null;
}

/** 起動時に最初に使うカメラの向き（旅先の景色を撮るため背面） */
export const DEFAULT_FACING_MODE: FacingMode = 'environment';

/** 映像のすべてのトラックを止める（ブラウザのカメラ使用中の表示を消すため） */
export function stopAllTracks(stream: CameraStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** getUserMedia に渡す条件。音声は要求しない。向きは「できれば」の指定にする */
export function buildConstraints(
  facingMode: FacingMode,
): MediaStreamConstraints {
  return {
    audio: false,
    video: { facingMode: { ideal: facingMode } },
  };
}

/** 前面と背面を入れ替える */
export function nextFacingMode(current: FacingMode): FacingMode {
  return current === 'user' ? 'environment' : 'user';
}

/** 切り替えボタンに出す文字 */
export function facingModeLabel(facingMode: FacingMode): string {
  return facingMode === 'user' ? '前面カメラ' : '背面カメラ';
}

/** ブラウザがカメラを使える状態かを調べるための材料 */
export interface CameraSupportInput {
  /** window.isSecureContext（HTTPS か localhost なら true） */
  isSecureContext: boolean;
  /** navigator.mediaDevices.getUserMedia があるか */
  hasGetUserMedia: boolean;
}

/**
 * カメラを使えない環境なら案内文を返す。使えるなら null を返す。
 * HTTPS でないページでは、ブラウザは getUserMedia を用意しない。
 */
export function unsupportedMessage(input: CameraSupportInput): string | null {
  if (!input.isSecureContext) {
    return 'カメラは、HTTPS のページか、この端末の localhost で開いたページでしか使えません。URL を確認してください。';
  }
  if (!input.hasGetUserMedia) {
    return 'このブラウザはカメラの利用に対応していません。別のブラウザで開いてください。';
  }
  return null;
}

/** getUserMedia の失敗（例外）を、利用者向けの日本語の案内文にする */
export function cameraErrorMessage(error: unknown): string {
  const name = errorName(error);
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'カメラの利用が許可されませんでした。ブラウザのアドレスバー付近にあるカメラの設定で「許可」に変えてから、もう一度「カメラを起動」を押してください。';
    case 'SecurityError':
      return 'このページではカメラを使えない設定になっています。HTTPS のページで開いているか、ブラウザの設定を確認してください。';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'カメラが見つかりませんでした。カメラがつながっているか、端末の設定でカメラが無効になっていないかを確認してください。';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'カメラを起動できませんでした。ほかのアプリやタブがカメラを使っていないかを確認して、もう一度「カメラを起動」を押してください。';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return '指定した向きのカメラが使えませんでした。カメラの切り替えをやめて、もう一度「カメラを起動」を押してください。';
    default:
      return 'カメラを起動できませんでした。ページを開き直してから、もう一度「カメラを起動」を押してください。';
  }
}

/** 止めた理由ごとの案内文。ボタンで止めたときは出さない */
export function stopMessage(reason: StopReason): string | null {
  switch (reason) {
    case 'user':
      return null;
    case 'hidden':
    case 'pagehide':
      return '画面を離れたため、カメラを止めました。再開するには「カメラを起動」を押してください。';
    case 'ended':
      return 'カメラが使えなくなったため、止めました。再開するには「カメラを起動」を押してください。';
  }
}

function errorName(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const { name } = error as { name: unknown };
    return typeof name === 'string' ? name : null;
  }
  return null;
}

export interface CameraControllerOptions<S extends CameraStream> {
  /** navigator.mediaDevices.getUserMedia（テストでは偽物を渡す） */
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<S>;
  /** 映像を表示する（video 要素に渡すなど） */
  onStream: (stream: S) => void;
  /** 映像の表示をやめる */
  onClear: () => void;
  /** 状態が変わったとき（ボタンの有効・無効や案内文の表示に使う） */
  onChange: (state: CameraState) => void;
}

export interface CameraController {
  /** カメラを起動する（ボタンを押したときだけ呼ぶ） */
  start(): Promise<void>;
  /** カメラを止める。起動中に呼んだ場合は、起動が終わった時点で止める */
  stop(reason: StopReason): void;
  /** 前面と背面を切り替える。映像が出ているときは、いったん止めてから新しい向きで起動する */
  switchFacingMode(): Promise<void>;
  getState(): CameraState;
}

/** カメラの状態を管理する */
export function createCameraController<S extends CameraStream>(
  options: CameraControllerOptions<S>,
): CameraController {
  let state: CameraState = {
    status: 'idle',
    facingMode: DEFAULT_FACING_MODE,
    message: null,
  };
  let stream: S | null = null;
  // 起動の要求ごとに番号を進める。起動中に止めた場合、古い要求の結果を捨てるために使う
  let requestId = 0;

  function update(next: Partial<CameraState>): void {
    state = { ...state, ...next };
    options.onChange(state);
  }

  function releaseStream(): void {
    if (stream) {
      stopAllTracks(stream);
      stream = null;
    }
    options.onClear();
  }

  async function start(): Promise<void> {
    if (state.status !== 'idle') {
      return;
    }
    const id = ++requestId;
    update({ status: 'starting', message: null });

    let obtained: S;
    try {
      obtained = await options.getUserMedia(buildConstraints(state.facingMode));
    } catch (error) {
      if (id !== requestId) {
        return;
      }
      update({ status: 'idle', message: cameraErrorMessage(error) });
      return;
    }

    if (id !== requestId) {
      // 許可を待つあいだに止められた（停止ボタン・画面を離れたなど）。すぐに止める
      stopAllTracks(obtained);
      return;
    }

    stream = obtained;
    for (const track of obtained.getTracks()) {
      track.addEventListener('ended', () => {
        // カメラが外された・権限が取り消されたなど。今の映像のときだけ止める
        if (stream === obtained) {
          stop('ended');
        }
      });
    }
    options.onStream(obtained);
    update({ status: 'active', message: null });
  }

  function stop(reason: StopReason): void {
    if (state.status === 'idle') {
      return;
    }
    requestId++;
    releaseStream();
    update({ status: 'idle', message: stopMessage(reason) });
  }

  async function switchFacingMode(): Promise<void> {
    if (state.status === 'starting') {
      return;
    }
    const facingMode = nextFacingMode(state.facingMode);
    if (state.status === 'active') {
      // 端末によっては前面と背面を同時に開けないため、先に止める
      requestId++;
      releaseStream();
      update({ status: 'idle', facingMode, message: null });
      await start();
      return;
    }
    update({ facingMode });
  }

  return {
    start,
    stop,
    switchFacingMode,
    getState: () => state,
  };
}
