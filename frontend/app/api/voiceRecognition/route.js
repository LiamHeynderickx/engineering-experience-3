const spawner = require('child_process').spawn;

console.log('Start python code');

const python_process = spawner('python',['-u','./OldVoiceRecog.py']); //old voice recognition (is faster)


python_process.stdout.on('data', (data)=>{
    
    result = data.toString().trim();
    if(result === "error"){
        console.log("Problem with postion");
    }
    else{
        console.log("Old output: ", result);
        //split the string in 2
        const letter = result.charAt(0).toUpperCase();
        const rest = result.slice(1);
    
        //find nur of letter
        const letters = "ABCDEFGHIJ";
        const index = letters.indexOf(letter);
        const nrEquivalent = index; //index starts at 0
        const newResult = nrEquivalent.toString() + rest;
    
        console.log("New output: ", newResult);
    }
    

});
