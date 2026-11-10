import { describe, expect, it } from 'vitest';
import { createGreeting } from './greeting.ts';

describe('createGreeting', () => {
  it('アプリ名を含むあいさつ文を返す', () => {
    expect(createGreeting('推し旅')).toBe('推し旅 の開発環境が動いています');
  });
});
