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

	var addNotifications = (notification) => {
		var notifications = robot.brain.get('notifications');
		if (!notifications) {
			notifications = [];
		}
		if (notification.repeat) {
			var momentType, endDate;
			if (notification.repeat.type === 'DAILY') {
				momentType = 'days';
				endDate = moment(notification.date).add(1, 'years');
			} else if (notification.repeat.type === 'WEEKLY') {
				momentType = 'weeks';
				endDate = moment(notification.date).add(1, 'years');
			} else if (notification.repeat.type === 'MONTHLY') {
				momentType = 'months';
				endDate = moment(notification.date).add(1, 'years');
			} else if (notification.repeat.type === 'YEARLY') {
				momentType = 'years';
				endDate = moment(notification.date).add(5, 'years');
			}

			var date = moment(notification.date);
			var i = 0;
			var repeatId = robot.brain.get('notification_sequence')+1;
			robot.brain.set('notification_sequence', repeatId);	
			while(date.isSameOrBefore(endDate)) {	
				robot.brain.set('notification_sequence', robot.brain.get('notification_sequence')+1);								
				notifications.push({
					recipients: notification.recipients,
					description: notification.description,
					date: date,
					attempts: 0,
					id: robot.brain.get('notification_sequence'),
					repeatId: repeatId
				});
				i+=notification.repeat.interval;
				date = moment(notification.date).add(i, momentType);
			}
			robot.brain.set("notifications", notifications);

		} else {
			notification.id = robot.brain.get('notification_sequence')+1;
			notification.attempts = 0;
			robot.brain.set('notification_sequence', notification.id);
			notifications.push(notification);
			robot.brain.set("notifications", notifications);				
		}
	}

	var createNotification = (res, repeated = false, individually = false) => {
		if (res.match[1].toLowerCase().includes('einzeln')) {
			return;
		} else {

			new Promise((resolve, reject) => {
				var recipients = res.match[1].trim().split(' ').join('').split('@').join('').split(',');
				var date, repeat;
				if (repeated) {
					var parts = res.match[2].trim().split(' ');
					if (parts.length < 2) {
						reject("Ich verstehe leider nicht. Wenn du 'ab <Datum>' sagst, muss ich danach wissen wie oft ich die Erinnerung wiederholen soll, z.B.: 'täglich', 'wöchentlich', 'monatlich', 'jährlich' oder auch 'alle 2 Wochen', 'alle 2 Jahre', ...");
					}
					date = moment(parts[0].trim(), 'D.M.YYYY');
					if (parts[1].trim() === 'alle') {
						if (parts.length < 4) {
							reject("Ich verstehe leider nicht. Wenn du 'ab <Datum>' sagst und dann 'alle', muss ich danach wissen wie oft ich die Erinnerung wiederholen soll, z.B.: 'alle 2 Wochen', 'alle 2 Monate' oder 'alle 2 Jahre'");
						} else {
							repeat = {interval: parseInt(parts[2].trim()) }
							var type = parts[3].trim().toLowerCase();
							if (type === 'wochen') {
								repeat.type = 'WEEKLY';
							} else if (type === 'monate') {
								repeat.type = 'MONTHLY';
							} else if (type === 'jahre') {
								repeat.type = 'YEARLY';
							} else if (type === 'tage') {
								repeat.type = 'DAILY';
							} else {
								reject("Ich verstehe leider nicht. Wenn du 'ab <Datum>' sagst und dann 'alle', muss ich danach wissen wie oft ich die Erinnerung wiederholen soll, z.B.: 'alle 2 Wochen', 'alle 2 Monate' oder 'alle 2 Jahre'");
							}
						}
					} else {
						if (parts.length > 2) {
							reject("Ich verstehe leider nicht. Wenn du 'ab <Datum>' sagst, muss ich danach wissen wie oft ich die Erinnerung wiederholen soll, z.B.: 'täglich', 'wöchentlich', 'monatlich', 'jährlich' oder auch 'alle 2 Wochen', 'alle 2 Jahre', ...");
						} else {
							repeat = {interval: 1 }
							var type = parts[1].trim().toLowerCase();	
							if (type === 'wöchentlich') {
								repeat.type = 'WEEKLY';
							} else if (type === 'monatlich') {
								repeat.type = 'MONTHLY';
							} else if (type === 'jährlich') {
								repeat.type = 'YEARLY';
							} else if (type === 'täglich') {
								repeat.type = 'DAILY';
							} else {
								reject("Ich verstehe leider nicht. Wenn du 'ab <Datum>' sagst, muss ich danach wissen wie oft ich die Erinnerung wiederholen soll, z.B.: 'täglich', 'wöchentlich', 'monatlich', 'jährlich' oder auch 'alle 2 Wochen', 'alle 2 Jahre', ...");
							}
						}
					}

				} else {
					date = moment(res.match[2].trim(), 'D.M.YYYY');
				}
				var description = res.match[3].trim();

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
					resolve({recipients: recipients, description: description, date: date, repeat: repeat});
				}
			}).then((notification) => {
				if (individually) {
					notification.recipients.forEach((recipient) => {
						if (recipient.toLowerCase() === config.discourse.allowedGroup.toLowerCase()) {
							var security = robot.brain.get("security");
							security.allowedUsers.forEach((user) => {
								if (user.toLowerCase() !== config.discourse.allowedGroup.toLowerCase()) {
									addNotifications({
										recipients: [user],
										description: notification.description,
										date: notification.date,
										repeat: notification.repeat
									});
								}
							});
						} else {
							addNotifications({
								recipients: [recipient],
								description: notification.description,
								date: notification.date,
								repeat: notification.repeat
							})
						}
					})
				} else {
					addNotifications(notification);
				}
				var notifications = robot.brain.get('notifications');			
				if (config.debug) {
					console.log('DEBUG: new Notifications: ' + JSON.stringify(notifications, null, 2));
				}
				return calendar.createEvent(notification.date, notification.date, notification.description + ": " + notification.recipients.join(','), notification.id, notification.repeat)
					.then(() => {return notification;});			

			}).then((notification) => {
				res.reply(discourse.humblify("Ich werde " + notification.recipients.join(',') + (repeated?" ab ":" am ") + res.match[2].trim() + " an " + notification.description + " erinnern! Immer und immer wieder..."));
			}).catch((error) => {
				res.reply(discourse.humblify(_t("error", {error:error.stack || error})));
			}) 		
		}
	}

	robot.respond("/(.*) ab (.*) an (.*) erinnern.*/i", (res) => {
		createNotification(res, true, false);
  	}); 

  	robot.respond("/(.*) einzeln ab (.*) an (.*) erinnern.*/i", (res) => {
		createNotification(res, true, true);
  	}); 	

	robot.respond("/(.*) am (.*) an (.*) erinnern.*/i", (res) => {
		createNotification(res, false, false);
  	}); 

	robot.respond("/(.*) einzeln am (.*) an (.*) erinnern.*/i", (res) => {
		createNotification(res, false, true);
  	}); 	  	

	robot.respond("/erledigt/i", (res) => {


		notifications = robot.brain.get('notifications');
		id = notifications.findIndex((item) => {
			return item.associatedTopic === res.message.room;
		})
		if(id > -1) {
			notification = notifications[id];
			if (notification.dones) {
				notification.dones ++;
			} else {
				notification.dones = 1;
			}
			if (notification.dones >= notification.recipients.length && !noticiation.recipients.include(config.discourse.allowedGroup)) {
				notifications.splice(id, 1);
			}
			if (config.debug) {
				console.log("DEBUG: new notifications after erledigt: " + JSON.stringify(notifications, null, 2));
			}
			robot.brain.set('notifications', notifications);

			res.reply(discourse.humblify("Danke fürs Erledigen!!! :heart:"));
		} else {
			res.reply(discourse.humblify("Was hast du erledigt? Antworte beim Abschließen von Aufgaben bitte direkt auf meine Erinnerungsnachricht."));			
		}

	});

	robot.respond("/aufhören/i", (res) => {


		notifications = robot.brain.get('notifications');
		id = notifications.findIndex((item) => {
			return item.associatedTopic === res.message.room;
		})
		if(id > -1) {
			notification = notifications[id];
			if (notification.repeatId) {
				notifications = notifications.filter((n) => {
					if (!n.repeatId) {
						return true;
					} else {
						return n.repeatId !== notification.repeatId;
					}
				});
			} else {
				notifications.splice(id, 1);
			}

			if (config.debug) {
				console.log("DEBUG: new notifications after aufhören: " + JSON.stringify(notifications, null, 2));
			}
			
			robot.brain.set('notifications', notifications);

			res.reply(discourse.humblify("Ich werde dich damit in Zukunft nicht mehr belästigen!"));
		} else {
			res.reply(discourse.humblify("Womit soll ich aufhören? Antworte bitte direkt auf meine Erinnerungsnachricht."));			
		}

	});	

}
