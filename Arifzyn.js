const {
  BufferJSON,
  WA_DEFAULT_EPHEMERAL,
  generateWAMessageFromContent,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  prepareWAMessageMedia,
  areJidsSameUser,
  getContentType,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const { exec } = require("child_process");
const axios = require("axios")
const cheerio = require("cheerio")
const syntaxerror = require("syntax-error")

const { generateProfilePicture, getBuffer, fetchJson, fetchText, getRandom, getGroupAdmins, runtime, sleep, makeid } = require("./lib/myfunc");

let prefix = "."; // Prefix
let mode = false; // Mode publik, true yang berarti public, false self

module.exports = async (conn, m) => {
  try {
    const body = m.mtype === "conversation" ? m.message.conversation : m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";
    const budy = typeof m.text === "string" ? m.text : "";
    const command = body.startsWith(prefix) ? body.replace(prefix, "").trim().split(/ +/).shift().toLowerCase() : "";
    const commands = command.replace(prefix, "");
    const args = body.trim().split(/ +/).slice(1);
    const q = (question = args.join(" "));
    const quoted = m.quoted ? m.quoted : m
    const message = m;
    const messageType = m.mtype;
    const messageKey = message.key;
    const pushName = m.pushName || "Undefined";
    const itsMe = m.key.fromMe;
    const chat = (from = m.chat);
    const sender = m.sender;
    const userId = sender.split("@")[0];
    const reply = m.reply;
    const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net'
    
    const isGroup = m.key.remoteJid.endsWith('@g.us')
    const groupMetadata = isGroup ? await conn.groupMetadata(from) : ''
    const groupName = isGroup ? groupMetadata.subject : ''
    const groupId = isGroup ? groupMetadata.id : ''
    const groupMembers = isGroup ? groupMetadata.participants : ''
    const groupAdmins = isGroup ? getGroupAdmins(groupMembers) : ''
    const isBotGroupAdmins = groupAdmins.includes(botNumber) || false
    const isGroupAdmins = groupAdmins.includes(sender)

    if (body.startsWith("$")) {
      if (!itsMe) return;
      await m.reply("_Executing..._");
      exec(q, async (err, stdout) => {
        if (err) return m.reply(`${err}`);
        if (stdout) {
          await m.reply(`${stdout}`);
        }
      });
    }

    if (body.startsWith(">")) {
      if (!itsMe) return;
      try {
      	var txtt = util.format(await eval(`(async()=>{ ${q} })()`));
      	m.reply(txtt)
      } catch (e) {
      	let _syntax = "";
          let _err = util.format(e);
          let err = syntaxerror(q, "EvalError", {
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
            sourceType: "module",
          });
          if (err) _syntax = err + "\n\n";
          m.reply(util.format(_syntax + _err))
      }
    }

    if (body.startsWith("=>")) {
      if (!itsMe) return;
      try {
      	var txtt = util.format(await eval(`(async()=>{ return ${q} })()`));
      	m.reply(txtt)
      } catch (e) {
      	let _syntax = "";
          let _err = util.format(e);
          let err = syntaxerror(q, "EvalError", {
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
            sourceType: "module",
          });
          if (err) _syntax = err + "\n\n";
          m.reply(util.format(_syntax + _err))
      }
    }

    if (!mode) {
      if (!m.key.fromMe) return;
    }

    if (m.message) {
    	console.log(chalk.bgMagenta(" [===>] "), chalk.cyanBright("Time: ") + chalk.greenBright(new Date()) + "\n", chalk.cyanBright("Message: ") + chalk.greenBright(budy || m.mtype) + "\n" + chalk.cyanBright("From:"), chalk.greenBright(pushName), chalk.yellow("- " + m.sender) + "\n" + chalk.cyanBright("Chat Type:"), chalk.greenBright(!m.isGroup ? "Private Chat" : "Group Chat - " + chalk.yellow(m.chat)));
    }

    if (!body.startsWith(prefix)) {
      return;
    }

    switch (commands) {
      case "menu": {
      	let menu = `Hai, ${m.pushName}\n\n`
      	  + `.tiktok\n`
      	  + `.ytmp4\n`
      	  + `.ytmp3\n\n`
      	  + `Copyright © 2023 Arifzyn.`
      	reply(menu)  
      } 	
      break 
      case "tes": {
        m.reply("Ok!");
      }    
      break;
      case 'hidetag': {
        if (!isGroup) return
        let teks = quoted.text ? quoted.text : q ? q : ''
        let mem = [];
        groupMembers.map( i => mem.push(i.id) )
        conn.sendMessage(m.chat, { text: teks, mentions: mem }, { quoted: m })
      }  
      break
      case "tiktok": {
      	if (!q) return reply("[!] Masukan URL TikTok !")
      	let res = await fetchJson("https://api.arifzyn.xyz/download/tiktok?url=" + q)
      	res = res.result
      	let txt = ``
      	if (res.type == "image") {
      		
      	} else {
      		conn.sendMessage(m.chat, { video: { url: res.video["no-watermark"] }, caption: res.title }, { quoted: m })
      	}
      }
      break
      case "ytmp4": 
      case "ytmp3": {
      	if (!q) return reply("[!] Masukan URL YouTube!")
      	if (commands == "ytmp4") {
      		const anu = await fetchJson("https://api.arifzyn.xyz/download/ytmp4?url=" + q)
      		conn.sendMessage(m.chat, { video: { url: anu.result.result }, caption: anu.result.title }, { quoted: m })
      	} else {
      		const anu = await fetchJson("https://api.arifzyn.xyz/download/ytmp3?url=" + q)
      		conn.sendMessage(m.chat, { audio: { url: anu.result.result }, mimetype: "audio/mp4" }, { quoted: m })
      	}
      }
      default: 
    }
  } catch (err) {
    m.reply(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
