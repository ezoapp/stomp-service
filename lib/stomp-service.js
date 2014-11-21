'use strict';

var factory = require('./factory');

function StompService(queueParams, connOpts) {
  this.subs_ = queueParams.subscribeMappings || [];
  this.pubs_ = queueParams.sendTos || [];
  this.opts_ = connOpts;
}

StompService.prototype.listen = function (handler) {
  var self = this,
    subs_ = self.subs_,
    pubs_ = self.pubs_,
    opts_ = self.opts_,
    socket_;

  socket_ = self.socket_ = factory.createSocket(opts_);
  socket_.connect(opts_, connectedCallback, errorCallback);

  function connectedCallback() {
    subs_.forEach(function (dest) {
      if (typeof dest === 'string') {
        socket_.subscribe(dest, messageHandler(dest));
      } else {
        var headers = dest;
        dest = headers.destination;
        delete headers['destination'];
        socket_.subscribe(dest, messageHandler(dest), headers);
      }
    });
  }

  function errorCallback() {
    self.destroy();
  }

  function messageHandler(dest) {
    return function onMessage(message) {
      var retDest = message.headers['reply-to'] || dest;

      handler.apply(self, [message.body, message.headers, reply, {
        message: message,
        socket: socket_
      }]);

      function reply(ret) {
        ret = typeof ret === 'string' ? ret : JSON.stringify(ret);
        if (pubs_.length === 0) {
          socket_.send(retDest, {}, ret);
        } else {
          pubs_.forEach(function (dest) {
            if (typeof dest === 'string') {
              socket_.send(dest, {}, ret);
            } else {
              var headers = dest;
              dest = headers.destination || retDest;
              delete headers['destination'];
              socket_.send(dest, headers, ret);
            }
          });
        }
      }
    };
  }
};

StompService.prototype.destroy = function (callback) {
  var self = this,
    socket_ = self.socket_;

  if (socket_ && socket_.connected) {
    Object.keys(socket_.subscriptions).forEach(function (sub) {
      socket_.unsubscribe(sub);
    });
    socket_.disconnect(function () {
      self.socket_ = null;
      callback && callback();
    });
  } else {
    self.socket_ = null;
    callback && callback();
  }
};

module.exports = StompService;
