/*
 * 三明治易起走｜小衍結果頁「提交本次卦象」
 * 只讀取原程式的 lineValues 與 #sixDigits，不呼叫、不修改任何洗牌／抽牌／分堆／爻值計算。
 *
 * 提交方式：在新分頁開啟 Apps Script 網頁應用程式的確認頁（頂層頁面瀏覽，不用 fetch），
 * 由該頁在 Google 端完成寫入並顯示結果。這樣不受 GitHub Pages 與 Apps Script 跨來源限制影響。
 */
(function () {
  'use strict';
  var C = window.XY_CONFIG || {}, core = window.XYCore, store = window.XYStore;
  if (!core || !store) return;

  function readLineValues() {
    // 原程式以頂層 let 宣告 lineValues，同頁其他 script 可直接讀取（唯讀使用，複製一份）
    try { return typeof lineValues !== 'undefined' && Array.isArray(lineValues) ? lineValues.slice() : []; } // eslint-disable-line no-undef
    catch (e) { return []; }
  }

  // ---- 介面 ----
  var css = document.createElement('style');
  css.textContent = '.xy-submit{margin-top:18px;padding:16px;background:#fffdf6;border:1px solid #d8d0bd;border-radius:13px}' +
    '.xy-submit h2{margin:0 0 8px;font-size:18px}.xy-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
    '.xy-rid{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;letter-spacing:1px}' +
    '.xy-submit input{font:inherit;padding:10px;border:1px solid #c7bda9;border-radius:9px;min-width:0;flex:1 1 260px;text-transform:uppercase}' +
    '.xy-msg{font-size:14px;margin:8px 0 0}.xy-msg.err{color:#812f27}.xy-msg.ok{color:#2f5f3a}.xy-note{color:#6c756d;font-size:13px;margin:6px 0 0}' +
    '.xy-env{display:inline-block;background:#9b6b24;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;margin-left:6px}';
  document.head.appendChild(css);

  var box = document.createElement('section');
  box.className = 'xy-submit';
  box.id = 'xySubmit';
  box.setAttribute('aria-live', 'polite');
  box.innerHTML =
    '<h2>提交本次卦象' + (C.env === 'test' ? '<span class="xy-env">測試環境</span>' : '') + '</h2>' +
    '<div class="xy-row"><span>登記識別碼：</span><span id="xyRidText" class="xy-rid">—</span>' +
    '<button id="xyChangeRid" type="button">更換</button></div>' +
    '<div class="xy-row" id="xyRidInputRow" hidden><input id="xyRidInput" autocomplete="off" spellcheck="false" placeholder="XY-XXXX-XXXX-XXXX-XXXX-X" aria-label="登記識別碼">' +
    '<button id="xyRidSave" type="button">使用這組識別碼</button></div>' +
    '<div class="xy-row"><button id="xySubmitBtn" type="button" disabled>提交本次卦象</button></div>' +
    '<p id="xyMsg" class="xy-msg"></p>' +
    '<p class="xy-note">按下後會開啟 Google 的確認頁面，在那裡完成送出。若網路中斷，可以回到這裡再按一次，系統不會重複寫入。</p>';
  var anchor = document.querySelector('.line-results');
  (anchor && anchor.parentNode ? anchor.parentNode : document.body).insertBefore(box, anchor ? anchor.nextSibling : null);

  var $ = function (id) { return document.getElementById(id); };
  var rid = null;

  function msg(text, kind) { var m = $('xyMsg'); m.textContent = text; m.className = 'xy-msg' + (kind ? ' ' + kind : ''); }

  function setRid(r, persist) {
    rid = core.isValidRid(r) ? core.normalizeRid(r) : null;
    $('xyRidText').textContent = rid ? core.formatRid(rid) : '尚未設定';
    $('xyRidInputRow').hidden = !!rid;
    if (rid && persist) { store.upsert(rid, {}); store.setCurrent(rid); }
    refresh();
  }

  function currentCode() {
    // 優先使用本頁剛完成的六爻；若本頁尚未完成，使用這個識別碼先前保存但未確認送出的六碼（網路中斷補救）
    var live = core.sixCodeFromLineValues(readLineValues());
    if (live) return { code: live, source: 'live' };
    var rec = rid && store.get(rid);
    if (rec && rec.code && core.isValidSixCode(rec.code) && rec.status !== 'submitted') return { code: rec.code, source: 'saved' };
    return null;
  }

  function refresh() {
    var btn = $('xySubmitBtn');
    var c = currentCode();
    var rec = rid && store.get(rid);
    if (!C.submitEndpoint) { btn.disabled = true; msg('提交服務尚未設定（管理者請見 docs/SETUP.md）。', 'err'); return; }
    if (!rid) { btn.disabled = true; msg('請輸入你在登記頁取得的識別碼。', ''); return; }
    if (rec && rec.status === 'submitted') { btn.disabled = true; msg('這組識別碼已完成提交（六碼 ' + (rec.code || '') + '）。若要問新的問題，請回登記頁產生新識別碼。', 'ok'); return; }
    if (!c) { btn.disabled = true; msg('六爻完成後即可提交。', ''); return; }
    // 六爻一完成就保存，避免重新整理或關閉分頁後遺失（不覆蓋已提交的紀錄）
    if (c.source === 'live' && (!rec || rec.code !== c.code)) store.upsert(rid, { code: c.code, status: 'drawn' });
    btn.disabled = false;
    msg(c.source === 'saved' ? '找到上次完成但尚未確認送出的卦象：' + c.code + '，可直接重新提交，不必重新起卦。' : '六碼：' + c.code + '（初爻→上爻）', '');
  }

  $('xyChangeRid').addEventListener('click', function () { $('xyRidInputRow').hidden = false; $('xyRidInput').focus(); });
  $('xyRidSave').addEventListener('click', function () {
    var v = $('xyRidInput').value;
    if (!core.isValidRid(v)) { msg('識別碼格式不正確，請再核對一次（共 19 碼，XY 開頭）。', 'err'); return; }
    setRid(v, true);
  });

  $('xySubmitBtn').addEventListener('click', function () {
    var c = currentCode();
    if (!rid || !c) { refresh(); return; }
    if (!core.isValidSixCode(c.code)) { msg('六碼不完整或格式錯誤，無法提交。', 'err'); return; }
    // 先存下來：送出途中斷線、關掉分頁，回來都能用同一組六碼重送
    store.upsert(rid, { code: c.code, status: 'pending' });
    var u = new URL(C.submitEndpoint);
    u.searchParams.set('rid', core.formatRid(rid));
    u.searchParams.set('code', c.code);
    var w = window.open(u.toString(), '_blank');
    if (w) { try { w.opener = null; } catch (e) {} } else location.href = u.toString(); // 彈出視窗被擋時改為本頁前往（六碼已保存）
    msg('已開啟確認頁面。請在新分頁按「確認送出」，看到成功訊息即完成。', '');
  });

  // Apps Script 結果頁的「回到小衍」連結會帶 xy_result；僅用於本機顯示，不作為資料依據
  var params = new URLSearchParams(location.search);
  var urlRid = params.get('rid');
  if (urlRid && core.isValidRid(urlRid)) setRid(urlRid, true);
  else setRid(store.getCurrent(), false);
  var result = params.get('xy_result');
  if (rid && (result === 'OK_WRITTEN' || result === 'OK_ALREADY')) { store.upsert(rid, { status: 'submitted' }); refresh(); }

  // 監看原程式的六碼顯示；完成時自動啟用按鈕
  var sd = document.getElementById('sixDigits');
  if (sd && window.MutationObserver) new MutationObserver(refresh).observe(sd, { childList: true, characterData: true, subtree: true });
})();
