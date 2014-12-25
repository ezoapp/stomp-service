'use strict';

var factory = require('./factory');

function StompService(queueParams, connOpts) {
  this.subs_ = queueParams.subscribeMappings || [];
  this.pubs_ = queueParams.sendTos || [];
  this.opts_ = connOpts;
}

function connect(o, callback) {
  o.sokt_ = factory.createSocket(o.opts_);
  o.sokt_.connect(o.opts_, function () {
    o.status = 'ready';
    callback && callback();
  }, function () {
    unsubscribe(o);
    disconnect(o);
  });
}

function subscribe(o) {
  o.subs_.forEach(function (dest) {
    var sock = o.sokt_;
    if (typeof dest === 'string') {
      sock.subscribe(dest, newMsgHandler(o, dest));
    } else {
      var headers = dest;
      dest = headers.destination;
      delete headers['destination'];
      sock.subscribe(dest, newMsgHandler(o, dest), headers);
    }
  });

  function newMsgHandler(o, dest) {
    return function onMessage(message) {
      var retDest = message.headers['reply-to'] || dest,
        pubs = o.pubs_,
        sock = o.sokt_,
        handler = o.hdlr_;

      handler.apply(o, [message.body, message.headers, reply, {
        message: message,
        socket: sock
      }]);

      function reply(ret) {
        ret = typeof ret === 'string' ? ret : JSON.stringify(ret);
        if (pubs.length === 0) {
          sock.send(retDest, {}, ret);
        } else {
          pubs.forEach(function (dest) {
            if (typeof dest === 'string') {
              sock.send(dest, {}, ret);
            } else {
              var headers = dest;
              dest = headers.destination || retDest;
              delete headers['destination'];
              sock.send(dest, headers, ret);
            }
          });
        }
      }
    };
  }
}

function unsubscribe(o) {
  var sock = o.sokt_;
  Object.keys(sock.subscriptions).forEach(function (sub) {
    sock.unsubscribe(sub);
  });
}

function disconnect(o, callback) {
  o.sokt_.disconnect(function () {
    o.sokt_ = null;
    o.status = 'stopped';
    callback && callback();
  });
}

StompService.prototype.start = function (handler) {
  var self = this;
  self.hdlr_ = handler;
  connect(self, function () {
    subscribe(self);
  });
};

StompService.prototype.suspend = function () {
  if (this.status === 'ready') {
    unsubscribe(this);
    this.status = 'suspended';
  }
};

StompService.prototype.restore = function () {
  if (this.status === 'suspended') {
    subscribe(this);
    this.status = 'ready';
  }
};

StompService.prototype.stop = function (callback) {
  disconnect(this, callback);
};

module.exports = StompService;
