require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot çalışıyor!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web server ${PORT} portunda çalışıyor.`);
});
const { Client, GatewayIntentBits } = require("discord.js");
const prefix = "p"
const inventory = {};
const fishInventory = {};
const fishCooldown = new Map();
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Hayvan envanterini yükle
try {
    Object.assign(inventory, JSON.parse(fs.readFileSync("animals.json", "utf8")));
} catch (err) {
    console.error("animals.json okunamadı:", err);
}

// Balık envanterini yükle
try {
    Object.assign(fishInventory, JSON.parse(fs.readFileSync("fish.json", "utf8")));
} catch (err) {
    console.error("fish.json okunamadı:", err);
}
function saveInventory() {
    fs.writeFileSync("animals.json", JSON.stringify(inventory, null, 2));
}

function saveFishInventory() {
    fs.writeFileSync("fish.json", JSON.stringify(fishInventory, null, 2));
}
function formatCoins(amount) {
    return Number(amount).toLocaleString("tr-TR");
}
const huntCooldown = new Map();
const animals = [ 
    { name: "🐇 tavşan", rarity: "C", chance: 50 },
    { name: "🦊 tilki", rarity: "R", chance: 25 },
    { name: "🐺 kurt", rarity: "E", chance: 10 },
    { name: "🐉 ejderha", rarity: "L", chance: 1 },
    { name: "🌟 void god", rarity: "S", chance: 0.1 }
];
const fish = [
    { name: "🐟 Hamsi", min: 2, max: 6, rarity: "Common" },
    { name: "🐠 Sardalya", min: 3, max: 8, rarity: "Common" },
    { name: "🐟 İstavrit", min: 4, max: 10, rarity: "Common" },
    { name: "🐟 Mezgit", min: 5, max: 12, rarity: "Common" },
    { name: "🐟 Kefal", min: 6, max: 14, rarity: "Common" },

    { name: "🐟 Sazan", min: 15, max: 25, rarity: "Uncommon" },
    { name: "🐠 Alabalık", min: 18, max: 30, rarity: "Uncommon" },
    { name: "🐟 Turna", min: 20, max: 35, rarity: "Uncommon" },
     
    { name: "<:killerfish:1522982081901101266> KillerFish", min: 70, max: 500, rarity: "Rare", },
    { name: "🐠 Somon", min: 40, max: 70, rarity: "Rare" },
    { name: "🐟 Levrek", min: 45, max: 75, rarity: "Rare" },
    { name: "<:luferdayi:1522992396910989392> Lüfer", min: 50, max: 80, rarity: "Rare" },
    
    { name: "<:JellyFish:1522981568443060255> JellyFish", min: 250, max: 1000, rarity: "Epic", },
    { name: "<:susfish:1522980654512476181> Susfish", min: 100, max: 500, rarity: "Epic", },
    { name: "🐡 Orkinos", min: 100, max: 180, rarity: "Epic" },
    { name: "🦈 Mako Köpekbalığı", min: 150, max: 250, rarity: "Epic" },
     
    { name: "<:pogfish:1522980811857592360> Pogfish", min: 650, max: 1500, rarity: "Legendary",  },
    { name: "<:blueshrimp:1522981135712522380> BlueShrimp", min: 500, max: 1000, rarity: "Legendary", },
    { name: "🦈 Büyük Beyaz Köpekbalığı", min: 300, max: 600, rarity: "Legendary" },
    { name: "🦈 Çekiç Başlı Köpekbalığı", min: 350, max: 700, rarity: "Legendary" },
     
    { name: "<:orca:1522991443755532500> Orca", min: 500, max: 1000, rarity: "Mythic", },
    { name: "<:devilshrimp:1522981228385669140> Devil Shrimp", min: 2000, max: 2500, rarity: "Mythic", },
    { name: "🐉 Deniz Ejderhası", min: 1000, max: 2000, rarity: "Mythic" },
     
    { name: "<:fisher_shrimp:1522981304327471195> FishingShrimp", min: 10000, max: 20000, rarity: "Secret", },
    { name: "<:cosmic:1522989206513647737> Kozmik Balık", min: 5000, max: 10000, rarity: "Secret" }
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let coins = {};

if (fs.existsSync("coins.json")) {
    try {
        coins = JSON.parse(fs.readFileSync("coins.json", "utf8"));
    } catch (err) {
        coins = {};
    }
}
async function saveCoin(userId) {
    await setCoins(userId, coins[userId] || 0);
}
function saveCoins() {
    fs.writeFileSync("coins.json", JSON.stringify(coins, null, 2));
}

client.once("ready", () => {
    console.log("BOT ONLINE!");
});

client.on("messageCreate", async (message) => {
    async function getCoins(userId) {
    const { data } = await supabase
        .from("coins")
        .select("coins")
        .eq("user_id", userId)
        .single();

    return data ? Number(data.coins) : 0;
}

async function setCoins(userId, amount) {
    const { error } = await supabase
        .from("coins")
        .upsert(
            {
                user_id: userId,
                coins: amount
            },
            {
                onConflict: "user_id"
            }
        );

    if (error) {
        console.error("Supabase setCoins hatası:", error);
    }
}
    if (message.content === prefix + "inv") {

    const userId = message.author.id;

    if (!inventory[userId] || inventory[userId].length === 0) {
        return message.reply("🎒 Envanterinde hiç hayvan yok!");
    }

    const animalCount = {};

    for (const animal of inventory[userId]) {
        animalCount[animal] = (animalCount[animal] || 0) + 1;
    }

    let text = "🎒 **AV ENVANTERİN**\n";
    text += "━━━━━━━━━━━━━━━━━━\n\n";

    for (const [name, amount] of Object.entries(animalCount)) {
        text += `${name} ×${amount}\n`;
    }

    text += `\n🦌 Toplam Av: **${inventory[userId].length}**`;

    return message.reply(text);
}
    if (message.content === prefix + "fishinv") {

    const userId = message.author.id;

    if (!fishInventory[userId] || fishInventory[userId].length === 0) {
        return message.reply("🎒 Envanterinde hiç balık yok!");
    }

    const fishCount = {};

    for (const fishName of fishInventory[userId]) {
        fishCount[fishName] = (fishCount[fishName] || 0) + 1;
    }

    let text = "🎒 **BALIK ENVANTERİN**\n";
    text += "━━━━━━━━━━━━━━━━━━\n\n";

    for (const [name, amount] of Object.entries(fishCount)) {
        text += `${name} ×${amount}\n`;
    }

    return message.reply(text);

}

if (message.content === prefix + "fishlist") {

    return message.reply(
`🎣 **FISH DEX**
━━━━━━━━━━━━━━━━━━

🟢 COMMON
🐟 Hamsi
🐠 Sardalya
🐟 İstavrit
🐟 Mezgit
🐟 Kefal

🔵 UNCOMMON
🐟 Sazan
🐠 Alabalık
🐟 Turna

🟣 RARE
<:killerfish:1522982081901101266> KillerFish
🐠 Somon
🐟 Levrek
🐠 Lüfer

🟡 EPIC
<:JellyFish:1522981568443060255> JellyFish
<:susfish:1522980654512476181> Susfish
🐡 Orkinos
🦈 Mako Köpekbalığı

🔴 LEGENDARY
<:pogfish:1522980811857592360> Pogfish
<:blueshrimp:1522981135712522380> BlueShrimp
🦈 Büyük Beyaz Köpekbalığı
🦈 Çekiç Başlı Köpekbalığı

👑 MYTHIC
<:orca:1522991443755532500> Orca
<:devilshrimp:1522981228385669140> Devil Shrimp
🐉 Deniz Ejderhası

🌟 SECRET
<:fisher_shrimp:1522981304327471195> FishingShrimp
<:cosmic:1522989206513647737> Kozmik Balık`
    );

}
    if (message.content === prefix + "fish") {

    const userId = message.author.id;
    const cooldown = 30 * 1000; // 30 saniye

if (fishCooldown.has(userId)) {
    const expiration = fishCooldown.get(userId) + cooldown;

    if (Date.now() < expiration) {
        const timeLeft = Math.ceil((expiration - Date.now()) / 1000);

        return message.reply(
            `⏳ Tekrar balık tutmak için **${timeLeft} saniye** beklemelisin!`
        );
    }
}

fishCooldown.set(userId, Date.now());

    if (!coins[userId]) coins[userId] = 0;
    if (!fishInventory[userId]) fishInventory[userId] = [];

    const caught = fish[Math.floor(Math.random() * fish.length)];

    const reward = Math.floor(
        Math.random() * (caught.max - caught.min + 1)
    ) + caught.min;

    const currentCoins = await getCoins(userId);
await setCoins(userId, currentCoins + reward);
    fishInventory[userId].push(caught.name);
    saveFishInventory();

    

    return message.reply(
`🎣 Oltanı attın...

🐟 Yakaladığın balık: **${caught.name}**

⭐ Nadirlik: **${caught.rarity}**

💰 Kazandığın Coin: **${formatCoins(reward)}**`
    );
}
    if (message.content.startsWith(prefix + "animals")) {

    let text = `🐾 HUNT DEX
━━━━━━━━━━━━

🟢 COMMON
🟡 RARE
🔵 EPIC
🟣 LEGENDARY
🟠 MYTHIC
👑 GOLD
🔮 ARCANE
🌟 SECRET`;

    return message.reply(text);
}
        if (message.content.startsWith(prefix + "help")) {

    return message.reply(
`📜 **BOT COMMANDS**

🏹 **AVCILIK**
🏹 phunt → Avlan
🐾 panimals → Hayvan listesi
🎒 pinv → Av envanteri

🎣 **BALIKÇILIK**
🎣 pfish → Balık tut
🎒 pfishinv → Balık envanteri
📖 pfishlist → Tüm balıkları göster

💰 **EKONOMİ**
🏆 ptop → Liderlik tablosu
🎰 pslot → Slot makinesi
🪙 pcoinflip → Yazı tura

❓ **DİĞER**
📜 phelp → Komutları göster
ppay ise kullanıcıya coin gönderir.`
    );
}
    if (message.content.startsWith(prefix + "hunt")) {
        const userId = message.author.id;

const cooldown = 10 * 1000; // 10 saniye

if (huntCooldown.has(userId)) {
    const expiration = huntCooldown.get(userId) + cooldown;

    if (Date.now() < expiration) {
        const timeLeft = Math.ceil((expiration - Date.now()) / 1000);
        return message.reply(`⏳ Tekrar avlanmak için **${timeLeft} saniye** beklemelisin!`);
    }
}

huntCooldown.set(userId, Date.now());
        
    

    if (!coins[userId]) coins[userId] = 0;

    const animals = [
    // 🟢 COMMON
    { name: "🐇 tavşan", min: 1, max: 5, rarity: "C", chance: 18 },
    { name: "🦊 tilki", min: 5, max: 12, rarity: "C", chance: 16 },
    { name: "🐿 sincap", min: 3, max: 10, rarity: "C", chance: 15 },
    { name: "🕊 güvercin", min: 2, max: 8, rarity: "C", chance: 14 },
    { name: "🐀 fare", min: 1, max: 6, rarity: "C", chance: 13 },

    // 🟡 RARE
    { name: "🐺 kurt", min: 10, max: 25, rarity: "R", chance: 10 },
    { name: "🦅 kartal", min: 15, max: 30, rarity: "R", chance: 8 },
    { name: "🦊 kızıl tilki", min: 15, max: 35, rarity: "R", chance: 7 },

    // 🔵 EPIC
    { name: "🐻 bear", min: 25, max: 50, rarity: "E", chance: 5 },
    { name: "🐆 Panter", min: 30, max: 60, rarity: "E", chance: 4 },
    { name: "🐍 Anaconda", min: 35, max: 70, rarity: "E", chance: 3 },

    // 🟣 LEGENDARY
    { name: "🦂 Scorpion", min: 100, max: 250, rarity: "L", chance: 1 },
    { name: "🐉 Dragon", min: 80, max: 150, rarity: "L", chance: 1.5 },

    // 🟠 MYTHIC
    { name: "<:FOssil:1522986455507402842> Fossil", min: 500, max: 1000, rarity: "M", chance: 0.5 },
    { name: "🐦‍🔥 Phoenix", min: 200, max: 400, rarity: "M", chance: 0.8 },
    { name: "<:leviathan:1522264800665534615> Leviathan", min: 220, max: 450, rarity: "M", chance: 0.6 },

    // 🟡 GOLD
    { name: "🦝 Raccoon", min: 350, max: 500, rarity: "G", chance: 0.3 },
    { name: "<:goldenlion:1522265537881833694> Golden Lion", min: 300, max: 600, rarity: "G", chance: 0.4 },

    // 🟣 ARCANE
    { name: "<:bronto:1522986010210734232> Shadow Brontosaurus", min: 500, max: 1500, rarity: "A", chance: 0.15 },
    { name: "<:arcane_spirit:1522265877503021198> Arcane Spirit", min: 500, max: 900, rarity: "A", chance: 0.25 },

    // 🌟 SECRET
    { name: "<:T_rex:1522987054097633491> T-rex", min: 5000, max: 15000, rarity: "E", chance: 0.01 },
    { name: "<:void_god:1522266075129970912> VOID GOD", min: 1000, max: 5000, rarity: "S", chance: 0.01 },

    { name: "<:aykutnine:1522253510136172664> aykut nine", min:1000, max: 5000, rarity: "S", chance: 0.1 }
];

    const animal = animals[Math.floor(Math.random() * animals.length)];

    const reward = Math.floor(Math.random() * (animal.max - animal.min + 1)) + animal.min;

    const currentCoins = await getCoins(userId);
await setCoins(userId, currentCoins + reward);
    if (!inventory[userId]) inventory[userId] = [];
inventory[userId].push(animal.name);
saveInventory();
if (animal.rarity === "S") {
    message.channel.send(
        `🌟 TEBRİKLER!!!! SECRET KAZANDINIZ!\n` +
        `🐉 ${animal.name} yakalandı!\n` +
        `💰 +${reward} coin\n\n` +
        'Nice'
    );
}

    

    message.reply(`🏹 Avladın: **${animal.name}**\n💰 Kazanç: +${formatCoins(reward)} coin`);
}
    if (message.content === prefix + "top") {

    const sorted = Object.entries(coins)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sorted.length === 0) {
        return message.reply("❌ hiç coin yok!");
    }

    let text = "🏆 TOP 5:\n";

    for (let i = 0; i < sorted.length; i++) {
        const userId = sorted[i][0];
        const amount = sorted[i][1];

        const user = await message.client.users.fetch(userId).catch(() => null);

        text += `${i + 1}. ${user ? user.username : "Unknown"} - ${amount} coin\n`;
    }

    message.reply(text);
}
    if (message.content.startsWith(prefix + "slot")) {
    const args = message.content.split(" ");
    const amount = Number(args[1]);

    if (!amount || amount <= 0) {
        return message.reply("❌ doğru kullanım: pslot 10");
    }

    const userId = message.author.id;

    if (!coins[userId]) coins[userId] = 0;

    if (coins[userId] < amount) {
        return message.reply("❌ yeterli coin yok! <:cayyakma:1522260727287779491>");
    }
    coins[userId] -= amount;
saveCoins();

    const emojis = ["🍒", "🍋", "🍇", "💎", "7️⃣"];

    const slot1 = emojis[Math.floor(Math.random() * emojis.length)];
    const slot2 = emojis[Math.floor(Math.random() * emojis.length)];
    const slot3 = emojis[Math.floor(Math.random() * emojis.length)];

    let resultText = `🎰 | ${slot1} | ${slot2} | ${slot3} |`;

    // JACKPOT (3 aynı)
    if (slot1 === slot2 && slot2 === slot3) {
        const win = amount * 5;
        coins[userId] += win;
        saveCoins();
        return message.reply(`${resultText}\n🎉 JACKPOT! +${formatCoins(win)} coin`);
    }

    // 2 aynı
    if (slot1 === slot2 || slot1 === slot3 || slot2 === slot3) {
        const win = amount * 2;
        coins[userId] += win;
        saveCoins();
    return message.reply(`${resultText}\n🎰 <:aykutkolamutlu:1522257760480268350> 2 eşleşme! Kazandın 🎉 +${formatCoins(win)} coin`);
    }

    // kaybetme
    saveCoins();

    return message.reply(`${resultText}\n🎰 <:aykutkola:1522257596491366460> Kola patladı 💥 Kaybettin!`);
} 

    if (message.content.startsWith("pcoinflip")) {
    const flipArgs = message.content.split(" ");
const amount = Number(flipArgs[1]);
const choice = flipArgs[2];
    
    

    if (!amount || amount <= 0) {
        return message.reply("❌ doğru kullanım: pcoinflip 10 yazı");
    }

    if (!choice) {
        return message.reply("❌ yazı veya tura seç: pcoinflip 10 yazı");
    }

    const userId = message.author.id;

    if (!coins[userId]) coins[userId] = 0;

    if (coins[userId] < amount) {
        return message.reply("❌ yeterli coin yok! <:ayrl:1522261227894607913>");
    }

    const result = Math.random() < 0.5 ? "yazı" : "tura";

    if (choice.toLowerCase() === result) {
        coins[userId] += amount;
        saveCoins();
        message.reply(`🎉 Kazandın! sonuç: ${result} +${formatCoins(amount)} coin`);
    } else {
        coins[userId] -= amount;
        saveCoins();
        return message.reply(` Kaybettin! <:cayyakma:1522260727287779491> sonuç: ${result} -${formatCoins(amount)} coin`);
    }

    if (message.author.bot) return;
    if (message.content.startsWith("ppay")) {

    const payArgs = message.content.split(" ");
const user = message.mentions.users.first();
const amount = Number(payArgs[2]);

    if (!user) return message.reply("❌ kullanıcı etiketle!");
    if (!amount) return message.reply("❌ miktar gir!");

    const sender = message.author.id;
    const receiver = user.id;

    if (!coins[sender]) coins[sender] = 0;
    if (!coins[receiver]) coins[receiver] = 0;

    if (coins[sender] < amount) {
        return message.reply("❌ yeterli coin yok!");
    }

    coins[sender] -= amount;
    coins[receiver] += amount;

    saveCoins();
return message.reply(
    `💸 ${user} kullanıcısına **${formatCoins(amount)}** coin gönderdin!`
);
}
    saveCoins();
}

   const id = message.author.id;

if (message.content === "pcoin") {
    const coin = await getCoins(id);
    return message.reply("💰 Coinin: " + formatCoins(coin));
}
    if (message.content === "ptop") {
        const top = Object.entries(coins)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map((x, i) => `${i + 1}. <@${x[0]}> - ${formatCoins(x[1])} coin`)
            .join("\n");

        message.channel.send("🏆 TOP 5:\n" + top);
    }
});
client.login(process.env.TOKEN);