var tile = require('./tile.js')

class Board {
  constructor(numRows, numCols, generalPos) {
    this.tiles = new Array(numRows*numCols).fill(new tile.Tile())
    this.numRows = numRows
    this.numCols = numCols
    this.length = numRows*numCols
    this.generalPos = generalPos
  }

  /* Returns a tile for this players general
   */
  getGeneral() {
    return this.tiles[this.generalPos]
  }

  /* Returns all valid tiles that are directly adjacent to this tile, not
   * including diagonally adjacent tiles
   */
  getAdjacents(tile) {
    index = this.tiles.indexOf(tile) // TODO: check this
    var l = this.tiles[index-1]
    var r = this.tiles[index+1]
    var u = this.tiles[index-this.numRows]
    var d = this.tiles[index+this.numRows]
    return [l, u, r, d]
  }


  /* Returns all valid tiles that are a neighbor to this tile, which includes
   * diagonally adjacent tiles. 
   */
  getNeighbors(tile) {
    var result = getAdjacents(tile)
    index = this.tiles.indexOf(tile)
    var ul = index-1-this.numRows
    var ur = index+1-this.numRows
    var dl = index-1+this.numRows
    var dr = index+1+this.numRows
    result.push(ul, ur, dl, dr)
    return result
  }


  /* Returns an array of all tiles for a given player index
   */
  allTilesforPlayer(playerIndex) {
    var result = []
    for (var i=0; i<this.tiles.length; i++) {
      if (this.tiles[i].terrainType == playerIndex){
        result.push(this.tiles[i])
      }
    }
    return result
  }

  /* doesn't include armies */
  shortestDistance(tileA, tileB) {

  }

  /* includes armies */
  shortestWeightedDistance(tileA, tileB) {

  }
}

module.exports.Board = Board
