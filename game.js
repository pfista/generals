var client =  require('./client.js')
var winston = require('winston')
var util = require('./map_utils.js')

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

  constructor(value) {
    this.armies
    this.terrainType = 0;
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

  displayForNum(num) {
    switch (num) {
      case (1):
        console.log(i)
    }

  }

  getIndexFromXY(x, y) {
      return y * this.numCols + x;
  }

  printMaps() {
    for (var r=0; r < this.numRows; r++) {
      var rowString = ''
      for (var j=0; j < this.numCols; j++) {
        rowString += this.map[this.getIndexFromXY(j,r)]
      }
      console.log(rowString)
    }
    console.log()
    for (var r=0; r < this.numRows; r++) {
      var rowString = ''
      for (var j=0; j < this.numCols; j++) {
        rowString += this.terrainMap[this.getIndexFromXY(j,r)]
      }
      console.log(rowString)
    }
  }

  gameUpdateHandler(data) {
    let diff = data[1]
    

    // TODO: update scores
    
    // update turn
    this.turn = diff.turn

    // update attackindex
    this.attackIndex = diff.attackIndex

    // update generals
    this.generalPos = diff.generals[this.playerIndex]
    this.generals = diff.generals.map(position => position)

    /*
      First pass will only update army count per tile. So if you find a tower,
      it will just show up as having some number of armies. but in the first
      pass you don't know what kind of terrain it is, or who owns it

      Second pass will update you on terrain type / ownership

      First pass:
        skips two tiles, 0 indexed i.e. first position starts at index 2
        index, num sequential updates, armie count, ..., index
      
      Second pass:
        >= 0 : owned by player id ✅
        -1 : visible empty space ✅   or visible tower ❓ (towers will have armies)
        -2 : visible mountain ✅
        -3 : invisible empty space ✅
        -4 : invisible obstacle (tower or mountain) ✅
    */

    var i = 0
    var offset = -2 // First offset is off by 2
    var terrainOffset = 0
    if (diff.map_diff[0] == 0) { // special first update
      this.diffSize = diff.map_diff[1]
      this.numRows = diff.map_diff[2]
      this.numCols = diff.map_diff[3]
      this.createMaps(this.numRows, this.numCols)
      for (var i=0; i < this.diffSize/2; i++) {
        this.map[i] = diff.map_diff[i+4]
        log.debug("Setting t[%d]=%d", i-1+this.diffSize/2, diff.map_diff[i+4-1+this.diffSize/2])
        this.terrainMap[i-1+this.diffSize/2] = diff.map_diff[i+4-1+this.diffSize/2]
      }
    }
    else {

      while (i < diff.map_diff.length) {
        offset += diff.map_diff[i] // TODO: first is +2 // 0 
        if (offset >= this.diffSize/2) { break }
        if (offset < -10) { break }

        var numSequentialUpdates = diff.map_diff[++i] // 2
        log.debug('offset %d, seqUpdates: %d', offset, numSequentialUpdates)

        for (var j=1; j <= numSequentialUpdates; j++) {
          log.debug('setting map[%d], from diffmap[%d]=%d', offset+j-1, i+j, diff.map_diff[i+j])
          this.map[offset+j-1] = diff.map_diff[i+j] 
        }
        i += numSequentialUpdates + 1

        terrainOffset += diff.map_diff[i-1+this.diffSize/2]

      }
    }

    this.printMaps()

    // TODO: update cities diff
    for (var i=0; i < diff.cities_diff.length; i++) {

    }

    // TODO: return here, or let bot call generals client when sending actions
    // TODO: tell bot the update has been applied
    //return ['attack', 0, to[toPos], false, this.attackIndex++]
  }

  createMaps(rows, cols) {
    this.map = new Array(rows*cols).fill(0)
    this.terrainMap = new Array(rows*cols).fill(-9)
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
    log.info('Pre game start, %j', data)
  }
  
  // ["game_start",{"playerIndex":0,"replay_id":"Hubx20GBl","chat_room":"game_1483037673430FTtrpyocExTZy84mAAOJ","usernames":["peen 🌸","Anonymous"],"teams":null},null]
  gameStartHandler(data) {
    var json = data[1]

    this.playerIndex = parseInt(json.playerIndex)
    this.replayId = json.replay_id
    this.chatroom = json.chat_room
    this.usernames = json.usernames.map(name => name);
    // TODO: update teams

    log.debug('Game start, %j', json)
    log.info('Player index is %d', this.playerIndex)
    log.info("all players: %s", this.usernames)
  }

  // ["queue_update",2,0,90]
  queueUpdateHandler(data) {
    this.queueSize = data[1]
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
