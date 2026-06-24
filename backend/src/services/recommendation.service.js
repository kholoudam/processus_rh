const pool = require("../config/db");


// récupérer toutes les recommandations
exports.getAllRecommendations = async () => {

    const result = await pool.query(`

        SELECT 
        r.id,

        c.name AS candidate_name,
        c.email AS candidate_email,

        j.title AS job_title,
        j.company,

        r.reason,
        r.created_at


        FROM recommendation r

        JOIN candidate c
        ON r.candidate_id = c.id

        JOIN job j
        ON r.job_id = j.id


        ORDER BY r.created_at DESC

    `);


    return result.rows;

};



// créer recommandation

exports.createRecommendation = async(data)=>{


const {
candidate_id,
job_id,
reason
}=data;



const result = await pool.query(`

INSERT INTO recommendation
(
candidate_id,
job_id,
reason
)

VALUES ($1,$2,$3)

RETURNING *

`,
[
candidate_id,
job_id,
reason
]
);



return result.rows[0];


};



// recommandations par candidat

exports.getCandidateRecommendations = async(candidateId)=>{


const result = await pool.query(`


SELECT

j.title,
j.company,
r.reason,
r.created_at


FROM recommendation r


JOIN job j

ON r.job_id=j.id


WHERE r.candidate_id=$1


`,
[candidateId]
);


return result.rows;


};