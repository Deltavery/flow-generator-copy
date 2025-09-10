// Create a single supabase client for interacting with your database
const dataObject = supabase.createClient("https://bjupfqvkdhjqossdulfm.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqdXBmcXZrZGhqcW9zc2R1bGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MDc4NzMsImV4cCI6MjA2MjM4Mzg3M30.W-BI2S0-pqHwcfK_igfbyYRrmeV8B8ME-wUTC--uJkY")


// -----===== FUNCTIONS =====-----

// adds the puzzle to the "puzzles" and "noodles" databases
// puzzle is an array [solved grid, array of noodle objects]
async function insert_puzzle(puzzle){

    // 2d array for the puzzles completed grid 
    const newGrid = grid_to_string(puzzle.solvedGrid);

    // inserts row for this grid to the "puzzles" database
    // note id, saved, approvals have default values
    const { data, error } = await dataObject.from("puzzles").insert({
        grid: newGrid,
    }).select();

    // data is an array containing an object for each row
    // gets the id of the puzzle just added
    let puzzleId = data[0].puzzleid;

    // set the default ordering to be the puzzle ID
    const { orderingError } = await dataObject.from("puzzles").update({
        ordernum: puzzleId
    }).eq("puzzleid", puzzleId);

    console.log(orderingError);

    // inserting rows for each noodle to "noodles" database
    let noodles = puzzle.noodles;
    for (let i = 0; i < noodles.length; i++){
        let noodle = noodles[i];
        const { error } = await dataObject.from("noodles").insert({
            startx: noodle.start[0],
            starty: noodle.start[1],
            endx: noodle.end[0],
            endy: noodle.end[1],
            icon: noodle.icon,
            length: noodle.length,
            colour: noodle.colour,
            puzzle: puzzleId
        });
    }

    // note async functions always return a promise, so this is a promise
    return puzzleId;
}

// updates the difficulty and saved value of a puzzle in the "puzzles" database
async function save_puzzle(puzzleIdPromise, newDifficulty, newSaved = false){

    let puzzleId = await puzzleIdPromise;

    // updates saved and difficulty columns
    // to the row with the corresponding ID
    
    const { error } = await dataObject.from("puzzles").update({
        saved: newSaved,
        difficulty: newDifficulty
    }).eq("puzzleid", puzzleId);

}

// updates the finalised status of the given puzzle in the database to the new value
async function finalise_puzzle(puzzleId, newFinalised = true){
    
    const { error } = await dataObject.from("puzzles").update({
        finalised: newFinalised
    }).eq("puzzleid", puzzleId);

}

// updates the saved status of the given puzzle to false
async function delete_puzzle(puzzleId){
    
    const { error } = await dataObject.from("puzzles").update({
        saved: false
    }).eq("puzzleid", puzzleId);

}

// updates the difficulty of a puzzle to a new value
// and resets difficultyvotes
async function update_puzzle_difficulty(puzzleId, newDifficulty){
    
    const { error } = await dataObject.from("puzzles").update({
        difficulty: newDifficulty,
        difficultyvotes: ""
    }).eq("puzzleid", puzzleId);

}

// updates the ratings of a puzzle
async function update_puzzle_ratings(puzzleId, newRatings){
    
    const { error } = await dataObject.from("puzzles").update({
        ratings: newRatings
    }).eq("puzzleid", puzzleId);

}

// adds a rating to the list of ratings in the database
async function add_puzzle_rating(puzzleId, newRating){

    // gets the current puzzle rating
    const { data, error } = await dataObject.from("puzzles").select().eq("puzzleid",puzzleId);

    let newRatings = data[0].ratings + "," + newRating;

    const { error: error2 } = await dataObject.from("puzzles").update({
        ratings: newRatings
    }).eq("puzzleid", puzzleId);

}

// removes a rating to the list of ratings in the database
async function remove_puzzle_rating(puzzleId, rating){

    // gets the current puzzle ratings
    const { data, error } = await dataObject.from("puzzles").select().eq("puzzleid",puzzleId);

    let prevRatings = data[0].ratings.split(",");

    prevRatings.splice(prevRatings.indexOf(rating),1);
    let newRatings = String(prevRatings);

    const { error: error2 } = await dataObject.from("puzzles").update({
        ratings: newRatings
    }).eq("puzzleid", puzzleId);

}

// gets the difficultyvotes string of a puzzle
async function get_puzzle_difficultyvotes(puzzleId){

    const { data, error } = await dataObject.from("puzzles").select().eq("puzzleid",puzzleId);

    return data[0].difficultyvotes;

}

// updates the difficultyvotes column of a puzzle
async function update_puzzle_difficultyvotes(puzzleId, newDifficultyvotes){
    
    const { error } = await dataObject.from("puzzles").update({
        difficultyvotes: newDifficultyvotes
    }).eq("puzzleid", puzzleId);

}

// updates the orderNum column of a puzzle
async function update_puzzle_ordernum(puzzleId, newOrderNum){
    
    const { error } = await dataObject.from("puzzles").update({
        ordernum: newOrderNum
    }).eq("puzzleid", puzzleId);

}

// gets all (saved) puzzles of a certain difficulty from the database
// returns an array of objects (one for each puzzle)
// with attributes puzzleId (int), grid (2d array), ratings (array of strings), finalised (boolean), noodles (array of objects)
async function get_puzzles_of_difficulty(difficulty){

    let returnArray = [];

    // gets an array of (saved) data objects (of the given difficulty) from "puzzles"
    // with attributes puzzleid, grid, ratings, finalised
    const { data, error } = await dataObject.from("puzzles").select().eq("saved",true).eq("difficulty",difficulty);

    if (data == null){
        return [];
    }

    // if the database contains no puzzles of the corresponding difficulty, returns an empty array
    if (data.length == 0){
        //console.log("no puzzles found");
        return [];
    }
    
    // gets an array of data objects (for the puzzles fetched) from "noodles"
    // with attributes startx, starty, endx, endy, icon, length, colour, puzzle
    const { data:noodleData, error:noodleError } = await dataObject.from("noodles").select().in("puzzle",data.map(x => x.puzzleid)); 

    for (let i = 0; i < data.length; i++) {

        // the current puzzle object being worked on
        let puzzle = data[i];

        // the id of the current puzzle
        let puzzleId = puzzle.puzzleid;

        // getting the list of noodle objects (will be an attribute of the puzzle object)
        let noodles = [];

        // gets list of noodles for the current puzzle
        let puzzleNoodleData = noodleData.filter(x => (x.puzzle == puzzleId));

        // for each noodle, adds a corresponding object to the noodles list
        for (let j = 0; j < puzzleNoodleData.length; j++){

            let current = puzzleNoodleData[j];

            noodles.push({
                "start": [current.startx,current.starty],
                "end": [current.endx,current.endy],
                "icon": current.icon,
                "length": current.length,
                "colour": current.colour,
            })

        }

        // sort noodles by length in ascending order
        noodles.sort((a,b) => (a.length - b.length));

        // adds an object for the current puzzle to the array
        returnArray.push({
            "puzzleId": puzzleId,
            "grid": string_to_grid(puzzle.grid),
            "ratings": puzzle.ratings.split(","),
            "finalised": puzzle.finalised,
            "noodles": noodles,
            "difficultyVotes": puzzle.difficultyvotes.split(","),
            "orderNum": puzzle.ordernum
        });

    }

    // sort puzzles by ID, ascending
    returnArray.sort((a,b) => (a.orderNum - b.orderNum));

    // note the value this returns is a promise, so you must use:
    // let puzzleArray = await get_puzzles_of_difficulty(difficulty)
    return returnArray;

}
    