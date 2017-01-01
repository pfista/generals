var PriorityQueue = require('js-priority-queue')
var attack = require('./attack.js');

class Bot {
      
  constructor(player_index, board) {
    this.playerIndex = player_index;
    this.board = board;
    this.general = this.board.getGeneral();
    this.searchQueue = null;
    this.attachQueue = [];
  }

  breadthFirst() {
    
    // First pass to find all desireable tiles
    var desirable_tiles = [];
    var my_tiles = this.board.allTilesforPlayer(this.playerIndex);
    for (var i=0;i<my_tiles.length;i++) {
      var mtile = my_tiles[i];
      var adjacents = this.board.getAdjacents(mtile);
      for (var j=0;j<adjacents.length;j++) {
        var atile = adjacents[j];
        // If reachable and not owned by me
        if ((atile.reachable()) && (atile.terrainType != this.playerIndex)) {
          // Avoid fortresses
          if (atile.armies > 40) {
            continue;
          }
          desirable_tiles.push(atile);
        }
      }
    }
    
    // Second pass find all tiles with more than one army and tell them to move in the direction of a desireable tile
    var new_attack_paths = []
    for (var i=0;i<my_tiles.length;i++) {
      var mtile = my_tiles[i];
      if (mtile.armies > 1) {
        // Find distance from this tile to every desireable tile
        var shortest_length = Infinity;
        var shortest_path = null;
        for (var k=0;k<desirable_tiles.length;k++) {
          var dtile = desirable_tiles[k];
          var path = this.astar(mtile, dtile);
          if (path) {
            if (path.length < shortest_length) {
              shortest_path = path;
              shortest_length = path.length;
            }
          }
        }
        // Choose shortest as attack
        new_attack_paths.push(shortest_path);
      }
    }
    
    if (new_attack_paths.length > 0) {
      // Sort new_attacks based on shortest distances
      new_attack_paths.sort(function(a,b) {a.length-b.length});
      // Send shortest attack
      var shortest_attack_path = new_attack_paths[0];
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
    var closed_set = []; // Set of positions
    var open_set = []; // Set of vertices
    var open_pq = new PriorityQueue({ comparator: function(v) { return v.fScore; }}); // Priority queue of vertices
    
    function Vertex(tile, distance_from_start_tile, manhattan_to_goal_tile, came_from) {
      this.gScore = distance_from_start_tile;  // distance from start_tile
      this.fScore = manhattan_to_goal_tile;  // estimated distance to goal_tile
      this.came_from = came_from;
      this.tile = tile;
      this.reconstructPath = function () {
        var result = []
        while (v) {
          result.push(v.tile)
          v = v.came_from
        }
        result.reverse()
        return result
      }
    }
    
    // Add start to open set
    var manhattan = this.board.manhattanDistance(start_tile, goal_tile);
    var vertex = new Vertex(start_tile, 0, manhattan, null);
    open_pq.queue(vertex)
    open_set.push(vertex);
    
    while (open_pq.length > 0) {
      // Get vertex in open with potential shortest distance
      // Remove current from open_pq and open_set, add to closed_set
      var curr = open_pq.dequeue()
      var index = open_set.indexOf(curr);
      open_set.splice(index, 1);
      closed_set.push(curr.tile.position);
      
      // If current equal goal_tile we're done
      if (curr.tile.position == goal_tile.position) {
        return curr.reconstructPath()
      }
      
      // Get neighbors
      var adjacents = this.board.getAdjacents(curr.tile);
      for (var i=0;i<adjacents.length;i++) {
        var atile = adjacents[i];
        
        // If not reachable continue
        if (!atile.reachable()) {
          continue;
        }
        
        // if neighbor in closed set continue
        if (closed_set.indexOf(atile.position) >= 0) {
          continue;
        }
        
        // Calculate this neighbors weight
        var tentative_g_score = curr.gScore + 1;
        
        function indexOf(vertices, position) {
          for(var k=0;k<vertices.length;k++) {
            if (vertices[k].tile.position == position) {
              return k;
            }
          }
          return -1;
        }
        
        // if neighbor is not in open set add it, else check tentative
        index = indexOf(open_set, atile.position);
        if (index < 0) {
          manhattan = this.board.manhattanDistance(atile, goal_tile);
          vertex = new Vertex(atile, curr.gScore, manhattan, curr);
          open_pq.queue(vertex)
          open_set.push(vertex);
        } else {
          vertex = open_set[index]
          if (tentative_g_score >= vertex.gScore) {
            continue;
          }
          manhattan = this.board.manhattanDistance(atile, goal_tile);
          vertex.gScore = tentative_g_score;
          vertex.fScore = manhattan;
        }
      }
    }
    return null;
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
