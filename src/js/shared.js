const SharedUI = {
  _cache: {},

  /**
   * Helper to get cached DOM element
   * @param {string} id - The element ID
   * @returns {HTMLElement|null}
   */
  getDOMElement: function (id) {
    if (!(id in this._cache)) {
      this._cache[id] = document.getElementById(id);
    }

    return this._cache[id];
  },
};

export default SharedUI;
