/* 查房本 离线缓存 Service Worker（由构建脚本生成，版本号随内容自动变化） */
var CACHE = 'wardround-15d0bb3063';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 万一"联网拿新版"和"缓存"都不成（比如国内网络连不上 GitHub  Pages），
   也绝不能给用户一个白屏——给一张说明页，告诉他怎么办。 */
var OFFLINE_HTML = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>查房本</title></head>' +
  '<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;' +
  'background:#f2f4f7;color:#1b2430;line-height:1.8;font-size:16px">' +
  '<h2 style="font-size:19px;margin:8px 0 12px">查房本暂时打不开</h2>' +
  '<p>本机的患者数据没有丢，只是这次没能把页面取回来。</p>' +
  '<p style="background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:14px">' +
  '<b>请按顺序试：</b><br>' +
  '1. 换成 WiFi 或流量，再点一次图标<br>' +
  '2. 打开手机浏览器（Safari / Chrome），访问你保存的那个网址，能打开就再点图标<br>' +
  '3. 都不行：用 Safari 打开网址，用「分享 → 添加到主屏幕」重新装一个图标（数据不会丢）</p>' +
  '<p style="color:#64748b;font-size:14px">注意：请在同一个网址下操作，数据是按网址分开存的。</p>' +
  '</body></html>';

/* 给任何一步加超时：网络卡住时先拿缓存顶上，页面照样能打开 */
function withTimeout(p, ms) {
  return new Promise(function (res) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; res(null); } }, ms);
    p.then(function (v) { if (!done) { done = true; clearTimeout(t); res(v); } },
           function () { if (!done) { done = true; clearTimeout(t); res(null); } });
  });
}

function offlinePage() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function fetchPage(req) {
  /* 联网取新版；拿到了就顺手更新缓存 */
  var net = fetch(req).then(function (res) {
    if (res && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
    }
    return res;
  }).catch(function () { return null; });
  /* 2.5 秒还没回来就先用缓存把页面打开（后台继续更新缓存，下次打开就是新版） */
  return withTimeout(net, 2500).then(function (res) {
    if (res) return res;
    return caches.match('./index.html').then(function (hit) {
      if (hit) return hit;
      return net.then(function (r) { return r || offlinePage(); });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  /* 页面导航：优先联网拿新版，网络慢/断网时用缓存兜底，兜不住就给说明页 */
  if (req.mode === 'navigate') {
    e.respondWith(fetchPage(req));
    return;
  }

  /* 其他资源：先用缓存，保证离线可用 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
