// -----=====FUNCTIONS=====-----

// runs upon the worker being called from the main program
function worker_called(genParams){

    let iconsList = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t"];

    // array of each length of noodle, each with format [length int, [array of booleans for if they're enabled or not], colour string, allowImmediateTurns bool]
    let noodleData = genParams[0];
    // chance that when placing a noodle, it will take a turn even though theres no wall in front of it
    let turnChance = genParams[1];
    // the 11x11 2d array that the noodles will be placed onto, can have "X"s for blocked off spaces
    let inputGrid = genParams[2];
    // the highest length of straight line allowed
    let straightLimit = genParams[3];

    // creating noodleList from noodleData
    // a list of objects with attributes:
    // - icon (string to be placed on grid)
    // - length (int)
    // - allowImmediateTurns (bool, determines whether the tile after the start or end must be straight)
    // - colour (string)
    let noodleList = [];
    let iconIndex = 0;
    console.log(noodleData);

    // for each length
    for (let i = 0; i < noodleData.length; i++){
        // for each enabled/disabled noodle
        for (let j = 0; j < noodleData[i][1].length; j++){
            if (noodleData[i][1][j] == true){
                noodleList.push({
                    "icon": iconsList[iconIndex],
                    "length": noodleData[i][0],
                    "allowImmediateTurns": noodleData[i][3],
                    "colour": noodleData[i][2]
                })
                iconIndex = iconIndex + 1;
            }
        }
    }

    let puzzle = generate_puzzle(inputGrid, noodleList, noodleData, straightLimit, turnChance);
    puzzle.genParams = genParams;
    postMessage(puzzle);
}

// generates the puzzle according to the input parameters
// returns a puzzle object with attributes:
// - solvedGrid (2d array of 11x11 solved grid)
// - noodles (array of noodle objects with their starts and ends)
function generate_puzzle(inputGrid, noodleList, noodleData, straightLimit=81, turnChance=1, tryCap=50, solverTimeout=5){
    let result = false;
    while (result == false){
        result = try_generate_puzzle(inputGrid, noodleList, noodleData, straightLimit, turnChance, tryCap, solverTimeout);
    }
    return result;
}

// tries a single attempt at generating a puzzle
// may fail, in which case it returns false
// otherwise returns puzzle object seen at generate_puzzle
function try_generate_puzzle(inputGrid, noodleList, noodleData, straightLimit, turnChance, tryCap, solverTimeout){

    postMessage("Generating puzzles...");

    let grid = structuredClone(inputGrid);
    let noodles = structuredClone(noodleList);

    // noodles are deleted from the above array and added here when they are placed on the grid
    let usedNoodles = [];

    // sorts noodles in descending order of length
    // this means that they are placed longest to shortest
    noodles.sort(function(a, b) {
        return a.length - b.length;
      });
    noodles.reverse();

    

    // run until all noodles have been placed
    // (or if it returns false)
    while (noodles.length > 0) {

        // categorise gaps of grid
        let categorisedGaps = categorise_gaps(grid,noodles);

        // check for any dead ends
        let deadEnds = find_dead_ends(grid);
        shuffle_array(deadEnds);



        // if there is a dead end, takes longest noodle that can fill that dead end (from categorise gaps)
        // tries to place it tryCap times.
        // if failure, moves on to next longest noodle
        // if runs out of noodles, returns false

        // this gets updated before placing
        let noodle = "unset";

        if (deadEnds.length > 0 ){

            // picks a (random) dead end
            let noodleStart = deadEnds[0];

            // get the noodles that can fill that dead end, in descending order
            let possibleNoodles = categorisedGaps[noodleStart[0]][noodleStart[1]].toSorted((a,b) => b.length - a.length);

            let noodlePlaced = false;
            let i = 0;
            while (!noodlePlaced){

                if (i == possibleNoodles.length){
                    //console.log("Abandoned puzzle generating attempt - could not place any noodles in a dead end");
                    return false;
                }

                noodle = possibleNoodles[i];
                // constructs remainingNoodles, an array of all OTHER noodles yet to be placed
                let remainingNoodles = noodles.toSorted(function(a,b){
                    if (a == noodle){
                        return -1;
                    } else if (b == noodle){
                        return 1;
                    } else {
                        return 0;
                    }
                })
                remainingNoodles = remainingNoodles.slice(1);

                noodlePlaced = place_noodle_within(grid, noodle, [noodleStart], tryCap, remainingNoodles, straightLimit, turnChance)

                i = i + 1;
            }


        // if there is no dead end, tries to place the longest noodle at a random spot it can fill (categorisegaps) tryCap times
        // (each time is a different random spot)
        // if reaches tryCap, returns false

        } else {

            // gets longest noodle
            noodle = noodles[0];

            // contructs possibleStarts, an array of every coord that the longest noodle could possibly start at
            let possibleStarts = [];
            for (let i = 1; i <= 9; i++){
                for (let j = 1; j <= 9; j++){
                    if (categorisedGaps[i][j].includes(noodle)){
                        possibleStarts.push([i,j])
                    }
                }
            }

            if (place_noodle_within(grid, noodle, possibleStarts, tryCap, noodles.slice(1), straightLimit, turnChance) == false){
                //console.log("Abandoned puzzle generating attempt - could not place longest noodle");
                return false;
            } else {

            }

        }

        // if the noodle is successfully placed,
        
        // push noodle to usedNoodles
        usedNoodles.push(noodle);
        // remove noodle from noodles
        noodles.splice(noodles.indexOf(noodle),1);

    }

    // once all noodles have been placed on the grid:

    // check if the result has a unique solution
    // if not, return false
    // if yes, return puzzle object

    let uniqueResult = is_unique(inputGrid,usedNoodles,solverTimeout,true,grid);
    if (uniqueResult == false){
        return false
    }


    return {
        "solvedGrid": uniqueResult,
        "noodles": usedNoodles
    };

}

// takes a grid and a list of noodle objects
// returns an 11x11 2d array where each tile is an array of each noodle that could fit in that gap
// non-gap tiles are replaced with empty arrays
function categorise_gaps(inputGrid,noodles){

    gapsInfo = find_gaps(inputGrid);

    // grid with gaps filled with a unique icon each
    let grid = gapsInfo.grid;
    // array of icons used
    let gapIcons = gapsInfo.gapIcons;
    // sizes of gaps at corresponding indexes
    let gapSizes = gapsInfo.gapSizes;

    // replacing all non-gap tiles with empty arrays
    for (let i = 1; i <= 9; i++){
        for (let j = 1; j <= 9; j++){
            if (!gapIcons.includes(grid[i][j])){
                grid[i][j] = [];
            }
        }
    }

    for (let i = 0; i < gapIcons.length; i++){

        let icon = gapIcons[i];
        let size = gapSizes[i];

        // get all sizes that can be made with the given noodles
        let combinations = get_combinations(noodles.map(x => x.length));

        // each length that can be used to add to a gap this size
        let lengthsUsed = [];

        // constructing lengthUsed
        // goes through each sum made, checks if its the right sum, then adds all new lengths used to the array
        for (let j = 0; j < combinations[0].length; j++){
            if (combinations[0][j] == size){
                for (length of combinations[1][j]){
                    if (!lengthsUsed.includes(length)){
                        lengthsUsed.push(length);
                    }
                }

            }
        }

        // array of noodles that could theoretically be used to fill the gap
        // ie each one that shares a length with lengthsUsed
        let possibleNoodles = [];

        // constructing possibleNoodles
        for (noodle of noodles){
            if (lengthsUsed.includes(noodle.length)){
                possibleNoodles.push(noodle);
            }
        }

        // goes through grid and replaces each tile in the current gap with the array of possible noodles that could fill it
        for (let row = 1; row <= 9; row++){
            for (let column = 1; column <= 9; column++){
                if (grid[row][column] == icon){
                    grid[row][column] = possibleNoodles;
                }
            }
        }

    }

    return grid;
}

// takes in a grid, noodle, array of possible coords to start at, and tryCap
// tries to place the noodle on that grid at a random start, tryCap times or until it works
// affects original grid
// gives noodle passed a start and end attribute if successful
// returns true if successful, false if not
function place_noodle_within(grid, noodle, possibleStarts, tryCap, remainingNoodles, straightLimit, turnChance){

    // amount of tries attempted
    let tryCount = 0;

    while (tryCount < tryCap){

        tryCount = tryCount + 1;

        // picks a random start from the array
        let randomStart = possibleStarts[Math.floor(Math.random()*possibleStarts.length)];

        let tryGrid = structuredClone(grid);

        if (try_place_noodle_at(tryGrid, noodle, randomStart, straightLimit, turnChance)){
            // if its successful

            // if placing the noodle makes the puzzle unfillable, accepts it
            if (puzzle_fillable(tryGrid,remainingNoodles)){
                // overwrites grid to match tryGrid
                for (let i = 1; i <= 9; i++){
                    grid[i] = tryGrid[i];
                }
                //console.log("Placed noodle in tries:");
                //console.log(tryCount);

                return true;
            }
        }

        // if attempt unsuccessful, resets the noodles start and end
        noodle.start = null;
        noodle.end = null;

    }

    // if it reaches the tryCap, ie times out

    console.log("Reached tryCap - timed out")
    return false;
}

// takes in a grid, noodle and coords to start at
// tries to place the noodle onto the grid
// affects original grid
// gives noodle start and end if successful
// returns true if successful, false if not
function try_place_noodle_at(grid, noodle, start, straightLimit, turnChance){

    // icon: string that will be filled into the grid
    let icon = noodle.icon;

    // amount of times a tile needs to be randomly picked and added to noodle
    // (-1 because start is placed automatically)
    let lengthLeft = noodle.length - 1;

    // current coordinates of the end of the noodle being placed
    let current = start;

    // places icon at start tile
    grid[current[0]][current[1]] = icon;

    // the direction that the noodle moved in most recently
    // exists so that the noodle can have a modified probability to keep going in the same direction
    // starts random because there is no preferred direction from the single initial tile
    // 0123 = down, up, right, left
    let direction = get_random_int(0,3);

    // array containing each direction used in order
    let usedDirections = [];
    let hasTurned = false;

    // continues until all tiles of noodle placed, or returned by a dead end
    while (lengthLeft > 0){

        // list of the [row,col] coordinates of the tiles adjacent to the current one
        // [below,above,right,left]
        let adjacentCoords = [[current[0]+1,current[1]],[current[0]-1,current[1]],[current[0],current[1]+1],[current[0],current[1]-1]];

        // same as above, but for the corresponding strings in those tiles
        let adjacentTiles = get_adjacent(grid,current[0],current[1]);




        // TODO

        // CHECK FOR RESTRICTIONS ON NOODLE PATHING:

        // if its one length left, and hasnt turned, and is over the straightLimit, block off the tile in front
        if ((lengthLeft == 1) && (!hasTurned) && (noodle.length > straightLimit)){
            adjacentTiles[direction] = "blocked";
        }

        // if the tile would cause an immediate turn AND it is forbidden by the noodle's attribute, replaces that adjacent tile with a "blocked"
        // ie if its determining the turn of the tile next to the start or end, it must go straight forward
        if ((!noodle.allowImmediateTurns) && ((lengthLeft == noodle.length - 2) || (lengthLeft == 1))){
            for (let i = 0; i < 4; i++){
                if (i != direction){
                    adjacentTiles[i] = "blocked";
                }
            }
        }

        // if it would cause a 180 after the start or before the end, replaces that adjacent tile with a "blocked"
        // if it is determining the tiles at the start or end of the noodle:
        if ((lengthLeft == 1) || (lengthLeft == (noodle.length - 3))){
            let n = usedDirections.length - 1;
            // if the last step made a 90 degree turn
            if (get_perpendicular_directions(usedDirections[n]).includes(usedDirections[n-1])){
                // blocks off directions perpendicular to the last step
                for (perpendicularDirection of get_perpendicular_directions(usedDirections[n])){
                    adjacentTiles[perpendicularDirection] = "blocked";
                }

            }

        }

        // fails the attempt if no adjacent valid spaces
        if (!adjacentTiles.includes(" ")){
            return false;
        }

        // if turning chance succeeds, randomises direction so that all directions are treated equally
        if (Math.random() < turnChance) {
            direction = get_random_int(0,3);
        }

        // randomises direction until it finds a valid one
        while (adjacentTiles[direction] != " "){
            direction = get_random_int(0,3);
        }

        // adds that tile to the end of the noodle
        current = adjacentCoords[direction];
        grid[current[0]][current[1]] = icon;
        lengthLeft = lengthLeft - 1;

        // adds it to the record of directions used
        usedDirections.push(direction);

        // checks to see if a turn has been made
        // this is used to disallow compeltely straight noodles
        if (direction != usedDirections[0]){
            hasTurned = true;
        }
    }
    // after lengthLeft reaches 0...

    // updates noodle start and end
    noodle.start = start;
    noodle.end = current;

    // returns a successful result
    return true;
}

// takes a direction and returns the 2 directions perpendicular to it
// returns [0,1] (down, up) for inputs 2 or 3
// returns [2,3] (right, left) for inputs 0 or 1
function get_perpendicular_directions(direction){
    let vertical = [0,1];
    let horizontal = [2,3];
    if (vertical.includes(direction)){
        return horizontal;
    }
    return vertical;

}

// returns an object with attributes:
// gapIcons - strings of numbers used on that grid
// gapSizes - array of the size of each "gap" in the grid (groups of " " spaces adjacent to each other), corresponding index to gapIcons
// grid - 2d array of the grid with each gap filled with a different number

// does not affect original grid

function find_gaps(grid){

    let tempGrid = structuredClone(grid);
    let nextNum = 0;

    //list of strings of numbers currently on the grid
    let finalNums = [];

    //tracks how much the number of the same index in finalNums is used
    let numCounts = []; 
    // for each tile in the grid
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
            
            // if more than one number adjacent
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

    // returns the object with the relevant attributes
    return {
        "gapSizes": numCounts,
        "grid": tempGrid,
        "gapIcons": finalNums
    };
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


// takes in a 2d grid array
// returns an array of pairs [row num, column num] of each "dead end"
// where a "dead end" is an empty tile adjacent to exactly 1 empty tile
function find_dead_ends(inputGrid){

    let deadEnds = [];
    
    for (let i = 1; i <= 9; i++){
        for (let j = 1; j <= 9; j++){

            if (inputGrid[i][j] != " "){
                continue;
            }

            let adjacentTiles = get_adjacent(inputGrid,i,j);

            // counts each adjacent empty tile
            let amountEmpty = 0;
            for (adjacent of adjacentTiles){
                if (adjacent == " "){
                    amountEmpty = amountEmpty + 1;
                }
            }

            // if theres exactly one empty adjacent tile (ie a dead end)
            // adds it to the array of coords
            if (amountEmpty == 1){
                deadEnds.push([i,j]);
            }
        }
    }
    return deadEnds;
}

// takes in a 2d grid array
// returns an array of pairs [row num, column num] of each "junction"
// where a junction is an empty tile that would split the gap its in into 3 or more gaps if filled
// this means that the gap its in cannot be filled by a single noodle
function find_junctions(inputGrid){

    let junctions = [];

    // amount of gaps in the grid by default
    let gapCount = find_gaps(inputGrid).gapIcons.length;

    for (let i = 1; i <= 9; i++){
        for (let j = 1; j <= 9; j++){

            let gridWithTileFilled = structuredClone(inputGrid);
            gridWithTileFilled[i][j] = "X";

            let newGapCount = find_gaps(gridWithTileFilled).gapIcons.length;

            // if the gap count increases by 2 or more, ie the gap was split into 3 or more gaps
            // adds it to the array of coords
            if (newGapCount >= gapCount + 2){
                junctions.push([i,j]);
            }
        }
    }
    return junctions;
}

// takes in a grid and an array of noodles
// does the following checks on those inputs: 
// - can the noodle lengths be summed to fill the remaining gaps in the grid?
// - if there is a junction, is it in a gap fillable by multiple noodles?
// if the answer to any of these is "no", returns false, otherwise true
// true - the puzzle may be fillable by placing more noodles
// false - the puzzle is definitely not fillable by placing more noodles
function puzzle_fillable(grid,noodles,categorisedGaps=null){

    // if it is not given the categorisedGaps, finds it itself
    if (categorisedGaps == null){
        categorisedGaps = categorise_gaps(grid,noodles);
    }

    // array of all the noodles lengths
    let noodleLengths = noodles.map(x => x.length);

    // ----CHECKS----

    // - can the noodle lengths be summed to fill the remaining gaps in the grid?
    let gapSizes = find_gaps(grid).gapSizes;
    if (!lengths_fill_gaps(gapSizes,noodleLengths)){
        //console.log("Puzzle not fillable - Noodle lengths do not fill gaps in grid")
        return false;
    }

    // - if there is a junction, is it in a gap fillable by multiple noodles?
    let junctions = find_junctions(grid);
    for (coord of junctions){
        if (categorisedGaps[coord[0]][coord[1]].length == 1){
            //console.log("Puzzle not fillable - Junction expected to be filled by a single noodle")
            return false;
        }
    }

    // if all the above checks do not return false,
    return true;

}

// Randomize array in-place using Durstenfeld shuffle algorithm
function shuffle_array(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

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

//returns strings in adjacent tiles in order [below,above,right,left]
function get_adjacent(grid,row,column){ 
	return [grid[row + 1][column],grid[row - 1][column],grid[row][column + 1],grid[row][column - 1]];
}

//returns list of strings of unique numbers adjacent to tile in descending order
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

// returns random integer between min (inclusive) and maximum (inclusive) 
function get_random_int(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function show_grid(grid){
	for (let i = 0; i < grid.length; i++){
		console.log(String(grid[i]))
	}
}

// old solver code

// returns solved grid if the given grid and noodles has exactly 1 solution, else false
// does not affect original grid
// noodles is a list of noodle objects
// solverTimeout is time in seconds
// ... if it takes longer than that to do 1% of the grids, it stops and fails (returns false)
function is_unique(grid,noodles,solverTimeout,colourDuping,iconGrid){
    let inputGrid = structuredClone(grid);

    // checks if pairings of noodles have unique solutions, to quickly rule out trivial non-unique puzzles
    if (are_pairings_unique(iconGrid,noodles,solverTimeout) == false){
        return false;
    }

    postMessage("Solution passed first uniqueness check");
    
    let solverResult = solve_noodles(inputGrid,noodles,solverTimeout);

    if (solverResult == false){
        console.log("Solver timed out");
        return false
    } else if (solverResult.length != 1){
        console.log("Solution not unique");
        return false
    }
    if (!colourDuping) {
        return solverResult[0];
    } else {
        postMessage("Checking uniqueness of multiple noodle endings...");

        // need to check other combinations of noodles of same length (therefore colour) DONT have ANY solutions
        // holds each unique noodle length
        let noodleLengths = [];
        // holds every start and end of the noodle length at the corresponding index
        let equivTails = [];
        for (let i=0;i<noodles.length;i++){
            if (!noodleLengths.includes(noodles[i].length)){
                noodleLengths.push(noodles[i].length);
                equivTails.push([noodles[i].start,noodles[i].end]);
            } else {
                equivTails[noodleLengths.indexOf(noodles[i].length)].push(noodles[i].start);
                equivTails[noodleLengths.indexOf(noodles[i].length)].push(noodles[i].end);
            }
        }
        let tailPerms = get_tail_pairs(equivTails);
        // removes first permutation, as that is the intended one to have a solution
        tailPerms.splice(0,1);
        // testing each other permutation to make sure they have no solutions
        for (let i = 0; i < tailPerms.length; i++){
            // getting the list of noodle objects to try a solution for
            let permNoodles = [];
            // looping through every stard/end pair in the permutation
            let lengthIndex = 0;
            let coordIndex = 0;
            while (tailPerms[i].length > lengthIndex){
                // takes a pair of coordinates from the first "length"
                let newStartEnd = tailPerms[i][lengthIndex].slice(coordIndex,coordIndex+2);
                // adds it as a noodle
                permNoodles.push({
                    "icon": "icon",
                    "length": noodleLengths[lengthIndex],
                    "start": newStartEnd[0],
                    "end": newStartEnd[1]
                })

                // goes to the next pair
                // if the length has no more pairs, goes to the next length
                coordIndex = coordIndex + 2;
                if (coordIndex >= tailPerms[i][lengthIndex].length) {
                    coordIndex = 0;
                    lengthIndex = lengthIndex + 1;
                }
                
            }
            
            let permSolverResult = solve_noodles(inputGrid,permNoodles,solverTimeout);
            if (!(permSolverResult.constructor === Array)){
                console.log("Other permutation solver timed out");
                return false;
            } else if (permSolverResult.length != 0){
                console.log("Other permutation had solution");
                return false;
            }

        }
        // if it has gotten through all the other permutations, ie none had a solution
        // returns the successful solution as usual
        console.log("No other permutations have a solution");
        return solverResult[0];
    }
}

// checks to see if each pair of bordering noodles have a unique solution, within the boundaries of their intended solution
// needs the grid with the intended solution of icons
// returns true if there is a single unique solution
// returns false otherwise
function are_pairings_unique(inputGrid,inputNoodles,solverTimeout){

    // gets all pairings of bordering noodles
    let pairings = get_bordering_noodles(inputGrid,inputNoodles);

    for (pairing of pairings){

        let testGrid = structuredClone(inputGrid);
        let pairingIcons = pairing.map(n => n.icon);

        // clears all spaces those noodles fill
        for (let i = 1; i <= 9; i++){
            for (let j = 1; j <= 9; j++){
                if (pairingIcons.includes(testGrid[i][j])){
                    testGrid[i][j] = " ";
                }
            }
        }

        // solves that two-noodle gap to see if theres a unique way of filling it
        let solverResult = solve_noodles(testGrid,pairing,solverTimeout);
        if (solverResult == false){
            console.log("Quick Pairing Uniqueness Check - Solver timed out");
            return false
        } else if (solverResult.length != 1){
            console.log("Quick Pairing Uniqueness Check - Solution not unique")
            return false
        }
    }

    // if none of the above pairings return false, then they all have unique solutions
    console.log("quick check success!");
    return true;

}

// returns an array of arrays, each with two noodles in them
// each pair is two noodles that have adjacent tiles somewhere in the intended solution
// each pair only appears once
function get_bordering_noodles(grid,noodles){

    let noodleIcons = noodles.map(n => n.icon);

    // array of pairs of bordering icons found in the grid
    let uniquePairsIcons = [];

    // for each tile
    for (let i = 1; i <= 9; i++){
        for (let j = 1; j <= 9; j++){

            let tile = grid[i][j];

            // rejects it if its not a noodle tile
            if (!noodleIcons.includes(tile)){
                continue;
            }

            // gets strings in adjacent tiles
            let adjacentTiles = get_adjacent(grid,i,j);

            // for each adjacent tile
            for (adjTile of adjacentTiles){

                // if its the same as the tile, moves on
                if (adjTile == tile){
                    continue;
                }

                // if its not a noodle tile, moves on
                if (!noodleIcons.includes(adjTile)){
                    continue;
                }

                // if the pair has already been found, moves on
                let alreadyFound = false;
                for (prevPair of uniquePairsIcons){
                    if (prevPair.includes(tile) && prevPair.includes(adjTile)){
                        alreadyFound = true;
                    }
                }
                if (alreadyFound){
                    continue;
                }

                // if none of the above reject it, adds the pair to the list of noodle pairs
                uniquePairsIcons.push([tile,adjTile]);

            }

        }
    }

    // constructs array of corresponding noodle objects to the icons found
    let uniquePairs = [];
    for (iconPair of uniquePairsIcons){
        let newPair = [];
        newPair.push(noodles[noodleIcons.indexOf(iconPair[0])]);
        newPair.push(noodles[noodleIcons.indexOf(iconPair[1])]);
        uniquePairs.push(newPair);
    }

    return uniquePairs;
}

// returns a list of grids of each possible way to fill the given grid with the given noodles
// inNoodles a list of noodle objects
// does not affect original list
// if it fails, returns false
// solverTimeout is time in seconds
// ... if it estimates longer than that to do the grids, it stops and fails
function solve_noodles(inputGrid,inNoodles,solverTimeout){

    let noodles = structuredClone(inNoodles);
    let grid = structuredClone(inputGrid);

    // puts a "X" block at each noodle start and end so they dont accidentally path through each other
    for (let i = 0; i < noodles.length; i++){
        let start = noodles[i].start;
        let end = noodles[i].end;
        grid[start[0]][start[1]] = "X";
        grid[end[0]][end[1]] = "X";
    }

    // the grids that each iteration recieves to try and place noodles on
    let partialGrids = [grid]

    while (noodles.length > 0){

        // gets the shortest noodle from the list and removes it
        let currentNoodle = noodles.reduce((prev, current) => (prev && prev.length < current.length) ? prev : current);
        noodles = noodles.filter(function(item){return (item != currentNoodle)});
        // get the data of the current noodle
        // note "movesLeft" instead of length because thats what find_paths takes
        let start = currentNoodle.start;
        let end = currentNoodle.end;
        let movesLeft = currentNoodle.length - 1;
        let icon = currentNoodle.icon;

        let gridsToCheck = partialGrids.length;

        // validGrids is essentially a trimmed down version of noodledGrids
        // doesn't have any of the grids that fail the checks
        let validGrids = [];

        console.log(gridsToCheck);

        // for each grid that the previous noodles were successfully placed on

        let startTime = Date.now();

        for (let i=0;i<gridsToCheck;i++){
            // TIMEOUT CHECK
            // if theres a lot of grids to check and its 1% through them, checks time taken
            // if estimated time to complete loop is longer than solverTimeout, fails (returns false)
            if ((gridsToCheck >= 100) && (i == Math.floor(gridsToCheck/100))){
                // solver timeout because *1000 to convert to milliseconds, /100 to extrapolate to 100% grids done
                if (((Date.now()) - startTime) > (solverTimeout*10)){
                    return false
                }
            }

            // gets all ways to place the current noodle on that grid
            let noodledGrids = find_paths(partialGrids[i],start,end,movesLeft,icon);
            

            // note: could make it not do the checks if its the last noodle?

            // for each way placed, checks if it is a valid placement
            // if it is, adds it to the list of grids for the next noodle to be placed on
            for (let j=0;j<noodledGrids.length;j++){
                let gridNoStartEnd = structuredClone(noodledGrids[j]);
                for (let k = 0; k < noodles.length; k++){
                    // removes all the starting and ending "X"s to not interfere with counting gaps
                    let tempStart = noodles[k].start;
                    let tempEnd = noodles[k].end;
                    gridNoStartEnd[tempStart[0]][tempStart[1]] = " ";
                    gridNoStartEnd[tempEnd[0]][tempEnd[1]] = " ";
                }
                // if its not still fillable, not added to validGrids
                if (!puzzle_fillable(gridNoStartEnd,noodles)){
                    continue;
                }

                // Adds it to the list of grids for the next noodle to be placed on
                validGrids.push(noodledGrids[j]);
            }

        }

        partialGrids = validGrids;
    }
    return partialGrids;
}

//returns a list of grids with the path filled in
//does not affect original grid
function find_paths(grid,start,end,movesLeft,icon){ 
	let foundPaths = [];
	let currentGrid = structuredClone(grid);
    let adjacentTiles = [[(start[0] + 1),start[1]],[(start[0] - 1),start[1]],[start[0],(start[1] + 1)],[start[0],(start[1] - 1)]]; //down, up , right, left
	currentGrid[start[0]][start[1]] = String(movesLeft) + icon;
	if (movesLeft == 0){ //if it is out of moves, correct if at the end, incorrect otherwise
		if (are_arrays_equal(start,end)){
			return [currentGrid];
		}else{
			return [];
		}
	}
	for (let i = 0; i < 4; i++){
		let newCell = adjacentTiles[i];
		if ((min_distance(newCell,end) <= (movesLeft - 1)) && ((currentGrid[newCell[0]][newCell[1]] == " ") || (are_arrays_equal(newCell,end) && movesLeft == 1 ) )){ //if its not too far from the goal and the space is empty/the goal
			foundPaths = foundPaths.concat(find_paths(currentGrid,newCell,end,(movesLeft - 1),icon)); //gets paths from the new cell to the end
		}
	}
	return foundPaths;
}

// takes in an array of subarrays
// returns an array of arrays like the input
// in every possible pairing of the elements in the subarrays
// eg [[1,2,3,4],[5,6]] = [[[1,2,3,4],[5,6]], [[1,3,2,4],[5,6]], [[1,4,2,3],[5,6]]]
// returns clones so changes dont affect the original
function get_tail_pairs(inputArray){
    // terminating case for recursion
    // if there is only one sublist, return the unique pairings of that sublist
    if (inputArray.length == 1){
        // note mapping is so that pairings are still contained an array of length 1, as it was recieved
        return get_unique_pairings(inputArray[0]).map((x) => [x]);
    }
    let allCombos = [];
    // get all pairings of the first element
    let firstPairings = get_unique_pairings(inputArray[0]).map((x) => [x]);
    // get all the unique combinations of the remaining elements
    let remainCombos = get_tail_pairs(inputArray.slice(1));
    // add each combo of those to the array to return
    for (let i = 0; i < firstPairings.length; i++){
        for (let j = 0; j < remainCombos.length; j++){
            allCombos.push(firstPairings[i].concat(remainCombos[j]));
        }
    }
    return allCombos;
}

// takes in an array
// returns array of arrays containing each unique way to pair the elements of the input together
// pairs are index 0,1 index 2,3 etc
// eg [1,2,3,4] -> [[1,2,3,4],[1,3,2,4],[1,4,2,3]]
// does not affect input array
// works recursively, pairing the first element with each possible element
// ... then calling itself to get the unique pairings for the remaining elements
// NOTE: ADDITIONAL CHECK. IF FIRST TWO TERMS ARE EQUAL JUST RETURNS INITIAL LIST SINCE THAT MEANS ITS NOODLES LENGTH 1
function get_unique_pairings(inputArray){
    // this is ONLY relevant for this program, remove if copying to something else
    if (inputArray.length >= 2){
        if (are_arrays_equal(inputArray[0],inputArray[1])){
            return [inputArray];
        }
    }
    // terminating case for recursion
    // if it is only 2 elements, that is the only unique pairing
    if (inputArray.length == 2){
        return [structuredClone(inputArray)]
    }
    let allPairings = [];
    // looping through potential SECOND elements, so starts at 1 not 0
    for (let i = 1; i < (inputArray.length); i++){
        // array with the original second element swapped with the current one
        let swappedArray = to_swapped(inputArray,1,i)
        // gets all pairings of the remaining elements in the array
        let remainingPairings = get_unique_pairings(swappedArray.slice(2));
        for (let j = 0; j < remainingPairings.length; j++){
            // adds the current first two elements with each unique pairing of the remaining elements to the array
            allPairings.push(swappedArray.slice(0,2).concat(remainingPairings[j]));
        }
    }
    return allPairings;
}

// takes in an array
// returns array with the elements at the two indexes swapped
// returns clones, so changes do not affect the original
function to_swapped(inputArray,index1,index2){
    let cloneArray = structuredClone(inputArray);
    let index2Element = cloneArray[index2];
    cloneArray[index2] = cloneArray[index1];
    cloneArray[index1] = index2Element;
    return cloneArray;
}




// for testing purposes

function unit_test(){
}

//-----=====MAIN PROGRAM=====-----


//runs when worker.postMessage() is ran in main code
onmessage = function(genParams){
    console.log(genParams.data);
    worker_called(genParams.data)
}

unit_test();