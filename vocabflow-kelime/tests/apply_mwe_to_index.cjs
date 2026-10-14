const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const multiWordConceptsDB = {
    "big bang": {
        english: "Big Bang",
        turkish: "Büyük Patlama (evrenin başlangıcı)",
        primary: "Büyük Patlama teorisi (evrenin oluşum başlangıcı)",
        context: "Büyük Patlama (evrenin başlangıcı)",
        type: "Bileşik Terim / Kavram",
        phonetic: "/ˌbɪɡ ˈbæŋ/"
    },
    "james webb": {
        english: "James Webb",
        turkish: "James Webb Uzay Teleskobu",
        primary: "NASA'nın amiral gemisi kızılötesi uzay gözlemevi",
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
    },
    "peer through": {
        english: "peer through",
        turkish: "arkasını taramak, içinden bakmak",
        primary: "yoğun bir engelin arkasını dikkatle incelemek",
        context: "arkasını taramak",
        type: "Deyimsel Fiil (Phrasal Verb)",
        phonetic: "/ˌpɪə ˈθruː/"
    },
    "solar shield": {
        english: "solar shield",
        turkish: "güneş kalkanı",
        primary: "teleskobu kavurucu güneş ısısından koruyan origami tarzı kalkan",
        context: "güneş kalkanı",
        type: "Bileşik Terim",
        phonetic: "/ˈsəʊlər ˈʃiːld/"
    },
    "deep space": {
        english: "deep space",
        turkish: "derin uzay",
        primary: "Güneş Sistemi'nin ötesindeki uçsuz bucaksız uzay boşluğu",
        context: "derin uzay",
        type: "Astronomi Terimi",
        phonetic: "/ˌdiːp ˈspeɪs/"
    },
    "light years": {
        english: "light years",
        turkish: "ışık yılları",
        primary: "ışığın bir yılda aldığı astronomik mesafe birimi",
        context: "ışık yılları",
        type: "Astronomi Birimi",
        phonetic: "/ˈlaɪt ˌjɪəz/"
    },
    "solar system": {
        english: "solar system",
        turkish: "Güneş Sistemi",
        primary: "Güneş ve çekimindeki gezegenler sistemi",
        context: "Güneş Sistemi",
        type: "Astronomi Terimi",
        phonetic: "/ˈsəʊlər ˌsɪstəm/"
    },
    "everyday algorithms": {
        english: "everyday algorithms",
        turkish: "günlük algoritmalar",
        primary: "gündelik hayatı şekillendiren yapay zeka kuralları",
        context: "günlük algoritmalar",
        type: "Bileşik Terim",
        phonetic: "/ˈevrideɪ ˈælɡərɪðəmz/"
    },
    "motion pictures": {
        english: "motion pictures",
        turkish: "hareketli görüntüler, sinema filmleri",
        primary: "beyaz perde sinema filmleri",
        context: "hareketli görüntüler",
        type: "Sinema Terimi",
        phonetic: "/ˌməʊʃn ˈpɪktʃəz/"
    },
    "hunter-gatherers": {
        english: "hunter-gatherers",
        turkish: "avcı-toplayıcılar",
        primary: "tarım öncesi doğadan beslenen göçebe insan toplulukları",
        context: "avcı-toplayıcılar",
        type: "Antropoloji Terimi",
        phonetic: "/ˌhʌntə ˈɡæðərəz/"
    },
    "hunter gatherers": {
        english: "hunter gatherers",
        turkish: "avcı-toplayıcılar",
        primary: "tarım öncesi doğadan beslenen göçebe insan toplulukları",
        context: "avcı-toplayıcılar",
        type: "Antropoloji Terimi",
        phonetic: "/ˌhʌntə ˈɡæðərəz/"
    },
    "voynich manuscript": {
        english: "Voynich Manuscript",
        turkish: "Voynich El Yazması",
        primary: "15. yüzyıldan kalma şifresi çözülemeyen gizemli kitap",
        context: "Voynich El Yazması",
        type: "Tarihi Eser",
        phonetic: "/ˈvɔɪnɪtʃ ˈmænjuskrɪpt/"
    }
};

const mweJs = `\n    /* MULTI-WORD CONCEPTS & PHRASES DATABASE (MWE: Big Bang, AI, etc.) */\n    const multiWordConceptsDB = ${JSON.stringify(multiWordConceptsDB, null, 8)};\n\n    function buildMultiWordRegex(db) {\n        if (!db) return null;\n        const keys = Object.keys(db).sort((a,b) => b.length - a.length);\n        if (keys.length === 0) return null;\n        const escaped = keys.map(k => k.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\s+/g, '\\\\s+'));\n        return new RegExp('\\\\b(' + escaped.join('|') + ')\\\\b', 'gi');\n    }\n    const multiWordRegex = buildMultiWordRegex(multiWordConceptsDB);\n`;

// 1. Insert multiWordConceptsDB right before getWordDefinition
const targetPos = html.indexOf('function getWordDefinition(rawWord) {');
if (targetPos === -1) {
    console.error("Could not find function getWordDefinition in index.html!");
    process.exit(1);
}

html = html.substring(0, targetPos) + mweJs + '\n    ' + html.substring(targetPos);

// 2. Update getWordDefinition to check multiWordConceptsDB
const oldCheckCleanWord = `    function getWordDefinition(rawWord) {
        if (!rawWord) return null;
        const cleanWord = String(rawWord).toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanWord) return null;`;

const newCheckCleanWord = `    function getWordDefinition(rawWord) {
        if (!rawWord) return null;
        const cleanPhrase = String(rawWord).toLowerCase().trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanPhrase) return null;

        // Check Multi-Word Concepts (e.g. Big Bang, Artificial Intelligence, Marcus Aurelius)
        if (typeof multiWordConceptsDB !== 'undefined' && multiWordConceptsDB && multiWordConceptsDB[cleanPhrase]) {
            const mwe = multiWordConceptsDB[cleanPhrase];
            return {
                english: mwe.english || rawWord,
                turkish: mwe.context || mwe.turkish || mwe.primary,
                primaryMeaning: mwe.primary || mwe.turkish,
                contextMeaning: mwe.context || mwe.turkish,
                phonetic: mwe.phonetic || \`/\${cleanPhrase}/\`,
                type: mwe.type || 'Bileşik Terim',
                example: mwe.example || \`The concept "\${rawWord}" is used in this article.\`,
                isGrammar: false,
                isCompound: true
            };
        }

        const cleanWord = cleanPhrase;`;

html = html.replace(oldCheckCleanWord, newCheckCleanWord);

// 3. Update renderArticleContentSafely tokenization to preserve multi-word expressions as unified interactive spans
const oldTokenizeLoop = `                    textNodes.forEach(textNode => {
                        const parent = textNode.parentNode;
                        if (!parent) return;
                        const textVal = textNode.nodeValue || textNode.textContent || '';
                        if (!textVal) return;

                        WORD_TOKEN_REGEX.lastIndex = 0;
                        let match;
                        let matchedAny = false;
                        const frag = doc.createDocumentFragment ? doc.createDocumentFragment() : document.createDocumentFragment();

                        while ((match = WORD_TOKEN_REGEX.exec(textVal)) !== null) {
                            matchedAny = true;
                            const word = match[1];
                            const nonWord = match[2];
                            if (word) {
                                const span = doc.createElement ? doc.createElement('span') : document.createElement('span');
                                const clean = word.toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                                const isGlossaryWord = Boolean(article.glossary && (article.glossary[clean] || (clean.endsWith('s') && article.glossary[clean.slice(0, -1)]) || (clean.endsWith('ed') && article.glossary[clean.slice(0, -2)])));
                                span.className = isGlossaryWord
                                    ? "interactive-word target-word cursor-pointer"
                                    : "interactive-word cursor-pointer";
                                span.textContent = word;
                                span.dataset.word = clean || word.toLowerCase();
                                frag.appendChild(span);
                            } else if (nonWord) {
                                const t = doc.createTextNode ? doc.createTextNode(nonWord) : document.createTextNode(nonWord);
                                frag.appendChild(t);
                            }
                        }

                        if (matchedAny && frag.childNodes && frag.childNodes.length > 0) {
                            parent.replaceChild(frag, textNode);
                        }
                    });`;

const newTokenizeLoop = `                    textNodes.forEach(textNode => {
                        const parent = textNode.parentNode;
                        if (!parent) return;
                        const textVal = textNode.nodeValue || textNode.textContent || '';
                        if (!textVal) return;

                        // Tokenize with multi-word expressions (Big Bang, AI, etc.) preserved
                        let chunks = [{ type: 'text', value: textVal }];
                        if (typeof multiWordRegex !== 'undefined' && multiWordRegex) {
                            multiWordRegex.lastIndex = 0;
                            let lastIdx = 0;
                            let mweMatch;
                            const newChunks = [];
                            while ((mweMatch = multiWordRegex.exec(textVal)) !== null) {
                                if (mweMatch.index > lastIdx) {
                                    newChunks.push({ type: 'text', value: textVal.substring(lastIdx, mweMatch.index) });
                                }
                                newChunks.push({ type: 'phrase', value: mweMatch[0], clean: mweMatch[0].toLowerCase().trim() });
                                lastIdx = mweMatch.index + mweMatch[0].length;
                            }
                            if (lastIdx < textVal.length) {
                                newChunks.push({ type: 'text', value: textVal.substring(lastIdx) });
                            }
                            if (newChunks.length > 0) chunks = newChunks;
                        }

                        let matchedAny = false;
                        const frag = doc.createDocumentFragment ? doc.createDocumentFragment() : document.createDocumentFragment();

                        for (const chunk of chunks) {
                            if (chunk.type === 'phrase') {
                                matchedAny = true;
                                const span = doc.createElement ? doc.createElement('span') : document.createElement('span');
                                span.className = "interactive-word compound-word cursor-pointer underline decoration-dotted decoration-primary/50 font-medium";
                                span.textContent = chunk.value;
                                span.dataset.word = chunk.clean;
                                frag.appendChild(span);
                            } else {
                                WORD_TOKEN_REGEX.lastIndex = 0;
                                let match;
                                while ((match = WORD_TOKEN_REGEX.exec(chunk.value)) !== null) {
                                    matchedAny = true;
                                    const word = match[1];
                                    const nonWord = match[2];
                                    if (word) {
                                        const span = doc.createElement ? doc.createElement('span') : document.createElement('span');
                                        const clean = word.toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                                        const isGlossaryWord = Boolean(article.glossary && (article.glossary[clean] || (clean.endsWith('s') && article.glossary[clean.slice(0, -1)]) || (clean.endsWith('ed') && article.glossary[clean.slice(0, -2)])));
                                        span.className = isGlossaryWord
                                            ? "interactive-word target-word cursor-pointer"
                                            : "interactive-word cursor-pointer";
                                        span.textContent = word;
                                        span.dataset.word = clean || word.toLowerCase();
                                        frag.appendChild(span);
                                    } else if (nonWord) {
                                        const t = doc.createTextNode ? doc.createTextNode(nonWord) : document.createTextNode(nonWord);
                                        frag.appendChild(t);
                                    }
                                }
                            }
                        }

                        if (matchedAny && frag.childNodes && frag.childNodes.length > 0) {
                            parent.replaceChild(frag, textNode);
                        }
                    });`;

if (!html.includes(oldTokenizeLoop)) {
    console.error("Could not find oldTokenizeLoop in index.html!");
    process.exit(1);
}

html = html.replace(oldTokenizeLoop, newTokenizeLoop);

// 4. Update openArticleWordLookup neighbor detection
const oldLookupStart = `    function openArticleWordLookup(rawWord, contextSentence = '', targetElement = null) {
        if (!rawWord) return;
        const cleanWord = String(rawWord).toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanWord) return;

        const safeContext = typeof contextSentence === 'string' ? contextSentence.trim() : '';
        const def = getWordDefinition(cleanWord);`;

const newLookupStart = `    function openArticleWordLookup(rawWord, contextSentence = '', targetElement = null) {
        if (!rawWord) return;
        let cleanWord = String(rawWord).toLowerCase().trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanWord) return;

        // Contextual neighbor collocation detection (e.g. user clicked on 'Big' or 'Bang' separately)
        if (targetElement && typeof multiWordConceptsDB !== 'undefined') {
            const nextEl = targetElement.nextElementSibling;
            if (nextEl && nextEl.dataset && nextEl.dataset.word) {
                const comboNext = (cleanWord + ' ' + nextEl.dataset.word).toLowerCase().trim();
                if (multiWordConceptsDB[comboNext]) {
                    cleanWord = comboNext;
                }
            }
            const prevEl = targetElement.previousElementSibling;
            if (prevEl && prevEl.dataset && prevEl.dataset.word) {
                const comboPrev = (prevEl.dataset.word + ' ' + cleanWord).toLowerCase().trim();
                if (multiWordConceptsDB[comboPrev]) {
                    cleanWord = comboPrev;
                }
            }
        }

        const safeContext = typeof contextSentence === 'string' ? contextSentence.trim() : '';
        const def = getWordDefinition(cleanWord);`;

if (!html.includes(oldLookupStart)) {
    console.error("Could not find oldLookupStart in index.html!");
    process.exit(1);
}

html = html.replace(oldLookupStart, newLookupStart);

// Update headword display to show proper case if def.english exists
const oldHeadwordText = "if (headwordEl) headwordEl.textContent = cleanWord;";
const newHeadwordText = "if (headwordEl) headwordEl.textContent = (def && def.english) ? def.english : cleanWord;";
html = html.replace(oldHeadwordText, newHeadwordText);

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Successfully applied Multi-Word Concepts & Phrases support to index.html!");
