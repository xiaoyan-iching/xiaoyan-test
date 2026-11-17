/*
 * 三明治易起走｜瀏覽器端登記紀錄（localStorage）
 * 無痕模式或儲存被封鎖時不會報錯，只是不保存；頁面一律另外提供「手動輸入識別碼」補救。
 */
(function (root) {
  'use strict';
  var KEY = 'xy_registrations_v1';
  var CUR = 'xy_current_rid_v1';

  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function all() {
    try { var a = JSON.parse(safeGet(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveAll(list) { return safeSet(KEY, JSON.stringify(list.slice(-20))); }

  function get(rid) {
    var r = root.XYCore.normalizeRid(rid);
    return all().filter(function (x) { return x.rid === r; })[0] || null;
  }

  function upsert(rid, patch) {
    var r = root.XYCore.normalizeRid(rid);
    var list = all();
    var found = null;
    list.forEach(function (x) { if (x.rid === r) found = x; });
    if (!found) { found = { rid: r, createdAt: new Date().toISOString(), status: 'registered', code: null }; list.push(found); }
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) found[k] = patch[k];
    found.updatedAt = new Date().toISOString();
    var ok = saveAll(list);
    return { record: found, persisted: ok };
  }

  function setCurrent(rid) { return safeSet(CUR, root.XYCore.normalizeRid(rid)); }
  function getCurrent() {
    var r = safeGet(CUR);
    return r && root.XYCore.isValidRid(r) ? r : null;
  }
  function storageWorks() {
    var t = '__xy_test__';
    if (!safeSet(t, '1')) return false;
    try { root.localStorage.removeItem(t); } catch (e) {}
    return true;
  }

  root.XYStore = { all: all, get: get, upsert: upsert, setCurrent: setCurrent, getCurrent: getCurrent, storageWorks: storageWorks };
})(window);
