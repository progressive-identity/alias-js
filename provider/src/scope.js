const express = require('express');

const router = express.Router();

router.get('/describe/', (req, res) => {
    const queryString = Object.keys(req.query).map(k => k + '=' + req.query[k]).join('&');
    const url = config.processor[0].http_url + "alias/scope/?" + queryString;
    fetch(url)
        .then(r => r.json())
        .then(r => res.json(r))
        .catch(r => res.status(500).send(r))
});


module.exports.router = router;
