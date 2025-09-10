// gets the display name of a colour string and returns it
// if its not in the list of colours with special display names, just returns the string
function get_colour_display_name(colour){

    // list of colour strings that have a different display name
    let colourStrings      = ["#00B5E2",    "#FF9E1B",       "#963CBD",       "#FC4C02",    "#EEDC00",       "#DF1995",       "#7ACC00",      "#EABEDB"];
    // display names at the corresponding index
    let correspondingNames = ["Cyan (306)", "Orange (1375)", "Purple (7442)", "Red (1655)", "Yellow (3965)", "Magenta (225)", "Green (2286)", "Lilac (217)"];

    let nameIndex = colourStrings.indexOf(colour);
    
    // ifs not in the list
    if (nameIndex == -1){
        return colour;
    }

    // otherwise
    return correspondingNames[nameIndex];
}



// convert a 2d array grid to a string
// separates first by semicolon, then by comma
function grid_to_string(grid) {
    let gridString = "";
    for (let i = 0; i < 11; i++){
        for (let j = 0; j < 11; j++){
            gridString = gridString + grid[i][j] + ",";
        }
        gridString = gridString.slice(0,-1) + ";"; 
    }
    gridString = gridString.slice(0,-1); 
    return gridString
}

// inverse function of grid_to_string
// converts string grid to a 2d array
// (11x11 grid format)
function string_to_grid(gridString) {

    // gets rows by separating by semicolon
    let rowStrings = gridString.split(";");

    // for each row:
    let newGrid = [];
    for (let i = 0; i < 11; i++){
        // separates by comma
        newGrid.push(rowStrings[i].split(","));
    }

    return newGrid;
}




// gets manhattan distance between two coordinates
function min_distance(start,end){
	return (Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]));
}

//returns strings in adjacent cells in order [below,above,right,left]
function get_adjacent(grid,row,column){ 
	return [grid[row + 1][column],grid[row - 1][column],grid[row][column + 1],grid[row][column - 1]];
}

//returns list of strings of unique numbers adjacent to cell in descending order
function get_adjacent_num(grid,row,column){ 
    let nums = [];
    let adjCells = get_adjacent(grid,row,column);
    for (let i = 0;i<4;i++){
        // if cell is a number AND is not already in array
        // for some reason " " is considered a number so theres the extra check in there
        if((!isNaN(adjCells[i]) && (adjCells[i] != " ")) && (!nums.includes(adjCells[i]))){
            nums.push(adjCells[i]);
        }
    }
    //sorts in descending order
    //note sort does alphabetical sort by default, NOT numerical
    nums.sort(function(a, b) {
        return a - b;
      });
    nums.reverse();
    return nums;
}

// returns a list of the size of each "gap" in the grid (groups of " " spaces adjacent to each other)
// adjacent being up right left down
function count_gaps(grid){
    let tempGrid = structuredClone(grid);
    let nextNum = 0;
    //list of strings of numbers currently on the grid
    let finalNums = [];
    //tracks how much the number of the same index in finalNums is used
    let numCounts = []; 
    for (let i = 1; i < 10; i++){
        for (let j = 1; j < 10; j++){
            //skips over non empty spaces
            if (tempGrid[i][j] != " "){
                continue
            }
            let adjNums = get_adjacent_num(tempGrid,i,j);
            //if no adjacent numbers, uses a new one
            if (adjNums.length == 0){
                tempGrid[i][j] = String(nextNum);
                finalNums.push(String(nextNum));
                numCounts.push(1)
                nextNum = nextNum + 1;
            // if one number adjacent, uses that
            } else if (adjNums.length == 1) {
                tempGrid[i][j] = adjNums[0];
                // updates count of that number in numCounts
                let numIndex = finalNums.indexOf(adjNums[0]);
                numCounts[numIndex] = numCounts[numIndex] + 1;
            } else {
                //takes lowest number from adjacent numbers
                let remainNum = adjNums.pop();
                //changes current tile to the lower number and updates the count
                tempGrid[i][j] = remainNum;
                let remainIndex = finalNums.indexOf(remainNum);
                numCounts[remainIndex] = numCounts[remainIndex] + 1;

                //removes other numbers from the list of used numbers
                for (let k = 0; k < adjNums.length; k++){
                    let numIndex = finalNums.indexOf(adjNums[k]);
                    finalNums.splice(numIndex,1);
                    numCounts.splice(numIndex,1);
                }
                //remainIndex = finalNums.indexOf(remainNum);
                //replaces said numbers with the lowest one
                for (let k = 1; k <= i; k++){
                    for (let l = 1; l <= 9; l++){
                        if (adjNums.includes(tempGrid[k][l])){
                            tempGrid[k][l] = remainNum;
                            numCounts[remainIndex] = numCounts[remainIndex] + 1;
                        }
                    }
                }
            }
        }
    }
    return numCounts;
}

// returns [[list of sums], list of combinations [4,4,6,etc] at corresponding index]
// note affects original list
function get_combinations_recur(lengthList){
    if (lengthList.length == 0){
        return [[0],[[]]];
    }
    let current = lengthList.pop();
    let otherCombs = get_combinations_recur(lengthList);
    let allCombs = [otherCombs[0].concat(otherCombs[0].map(n => n + current)),otherCombs[1].concat(otherCombs[1].map(x => x.concat([current])))];
    return allCombs;

}

// returns [[list of sums], list of combinations [4,4,6,etc] at corresponding index]
// does not affect original list
// does not include the zero sum
function get_combinations(lengthList){
    let tempList = structuredClone(lengthList);
    let results = get_combinations_recur(tempList);
    // removes the 0 combination (and corresponding [] used to sum to it)
    results[0].shift();
    results[1].shift();
    return results;
}

// returns true if the integers in lengthList can be summed to create the integers in gapList
// (otherwise false)
// each integer in lengthList only being used once
// works recursively, picking one gap seeing if it can be summed with the lengths
// ... then repeating with the remaining gaps and lengths
// cannot be over or under, must be exact
function lengths_fill_gaps(gapList,lengthList){
    // if all lengths are used, then it is fillable (terminating case for recursion)
    if (lengthList.length == 0){
        return true
    }
    let remainingGaps = structuredClone(gapList);
    let gap = remainingGaps.pop();
    let combinations = get_combinations(lengthList);
    let valid = [];
    // if it is not possible to fill the current gap with the remaining lengths
    // returns false (not still fillable)
    if (!combinations[0].includes(gap)){
        return false;
    // gets every combination of lengths that can fill said gap
    } else {
        for (let i = 0; i < combinations[0].length; i++){
            if (combinations[0][i] == gap){
                valid.push(combinations[1][i]);
            }
        }
    }
    // for each combination, repeats the function with the remaining gaps and lengths
    // if any of them are true, then it is still fillable
    // if not, then it is not
    let fillable = false;
    for (let i = 0; i < valid.length; i++){
        // comb is a list of integers that add to the current gap
        let comb = valid[i]
        let remainingLengths = structuredClone(lengthList);
        // removes all numbers in comb from the list of lengths
        for (let j = 0; j < comb.length;j++){
            let numIndex = remainingLengths.indexOf(comb[j]);
            remainingLengths.splice(numIndex,1);
        }
        if (lengths_fill_gaps(remainingGaps,remainingLengths)){
            fillable = true;
        }
    }
    return fillable;
}

// checks if two arrays contain the same elements
// note if they both contain arrays, those arrays must have the same reference to return true
function are_arrays_equal(array1,array2){
	if (array1.length != array2.length){
		return false;
	}
	for (let i = 0; i<array1.length; i++){
		if (array1[i] != array2[i]){
			return false;
		}
	}
	return true;

}


function show_grid(grid){
	for (let i = 0; i < grid.length; i++){
		console.log(String(grid[i]))
	}
}