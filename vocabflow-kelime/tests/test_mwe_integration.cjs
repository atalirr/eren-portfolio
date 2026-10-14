const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log("Analyzing index.html for compound words support...");

// Verify that Big Bang, Artificial Intelligence, James Webb etc are in multiWordConceptsDB
const multiWordConceptsDB = {
    "big bang": {
        english: "Big Bang",
        turkish: "Büyük Patlama (evrenin başlangıcı)",
        primary: "Büyük Patlama (evrenin oluşum teorisi)",
        context: "Büyük Patlama (evrenin başlangıcı)",
        type: "Bileşik Terim / Kavram",
        phonetic: "/ˌbɪɡ ˈbæŋ/"
    },
    "james webb": {
        english: "James Webb",
        turkish: "James Webb Uzay Teleskobu",
        primary: "NASA'nın gelişmiş uzay gözlemevi",
        context: "James Webb Uzay Teleskobu",
        type: "Özel Terim",
        phonetic: "/ˌdʒeɪmz ˈweb/"
    },
    "space telescope": {
        english: "space telescope",
        turkish: "uzay teleskobu",
        primary: "yörüngedeki astronomik gözlemevi",
        context: "uzay teleskobu",
        type: "Bileşik İsim",
        phonetic: "/ˈspeɪs ˈtelɪskəʊp/"
    },
    "artificial intelligence": {
        english: "Artificial Intelligence",
        turkish: "yapay zekâ (YZ)",
        primary: "insan zekasını taklit eden algoritmik sistemler",
        context: "yapay zekâ (YZ)",
        type: "Bileşik Terim",
        phonetic: "/ˌɑːtɪˈfɪʃl ɪnˈtelɪdʒəns/"
    },
    "marcus aurelius": {
        english: "Marcus Aurelius",
        turkish: "Marcus Aurelius",
        primary: "Roma İmparatoru ve ünlü Stoacı filozof",
        context: "Marcus Aurelius",
        type: "Tarihi Kişi / Filozof",
        phonetic: "/ˌmɑːkəs ɔːˈriːliəs/"
    },
    "charlie chaplin": {
        english: "Charlie Chaplin",
        turkish: "Charlie Chaplin",
        primary: "Sessiz sinema döneminin efsanevi aktörü ve komedyeni",
        context: "Charlie Chaplin",
        type: "Tarihi Kişi / Sanatçı",
        phonetic: "/ˌtʃɑːli ˈtʃæplɪn/"
    },
    "mariana trench": {
        english: "Mariana Trench",
        turkish: "Mariana Çukuru",
        primary: "Dünyanın en derin okyanus çukuru (~11.000 m)",
        context: "Mariana Çukuru",
        type: "Coğrafi Terim",
        phonetic: "/ˌmæriˈænə ˈtrentʃ/"
    },
    "hadal zone": {
        english: "Hadal Zone",
        turkish: "Hadal Bölgesi",
        primary: "Okyanusların 6.000 metreden derin taban katmanı",
        context: "Hadal Bölgesi",
        type: "Okyanusbilim Terimi",
        phonetic: "/ˈheɪdl ˌzəʊn/"
    },
    "sagrada família": {
        english: "Sagrada Família",
        turkish: "Sagrada Família (Kutsal Aile)",
        primary: "Antoni Gaudí'nin Barselona'daki şaheser bazilikası",
        context: "Sagrada Família",
        type: "Mimari Başyapıt",
        phonetic: "/səˈɡrɑːdə fəˈmiːliə/"
    },
    "sagrada familia": {
        english: "Sagrada Familia",
        turkish: "Sagrada Família (Kutsal Aile)",
        primary: "Antoni Gaudí'nin Barselona'daki şaheser bazilikası",
        context: "Sagrada Família",
        type: "Mimari Başyapıt",
        phonetic: "/səˈɡrɑːdə fəˈmiːliə/"
    },
    "weather forecast": {
        english: "weather forecast",
        turkish: "hava durumu tahmini",
        primary: "meteorolojik hava durumu öngörüsü",
        context: "hava durumu tahmini",
        type: "Bileşik İsim",
        phonetic: "/ˈweðər ˌfɔːkɑːst/"
    },
    "fastest route": {
        english: "fastest route",
        turkish: "en hızlı rota, en kestirme yol",
        primary: "en kısa sürede ulaştıran güzergâh",
        context: "en hızlı rota",
        type: "Bileşik İfade",
        phonetic: "/ˈfɑːstɪst ˈruːt/"
    },
    "music playlists": {
        english: "music playlists",
        turkish: "müzik çalma listeleri",
        primary: "dijital müzik listeleri",
        context: "müzik çalma listeleri",
        type: "Bileşik İsim",
        phonetic: "/ˈmjuːzɪk ˈpleɪlɪsts/"
    },
    "silent cinema": {
        english: "silent cinema",
        turkish: "sessiz sinema",
        primary: "senkronize ses kaydı olmayan ilk sinema dönemi",
        context: "sessiz sinema",
        type: "Sinema Terimi",
        phonetic: "/ˌsaɪlənt ˈsɪnəmə/"
    },
    "carbon dioxide": {
        english: "carbon dioxide",
        turkish: "karbondioksit (CO2)",
        primary: "atmosferde bulunan karbon bileşiği gaz",
        context: "karbondioksit",
        type: "Kimyasal Bileşik",
        phonetic: "/ˌkɑːbən daɪˈɒksaɪd/"
    },
    "look back": {
        english: "look back",
        turkish: "geçmişe bakmak, zamanda geriye bakmak",
        primary: "geçmişe dönüp hatırlamak veya zamanda geriye bakmak",
        context: "zamanda geriye bakmak",
        type: "Deyimsel Fiil (Phrasal Verb)",
        phonetic: "/ˌlʊk ˈbæk/"
    }
};

console.log("Total multi-word concepts prepared:", Object.keys(multiWordConceptsDB).length);
