const Https = require('https');
const Fs = require('fs').promises;
const Discord = require('discord.js');
const DiscordClient = new Discord.Client();
const Config = require("../config.json");



//{
//	"TrainerChannels": {
//		"511496517056724996": [ "541232877497483267", "/api/webhooks/..."],
//		"ChannelId": [ "RequiredRoleId", "WebhookPath"]
//	},
//	"TrainerToken": "DiscordAuthToken"
//}
var ConfigChannels = Config.TrainerChannels;
var DiscordToken = Config.TrainerToken;


DiscordClient.on('ready', () => {
	console.log(`Logged in as ${DiscordClient.user.tag}!`);
	DiscordClient.on('error', console.error);
});

DiscordClient.login(DiscordToken);


const MaxComplexity = 1000;
const MaxWeight = 100;
const GlitchCommand = "EMP";
const GlitchTime = 120000;


var Patterns = {};
var Triggers = {};
var LongestTrigger = 0;

function CrossProduct(sets) {
	this.sets = sets;
	this.carets = [];
	this.args = [];
}
CrossProduct.prototype = {
	init: function() {
		for (var i = 0, n = this.sets.length; i < n; i++) {
			this.carets[i] = 0;
			this.args[i] = this.sets[i][0];
		}
	},
	next: function() {
		if (!this.args.length) {
			this.init();
			return true;
		}
		var i = this.sets.length - 1;
		this.carets[i]++;
		if (this.carets[i] < this.sets[i].length) {
			this.args[i] = this.sets[i][this.carets[i]];
			return true;
		}
		while (this.carets[i] == this.sets[i].length) {
			if (i === 0) return false;
			this.carets[i] = 0;
			this.args[i] = this.sets[i][0];
			this.carets[--i]++;
		}
		this.args[i] = this.sets[i][this.carets[i]];
		return true;
	},
	do: function(block, _context) {
		return block.apply(_context, this.args);
	}
}

const NonemptyLineRegex = /^.+/gm;
const CommentRegex = /^\s*[(#\/]/;
const PatternPartsRegex = /\s*(?:(\/)?\s*(\w+(?:'\w+)?)|(\*))/gi;
const TriggerLineRegex = /^\s*\[/;
const TriggerRegex = /^\s*\[(.+?)\]\s+-\s+\[(.+?)\]\s*(?:\/\/.*)?$/;
const TriggerReplaceRegex = /^\s*(.+?)\s*(\d+)?$/;
function ProcessPatternLine(line) {
	let splitter = /\s-\s/.exec(line);
	if(splitter === null) return false;
	splitter = splitter.index;
	
	let commentStart = line.indexOf('//', splitter + 1);
	if(commentStart !== -1) line = line.substring(0, commentStart);
	
	let patternString = line.substring(0, splitter).trim();
	PatternPartsRegex.lastIndex = 0;
	let lastIndex = 0;
	
	let patternParts = [];
	let lastPatternPart;
	
	do {
		let patternPart = PatternPartsRegex.exec(patternString);
		if(patternPart === null || patternPart.index !== lastIndex) return false;
		if(patternPart[1] !== undefined) { //has slash
			if(typeof(lastPatternPart) !== 'object') return false;
			lastPatternPart.push(patternPart[2].toLowerCase());
		}
		else {
			lastPatternPart = (patternPart[3] !== undefined) ? 1 : [ patternPart[2].toLowerCase() ];
			patternParts.push(lastPatternPart);
		}
		
		lastIndex = PatternPartsRegex.lastIndex;
	} while(lastIndex !== patternString.length);

	let complexity = 0;
	let rootPart;
	let rootPartLength = MaxComplexity;
	let rootIndex;
	let i = 0;
	for(let patternPart of patternParts) {
		if(typeof(patternPart) === 'object') {
			complexity = (complexity === 0) ? patternPart.length : complexity * patternPart.length;
			if(patternPart.length < rootPartLength) {
				rootPart = patternPart;
				rootPartLength = patternPart.length;
				rootIndex = i;
			}
		}
		i++;
	}
	if(complexity === 0 || complexity > MaxComplexity) return false;
	
	
	let matchParts = [];
	let matchPartsRight = [];
	
	let mask = 0;
	i = 1;
	for(let patternPart of patternParts) {
		if(patternPart === rootPart) break;
		mask <<= 1;
		if(typeof(patternPart) === 'object') {
			mask |= 0b0000000100000000;
			matchParts.push(patternPart);
		}
		i++;
	}
	let bit = 0b0000000010000000;
	for(; i < patternParts.length; i++) {
		let patternPart = patternParts[i];
		if(typeof(patternPart) === 'object') {
			mask |= bit;
			matchPartsRight.push(patternPart);
		}
		bit >>= 1;
	}
	matchParts = matchParts.concat(matchPartsRight.reverse());
	
	let replacements = line.substring(splitter + 3).trim().split(/\s*,\s*/).map(x => x === '*' ? 1 : x === '~' ? 0 : x);
	if(replacements.length !== patternParts.length) return false;
	if(replacements.length === 1) replacements = replacements[0];
	else replacements.unshift(rootIndex);
	
	if(mask === 0) {
		for(let rootword of rootPart) {
			rootword = rootword.toLowerCase();
			let rootwordGroup = Patterns[rootword];
			if(rootwordGroup === undefined) {
				rootwordGroup = {m:[0]};
				Patterns[rootword] = rootwordGroup;
				rootwordGroup[0] = replacements;
			}
			else {
				if(rootwordGroup[0] !== undefined) console.warn(`Pattern override! In ${rootword} / ${rootwordGroup[0]}`);
				else rootwordGroup.m.push(0);
				rootwordGroup[0] = replacements;
			}
		}
		
	}
	else {	
		let cross = new CrossProduct(matchParts);
		while (cross.next()) cross.do((...words) => {
			let key = words.join();
			
			for(let rootword of rootPart) {
				rootword = rootword.toLowerCase();
				let rootwordGroup = Patterns[rootword];
				let maskPatterns;
				if(rootwordGroup === undefined) {
					rootwordGroup = {m:[]};
					Patterns[rootword] = rootwordGroup;
				}
				else maskPatterns = rootwordGroup[mask];

				if(maskPatterns === undefined) {
					rootwordGroup.m.push(mask);
					maskPatterns = {};
					rootwordGroup[mask] = maskPatterns;
				}
				else if(maskPatterns[key] !== undefined) console.warn(`Pattern override! In ${rootword} / ${key}`);
				
				maskPatterns[key] = replacements;
			}
		});
	}
	
	
	return true;
}
function ProcessTriggerLine(line) {
	let triggerMatch = TriggerRegex.exec(line);
	if(triggerMatch === null) return false;
	
	let triggerParts = triggerMatch[1].split('|');
	let replacementParts = triggerMatch[2].split('|');
	let weightSum = 0;
	for(let i = replacementParts.length - 1; i >= 0; i--) {
		let replacement = TriggerReplaceRegex.exec(replacementParts[i]);
		if(replacement === null) return false;
		
		let weight = parseInt(replacement[2]) || 1;
		replacementParts[i] = [ weight, replacement[1] ];
		weightSum += weight;
	}
	replacementParts.w = weightSum;
	
	for(let triggerPhrase of triggerParts) {
		triggerPhrase = triggerPhrase.trim().toLowerCase();
		let oldReplacements = Triggers[triggerPhrase];
		if(oldReplacements === undefined) {
			Triggers[triggerPhrase] = replacementParts;	
			if(triggerPhrase.length > LongestTrigger) LongestTrigger = triggerPhrase.length;
		}
		else {
			let newReplacements = oldReplacements.concat(replacementParts);
			newReplacements.w = oldReplacements.w + replacementParts.w;
			Triggers[triggerPhrase] = newReplacements;
		}
	}
}


function ProcessPatternText(patternText) {
	NonemptyLineRegex.lastIndex = 0;
	while(true) {
		let match = NonemptyLineRegex.exec(patternText);
		if(match === null) break;
		let line = match[0];
		if(CommentRegex.test(line)) continue;
		
		if(!(TriggerLineRegex.test(line) && !ProcessTriggerLine(line)) && !ProcessPatternLine(line))
			console.warn("Invalid line: " + line);
	}
}

function ComparePopcount(a, b) {
	a = a - ((a >> 1) & 0x55555555);
	a = (a & 0x33333333) + ((a >> 2) & 0x33333333);
	a = ((a + (a >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
	b = b - ((b >> 1) & 0x55555555);
	b = (b & 0x33333333) + ((b >> 2) & 0x33333333);
	b = ((b + (b >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
	return a === b ? 0 : a > b ? -1 : 1;
}
function SortMasks() {
	for(let rootwordGroup of Object.values(Patterns)) {
		rootwordGroup.m.sort(ComparePopcount);
	}
}
function SortTriggers() {
	for(let replacements of Object.values(Triggers)) {
		replacements.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
	}
}
function Postprocess() {
	SortMasks();
	SortTriggers();
}

const ProcessRegex = /(?:((?:[.?!\n]\s*)+|https?:\/\/[^\s]+\s*)|(\w+(?:'\w+)*))/gi;

function TrainText(message) {
	if(message.length <= LongestTrigger) {
		let smallMessage = message.toLowerCase();
		let replacements = Triggers[smallMessage];
		if(replacements !== undefined) {
			if(replacements.length === 1) return replacements[0][1];
			
			let random = Math.random() * replacements.w;
			let weightCounter = 0;
			for(let replacement of replacements) {
				weightCounter += replacement[0];
				if(weightCounter > random) return replacement[1];
			}
		}
	}
	
	ProcessRegex.lastIndex = 0;
	let groupWords = [];
	let chewedWords = [];
	let replacements = [];
	let newMessage = "";
	let messagePointer = 0;
	while(true) {
		let match = ProcessRegex.exec(message);
		if(match !== null && match[2] !== undefined) {
			groupWords.push(match);
			chewedWords.push(match[2].toLowerCase());
		}
		else if(groupWords.length === 0) {
			if(match === null) break;
			continue;
		}
		else {
			let wordMaxindex = groupWords.length - 1;
			for(let wordIndex = wordMaxindex; wordIndex >= 0; wordIndex--) {
				let rootwordGroup = Patterns[chewedWords[wordIndex]];
				if(rootwordGroup !== undefined) {
				
					let boundsMask = (0xFF00 << wordIndex) | (0xFF >> (wordMaxindex - wordIndex));
					for(let mask of rootwordGroup.m) { //ordered big to small
						if(mask === 0) { //single word
							let matchedPattern = rootwordGroup[0];
							let strength = (typeof(matchedPattern) === 'object') ? (matchedPattern.length - 1) : 1;
							replacements.push({ pattern: matchedPattern, s: strength, i: wordIndex });
							break;
						}
						else if((mask & boundsMask) === 0) { //check if in bounds
							let maskPatterns = rootwordGroup[mask];
							let importantWords = [];
							if(mask & 0xFF00) { //has words before
								let i = wordIndex - 8;
								let bit = 0b1000000000000000;
								if((mask & 0xF000) === 0) {
									if(mask & 0xC00 === 0) {
										i += 6;
										bit >>= 6;
									}
									else {
										i += 4;
										bit >>= 4;
									}
								}
								if(i < 0) {
									bit >>= (i * -1);
									i = 0;
								}
								do {
									if((mask & bit) !== 0) importantWords.push(chewedWords[i]);
									i++;
									bit >>= 1;
								} while(bit !== 0b0000000010000000);
							}
							if(mask & 0xFF) { //has words after
								let i = wordIndex + 8;
								let bit = 0b0000000000000001;
								if((mask & 0x000F) === 0) {
									if(mask & 0x30 === 0) {
										i -= 6;
										bit <<= 6;
									}
									else {
										i -= 4;
										bit <<= 4;
									}
								}
								if(i > wordMaxindex) {
									bit <<= (i - wordMaxindex);
									i = wordMaxindex;
								}
								do {
									if((mask & bit) !== 0) importantWords.push(chewedWords[i]);
									i--;
									bit <<= 1;
								} while(bit !== 0b0000000100000000);
							}
							
							let matchedPattern = maskPatterns[importantWords.join()]; //maybe hash?
							if(matchedPattern !== undefined) {
								let strength;
								/*if(typeof(matchedPattern) !== 'object') {
									//strength = Masks[mask].s;
									strength = 1;
								}
								else {*/
									//strength = matchedPattern.s;
									strength = matchedPattern.length - 1;
								//}
								
								replacements.push({ pattern: matchedPattern, s: strength, i: wordIndex });
								
								break;
							}
						}
					}
				}
			}
			
			if(replacements.length !== 0) {
				
				replacements.sort((a, b) => a.s > b.s ? -1 : a.s < b.s ? 1 : 0);
				
				let wordsToReplace = [];
				
				let replacement = replacements[0];
				let pattern = replacement.pattern;
				if(typeof(pattern) === 'object') {
					let wordOffset = replacement.i - pattern[0] - 1; //-1 because pattern[0]
					if(wordOffset >= -1 && (wordOffset + pattern.length) <= groupWords.length) { //<= because wordOffset has -1 and pattern.length has +1
						for(let i = pattern.length - 1; i > 0; i--) {
							wordsToReplace[wordOffset + i] = pattern[i];
						}
					}
				}
				else {
					wordsToReplace[replacement.i] = pattern;
				}
				
				for(let replacementIndex = 1; replacementIndex < replacements.length; replacementIndex++) {
					replacement = replacements[replacementIndex];
					pattern = replacement.pattern;
					
					if(typeof(pattern) === 'object') {
						let wordOffset = replacement.i - pattern[0] - 1;
						let overlap = false;
						for(let i = pattern.length - 1; i > 0; i--) {
							if(wordsToReplace[wordOffset + i] !== undefined || groupWords[wordOffset + i] === undefined) {
								overlap = true;
								break;
							}
						}
						if(overlap) continue;
						for(let i = pattern.length - 1; i > 0; i--) {
							wordsToReplace[wordOffset + i] = pattern[i];
						}
					}
					else {
						if(wordsToReplace[replacement.i] !== undefined) continue;
						wordsToReplace[replacement.i] = pattern;
					}
				}
				
				for(let key of Object.keys(wordsToReplace)) {
					let newWord = wordsToReplace[key];
					if(newWord === 1) continue;
					let oldWord = groupWords[key];
					if(newWord === 0) {
						if(message.charAt(oldWord.index - 1) === ' ') {
							newMessage += message.substring(messagePointer, oldWord.index - 1);
							messagePointer = oldWord.index + oldWord[0].length;
						}
						else
						{
							newMessage += message.substring(messagePointer, oldWord.index);
							messagePointer = oldWord.index + oldWord[0].length;
							if(message.charAt(oldWord.index + oldWord[0].length) === ' ') messagePointer++;
						}
						continue;
					}
					
					newMessage += message.substring(messagePointer, oldWord.index) + ((key === '0') ? (newWord.charAt(0).toUpperCase() + newWord.slice(1)) : newWord);
					messagePointer = oldWord.index + oldWord[0].length;
					
				}
				
				
				replacements = [];
			}
			
			if(match === null) break;
			
			groupWords = [];
			chewedWords = [];
		}
	}

	return (newMessage === "") ? null : (newMessage + message.substring(messagePointer));
}


var ErrorMessages = [];

function ProcessErrorText(errorText) {
	let lines = errorText.split(/\r?\n/).map(x => x.trim()).filter(x => x !== "");
	ErrorMessages = ErrorMessages.concat(lines);
}

function GlitchBefore(word) {
	let maxIndex = word.length - 1;
	let s = '';
	for(let i = Math.floor(Math.random() * 4); i !== -1; i--) {
    	s += word.substring(0, Math.floor(Math.random() * maxIndex) + 1) + '-';
	}
	return s;
}
function GlitchAfter(word) {
	let maxIndex = word.length - 1;
	let s = '';
	for(let i = Math.floor(Math.random() * 4); i !== -1; i--) {
    	s += '-' + word.substring(Math.floor(Math.random() * maxIndex) + 1);
	}
	return s;
}

function GlitchText(message) {
	ProcessRegex.lastIndex = 0;
	let groupWords = [];
	let replacements = [];
	let newMessage = "";
	let messagePointer = 0;
	while(true) {
		let match = ProcessRegex.exec(message);
		if(match !== null && match[2] !== undefined) {
			groupWords.push(match);
		}
		else if(groupWords.length === 0) {
			if(match === null) break;
			continue;
		}
		else {
			let glitchGroupLength = 0;
			let wordCount = groupWords.length;
			for(let wordIndex = 0; wordIndex !== wordCount; wordIndex++) {
				let glitchType = Math.floor(Math.random() * 16);
				if(glitchType < 3) {
					glitchGroupLength++;
				}
				else
				{
					if(glitchGroupLength !== 0) {
						if(glitchGroupLength === 1 && Math.random() < 0.5) continue;
						let newPointer = groupWords[wordIndex - 1].index + groupWords[wordIndex - 1][0].length;
						newMessage += message.substring(messagePointer, newPointer) + "- " + groupWords.slice(wordIndex - glitchGroupLength, wordIndex).map(x => x[0]).join(' ');
						messagePointer = newPointer;
						glitchGroupLength = 0;
					}
					if(glitchType < 6) {
						let word = groupWords[wordIndex][0];
						if(word.length < 2) { glitchGroupLength++; continue; }
						newMessage += message.substring(messagePointer, groupWords[wordIndex].index);
						messagePointer = groupWords[wordIndex].index + word.length;
						switch(glitchType) {
							case 3:
								newMessage += GlitchBefore(word) + word;
							break;
							case 4:
								newMessage += word + GlitchAfter(word);
							break;
							case 5:
								newMessage += GlitchBefore(word) + word + GlitchAfter(word);
							break;
						}
					}						
				}
			}
			if(glitchGroupLength !== 0 && (glitchGroupLength !== 1 || Math.random() < 0.5)) {
				let newPointer = groupWords[wordCount - 1].index + groupWords[wordCount - 1][0].length;
				newMessage += message.substring(messagePointer, newPointer) + "- " + groupWords.slice(wordCount - glitchGroupLength, wordCount).map(x => x[0]).join(' ');
				messagePointer = newPointer;
			}


			if(match === null || match[2] === undefined) {
				if(Math.random() < 0.1) {
					let lastpart = message.substring(messagePointer);
					newMessage += (/\s/.test(lastpart.substr(-1)) ? lastpart : lastpart + ' ') + ErrorMessages[Math.floor(Math.random() * ErrorMessages.length)];
					messagePointer = message.length;
				}
				if(match === null) break;
			}
			else if(Math.random() < 0.1) {
				let newPointer = match.index + match[0].length;
				newMessage += message.substring(messagePointer, newPointer) + ErrorMessages[Math.floor(Math.random() * ErrorMessages.length)] + ' ';
				messagePointer = newPointer;
			}
			
			groupWords = [];
		}
	}

	return (newMessage === "") ? null : (newMessage + message.substring(messagePointer));
}


async function FindTextfiles(path, callback) {
	let contents = await Fs.readdir(path);
	for(let content of contents) {
		let contentPath = path + '/' + content;
		let stat = await Fs.stat(contentPath);
		if(stat.isDirectory()) await FindTextfiles(contentPath, callback);
		else if(stat.size > 0 && /\.txt$/i.test(content)) await callback(contentPath);
	}
}


(async()=>{


await FindTextfiles('patterns', async (path) => {
	let file = await Fs.open(path, 'r');
	let patternText = await file.readFile('utf8');
	file.close();

	ProcessPatternText(patternText);
});

SortMasks();

console.log(`Processed all patterns!`);


let file = await Fs.open('errormessages.txt', 'r');
let errorText = await file.readFile('utf8');
file.close();
ProcessErrorText(errorText);

console.log(`Loaded the error messages!`);


function DisableGlitchy(channelConfig) { channelConfig.glitchy = false }
const RequestBase = {
	hostname: 'discordapp.com',
	port: 443,
	method: 'POST'
};
DiscordClient.on('message', (message) => {
	if(message.content === "" || message.member === null) return;
	
	let channelConfig = ConfigChannels[message.channel.id];
	if(channelConfig === undefined) return;
	
	if(message.content === GlitchCommand) {
		if(message.member.roles.get(channelConfig[0]) === undefined) return;
		
		if(channelConfig.glitchy === true) clearTimeout(channelConfig.glitchyTimeout);
		else channelConfig.glitchy = true;
		channelConfig.glitchyTimeout = setTimeout(DisableGlitchy, GlitchTime, channelConfig);
		return;
	}
	
	let newContent;
	if(channelConfig.glitchy) {
		let roles = message.member.roles;
		if(roles.get(channelConfig[2]) === undefined) {
			if(roles.get(channelConfig[1]) === undefined) return;
			newContent = GlitchText(message.content);
			if(newContent === null) return;
		}
		else {
			let trainedText = TrainText(message.content);
			newContent = GlitchText(trainedText || message.content);
			if(newContent === null)	{
				if(trainedText === null) return;
				newContent = trainedText;
			}
		}
	}
	else {
		if(message.member.roles.get(channelConfig[2]) === undefined) return;
		newContent = TrainText(message.content);
		if(newContent === null) return;
	}
	
	message.delete();
	
	let webhookMessage = {
		username: message.member.displayName,
		avatar_url: message.author.displayAvatarURL,
		content: newContent
	};
	
	let data = Buffer.from(JSON.stringify(webhookMessage));
	let requestObject = Object.assign({}, RequestBase);
	requestObject.headers = {
		'Content-Type': 'application/json',
		'Content-Length': data.length
	}
	requestObject.path = channelConfig[3];

	let post = Https.request(requestObject);
	post.end(data);
});


})();