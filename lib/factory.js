'use strict';

var Stomp = require('stompjs'),
  util = require('util');

var Factory = {

  createSocket: function (connOpts) {
    var socket = Stomp.overTCP(connOpts.host, connOpts.port);
    connOpts.debug && (socket.debug = util.debug);
    return socket;
  }

};

module.exports = Factory;
