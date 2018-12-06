var config = require('../config/config.json');
var querystring = require('query-string');
var _t = require('../util/strings')._t;
var discourse = require('../util/discourse');

module.exports = (robot) => {

  	robot.listenerMiddleware((context, next, done) => {
  		var security = robot.brain.get("security");
  		security = undefined;
  		// refresh every hour
  		if (!security || !security.allowedUsers || security.allowedUsers.length == 0 || !security.lastRefresh || Date.now() - security.lastRefresh > 1000 * 60 * 60) {
  			security =  {};
			robot.http(discourse.discourseURL('groups/' + config.discourse.allowedGroup + '/members.json'))
				.header('Accept', 'application/json')
			    .get()((err, response, body) => {
			    	console.log("err: " + err + ", response: " + response + ", body: " + body);
			    	body = JSON.parse(body);
			    	if(!err && !body.errors){
			    		security.allowedUsers = body.members.map((member) => {return member.username;});
			    		security.lastRefresh = Date.now();		
			    		console.log("allowed: " + JSON.stringify(security.allowedUsers));			    		
			    		robot.brain.set("security", security);
			    		console.log("set");
			    		if (security.allowedUsers && security.allowedUsers.includes(context.response.message.user.username)) {
				      		next();
				      	} else {
				        	context.response.reply(_t("not_allowed"));
				        	done();
				        }
			    	} else {
			    		console.log ("ERROR FETCHING GROUPS: " + body.errors);
			    	}
			    });  			
			
  		} else {
	  		console.log("security: " + JSON.stringify(security));
	      	if (security.allowedUsers && security.allowedUsers.includes(context.response.message.user.username)) {
	      		next();
	      	} else {
	        	context.response.reply(_t("not_allowed"));
	        	done();
	        }
	    }
  	});
}