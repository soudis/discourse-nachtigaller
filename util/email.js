var ImapClient = require('emailjs-imap-client');
var config = require('../config/config.json');
var utf7 = require('./utf7');
var Promise = require("bluebird");

var foldersCache, foldersCacheTime;

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
	if (!foldersCacheTime || !foldersCache || foldersCacheTime - Date.now() > 1000 * 60 * 60 * 24) {
		var client = getClient();
		return client.connect()
			.then(() => {
				return client.listMailboxes()
			})
			.then((mailboxes) => {
				return flattenFolders(mailboxes);			
			})
			.finally(() => {
				return client.close();
			});
	} else {
		return Promise.resolve(foldersCache);
	}
}

exports.checkEmails = (folders) => {
	return Promise.all(folders.map((folder) => {
		var client = getClient();
		return client.connect()
			.then(() => {
				return client.search(utf7.imap.encode(folder.path), { unkeyword: 'discourse-mailbot' }, { byUid: true })
			})
			.then((uids) => {
				if (uids && uids.length > 0) {
					return client.setFlags(utf7.imap.encode(folder.path), uids.join(','), {add: ['discourse-mailbot'], set: ['discourse-mailbot']}, { byUid: true})
					  .then(() => {
					  	return client.listMessages(utf7.imap.encode(folder.path), uids.join(','), ['uid', 'flags', 'envelope', 'bodystructure'], { byUid: true});
					  })
					
				}				
				else {
					return [];
				}
			})
			.then((messages) => {
				return {folder: folder, messages: messages};
			})
			.finally(() =>  {
				return client.close();
			})
	}));
}