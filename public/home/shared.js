// Shared bits for the three concepts: a live month (sample salary spread over
// every second), the real bitcoin price, money formatting, and a homography
// that lays a flat element exactly onto a screen in a photo.

window.PF = (function () {
  var NET = 3800; // sample net pay per month (labelled as sample on the page)
  var nl = function (d) { return new Intl.NumberFormat(window.PF_LOCALE || 'nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }); };
  var f2 = nl(2), f3 = nl(3), f0 = nl(0);

  function month() {
    var n = new Date(), s = new Date(n.getFullYear(), n.getMonth(), 1), e = new Date(n.getFullYear(), n.getMonth() + 1, 1);
    var f = (n - s) / (e - s);
    return { f: f, earned: NET * f, perSecond: NET / ((e - s) / 1000) };
  }

  var btc = { eur: null, ch: null };
  function fetchBtc() {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur&include_24hr_change=true')
      .then(function (r) { return r.json(); })
      .then(function (j) { btc.eur = j.bitcoin.eur; btc.ch = j.bitcoin.eur_24h_change; })
      .catch(function () {});
  }
  fetchBtc(); setInterval(fetchBtc, 60000);

  // Solve the 3x3 homography that maps the unit rectangle (0,0)-(w,h) onto
  // four points, and return it as a CSS matrix3d.
  function matrix3d(w, h, q) {
    var src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = q[i][0], v = q[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (var c = 0; c < 8; c++) {
      var p = c;
      for (var r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var t = A[c]; A[c] = A[p]; A[p] = t; var tb = b[c]; b[c] = b[p]; b[p] = tb;
      for (var r2 = c + 1; r2 < 8; r2++) {
        var k = A[r2][c] / A[c][c];
        for (var cc = c; cc < 8; cc++) A[r2][cc] -= k * A[c][cc];
        b[r2] -= k * b[c];
      }
    }
    var s = new Array(8);
    for (var i2 = 7; i2 >= 0; i2--) {
      var sum = b[i2];
      for (var j = i2 + 1; j < 8; j++) sum -= A[i2][j] * s[j];
      s[i2] = sum / A[i2][i2];
    }
    var m = [s[0], s[3], 0, s[6], s[1], s[4], 0, s[7], 0, 0, 1, 0, s[2], s[5], 0, 1];
    return 'matrix3d(' + m.map(function (v) { return v.toFixed(10); }).join(',') + ')';
  }

  // Place `el` (sized w x h) onto a screen quad given in a photo's pixel space,
  // for a photo shown with object-fit: cover inside `box`.
  function onto(el, box, img, quad) {
    var W = box.clientWidth, H = box.clientHeight, s = Math.max(W / img.w, H / img.h);
    var ox = (W - img.w * s) / 2, oy = (H - img.h * s) / 2;
    var q = quad.map(function (p) { return [ox + p[0] * s, oy + p[1] * s]; });
    el.style.transformOrigin = '0 0';
    el.style.transform = matrix3d(el.offsetWidth, el.offsetHeight, q);
  }

  // setNet: the visitor's own pay from the homepage (kept in the page only, never sent).
  function setNet(v) { if (v >= 0 && v < 1e7) NET = v; }
  return { month: month, btc: btc, f2: f2, f3: f3, f0: f0, matrix3d: matrix3d, onto: onto, setNet: setNet, net: function () { return NET; } };
})();
