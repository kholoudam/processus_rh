const router=require("express").Router();


const controller =
require("../controllers/recommendation.controller");



router.get(
"/",
controller.getRecommendations
);



router.post(
"/",
controller.createRecommendation
);



router.get(
"/candidate/:id",
controller.getByCandidate
);



module.exports=router;