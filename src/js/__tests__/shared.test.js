import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SharedUI from '../shared';

describe('SharedUI.getDOMElement', () => {
  let getElementByIdSpy;

  beforeEach(() => {
    SharedUI._cache = {};
    getElementByIdSpy = vi.spyOn(document, 'getElementById');
  });

  afterEach(() => {
    getElementByIdSpy.mockRestore();
  });

  it('queries the DOM on first access and caches the element', () => {
    const element = document.createElement('div');
    getElementByIdSpy.mockReturnValue(element);

    const first = SharedUI.getDOMElement('prayer-card');
    const second = SharedUI.getDOMElement('prayer-card');

    expect(first).toBe(element);
    expect(second).toBe(element);
    expect(getElementByIdSpy).toHaveBeenCalledTimes(1);
    expect(getElementByIdSpy).toHaveBeenCalledWith('prayer-card');
    expect(SharedUI._cache['prayer-card']).toBe(element);
  });

  it('stores and reuses null when element is not found', () => {
    getElementByIdSpy.mockReturnValue(null);

    const first = SharedUI.getDOMElement('missing-id');
    const second = SharedUI.getDOMElement('missing-id');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(getElementByIdSpy).toHaveBeenCalledTimes(1);
    expect(SharedUI._cache['missing-id']).toBeNull();
  });

  it('caches different IDs independently', () => {
    const firstElement = document.createElement('section');
    const secondElement = document.createElement('article');

    getElementByIdSpy.mockImplementation((id) => {
      if (id === 'first') return firstElement;
      if (id === 'second') return secondElement;
      return null;
    });

    const first = SharedUI.getDOMElement('first');
    const second = SharedUI.getDOMElement('second');

    expect(first).toBe(firstElement);
    expect(second).toBe(secondElement);
    expect(getElementByIdSpy).toHaveBeenCalledTimes(2);
    expect(SharedUI._cache.first).toBe(firstElement);
    expect(SharedUI._cache.second).toBe(secondElement);
  });
});
