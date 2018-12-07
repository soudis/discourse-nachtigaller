var dav = require('dav');
//dav.debug.enabled = true;
var moment = require('moment');
var config = require('../config/config');
var stringify = require('json-stringify-safe');
var ical = require('ical2json');

var account;

var xhr = new dav.transport.Basic(
  new dav.Credentials({
    username: config.calendar.username,
    password: config.calendar.password
  })
);

function getAccount() {
	if (account) {
		return Promise.resolve(account);
	} else {
		return dav.createAccount({ server: config.calendar.server, xhr: xhr })
			.then(function(createdAccount) {
//				console.log("Account retrieved: " + stringify(createdAccount, null, 2));
  				account = createdAccount;
  				return account;
			});
	}
}

function getCalendar () {
	return getAccount()
		.then((account) => {
//			console.log("Calendars: " + stringify(account.calendars, null, 2));
			calendar = account.calendars.find((calendar) => { return calendar.displayName.toLowerCase() === config.calendar.calendar.toLowerCase(); });
			if (calendar) {
				return calendar;
			} else {
				throw "Calendar " + config.calendar.calendar + " not found";
			}
		})
}

exports.getEventsBetween = (start, end) => {
	return getAccount()
		.then((account) => {
			//console.log("Calendars: " + stringify(account.calendars, null, 2));
			calendar = account.calendars.find((calendar) => { return calendar.displayName.toLowerCase() === config.calendar.calendar.toLowerCase(); });
			if (calendar) {

				var filter =     
					{
				        type: "comp-filter",
				        attrs: {name: "VCALENDAR"},
				        children: [
				        	{
				        		type: "comp-filter",
				        		attrs: {name: "VEVENT"},
				        		children: [
				        			{
				        				type: "time-range",
				        				attrs: {
				        					start: moment(start).format("YYYYMMDDTHHmmss"), 
				        					end: moment(end).format("YYYYMMDDTHHmmss")
				        				}
				        			}
				        		]
				        	}
				        ]        
				    };
				return dav.syncCalendar(calendar, {xhr:xhr, filters: [filter]});
			} else {
				throw "Calendar " + config.calendar.calendar + " not found";
			}
		})	
}

exports.createEvent = (start, end, summary, uid) => {
	return getCalendar()
		.then((calendar) => {
			//console.log("calendar: " + stringify(calendar, null, 2));
			event = 
				{
				  "VCALENDAR": [
				    {
				      "PRODID": "-//Abdul Nachtigaller//DE",
				      "VERSION": "2.0",
				      "VEVENT": [
				        {
				          "DTSTART;VALUE=DATE": moment(start).format("YYYYMMDD"),
				          "DTEND;VALUE=DATE": moment(end).format("YYYYMMDD"),
				          "DTSTAMP": moment().format("YYYYMMDDTHHmmss") + "Z",
				          "UID": uid + "@abdul-nachtigaller",
				          "STATUS": "CONFIRMED",
				          "SUMMARY": summary
				        }
				       ]
				    }
				    ]
				};			
			return dav.createCalendarObject(calendar, {xhr:xhr, filename: uid + "_abdul-nachtigaller.ics", data: ical.revert(event)});		
		})
}

/*this.createEvent(moment(), moment(), "Test Event", "12345").then((object) => {
	console.log("return: " + stringify(object, null, 2));
}).catch((error) => {
	console.log("error: " + (error.stack||error));
})*/







