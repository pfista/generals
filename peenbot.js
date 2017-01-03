var PriorityQueue = require('js-priority-queue')
var attack = require('./attack.js')
var winston = require('winston')

var bot_logger = winston.loggers.get('bot')

var log = new (winston.Logger)()
log.add(winston.transports.Console, {
  /* error, warn, info, verbose, debug, silly. */
  level: process.env.LOG_LEVEL,
  label: 'peenbot',
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true,
})

Modes = {
  EXPAND: 0,
  ATTACK: 1,
}

class Bot {
      
  constructor(player_index, board) {
    this.playerIndex = player_index
    this.board = board
    this.general = this.board.getGeneral()
    this.searchQueue = null
    this.attachQueue = []
    this.cache = {}
    this.mode = Modes.EXPAND
  }
  
  computeFscore(start, goal) {
    if (this.mode === Modes.EXPAND) {
      return this.board.manhattanDistance(start, goal)
    } else if (this.mode === Modes.ATTACK) {
      var dist = this.board.manhattanDistance(start, goal)
      var reward = 1
      return -1 * ((dist * this.ave_armies + goal.armies/2.0) / (1.0 * dist * this.ave_armies)) * reward 
    }
  }
  
  computeGscore(tile, came_from) {
    if (this.mode === Modes.EXPAND) {
      var dist = 1
      var reward = 1
      var v = came_from
      while (v) {
        dist += 1
        v = v.came_from
      }
      var gscore = dist
      return gscore
    } else if (this.mode === Modes.ATTACK) {
      var dist = 1
      var armies = tile.armies - 1
      var reward = 1
      var v = came_from
      while (v) {
        if (v.tile.terrainType === this.playerIndex) {
          armies += v.tile.armies
        } else {
          armies += v.tile.armies / 2.0
        }
        dist += 1
        v = v.came_from
      }
      var gscore = -1 * armies / (1.0 * dist * this.ave_armies) * reward
      return gscore
    }
  }

  breadthFirst() {
    
    this.ave_armies = this.board.getMeanMovableArmies(this.playerIndex)
    
    // First pass to find all desireable tiles
    var desirable_tiles = []
    var my_tiles = this.board.allTilesforPlayer(this.playerIndex)
    for (var i=0;i<my_tiles.length;i++) {
      var adjacents = this.board.getAdjacents(my_tiles[i])
      for (var j=0;j<adjacents.length;j++) {
        // If reachable and not owned by me
        if (adjacents[j].reachable()) {
          // Avoid fortresses
          if (adjacents[j].terrainType != this.playerIndex) {
            desirable_tiles.push(adjacents[j])
          }
        }
        
      }
    }
    
    // Set mode and determine which tiles we're going to attack
    this.mode = Modes.EXPAND
    for (var i=0;i<desirable_tiles.length;i++) {
      if ((desirable_tiles[i].armies > 1) && (desirable_tiles[i].armies * 2 < this.board.getTotalMovableArmies(this.playerIndex))) {
        this.mode = Modes.ATTACK
      }
    }
    var tiles_to_attack = []
    switch(this.mode) {
      case Modes.EXPAND:
        // Add all tiles with 0-10 armies
        for (var i=0;i<desirable_tiles.length;i++) {
          if (desirable_tiles[i].armies < 10) {
            tiles_to_attack.push(desirable_tiles[i])
          }
        }
        break;
      case Modes.ATTACK:
        // Add all tiles with >1 armies
        for (var i=0;i<desirable_tiles.length;i++) {
          if (desirable_tiles[i].armies > 1) {
            tiles_to_attack.push(desirable_tiles[i])
          }
        }
        break;
    }
    
    bot_logger.silly("Tiles to attack: %j", tiles_to_attack)  
    
    // Second pass find all tiles with more than one army and tell them to move in the direction of a desireable tile
    // Find tiles with more than one army
    my_tiles.sort(function(a,b) { return b.armies - a.armies })
    
    bot_logger.silly("My tiles: %j", my_tiles)
    var ready_tiles = []
    for (var i=0;i<Math.min(3, my_tiles.length);i++) {
      if (my_tiles[i].armies > 1) {
        ready_tiles.push(my_tiles[i])
      }
    }
    bot_logger.silly("Ready tiles: %j", ready_tiles)
    
    var new_attack_paths = []
    for (var i=0;i<tiles_to_attack.length;i++) {
      // Make fscore for every ready tile and only compute ready tiles with low fscore
      var fscores = []
      for (var j=0;j<ready_tiles.length;j++) {
        var fscore = this.computeFscore(ready_tiles[j], tiles_to_attack[i])
        fscores.push({
          fscore: fscore,
          tile: ready_tiles[j],
        })
      }
      fscores.sort(function(a,b) { return a.fscore-b.fscore })
      bot_logger.silly("Fscores: %j", fscores)
      
      var compute_tiles = []
      for (var j=0;j<Math.min(fscores.length, 5);j++) {
        compute_tiles.push(fscores[j].tile)
      }
      bot_logger.silly("Compute tiles: %j", compute_tiles)
      
      // Compute shortest path with A*
      var weighted_paths = []
      for (var j=0;j<compute_tiles.length;j++) {
        var weighted_path = this.astar(compute_tiles[j], tiles_to_attack[i])
        if ((weighted_path) && (weighted_path.path)) {
          weighted_paths.push(weighted_path)
        }
      }
      bot_logger.silly("Weighted paths: %j", weighted_paths)
      
      // Find best path to this desirable tile based on lowest weight
      var best_path = {
        path: null,
        weight: Infinity,
      }
      for (var j=0;j<weighted_paths.length;j++) {
        if (weighted_paths[j].weight < best_path.weight) {
          best_path = weighted_paths[j]
        }
      }
      if (best_path.path) {
        // Choose shortest as attack
        new_attack_paths.push(best_path)
      }
    }
    //var cachedPath = this.cache[my_tiles[i].position+''+tiles_to_attack[k].position]
    //if (cachedPath){
      //path = cachedPath
    //}
    //else {
    //var weighted_path = this.astar(my_tiles[i], tiles_to_attack[k])
    //this.cache[my_tiles[i].position+''+tiles_to_attack[k].position] = path

    if (new_attack_paths.length > 0) {
      // Sort new_attacks based on shortest distances
      new_attack_paths.sort(function(a,b) {return a.weight-b.weight})
      bot_logger.silly("New attack paths: %j", new_attack_paths)
      bot_logger.debug("Best path: weight=%s %j", new_attack_paths[0].weight, new_attack_paths[0].path)
      // Send shortest attack
      var shortest_attack_path = new_attack_paths[0].path
      var atk = new attack.Attack(shortest_attack_path[0], shortest_attack_path[1], false)
      return atk
    }
  }
  
  /**
   *function A*(start, goal)
    // The set of nodes already evaluated.
    closedSet := {}
    // The set of currently discovered nodes still to be evaluated.
    // Initially, only the start node is known.
    openSet := {start}
    // For each node, which node it can most efficiently be reached from.
    // If a node can be reached from many nodes, cameFrom will eventually contain the
    // most efficient previous step.
    cameFrom := the empty map

    // For each node, the cost of getting from the start node to that node.
    gScore := map with default value of Infinity
    // The cost of going from start to start is zero.
    gScore[start] := 0 
    // For each node, the total cost of getting from the start node to the goal
    // by passing by that node. That value is partly known, partly heuristic.
    fScore := map with default value of Infinity
    // For the first node, that value is completely heuristic.
    fScore[start] := heuristic_cost_estimate(start, goal)

    while openSet is not empty
        current := the node in openSet having the lowest fScore[] value
        if current = goal
            return reconstruct_path(cameFrom, current)

        openSet.Remove(current)
        closedSet.Add(current)
        for each neighbor of current
            if neighbor in closedSet
                continue		// Ignore the neighbor which is already evaluated.
            // The distance from start to a neighbor
            tentative_gScore := gScore[current] + dist_between(current, neighbor)
            if neighbor not in openSet	// Discover a new node
                openSet.Add(neighbor)
            else if tentative_gScore >= gScore[neighbor]
                continue		// This is not a better path.

            // This path is the best until now. Record it!
            cameFrom[neighbor] := current
            gScore[neighbor] := tentative_gScore
            fScore[neighbor] := gScore[neighbor] + heuristic_cost_estimate(neighbor, goal)

    return failure
   */

  astar(start_tile, goal_tile) {
    bot_logger.silly("A*")
    bot_logger.silly("Start tile: %j", start_tile)
    bot_logger.silly("Goal tile: %j", goal_tile)
    var closed_set = [] // Set of positions
    var open_set = [] // Set of vertices
    var open_pq = new PriorityQueue({ comparator: function(a,b) { return a.fScore - b.fScore }}) // Priority queue of vertices
    
    function Vertex(tile, gscore, fscore, came_from) {
      this.gScore = gscore  // distance from start_tile
      this.fScore = fscore  // estimated distance to goal_tile
      this.came_from = came_from
      this.tile = tile
      this.reconstructPath = function () {
        var path = []
        var v = this
        var weight = v.gScore
        while (v) {
          path.push(v.tile)
          v = v.came_from
        }
        path.reverse()
        var result = {
          path: path,
          weight: weight,
        }
        bot_logger.silly("Result path: %j", result)
        return result
      }
    }
    
    // Add start to open set
    var manhattan = this.computeFscore(start_tile, goal_tile)
    var gscore = this.computeGscore(start_tile, null)
    var vertex = new Vertex(start_tile, gscore, manhattan, null)
    open_pq.queue(vertex)
    open_set.push(vertex)
    
    while (open_pq.length > 0) {
      bot_logger.silly("Open set: %j", open_set)
      // Get vertex in open with potential shortest distance
      // Remove current from open_pq and open_set, add to closed_set
      var curr = open_pq.dequeue()
      var index = open_set.indexOf(curr)
      open_set.splice(index, 1)
      closed_set.push(curr.tile.position)
      
      // If current equal goal_tile we're done
      if (curr.tile.position == goal_tile.position) {
        return curr.reconstructPath()
      }
      
      // Get neighbors
      var adjacents = this.board.getAdjacents(curr.tile)
      for (var i=0;i<adjacents.length;i++) {
        var atile = adjacents[i]
        
        // If not reachable continue
        if (!atile.reachable()) {
          continue
        }
        
        // Don't pass through fortresses
        //if ((atile.terrainType != this.playerIndex) && (atile.armies >= this.board.getTotalMovableArmies(this.playerIndex))) {
        if ((atile.terrainType != this.playerIndex) && (atile.position != goal_tile.position)) {
          continue
        }
        
        // if neighbor in closed set continue
        if (closed_set.indexOf(atile.position) >= 0) {
          continue
        }
        
        // Calculate this neighbors weight
        var neighborWeight
        if (atile.terrainType == this.playerIndex && goal_tile.terrainType != this.playerIndex && atile.armies > 1 && atile.position != this.board.generalPos) {
            neighborWeight = -atile.armies + curr.armies/2
        }
        else if (atile.terrainType < 0) {
          neighborWeight = 1
        }
        else {
          neighborWeight = atile.armies
        }
        //var tentative_g_score = curr.gScore + neighborWeight
        var tentative_g_score = this.computeGscore(atile, curr)
        
        function indexOf(vertices, position) {
          for(var k=0;k<vertices.length;k++) {
            if (vertices[k].tile.position == position) {
              return k
            }
          }
          return -1
        }
        
        // if neighbor is not in open set add it, else check tentative
        index = indexOf(open_set, atile.position)
        if (index < 0) {
          manhattan = this.computeFscore(atile, goal_tile)
          vertex = new Vertex(atile, tentative_g_score, manhattan, curr)
          open_pq.queue(vertex)
          open_set.push(vertex)
        } else {
          vertex = open_set[index]
          if (tentative_g_score >= vertex.gScore) {
            continue
          }
          manhattan = this.computeFscore(atile, goal_tile)
          vertex.gScore = tentative_g_score
          vertex.fScore = manhattan
        }
      }
    }
    return null
  }
  
  getMove() {
    return this.breadthFirst()
  }
}

module.exports.Bot = Bot
