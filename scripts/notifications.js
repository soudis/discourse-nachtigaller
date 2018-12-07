//var email = require('../util/email');
var config = require('../config/config.json');
var querystring = require('query-string');
var _t = require('../util/strings')._t;
var moment = require('moment');
var calendar = require('../util/calendar');

var discourse = require('../util/discourse');
var Promise = require("bluebird");

/**
 * Returns TRUE if the first specified array contains all elements
 * from the second one. FALSE otherwise.
 *
 * @param {array} superset
 * @param {array} subset
 *
 * @returns {boolean}
 */
function arrayContainsArray (superset, subset) {
  if (0 === subset.length) {
    return false;
  }
  return subset.every(function (value) {
    return (superset.indexOf(value) >= 0);
  });
}

module.exports = (robot) => {

    // check emails
    var checkNotfications = () => {
	  	notifications = robot.brain.get("notifications") || [];

	  	Promise.all(notifications.map((notification) => {
	  		if (moment(notification.date).isSameOrBefore(moment(), 'day')) {
	  			if (!notification.attempts || notification.attempts === 0) {
	  				return discourse.sendPM(robot, 
								_t("notification_first_title", {description: notification.description}), 
								_t("notification_first_body", {description: notification.description}),
								notification.recipients)
	  					.then((response) => {
	  						//console.log("response: " + JSON.stringify(response, null, 2));
	  						notification.attempts = 1;
	  						notification.lastAttempt = moment();
	  						notification.associatedTopic = response.topic_id;
	  						notification.date = moment(notification.date).add(config.notifications.defaultInterval, 'days');
	  						//console.log ('new notificiation: ' + JSON.stringify(notification, null, 2));
	  						return notification;
	  					});
	  			} else {

	  				return discourse.sendPM(robot, 
								_t("notification_second_title", {description: notification.description, attempt: notification.attempts+1}), 
								_t("notification_second_body", {description: notification.description, attempt: notification.attempts+1}),
								notification.recipients,
								notification.associatedTopic)
	  					.then((response) => {
	  						notification.attempts++;
	  						notification.lastAttempt = moment();
	  						notification.associatedTopic = response.topic_id;
	  						notification.date = moment(notification.date).add(config.notifications.defaultInterval, 'days');
	  						//console.log ('new new notificiation: ' + JSON.stringify(notification, null, 2));
	  						return notification;
	  					});
	  			}
	  			
	  		} else {
	  			return notification;
	  		}	
	  	})).then((notifications) => {
	  		robot.brain.set('notifications', notifications);
	  	}).catch((error) => {
	  		console.log("ERROR checking notifications: " + (error.stack || error));
	  	})
	};

	if (config.notifications.checkNotifications) {
		setInterval(checkNotfications, 1000 * config.notifications.checkDelay);
	}

	robot.respond("/(.*) am (.*) an (.*) erinnern.*/i", (res) => {

		new Promise((resolve, reject) => {
			var recipients = res.match[1].split(' ').join('').split('@').join('').split(',');
			var date = moment(res.match[2], 'D.M.YYYY');
			var description = res.match[3];

			//console.log("notification: " + JSON.stringify( {recipients: recipients, description: description, date: date}, null, 2));

			var security = robot.brain.get('security');

			if (!recipients || recipients.length < 1) {
				reject("Ich weiß nicht wen ich benachrichtigen soll");
			} else if (!arrayContainsArray(security.allowedUsers, recipients)) {
				reject("Ich kenne von denen jemanden nicht: " + res.match[1]);
			} else if (!date.isValid()) {
				reject("Wann soll das sein: " + res.match[2]);
			} else if (date.isBefore(moment().subtract(1, 'days'))) {
				reject("Das Datum liegt in der Vergangenheit!");
			}else if (!description || description === '') {
				reject("An was soll ich erinnern?");
			} else {
				resolve({recipients: recipients, description: description, date: date});
			}
		}).then((notification) => {
			var notifications = robot.brain.get('notifications');
			if (!notifications) {
				notifications = [];
			}
			notification.id = robot.brain.get('notification_sequence')+1;
			notification.attempts = 0;
			robot.brain.set('notification_sequence', notification.id);
			notifications.push(notification);
			robot.brain.set(notifications);

			return calendar.createEvent(notification.date, notification.date, notification.description + ": " + notification.recipients.join(','), notification.id)
				.then(() => {return notification;});

			//console.log('new Notifications: ' + JSON.stringify(notifications, null, 2));

		}).then(() => {
			res.reply(discourse.humblify("Ich werde " + notification.recipients.join(',') + " an " + notification.description + " erinnern! Immer und immer wieder..."));
		}).catch((error) => {
			res.reply(discourse.humblify(_t("error", {error:error.stack || error})));
		}) 
  	}); 

	robot.respond("/erledigt/i", (res) => {


		notifications = robot.brain.get('notifications');
		id = notifications.findIndex((item) => {
			return item.associatedTopic === res.message.room;
		})
		if(id > -1) {
			notification = notifications[id];
			notifications.splice(id, 1);

			//console.log("new Notificaitons after erledigt: " + JSON.stringify(notifications, null, 2));

			robot.brain.set('notifications', notifications);

			res.reply(discourse.humblify("Danke fürs Erledigen!!! :heart:"));
		} else {
			res.reply(discourse.humblify("Was hast du erledigt? Antworte beim Abschließen von Aufgaben bitte direkt auf meine Erinnerungsnachricht."));			
		}

	});

}
