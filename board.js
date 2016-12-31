var tile = require('./tile.js')

class Board {
  constructor(numRows, numCols) {
    this.tiles = new Array(numRows*numCols).fill(new tile.Tile())
    this.numRows = numRows
    this.numCols = numCols
    this.length = numRows*numCols
  }

  /* Returns a tile for this players general
   */
  getGeneral() {

  }

  /* Returns all valid tiles that are directly adjacent to this tile, not
   * including diagonally adjacent tiles
   */
  getAdjacent() {

  }


  /* Returns all valid tiles that are a neighbor to this tile, which includes
   * diagonally adjacent tiles. 
   */
  getNeighbors() {

  }


  /* Returns an array of all tiles for a given player index
   */
  allTilesforPlayer(playerIndex) {

  }

  /* doesn't include armies */
  shortestDistance(tileA, tileB) {

  }

  /* includes armies */
  shortestWeightedDistance(tileA, tileB) {

  }

}

module.exports.Board = Board
