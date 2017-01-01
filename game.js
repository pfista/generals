var winston = require('winston')
// Setup winston
winston.loggers.add('bot', {
    console: {
      level: process.env.LOG_LEVEL,
      colorize: true,
      label: 'bot',
    },
    file: {
      filename: './bot.log',
      level: 'silly'
    }
  });
var bot_logger = winston.loggers.get('bot');

var client =  require('./client.js')
var board = require('./board.js')
var peenbot = require('./peenbot.js')

var log = new (winston.Logger)();
log.add(winston.transports.Console, {
  /* error, warn, info, verbose, debug, silly. */
  level: process.env.LOG_LEVEL,
  label: 'game',
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true,
});

class Game {
  constructor(x, y) {
    // Map of event type to the appropriate handler function
    this.board = null;
    this.bot = null;
    
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

  // TODO: refactor
  getIndexFromRC(r, c) {
      return r * this.board.numCols + c;
  }

  symbolForTerrain(num) {
    switch (num) {
      case (-1):
        return '⬜️'
      case (-2):
        return '⛰'
      case (-3):
        return '🔲'
      case (-4):
        return '🗻'
      case (0):
        return '😈'
      case (1):
        return '😡'
      case (2):
        return '👹'
      case (3):
        return '🐙'
      case (4):
        return '💩'
      case (5):
        return '🐊'
      case (6):
        return '👻'
      case (7):
        return '🐬'
      default:
        return '❓'
    }
  }

  printMap() {
    bot_logger.info("Turn: %s", this.turn)
    for (var r=0; r < this.board.numRows; r++) {
      var rowString = ''
      for (var c=0; c < this.board.numCols; c++) {
        rowString += ('   ' + parseInt(this.rawMap[2+this.getIndexFromRC(r,c)])+' ').slice(-4)
      }
      bot_logger.info(rowString)
    }
    bot_logger.info(rowString)
    for (var r=0; r < this.board.numRows; r++) {
      var rowString = ''
      for (var c=0; c < this.board.numCols; c++) {
        rowString += this.symbolForTerrain(this.rawMap[2+this.getIndexFromRC(r,c)+this.board.numRows*this.board.numCols]) + ' '
      }
      bot_logger.info(rowString)
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

    this.updateRawMap(diff.map_diff)
    this.updateBoard()
    this.printMap()
    var atk = this.bot.getMove();
    if (atk) {
      return ['attack', atk.from.position, atk.to.position, atk.half, this.attackIndex++];
    }
    
    // TODO: update cities diff
    // TODO: return here, or let bot call generals client when sending actions
    // TODO: tell bot the update has been applied
    //return ['attack', 0, to[toPos], false, this.attackIndex++]
  }

  /*
    1st half of map_diff represents army counts on the map
      skips two tiles, 0 indexed i.e. first position starts at index 2
      index, num sequential updates, armie count, ..., index
    
    2nd half of map diff represents terrain type and land owners
      >= 0 : owned by player id
      -1 : visible empty space or visible tower (towers will have armies)
      -2 : visible mountain
      -3 : invisible empty space
      -4 : invisible obstacle (tower or mountain)
  */
  updateRawMap(diff) {
    if (diff[0] == 0){
      this.rawMap = new Array(diff[1])
      let numCols = diff[2]
      let numRows = diff[3]
      this.board = new board.Board(numRows, numCols, this.generalPos)
      this.bot = new peenbot.Bot(this.playerIndex, this.board)
    }
    var i = 0
    var cursor = 0
    var numSequentialChanges
    while (i < diff.length) {
        cursor += diff[i++]
        numSequentialChanges = diff[i++]
      for (var j=0; j<numSequentialChanges; j++) {
        this.rawMap[cursor++] = diff[i++]
      }
    }
  }

  updateBoard() {
    for (var i=0; i < this.board.length; i++) { 
      this.board.tiles[i].armies = this.rawMap[i+2]
      this.board.tiles[i].terrainType = this.rawMap[i+2+this.board.length]
      this.board.tiles[i].position = i
    }
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
