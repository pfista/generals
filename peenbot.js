var attack = require('./attack.js');

class Bot {
      
  constructor(player_index, board) {
    this.playerIndex;
    this.board = board;
    this.general = this.board.getGeneral();
    this.searchQueue = null;
    this.attachQueue = [];
  }

  breadthFirst() {
    if (!this.searchQueue) {
      this.searchQueue = [this.general];
    }
    
    while (this.search)
    var tile = this.searchQueue.shift();
    
    adjacents = tile.getAdjacent();
    for (var i=0;i<adjacents.length;i++) {
      atile = adjacents[i];
      if (atile.reachable()) {
        this.searchQueue.push(atile);
      }
    }
  }
  
  getMove() {
    return this.breadthFirst();
  }

    //var from = [this.lastAttackPos, this.generalPos]
    //var fromPos = parseInt(Math.random()*2)
    
    //var to = [from[fromPos]-1, from[fromPos]+1,  from[fromPos]-this.numCols, from[fromPos]+this.numCols]
    //var toPos = parseInt(Math.random()*4)
    
    //this.lastAttackPos = to[toPos]
    //log.info("Going %d", to[toPos])
}

module.exports.Bot = Bot