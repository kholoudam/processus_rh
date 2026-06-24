const service =
require("../services/recommendation.service");



exports.getRecommendations = async(req,res)=>{


try{


const data =
await service.getAllRecommendations();


res.json(data);


}

catch(error){

res.status(500)
.json({
message:error.message
});

}


};




exports.createRecommendation = async(req,res)=>{


try{


const result =
await service.createRecommendation(req.body);


res.json(result);


}

catch(error){


res.status(500)
.json({
message:error.message
});


}


};




exports.getByCandidate = async(req,res)=>{


try{


const result =
await service.getCandidateRecommendations(
req.params.id
);


res.json(result);


}

catch(error){

res.status(500)
.json({
message:error.message
});


}


};