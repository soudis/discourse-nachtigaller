var email = require('../util/email');
var config = require('../config/config.json');
var querystring = require('query-string');
var _t = require('../util/strings')._t;
var discourse = require('../util/discourse');
var Promise = require("bluebird");

module.exports = (robot) => {



  function getSubscribedMessage(res) {
	var subscribed;
	if (robot.brain.get("folders")) {
		subscribed = robot.brain.get("folders").filter((folder) => {
			return folder.recipients && folder.recipients.includes(res.message.user.username);
		})
	} else {
		subscribed = [];
	}
	subscribed = subscribed.map((folder) => {
		return folder.path;
	});
	return (subscribed&&subscribed.length>0?
		  				_t("subscribed", {subscriptions: subscribed.join("\n* ") }):
		  				_t("subscribed_none")
		  				)
  }


  // check emails
  var checkEmails = () => {
  	folders = robot.brain.get("folders") || [];
  	console.log("folders: " + JSON.stringify(folders));
  	email.checkEmails(folders)
  		.then((results) => {
  			return Promise.all(results.map((result) => {
  				if (result.folder.recipients && result.folder.recipients.length > 0) {
  					console.log("recipients: " + JSON.stringify(result.folder.recipients));
	  				return Promise.all(result.messages.map((message) => {
						return discourse.sendPM(robot, 
							_t("newemail_title",{folder: result.folder.path, subject: message.envelope.subject}), 
							_t("newemail_body", {address: message.envelope.from[0].address, subject: message.envelope.subject, folder: result.folder.path }),
							result.folder.recipients);  					
	  				}));		
	  			} else {
	  				return;
	  			}
  			}));
  		})
  		.catch((error) => {
  			console.log("ERROR polling e-mail: " + error.stack);
  		})
  }
  if (config.checkMails) {
	  setInterval(checkEmails, 1000 * config.pollingDelay);
  }


  robot.respond("/.*Postfächer.*/i", (res) => {
  	//console.log("user: " + JSON.stringify(res.message.user));
  	email.listFolders()
  		.then((folders) => {
		  	res.reply(discourse.humblify(_t("mailboxes", {mailboxes: folders.join("\n* ")})+ getSubscribedMessage(res))); 
  		})
  		.catch((error) => {
  			res.reply(discourse.humblify(_t("error", {error:error})));
  		})
  });

  robot.respond("/.*Sag Willkommen.*/i", (res) => {
  	//console.log("user: " + JSON.stringify(res.message.user));
  	Promise.all(robot.brain.get("security").allowedUsers.map((user) => {discourse.sendPM(robot, _t("welcome_title", {username:user}), _t("welcome"), [user]);}))
    	.catch((error) => {
			console.log("ERROR sending welcome message: " + error);
    	});
  });  		

  robot.respond("/(.*) abonnieren.*/i", (res) => {

  	var mailbox = res.match[1];
  	var folders = robot.brain.get("folders") || [];
  	email.listFolders()
  		.then((foldersAvailable) => {
  			result = foldersAvailable.findIndex((item) => mailbox.toLowerCase() === item.toLowerCase());
		  	if (result > -1) {
		  		email.subscribe(folders, foldersAvailable[result], res.message.user.username);
		  		robot.brain.set("folders", folders);
		  		res.reply(discourse.humblify(_t("subscribed_success", {mailbox: foldersAvailable[result]})+ "\n\n" + getSubscribedMessage(res))); 
		  	} else {
		  		res.reply(discourse.humblify(_t("subscribed_fail", {mailbox: mailbox, mailboxes: foldersAvailable.join("\n* ") })+ "\n\n" + getSubscribedMessage(res))); 
		  	}
  		})
  		.catch((error) => {
  			res.reply(discourse.humblify(_t("error", {error:error})));
  		})  	
  	//console.log("user: " + JSON.stringify(res.message.user));
  });  	

  robot.respond("/(.*) abbestellen.*/i", (res) => {

  	var mailbox = res.match[1];
  	var folders = robot.brain.get("folders") || [];
  	email.listFolders()
  		.then((foldersAvailable) => {
  			result = foldersAvailable.findIndex((item) => mailbox.toLowerCase() === item.toLowerCase());
		  	if (result > -1) {
		  		if (email.unsubscribe(folders, foldersAvailable[result], res.message.user.username)) {
			  		robot.brain.set("folders", folders);
			  		res.reply(discourse.humblify(_t("unsubscribed_success", {mailbox: foldersAvailable[result]})+ "\n\n" + getSubscribedMessage(res))); 		  			
		  		} else {
			  		res.reply(discourse.humblify(_t("unsubscribed_notsubscribed", {mailbox: foldersAvailable[result]})+ "\n\n" + getSubscribedMessage(res))); 		  			
		  		}
		  	} else {
		  		res.reply(discourse.humblify(_t("unsubscribed_fail", {mailbox: mailbox})+ "\n\n" + getSubscribedMessage(res))); 
		  	}
  		})
  		.catch((error) => {
  			res.reply(discourse.humblify(_t("error", {error:error})));
  		})  	
  	//console.log("user: " + JSON.stringify(res.message.user));
  });  	  
  
}
