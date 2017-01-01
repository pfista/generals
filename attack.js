class Attack {
  
  /*  from: (Tile) From tile
   *  to: (Tile) To tile
   *  half: (boolean) - if true attack with half my armies
   */
  constructor(from, to, half) {
    this.from = from
    this.to = to
    this.half = half
  }
}

module.exports.Attack = Attack
