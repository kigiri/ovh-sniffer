var _text = 'nothing';
var _time = Date.now();

function _replaceText(msg) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(msg);
}

function toSecond(timestamp) {
  return (timestamp / 1000).toFixed(2) + ' seconds';
}


var refreshDisplay = (function () {
  lastText = '';
  return function () {
    var now = Date.now();
    var txt;
    if (_time > now) {
      txt = _text + ' in ' + toSecond(_time - now);
    } else {
      txt = toSecond(now - _time) + ' elapsed since ' + _text;
    }
    if (txt !== lastText) {
      _replaceText(txt);
      lastText = txt;
    }
  }

})();

module.exports = {
  init: function () {
    setInterval(refreshDisplay, 100);
  },
  setState: function (timestamp, prefix) {
    _text = prefix;
    _time = timestamp;
  }
};
