const request = require('request');

const post = (req, callback) => {
    let option = {
        json: true,
        headers: req.headers,
        body: req.body,
        url: req.url
    }
    request.post(option, function (err, res) {
        if (res) {
            callback(null, res)
        }
        else {
            callback(err, null);
        }
    });
}

exports.post = post

