class MapUtils {
    constructor(num_rows, num_cols, map_array) {
        
        this.numRows  = num_rows;
        this.numCols = num_cols;
        this.mapArray = map_array;
    }
    
    getAdjacents(i) {
        i = this.getIndexFromXY(arguments[0], arguments[1]);
        return [this.getLeft(), this.getAbove(), this.getRight(), this.getBelow()];
    }
    
    getIndexFromXY(x, y) {
        return y * this.numCols + x;
    }
    
    getXYFromIndex(i) {
        return [i % this.numCols, i / this.numCols];
    }
    
    getNeighbors() {
        return [this.getLeft(), this.getAboveLeft(), this.getAbove(), this.getAboveRight(), this.getRight(), this.getBelowRight(), this.getBelow(), this.getBelowRight()];
    }
     
    getAbove(i) {
        return i - this.numCols;
    }
    
    getBelow(i) {
        return i + this.numCols;
    }
    
    getLeft(i) {
        return i - 1;
    }
    
    getRight(i) {
        return i + 1;
    }
    
    getAboveLeft(i) {
        return i - this.numCols - 1;
    }
    
    getAboveRight(i) {
        return i - this.numCols + 1;
    }
    
    getBelowLeft(i) {
        return i + this.numCols - 1;
    }
    
    getBelowRight(i) {
        return i + this.numCols + 1;
    }
}