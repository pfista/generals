var client =  require('./client.js')
var winston = require('winston')

var log = new (winston.Logger)();
log.add(winston.transports.Console, {
  /* error, warn, info, verbose, debug, silly. */
  level: process.env.LOG_LEVEL,
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true,
});

class Tile {
  /* 
  *  1 : your general
  * -1 : visible empty spot 
  * -2 : visible mountain
  *  -3 : invisible empty space
  *  -4 : invisible obstacle (tower or mountain)
    *
  */

  constructor(value) {
    this.armies
    this.terrainType = // 1 2 3 3 4
    this.playerIndex // Owner of the cell
  }



}

class Game {
  constructor(x, y) {
    // Map of event type to the appropriate handler function
    this.created = false
    this.turn = 0
    this.attackIndex = 0

    this.handle = {
      'stars' : this.starsHandler.bind(this),
      'rank': this.rankHandler.bind(this),
      'queue_update': this.queueUpdateHandler.bind(this),
      'pre_game_start':this.preGameStartHandler.bind(this),
      'game_start': this.gameStartHandler.bind(this),
      'game_update': this.gameUpdateHandler.bind(this),
      'game_won': this.gameWonHandler.bind(this),
      'game_lost': this.gameLostHandler.bind(this),
      'chat_message': this.chatMessageHandler.bind(this),
    }
  }
  
  update(data) {
    log.verbose(data[0])
    if (!(data[0] in this.handle)) {
      throw new Error("Unhandled message error: %s", data[0])
    }

    return this.handle[data[0]](data)
  }

  // index 0: ??
  // index 1: length of rest of array
  // row size
  // column size
  // x*y of bools, what you own
  //
  // data: 42["game_update",{"scores":[{"total":12,"tiles":3,"i":0,"dead":false},{"total":12,"tiles":3,"i":1,"dead":false}],"turn":22,"attackIndex":20,"generals":[69,-1],"map_diff":[71,1,2,578],"cities_diff":[0]},null]

  gameUpdateHandler(data) {
    let diff = data[1]
    //this.scoresDiff = diff.scores
    //this.generals = diff.generals
    //this.mapDiff = diff.map_diff
    //this.citiesDiff = diff.cities_diff
    
    this.turn = diff.turn
    this.attackIndex = diff.attackIndex

    if (!this.created) {

      this.numRows = diff.map_diff[2]
      this.numCols = diff.map_diff[3]
      this.createMap(this.numRows, this.numCols)

      this.generalPos = diff.generals[this.playerIndex]
      this.attackIndex = 0

      this.created = true
    }
    else {
      var from = [this.lastAttackPos, this.generalPos]
      var fromPos = parseInt(Math.random()*2)

      var to = [from[fromPos]-1, from[fromPos]+1,  from[fromPos]-this.numCols, from[fromPos]+this.numCols]
      var toPos = parseInt(Math.random()*4)

      this.lastAttackPos = to[toPos]
      log.info("Going %d", to[toPos])
      return ['attack', from[fromPos], to[toPos], false, this.attackIndex++]
    }
  }

  createMap(rows, cols) {
    this.map = new Array(rows*cols)
  }


  // ["stars",{"duel":69.98790990323106}]
  // ["stars",{"ffa":69.67311444703878}]
  starsHandler(data) {
    log.info("Game got stars update")
  }

  // ["rank",{"duel":262}]
  // ["rank",{"ffa":2189}]
  rankHandler(data) {

  }

  // ["pre_game_start"]
  preGameStartHandler(data) {
    // TODO: possible setup here?
    log.info('Pre game start, %j', data)
  }
  
  // ["game_start",{"playerIndex":0,"replay_id":"Hubx20GBl","chat_room":"game_1483037673430FTtrpyocExTZy84mAAOJ","usernames":["peen 🌸","Anonymous"],"teams":null},null]
  gameStartHandler(data) {
    log.info('Game start, %j', data)
    this.playerIndex = parseInt(data[1]['playerIndex'])
    log.info('Player index is %d', this.playerIndex)
  }

  // ["queue_update",2,0,90]
  queueUpdateHandler(data) {
    log.info("Game got queue update")
  }

  // ["game_won",null,null]
  gameWonHandler(data) {

  }

  // ["game_lost",{"killer":0},null]
  gameLostHandler(data) {

  }

  // ["chat_message","game_1483037673430FTtrpyocExTZy84mAAOJ",{"text":"peen 🌸 captured Anonymous."}]
  // { username: 'peen 🌸', text: 'asdf', playerIndex: 1 }
  chatMessageHandler(data) {
    var msg = data[2]
    log.info('%s: %s', msg['username'], msg['text'])
  }

}

var game = new Game()
var gc = new client.GeneralsClient(game)
