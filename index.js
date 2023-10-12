const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  jidDecode,
  proto,
  PHONENUMBER_MCC,
  getContentType,
  DisconnectReason,
  downloadContentFromMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const path = require("path");
const pino = require("pino");
const readline = require("readline");
const chalk = require("chalk");
const fs = require("fs-extra");
const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();
const { smsg } = require("./lib/myfunc")

global.mode = false;
global.sessionName = "session";
const pairingCode = process.argv.includes("-pairing");

if (!pairingCode) {
  console.log(chalk.redBright("Use -pairing"));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const store = makeInMemoryStore({
  logger: pino().child({
    level: "silent",
    stream: "store",
  }),
});

async function startServer() {
  const child = async () => {
    process.on("unhandledRejection", (err) => console.error(err));
    const { state, saveCreds } = await useMultiFileAuthState("./" + sessionName);
    const conn = makeWASocket({
      printQRInTerminal: !pairingCode,
      logger: pino({
        level: "silent",
      }),
      browser: ["Chrome (Linux)", "", ""],
      auth: state,
      msgRetryCounterCache,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: true,
      fireInitQueries: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true,
      markOnlineOnConnect: true,
    });
    conn.ev.on("creds.update", saveCreds);

    if (pairingCode && !conn.authState.creds.registered) {
      console.log(chalk.cyan("╭──────────────────────────────────────···"));
      console.log(`📨 ${chalk.redBright("Please type your WhatsApp number")}:`);
      console.log(chalk.cyan("├──────────────────────────────────────···"));
      let phoneNumber = await question(`   ${chalk.cyan("- Number")}: `);
      console.log(chalk.cyan("╰──────────────────────────────────────···"));
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
      if (!Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))) {
        console.log(chalk.cyan("╭─────────────────────────────────────────────────···"),);
        console.log(`💬 ${chalk.redBright("Start with your country's WhatsApp code, Example 62xxx")}:`,);
        console.log(chalk.cyan("╰─────────────────────────────────────────────────···"));
        console.log(chalk.cyan("╭──────────────────────────────────────···"));
        console.log(`📨 ${chalk.redBright("Please type your WhatsApp number")}:`,);
        console.log(chalk.cyan("├──────────────────────────────────────···"));
        phoneNumber = await question(`   ${chalk.cyan("- Number")}: `);
        console.log(chalk.cyan("╰──────────────────────────────────────···"));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
      }
      let code = await conn.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(chalk.cyan("╭──────────────────────────────────────···"));
      console.log(` 💻 ${chalk.redBright("Your Pairing Code")}:`);
      console.log(chalk.cyan("├──────────────────────────────────────···"));
      console.log(`   ${chalk.cyan("- Code")}: ${code}`);
      console.log(chalk.cyan("╰──────────────────────────────────────···"));
      rl.close();
    }

    store.bind(conn.ev);

    conn.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        m = chatUpdate.messages[0];
        if (!m.message) return;
        m.message =
          Object.keys(m.message)[0] === "ephemeralMessage"
            ? m.message.ephemeralMessage.message
            : m.message;
        if (m.key && m.key.remoteJid === "status@broadcast") return;
        if (!conn.public && !m.key.fromMe && chatUpdate.type === "notify")
          return;
        if (m.key.id.startsWith("BAE5") && m.key.id.length === 16) return;
        m = smsg(conn, m, store);
        require("./Arifzyn")(conn, m, chatUpdate, store);
      } catch (err) {
        console.log(err);
      }
    });

    conn.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return ((decode.user && decode.server && decode.user + "@" + decode.server) || jid);
      } else return jid;
    };

    conn.public = mode;
    conn.serializeM = (m) => smsg(sock, m, store);

    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      const code =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.output?.payload?.statusCode;

      connection === "close" &&
        (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
          ? child()
          : console.log("connection logged out..."));
      if (connection == "open") {
        console.log(
          chalk.black(chalk.bgWhite("\u2705 Berhasil Terhubung....")),
        );
      }
    });
    
    conn.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true
    ) => {
    	let quoted = message.msg ? message.msg : message;
    	let mime = (message.msg || message).mimetype || "";
    	let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    	const stream = await downloadContentFromMessage(quoted, messageType);
    	let buffer = Buffer.from([]);
    	for await (const chunk of stream) {
    		buffer = Buffer.concat([buffer, chunk]);
        }
        let type = await fileTypeFromBuffer(buffer);
        let trueFileName = attachExtension ? filename + "." + type.ext : filename;
        await fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };
    
    conn.downloadMediaMessage = async (message) => {
    	let mime = (message.msg || message).mimetype || "";
    	let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    	const stream = await downloadContentFromMessage(message, messageType);
    	let buffer = Buffer.from([]);
    	for await (const chunk of stream) {
    		buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    conn.sendText = (jid, teks, quoted = "", options) => {
      return conn.sendMessage(
        jid,
        {
          text: teks,
          ...options,
        },
        {
          quoted,
          ...options,
        },
      );
    };

    conn.sendImage = async (jid, path, caption = "", quoted = "", options) => {
      let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], "base64") : /^https?:\/\//.test(path) ? await await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
      return await conn.sendMessage(
        jid,
        {
          image: buffer,
          caption: caption,
          jpegThumbnail: "",
          ...options,
        },
        {
          quoted,
        },
      );
    };

    conn.sendVideo = async (
      jid,
      path,
      caption = "",
      quoted = "",
      gif = false,
      options,
    ) => {
      let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], "base64") : /^https?:\/\//.test(path) ? await await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
      return await conn.sendMessage(
        jid,
        {
          video: buffer,
          caption: caption,
          gifPlayback: gif,
          jpegThumbnail: "",
          ...options,
        },
        {
          quoted,
        },
      );
    };

    conn.sendAudio = async (jid, path, quoted = "", ptt = false, options) => {
      let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], "base64") : /^https?:\/\//.test(path) ? await await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
      return await conn.sendMessage(
        jid,
        {
          audio: buffer,
          ptt: ptt,
          ...options,
        },
        {
          quoted,
        },
      );
    };

    return conn;
  };
  child().catch((err) => console.log(err));
}

startServer();
