var config = require('../config/config.json');
var querystring = require('query-string');
var _t = require('../util/strings')._t;

exports.discourseURL = (endpoint, parameters = undefined) => {
   	return config.discourse.apiurl + '/' + endpoint +
    '?api_key=' + config.discourse.apikey +
    '&api_username=' + config.discourse.username +
    '&' + querystring.stringify(parameters);
}

exports.humblify = ( text) => {
	return _t("hellos") + "!\n\n" 
		+ text + "\n\n"
		+ _t("byes") + ", Prof. Dr. Abdul Nachtigaller \n\n"
		+ "> " + _t("citation");
}

exports.sendPM = (robot, title, body, recipients, topic) => {
	return new Promise ((resolve, reject) => {
		console.log("title: " + title);
		robot.http(this.discourseURL('posts'))
			.header('Content-Type', 'application/json')
			.header('Accept', 'application/json')
		    .post(JSON.stringify({
		        'title': title,
		        'raw': this.humblify(body),
		        'target_usernames': recipients.join(','),
		        'archetype': 'private_message',
		        'topic_id': topic
		    }))((err, response, body) => {
		    	//console.log("err: " + err + ", response: " + response + ", body: " + body);
		    	body = JSON.parse(body);
		    	if(err){
		    		reject(err);
		    	} else if (body.errors) {
		    		reject(body.errors.join(", "));
		    	} else {
		    		resolve(body);
		    	}
		    });
	});
}