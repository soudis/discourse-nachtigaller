var ImapClient = require('emailjs-imap-client');
var config = require('../config/config.json');
var utf7 = require('./utf7');
var Promise = require("bluebird");

var foldersCache, foldersCacheTime;

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function flattenFolders(node, result = []){
	if(!node.root) {
    	result.push(utf7.imap.decode(node.path));
	}
    node.children.forEach((child) => {
		flattenFolders(child, result);
    })         
    return result;
}

function getClient() {
	return new ImapClient(config.server.host, config.server.port, config.server.options);
}

function getRecipients(folders, path) {
	var result = folders.findIndex((item) => {
		return item.path.toLowerCase() === path.toLowerCase();
	});
	if (result > -1) {
		return folders[result].recipients;
	} else {
		return [];
	}
}

exports.subscribe = (folders, path, username) => {
	var result = folders.findIndex((item) => {
		return item.path.toLowerCase() === path.toLowerCase();
	});
	if (result > -1) {
		if (!folders[result].recipients.includes(username)) {
			folders[result].recipients.push(username);
		}
	} else {
		folders.push({
			path: path,
			recipients: [username]
		})
	}
}

exports.unsubscribe = (folders, path, username) => {
	var result = folders.findIndex((item) => {
		return item.path.toLowerCase() === path.toLowerCase();
	});
	if (result > -1) {
		var index = folders[result].recipients.indexOf(username);
		if (index > -1) {
			folders[result].recipients.splice(index, 1);
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

exports.listFolders = () => {
	if (!foldersCacheTime || !foldersCache || Date.now() - foldersCacheTime  > 1000 * 60 * 60 * 24) {
		var client = getClient();
		return client.connect()
			.then(() => {
				return client.listMailboxes()
			})
			.then((mailboxes) => {
				var folders =  flattenFolders(mailboxes);					
				if (config.excludeFolders && config.excludeFolders.length > 0) {
					return folders.filter((folder) => {return !config.excludeFolders.includes(folder);});
				} else {
					return folders;
				}					
			})
			.then(() => {
				return client.close();
			});
	} else {
		return Promise.resolve(foldersCache);
	}
}

exports.checkEmails = (subscriptions) => {
	return this.listFolders()
		.then((folders) => {
			return 	Promise.all(folders.map((folder) => {
				var recipients = getRecipients(subscriptions, folder);
				var client = getClient();
				return client.connect()
					.then(() => {
						return client.search(utf7.imap.encode(folder), { unkeyword: 'mailbot-' + folder.hashCode() }, { byUid: true })
					})
					.then((uids) => {
						if (uids && uids.length > 0) {
							return client.setFlags(utf7.imap.encode(folder), uids.join(','), {add: ['mailbot-' + folder.hashCode()], set: ['mailbot-'+ folder.hashCode()]}, { byUid: true})
							  .then(() => {
							  	if (recipients.length > 0) {
							  		return client.listMessages(utf7.imap.encode(folder), uids.join(','), ['uid', 'flags', 'envelope', 'bodystructure'], { byUid: true});
							  	} else {
							  		return [];
							  	}
							  	
							  })
							
						}				
						else {
							return [];
						}
					})
					.then((messages) => {
						return {folder: {path: folder, recipients: recipients}, messages: messages};
					})
					.finally(() =>  {
						return client.close();
					})
			}));

		})
}