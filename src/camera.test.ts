import { describe, expect, it, vi } from 'vitest';
import {
  buildConstraints,
  cameraErrorMessage,
  createCameraController,
  DEFAULT_FACING_MODE,
  facingModeLabel,
  nextFacingMode,
  stopAllTracks,
  stopMessage,
  unsupportedMessage,
  type CameraState,
  type CameraStream,
} from './camera.ts';

/** 偽物のトラック。stop の呼び出しと、ended を起こす操作を記録する */
function createFakeTrack() {
  const endedListeners: Array<() => void> = [];
  return {
    stop: vi.fn(),
    addEventListener: (type: 'ended', listener: () => void) => {
      if (type === 'ended') {
        endedListeners.push(listener);
      }
    },
    /** カメラが外されたときなどの ended を起こす */
    fireEnded: () => {
      for (const listener of endedListeners) {
        listener();
      }
    },
  };
}

type FakeTrack = ReturnType<typeof createFakeTrack>;

function createFakeStream(
  trackCount = 1,
): CameraStream & { tracks: FakeTrack[] } {
  const tracks = Array.from({ length: trackCount }, () => createFakeTrack());
  return { tracks, getTracks: () => tracks };
}

/** 結果をあとで決められる Promise（許可を待っているあいだの動きを調べるため） */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setUp(
  getUserMedia: (c: MediaStreamConstraints) => Promise<CameraStream>,
) {
  const onStream = vi.fn();
  const onClear = vi.fn();
  const states: CameraState[] = [];
  const getUserMediaMock = vi.fn(getUserMedia);
  const controller = createCameraController({
    getUserMedia: getUserMediaMock,
    onStream,
    onClear,
    onChange: (state) => states.push(state),
  });
  return {
    controller,
    getUserMedia: getUserMediaMock,
    onStream,
    onClear,
    states,
  };
}

/** DOMException の代わり（name だけを見るため） */
function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('stopAllTracks', () => {
  it('すべてのトラックの stop を呼ぶ', () => {
    const stream = createFakeStream(3);
    stopAllTracks(stream);
    for (const track of stream.tracks) {
      expect(track.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('トラックがなくてもエラーにならない', () => {
    expect(() => stopAllTracks(createFakeStream(0))).not.toThrow();
  });
});

describe('buildConstraints', () => {
  it('音声は要求せず、向きは ideal で指定する', () => {
    expect(buildConstraints('environment')).toEqual({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    expect(buildConstraints('user')).toEqual({
      audio: false,
      video: { facingMode: { ideal: 'user' } },
    });
  });
});

describe('nextFacingMode と facingModeLabel', () => {
  it('前面と背面を入れ替える', () => {
    expect(nextFacingMode('user')).toBe('environment');
    expect(nextFacingMode('environment')).toBe('user');
  });

  it('向きの名前を日本語で返す', () => {
    expect(facingModeLabel('user')).toBe('前面カメラ');
    expect(facingModeLabel('environment')).toBe('背面カメラ');
  });
});

describe('unsupportedMessage', () => {
  it('HTTPS でも localhost でもないページでは案内文を返す', () => {
    expect(
      unsupportedMessage({ isSecureContext: false, hasGetUserMedia: false }),
    ).toContain('HTTPS');
  });

  it('getUserMedia がないブラウザでは案内文を返す', () => {
    expect(
      unsupportedMessage({ isSecureContext: true, hasGetUserMedia: false }),
    ).toContain('対応していません');
  });

  it('使える環境では null を返す', () => {
    expect(
      unsupportedMessage({ isSecureContext: true, hasGetUserMedia: true }),
    ).toBeNull();
  });
});

describe('cameraErrorMessage', () => {
  it.each([
    ['NotAllowedError', '許可されませんでした'],
    ['PermissionDeniedError', '許可されませんでした'],
    ['SecurityError', '使えない設定'],
    ['NotFoundError', '見つかりませんでした'],
    ['DevicesNotFoundError', '見つかりませんでした'],
    ['NotReadableError', 'ほかのアプリやタブ'],
    ['TrackStartError', 'ほかのアプリやタブ'],
    ['AbortError', 'ほかのアプリやタブ'],
    ['OverconstrainedError', '指定した向き'],
    ['ConstraintNotSatisfiedError', '指定した向き'],
  ])('%s のときは「%s」を含む案内文を返す', (name, expected) => {
    expect(cameraErrorMessage(namedError(name))).toContain(expected);
  });

  it('知らないエラー名や、name のない値のときは一般的な案内文を返す', () => {
    const fallback = 'ページを開き直してから';
    expect(cameraErrorMessage(namedError('SomethingElse'))).toContain(fallback);
    expect(cameraErrorMessage('文字列')).toContain(fallback);
    expect(cameraErrorMessage(null)).toContain(fallback);
    expect(cameraErrorMessage({ name: 123 })).toContain(fallback);
  });
});

describe('stopMessage', () => {
  it('停止ボタンで止めたときは案内文を出さない', () => {
    expect(stopMessage('user')).toBeNull();
  });

  it('画面を離れて止めたときは、再開の方法を案内する', () => {
    expect(stopMessage('hidden')).toContain('「カメラを起動」');
    expect(stopMessage('pagehide')).toContain('「カメラを起動」');
  });

  it('カメラが使えなくなって止めたときも案内する', () => {
    expect(stopMessage('ended')).toContain('使えなくなった');
  });
});

describe('createCameraController', () => {
  it('作っただけでは getUserMedia を呼ばない', () => {
    const { controller, getUserMedia } = setUp(async () => createFakeStream());
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({
      status: 'idle',
      facingMode: DEFAULT_FACING_MODE,
      message: null,
    });
  });

  it('start で getUserMedia を1回呼び、映像を渡して active になる', async () => {
    const stream = createFakeStream();
    const { controller, getUserMedia, onStream, states } = setUp(
      async () => stream,
    );

    await controller.start();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(
      buildConstraints(DEFAULT_FACING_MODE),
    );
    expect(onStream).toHaveBeenCalledWith(stream);
    expect(states.map((s) => s.status)).toEqual(['starting', 'active']);
  });

  it('起動中・起動後に start を続けて呼んでも、getUserMedia は1回だけ', async () => {
    const { controller, getUserMedia } = setUp(async () => createFakeStream());
    const first = controller.start();
    const second = controller.start();
    await Promise.all([first, second]);
    await controller.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('stop("user") ですべてのトラックを止め、案内文なしで idle に戻る', async () => {
    const stream = createFakeStream(2);
    const { controller, onClear } = setUp(async () => stream);
    await controller.start();

    controller.stop('user');

    for (const track of stream.tracks) {
      expect(track.stop).toHaveBeenCalledTimes(1);
    }
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      message: null,
    });
  });

  it('画面が隠れて止めたときは、トラックを止めて案内文を出し、自動では再起動しない', async () => {
    const stream = createFakeStream();
    const { controller, getUserMedia } = setUp(async () => stream);
    await controller.start();

    controller.stop('hidden');

    expect(stream.tracks[0]?.stop).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      message: stopMessage('hidden'),
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('止めたあとは、もう一度 start で再開できる', async () => {
    const { controller, getUserMedia } = setUp(async () => createFakeStream());
    await controller.start();
    controller.stop('hidden');
    await controller.start();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      status: 'active',
      message: null,
    });
  });

  it('止まっているときの stop は何もしない', () => {
    const { controller, onClear, states } = setUp(async () =>
      createFakeStream(),
    );
    controller.stop('hidden');
    expect(onClear).not.toHaveBeenCalled();
    expect(states).toEqual([]);
  });

  it('許可を待っているあいだに止めたら、あとで届いた映像はすぐに止めて表示しない', async () => {
    const pending = deferred<CameraStream>();
    const stream = createFakeStream();
    const { controller, onStream } = setUp(() => pending.promise);

    const starting = controller.start();
    expect(controller.getState().status).toBe('starting');
    controller.stop('hidden');
    pending.resolve(stream);
    await starting;

    expect(stream.tracks[0]?.stop).toHaveBeenCalledTimes(1);
    expect(onStream).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe('idle');
  });

  it('許可を拒否されたら、案内文を出して idle に戻る', async () => {
    const { controller, onStream } = setUp(async () => {
      throw namedError('NotAllowedError');
    });

    await controller.start();

    expect(onStream).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      message: cameraErrorMessage(namedError('NotAllowedError')),
    });
  });

  it('許可を待っているあいだに止めたあとで失敗しても、案内文で上書きしない', async () => {
    const pending = deferred<CameraStream>();
    const { controller } = setUp(() => pending.promise);

    const starting = controller.start();
    controller.stop('hidden');
    pending.reject(namedError('NotAllowedError'));
    await starting;

    expect(controller.getState().message).toBe(stopMessage('hidden'));
  });

  it('トラックが終わったら（カメラが外されたなど）止めて案内する', async () => {
    const stream = createFakeStream();
    const { controller, onClear } = setUp(async () => stream);
    await controller.start();

    stream.tracks[0]?.fireEnded();

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      message: stopMessage('ended'),
    });
  });

  it('止めたあとの古い映像のトラックが終わっても、今の映像は止めない', async () => {
    const first = createFakeStream();
    const second = createFakeStream();
    const streams = [first, second];
    const { controller } = setUp(
      async () => streams.shift() ?? createFakeStream(),
    );
    await controller.start();
    controller.stop('user');
    await controller.start();

    first.tracks[0]?.fireEnded();

    expect(controller.getState().status).toBe('active');
    expect(second.tracks[0]?.stop).not.toHaveBeenCalled();
  });

  it('映像が出ているときに切り替えると、今の映像を止めてから新しい向きで起動する', async () => {
    const first = createFakeStream();
    const second = createFakeStream();
    const streams = [first, second];
    const { controller, getUserMedia } = setUp(
      async () => streams.shift() ?? createFakeStream(),
    );
    await controller.start();

    await controller.switchFacingMode();

    const switched = nextFacingMode(DEFAULT_FACING_MODE);
    expect(first.tracks[0]?.stop).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenLastCalledWith(buildConstraints(switched));
    expect(controller.getState()).toMatchObject({
      status: 'active',
      facingMode: switched,
    });
  });

  it('止まっているときに切り替えると、向きだけを変えてカメラは起動しない', async () => {
    const { controller, getUserMedia } = setUp(async () => createFakeStream());

    await controller.switchFacingMode();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      facingMode: nextFacingMode(DEFAULT_FACING_MODE),
    });
  });
});
