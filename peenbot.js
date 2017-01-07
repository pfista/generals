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
  QUEUE: 2,
  DEFEND: 3,
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
    this.queue = []
    this.attacking = null
    this.attackingTerrainType = undefined
    this.general = this.board.getGeneral(this.playerIndex)
  }
  
  computeFscore(start, goal) {
    switch (this.mode) {
      case Modes.EXPAND:
        return this.board.manhattanDistance(start, goal)
        break;
      case Modes.ATTACK:
        var dist = this.board.manhattanDistance(start, goal)
        if ((goal.terrainType > 0) && (goal.terrainType != this.playerIndex)) {
          var reward = 4
        } else if (goal.armies > 0) {
          var reward = 2
        } else {
          var reward = 1
        }
        return -1 * ((dist * this.ave_armies) / (.1 * dist)) * reward 
        break;
      case Modes.DEFEND:
        //return this.board.manhattanDistance(this.general, goal) * this.board.manhattanDistance(start, goal) / goal.armies / start.armies
        return this.board.manhattanDistance(start, goal) / goal.armies / start.armies
        break;
    }
  }
  
  computeGscore(tile, came_from) {
    switch (this.mode) {
      case Modes.EXPAND:
        var dist = 1
        var reward = 1
        var v = came_from
        while (v) {
          dist += 1
          v = v.came_from
        }
        var gscore = dist
        return gscore
        break;
      case Modes.ATTACK:
        var dist = 1
        var armies = tile.armies - 1
        var reward = 1
        var v = came_from
        while (v) {
          armies += v.tile.armies
          
          if ((v.terrainType > 0) && (goal.terrainType != this.playerIndex)) {
            var reward = 4
          } else if (v.armies > 0) {
            var reward = 2
          } else {
            var reward = 1
          }
          
          dist += 1
          v = v.came_from
        }
        var gscore = -1 * armies / (.1 * dist) * reward
        return gscore
        break;
      case Modes.DEFEND:
        var dist_from_general = this.board.manhattanDistance(this.general, tile)
        var dist = 1
        var armies = tile.armies - 1
        var reward = 1
        var v = came_from
        while (v) {
          if (v.tile.terrainType === this.playerIndex) {
            armies += v.tile.armies
          } else {
            reward = v.tile.armies / 2.0
          }
          dist += 1
          v = v.came_from
        }
        //var gscore = dist_from_general / dist / armies / reward
        var gscore = dist / armies / reward
        return gscore
        break;
    }
    if (this.mode === Modes.EXPAND) {
      
    } else if (this.mode === Modes.ATTACK) {
      
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
    if (this.mode === Modes.DEFEND) {
      this.mode = Modes.ATTACK
    }
    for (var i=0;i<desirable_tiles.length;i++) {
      if ((desirable_tiles[i].terrainType > 0) && (this.board.manhattanDistance(desirable_tiles[i], this.general) < 10)) {
        this.mode = Modes.DEFEND
        break
      }
    }
    if (this.mode === Modes.QUEUE) {
      if (this.queue.length > 0) {
        bot_logger.info("Mode: ", this.mode)
        var atk = this.queue.shift()
        return atk
      }
    }
    
    // Set mode and determine which tiles we're going to attack
    if (this.mode !== Modes.DEFEND) {
      this.mode = Modes.EXPAND
      for (var i=0;i<desirable_tiles.length;i++) {
        if ((desirable_tiles[i].armies > 1) && (desirable_tiles[i].armies < 1.5 * this.board.getTotalMovableArmies(this.playerIndex))) {
          this.mode = Modes.ATTACK
          break
        }
      }
    }
    
    bot_logger.info("Mode: ", this.mode)
    var tiles_to_attack = []
    var new_attack_paths = []
    switch(this.mode) {
      case Modes.EXPAND:
        // Add all tiles with 0-10 armies
        for (var i=0;i<desirable_tiles.length;i++) {
          if (desirable_tiles[i].armies < 1) {
            tiles_to_attack.push(desirable_tiles[i])
          }
        }
        
        my_tiles.sort(function(a,b) { return b.armies - a.armies })
        new_attack_paths = this.makeAttackPath(my_tiles.slice(0,3), tiles_to_attack)
        
        break;
      case Modes.ATTACK:
        // If we're attacking a tile that still hasn't lost, keep attacking it
        if (this.attacking) {
          if ((this.attacking.terrainType !== this.playerIndex) || (this.attacking.armies < 1)){
            tiles_to_attack = [this.attacking]
            new_attack_paths = this.makeAttackPath(my_tiles, tiles_to_attack)
            if (new_attack_paths.length > 0) {
              break
            }
          }
        }
        
        var attackable = []
        for (var i=0;i<desirable_tiles.length;i++) {
          if (desirable_tiles[i].armies > 0) {
            attackable.push(desirable_tiles[i])
          }
        }
        attackable.sort(function(a,b) { return a.armies - b.armies }.bind(this))
        // Check for enemies
        var enemies = []
        for (var i=0;i<attackable.length;i++) {
          if (attackable[i].terrainType > 0) {
            enemies.push(attackable[i])
          }
        }
        // Attack other players first
        new_attack_paths = []
        while (enemies.length > 0) {
          //var enemy = enemies.shift()
          tiles_to_attack = enemies
          bot_logger.silly("Tiles to attack: %j", tiles_to_attack)  
          new_attack_paths = this.makeAttackPath(my_tiles, tiles_to_attack)
          if (new_attack_paths.length > 0) {
            break
          }
        }
        // Then attack towers
        if (new_attack_paths.length === 0) {
          while (attackable.length > 0) {
            //var fortress = attackable.shift()
            tiles_to_attack = attackable
            bot_logger.silly("Tiles to attack: %j", tiles_to_attack)
            my_tiles.sort(function(a,b) { return b.armies - a.armies })
            new_attack_paths = this.makeAttackPath(my_tiles.slice(0,3), tiles_to_attack)
            if (new_attack_paths.length > 0) {
              break
            }
          }
        }

          
          //// Add all tiles with >1 armies
          //for (var i=0;i<desirable_tiles.length;i++) {
          //  if (desirable_tiles[i].armies > 1) {
          //    tiles_to_attack.push(desirable_tiles[i])
          //  }
          //}
          
        
        break
      case Modes.DEFEND:
        var attackable = []
        for (var i=0;i<desirable_tiles.length;i++) {
          if (desirable_tiles[i].armies >= 0) {
            attackable.push(desirable_tiles[i])
          }
        }
        
        attackable.sort(function(a,b) { return this.board.manhattanDistance(a, this.general) - this.board.manhattanDistance(b, this.general) }.bind(this))
        bot_logger.silly("Attackable: %j", attackable)
        var enemies = []
        for (var i=0;i<attackable.length;i++) {
          if (attackable[i].terrainType > 0) {
            enemies.push(attackable[i])
          }
        }
        new_attack_paths = []
        while (enemies.length > 0) {
          tiles_to_attack = enemies
          bot_logger.silly("Tiles to attack: %j", tiles_to_attack)
          new_attack_paths = this.makeAttackPath(my_tiles, tiles_to_attack)
          if (new_attack_paths.length > 0) {
            break
          }
        }
        break
    }
    
    
    //var new_attack_paths = this.makeAttackPath(my_tiles, tiles_to_attack)

    if (new_attack_paths.length > 0) {
      // Sort new_attacks based on shortest distances
      new_attack_paths.sort(function(a,b) {return a.weight-b.weight})
      bot_logger.silly("New attack paths: %j", new_attack_paths)
      bot_logger.debug("Best path: weight=%s %j", new_attack_paths[0].weight, new_attack_paths[0].path)
      // Send shortest attack
      var shortest_attack_path = new_attack_paths[0].path
      for (var i=0;i<shortest_attack_path.length-1;i++) {
        var atk = new attack.Attack(shortest_attack_path[i], shortest_attack_path[i+1], false)
        this.queue.push(atk)
      }
      if (this.mode === Modes.ATTACK) {
        this.attacking = shortest_attack_path[shortest_attack_path.length-1]
        this.attackingTerrainType = this.attacking.terrainType
        this.mode = Modes.QUEUE
        bot_logger.info("Attacking: ", this.attacking)
        return this.queue.shift()
      } else {
        var atk = this.queue.shift()
        this.queue = []
        return atk
      }
      
    }
  }
  
  makeAttackPath(my_tiles, tiles_to_attack) {
    // Second pass find all tiles with more than one army and tell them to move in the direction of a desireable tile
    // Find tiles with more than one army
    my_tiles.sort(function(a,b) { return b.armies - a.armies })
    
    bot_logger.silly("My tiles: %j", my_tiles)
    var ready_tiles = []
    for (var i=0;i<Math.min(20, my_tiles.length);i++) {
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
    
    return new_attack_paths
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
      adjacents.sort(function(a,b) { return this.board.manhattanDistance(a, this.general) - this.board.manhattanDistance(b, this.general) }.bind(this))
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
