import { describe, expect, it } from 'vitest';
import { stripDuplicateBasmalaPrefix } from '@/lib/tafsirHtmlUtils';

describe('stripDuplicateBasmalaPrefix', () => {
  it('strips a bracketed Arabic Basmalah prefix for Al-Fatiha tafsir', () => {
    const input = '( بسم الله الرحمن الرحيم ) يقال لها : الفاتحة';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('يقال لها : الفاتحة');
  });

  it('strips an HTML-wrapped bracketed Arabic Basmalah prefix', () => {
    const input = '<p>( بسم الله الرحمن الرحيم )</p> تفسير';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('تفسير');
  });

  it('strips a non-bracketed standalone Arabic Basmalah prefix', () => {
    const input = 'بسم الله الرحمن الرحيم تفسير مختصر';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('تفسير مختصر');
  });

  it('strips mixed malformed English and Arabic Basmalah prefixes until stable', () => {
    const input = ' ( In the Name of Allah, the Most Gracious, the Most Merciful ) بسم الله الرحمن الرحيم تفسير الآية';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('تفسير الآية');
  });

  it('strips a bracketed English Basmalah prefix', () => {
    const input = '(In the Name of Allah, the Most Gracious, the Most Merciful) Tafsir text';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('Tafsir text');
  });

  it('strips an unbracketed English Basmalah prefix', () => {
    const input = 'In the Name of Allah, the Most Gracious, the Most Merciful Tafsir text';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('Tafsir text');
  });

  it('strips a plain unbracketed English Basmalah prefix without suffix', () => {
    const input = 'In the Name of Allah Tafsir text';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe('Tafsir text');
  });

  it('returns falsy-like inputs unchanged', () => {
    expect(stripDuplicateBasmalaPrefix('', 1)).toBe('');
    expect(stripDuplicateBasmalaPrefix(null as unknown as string, 1)).toBe(null as unknown as string);
    expect(stripDuplicateBasmalaPrefix(undefined as unknown as string, 1)).toBe(undefined as unknown as string);
  });

  it('returns strings without a Basmalah prefix unchanged', () => {
    const input = 'تفسير السورة بدون مقدمة';

    expect(stripDuplicateBasmalaPrefix(input, 1)).toBe(input);
  });

  it('does not strip content for non-first ayah', () => {
    const input = '( بسم الله الرحمن الرحيم ) تفسير الآية';

    expect(stripDuplicateBasmalaPrefix(input, 2)).toBe(input);
  });
});
