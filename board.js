var tile = require('./tile.js')

class Board {
  constructor(numRows, numCols, generalPos) {
    this.tiles = []
    for (var i=0; i<numCols*numRows; i++) {
      this.tiles[i] = new tile.Tile()
    }
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
    var candidates = []
    candidates.push(this.tiles[tile.position-1])
    candidates.push(this.tiles[tile.position+1])
    candidates.push(this.tiles[tile.position-this.numRows])
    candidates.push(this.tiles[tile.position+this.numRows])
    var result = []
    for (var i=0; i<candidates.length; i++){
      if (candidates[i]) {
        result.push(candidates[i])
      }
    }
    return result
  }


  /* Returns all valid tiles that are a neighbor to this tile, which includes
   * diagonally adjacent tiles. 
   */
  getNeighbors(tile) {
    var result = this.getAdjacents(tile)
    var candidates = []
    candidates.push(this.tiles[tile.position-1-this.numRows])
    candidates.push(this.tiles[tile.position+1-this.numRows])
    candidates.push(this.tiles[tile.position-1+this.numRows])
    candidates.push(this.tiles[tile.position+1+this.numRows])
    for (var i=0; i<candidates.length; i++){
      if (candidates[i]) {
        result.push(candidates[i])
      }
    }

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
  shortestDistance(fromTile, toTile) {
    return shortestPath(fromTile, toTile).length
  }

  /* Returns an array of tiles in the shortest path from A to B with the shortest path */
  shortestPath(fromTile, toTile) {
    var result = []

    return result
  }

  /* includes armies */
  shortestWeightedDistance(tileA, tileB) {

  }
  
  manhattanDistance(a, b) {
    var ia = this.tiles.indexOf(a);
    var rc = this.getRCFromIndex(ia);
    var ra = rc[0];
    var ca = rc[1];
    var ib = this.tiles.indexOf(b);
    rc = this.getRCFromIndex(ia);
    var rb = rc[0];
    var cb = rc[1];
    return Math.abs(ra-rb) + Math.abs(ca-cb);
  }
  
  getRCFromIndex(i) {
      return [i / this.numCols, i % this.numCols];
  }
}

module.exports.Board = Board
