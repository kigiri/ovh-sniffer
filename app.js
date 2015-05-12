var conf = require('./config');
var logger = require('./logger');
var notif = require('./notif')(conf);
var request = require('request');
var fs = require('fs');

var callOVHApi = (function () {
  var url = 'https://ws.ovh.com/dedicated/r2/ws.dispatcher/getAvailability2';

  function genCallback(cb) {
    var timestamp = Date.now();
    logger.setState(timestamp, 'last ovh server call.');
    return function (err, res, body) {
      try {
        var bodyToData = JSON.parse(body);
        cb(bodyToData, body, (Date.now() - timestamp));
      } catch (err) {
        console.log(err, 'Error parsing json:', body, '\nRetrying...');
        callOVHApi(cb);
      }
    };
  }

  return function (cb) {
    request.get(url, genCallback(cb));
  }
})();

function testZone(zoneArray) {
  var results = [];
  for (var i = 0; i < zoneArray.length; i++) {
    var availability = zoneArray[i].availability
    if (availability !== 'unknown' && availability !== 'unavailable') {
      var obj = {};
      obj[zoneArray[i].zone] = availability
      results.push(obj);
    }
  }
  return results;
}

var checkServer = (function () {
  kimsufiData = {
    '150sk60': 'KS-6: 2.40 GHz (x16), 24 Go RAM, 2 To @ 29,99 € HT / mois',
    '150sk50': 'KS-5: 2.00 GHz (x8), 16 Go RAM, 2 To @ 24,99 € HT / mois',
    '150sk40': 'KS-4: 2.66 GHz (x8), 16 Go RAM, 2 To @ 19,99 € HT / mois',
    '150sk30': 'KS-3: 2.67 GHz (x4), 16 Go RAM, 2 To @ 14,99 € HT / mois',
    '150sk22': 'KS-2: 1.86 GHz (x4), 4 Go RAM, 40 Go SSD @ 9,99 € HT / mois',
    '150sk20': 'KS-2: 1.86 GHz (x4), 4 Go RAM, 1 To @ 9,99 € HT / mois',
    '150sk10': 'KS-1: 1.86 GHz (x4), 2 Go RAM, 500 Go @ 4,99 € HT / mois',
  }
  previousInfos = {};
  return function (serv) {
    if (!/^150sk30/.test(serv.reference)) { return; } // only test kimsufi servers
    var results = testZone(serv.zones).concat(testZone(serv.metaZones));
    var total = results.length
    if (total) {
      var mobileTextMsg = '';
      for (var i = 0; i < total; i++) {
        var res = results[i];
        var buff = '';
        for (var key in res) {
          var refKey = serv.reference + key;
          if (previousInfos[refKey] !== res[key]) {
            previousInfos[refKey] = res[key];
            buff += ((buff.length) ? ', ' : '') + res[key] + '('+ key +')';
          }
        }
        if (buff.length) {
          mobileTextMsg += '\n' + buff;
        }
      }
      if (mobileTextMsg.length) {
        notif.send(kimsufiData[serv.reference] + mobileTextMsg + '\n'
          + 'https://www.kimsufi.com/fr/commande/kimsufi.xml?reference=' + serv.reference);
        console.log('https://www.kimsufi.com/fr/commande/kimsufi.xml?reference=' + serv.reference);
      }
    } else {
      var cleanedUp = false;
      for (var key in previousInfos) {
        if (key.indexOf(serv.reference) !== -1) {
          cleanedUp = true;
          delete previousInfos[key];
        }
      }
      if (cleanedUp) {
        console.log(serv.reference + ' not available anymore :(');
      }
    }
  }
})();

function loopOnServers(serverArray) {
  for (var i = 0; i < serverArray.length; i++) {
    checkServer(serverArray[i]);
  };
}

function parseServerInfo(serverInfo, rawData, timespend) {
  if (serverInfo.error !== null) {
    setTimeout(callOVHApi, 10000, parseServerInfo);
    return console.log(serverInfo.error, 'retry in 10sec...');
  }
  var stream = fs.createWriteStream(conf.filename);
  stream.write(rawData);
  stream.end();

  loopOnServers(serverInfo.answer.availability);
  var delay = Math.max(conf.refreshDelay - timespend, 0);
  logger.setState(Date.now() + delay, 'Next api call');
  setTimeout(callOVHApi, delay, parseServerInfo);
}

function init() {
  var previousData;
  try {
    previousData = fs.readFileSync(conf.filename);
    try {
      var previousData = JSON.parse(previousData);
      console.log('recoverd data from', conf.filename);
      loopOnServers(previousData.answer.availability);
    } catch (err) { console.log (err); } // ill formated file ?
  } catch (err) {
    // silence the error if file doesnt exist
    if (err.code !== 'ENOENT') {
      console.log(err);
    }
  }
  callOVHApi(parseServerInfo);
  logger.init();
}

init();
