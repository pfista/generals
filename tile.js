class Tile {
  constructor() {
    this.armies
    this.terrainType
  }

  /* Returns true if this tile is reachable, regardless of army count
   */
  reachable() {
    return this.terrainType >= -1
  }
}

module.exports.Tile = Tile
