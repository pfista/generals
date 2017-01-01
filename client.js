var winston = require('winston')
var WebSocket = require('ws')

var w = new (winston.Logger)();
w.add(winston.transports.Console, {
  /* error, warn, info, verbose, debug, silly. */
  level: process.env.LOG_LEVEL,
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true,
});

const CONNECTED = 0
const ACK = 3
const INITIALIZED = 40
const MESSAGE = 42

class GeneralsClient {

  constructor(game) {
    this.game = game
    this.gws = new GeneralsWS(this)
  }

  eventHandler(data) {
    w.debug("In event handler with data: %s", data)
    var msgType = parseInt(data, 10)
    var jsonIndex = data.search(/\D/)
    if (jsonIndex >= 0) {
      var json = JSON.parse(data.substring(jsonIndex, data.length))
      w.debug("%j", json)
    }

    if (msgType == CONNECTED) {
      w.debug('connected to gio')
    }
    else if (msgType == INITIALIZED) {
      setInterval(this.heartbeat.bind(this), 10000) // TODO: use sid info
      w.debug('gio setup complete')
      this.joinCustomGame('pfistabot', 'pfister', '🤖')
    }
    else if (msgType == ACK) {
      w.debug('ack')
    }
    else if (msgType == MESSAGE) {
      w.debug('got message')
      var res = this.game.update(json)
      if (res) {
        this.send.apply(this, res);
      }
    }
  }

  heartbeat() {
    w.debug("sending 2")
    this.gws.send('2', this.handleError)
  }

  send() {
    var data = '42'+JSON.stringify(Array.from(arguments))
    w.debug("client send %s", data)
    this.gws.send(data, this.handleError)
  }

  async joinCustomGame(userId, roomId, username) {
    w.info("Joining custom game")
    this.send('stars_and_rank', userId)
    await sleep(50)
    this.send('join_private', roomId, username, userId) 
    await sleep(50)
    this.setUsername(userId, username)
    await sleep(50)
    this.setForceStart(true, roomId)
  }


  /*
   * user_id -
   * username -
   */
  setUsername(user_id, username) {
    this.send('set_username', user_id, username)
  }

  /**
   * shouldForce - 
   * room_id -
   */
  setForceStart(shouldForce, room_id) {
    this.send('set_force_start', room_id, shouldForce)
  }

  /**
   * old_xy - 
   * new_xy - 
   * half -
   * attackIndex -
   */
  attack(old_xy, new_xy, half, attackIndex) {
    this.send('attack', old_xy, new_xy, is50, attackIndex)
  }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class GeneralsWS {
  constructor(client) {
    this.ws = WebSocket('ws://ws.generals.io/socket.io/?EIO=3&transport=websocket', {
      origin: 'http://michaelpfister.com', })

    this.ws.on('open', function open() {
      w.info("connected")
    })

    this.ws.on('close', function close() {
      w.info('disconnected');
    })

    this.ws.on('message', function(data, flags) {
      w.debug('data: %s', data)
      client.eventHandler(data)
    }.bind(client))

    this.ws.on('error', function(error) {
      w.error(error)
    })

    this.ws.on('unexpected-response', function(req, res) {
      w.error(req)
      w.error(res)
    })
  }

  send(data){
    w.debug("ws sending %s", data)
    this.ws.send(data, function ack(error) {
      if (error) {
        w.error(error)
        this.gws.close()
        process.exit(1)
      }

    })
  }
}

module.exports.GeneralsClient = GeneralsClient
