const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Load common vocabulary JSON
const vocabPath = path.join(__dirname, 'common_vocab.json');
const commonVocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));

console.log(`Loaded ${Object.keys(commonVocab).length} words from common_vocab.json.`);

// Format JS code for commonVocabularyDB
const vocabJs = `    /* EXTENDED COMMON VOCABULARY DATABASE (All Article Words + Common Core) */\n    const commonVocabularyDB = ${JSON.stringify(commonVocab, null, 8)};\n`;

// Target injection point: right after `grammarFunctionWords = { ... };` and right before `function getWordDefinition`
const grammarEndAnchor = "        }\n    };\n\n    function getWordDefinition(rawWord) {";
if (!indexContent.includes(grammarEndAnchor)) {
    console.error("Could not find grammarEndAnchor in index.html!");
    process.exit(1);
}

// Prepare updated getWordDefinition function
const oldGetWordDefSnippet = `    function getWordDefinition(rawWord) {
        if (!rawWord) return null;
        const cleanWord = String(rawWord).toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanWord) return null;

        // 1. Current article glossary
        const currentArticle = (typeof appState !== 'undefined' && appState.activeArticleObject && (!appState.currentArticleId || appState.activeArticleObject.id === appState.currentArticleId))
            ? appState.activeArticleObject
            : ((typeof articlesDB !== 'undefined' && Array.isArray(articlesDB))
                ? articlesDB.find(a => a.id === (typeof appState !== 'undefined' ? appState.currentArticleId : null))
                : (typeof appState !== 'undefined' ? appState.activeArticleObject : null));

        function findGeneralDefinition(word) {
            if (typeof dictionaryDB !== 'undefined' && dictionaryDB && dictionaryDB[word]) {
                const d = dictionaryDB[word];
                return {
                    primary: d.turkish || d.tr || '',
                    phonetic: d.phonetic || '',
                    type: d.type || '',
                    example: (Array.isArray(d.examples) ? d.examples[0] : d.example) || ''
                };
            }
            if (typeof languageRecommendations !== 'undefined' && languageRecommendations.en) {
                const lr = languageRecommendations.en.find(item => item && item.english && item.english.toLowerCase() === word);
                if (lr) {
                    return {
                        primary: lr.turkish || '',
                        phonetic: '',
                        type: 'Kelime',
                        example: (Array.isArray(lr.examples) ? lr.examples[0] : '') || ''
                    };
                }
            }
            return null;
        }

        function findInGlossary(glossary, word) {
            if (!glossary) return null;
            if (glossary[word]) return glossary[word];
            if (word.endsWith('s') && glossary[word.slice(0, -1)]) return glossary[word.slice(0, -1)];
            if (word.endsWith('ed') && glossary[word.slice(0, -2)]) return glossary[word.slice(0, -2)];
            if (word.endsWith('ing') && glossary[word.slice(0, -3)]) return glossary[word.slice(0, -3)];
            return null;
        }

        // 1. Check current article glossary
        const articleGlossaryItem = currentArticle ? findInGlossary(currentArticle.glossary, cleanWord) : null;
        if (articleGlossaryItem) {
            const contextMeaning = articleGlossaryItem.turkish || articleGlossaryItem.tr || '';
            const phonetic = articleGlossaryItem.phonetic || \`/\${cleanWord}/\`;
            const type = articleGlossaryItem.type || 'Kelime';
            const example = articleGlossaryItem.example || (Array.isArray(articleGlossaryItem.examples) ? articleGlossaryItem.examples[0] : '') || '';

            const gen = findGeneralDefinition(cleanWord) || 
                        (cleanWord.endsWith('s') ? findGeneralDefinition(cleanWord.slice(0, -1)) : null) ||
                        (cleanWord.endsWith('ed') ? findGeneralDefinition(cleanWord.slice(0, -2)) : null) ||
                        (cleanWord.endsWith('ing') ? findGeneralDefinition(cleanWord.slice(0, -3)) : null);
            
            const primaryMeaning = (gen && gen.primary) ? gen.primary : (articleGlossaryItem.primaryMeaning || contextMeaning);

            return {
                english: cleanWord,
                turkish: contextMeaning || primaryMeaning,
                primaryMeaning: primaryMeaning || contextMeaning,
                contextMeaning: contextMeaning || primaryMeaning,
                phonetic: phonetic,
                type: type,
                example: example,
                isGrammar: false
            };
        }

        // 2. Check grammar function words (the, a, of, to, in, etc.)
        if (typeof grammarFunctionWords !== 'undefined' && grammarFunctionWords[cleanWord]) {
            const gw = grammarFunctionWords[cleanWord];
            return {
                english: cleanWord,
                turkish: gw.context || gw.primary,
                primaryMeaning: gw.primary,
                contextMeaning: gw.context,
                phonetic: gw.phonetic || \`/\${cleanWord}/\`,
                type: gw.type || 'Gramer',
                example: \`The word "\${cleanWord}" is a grammatical function word.\`,
                isGrammar: true
            };
        }

        // 3. Check general dictionaryDB
        const genDef = findGeneralDefinition(cleanWord);
        if (genDef) {
            const primaryMeaning = genDef.primary;
            return {
                english: cleanWord,
                turkish: primaryMeaning,
                primaryMeaning: primaryMeaning,
                contextMeaning: primaryMeaning,
                phonetic: genDef.phonetic || \`/\${cleanWord}/\`,
                type: genDef.type || 'Kelime',
                example: genDef.example || '',
                isGrammar: false
            };
        }

        // 4. Check other articles in articlesDB
        if (typeof articlesDB !== 'undefined' && Array.isArray(articlesDB)) {
            for (const art of articlesDB) {
                const otherItem = findInGlossary(art.glossary, cleanWord);
                if (otherItem) {
                    const otherTr = otherItem.turkish || otherItem.tr || '';
                    return {
                        english: cleanWord,
                        turkish: otherTr,
                        primaryMeaning: otherTr,
                        contextMeaning: otherTr,
                        phonetic: otherItem.phonetic || \`/\${cleanWord}/\`,
                        type: otherItem.type || 'Kelime',
                        example: otherItem.example || (Array.isArray(otherItem.examples) ? otherItem.examples[0] : '') || '',
                        isGrammar: false
                    };
                }
            }
        }

        // 5. Fallback definition
        return {
            english: cleanWord,
            turkish: \`\${cleanWord} (Türkçe karşılığı)\`,
            primaryMeaning: \`\${cleanWord} (Genel anlamı)\`,
            contextMeaning: \`\${cleanWord} (Metin içi karşılığı)\`,
            phonetic: \`/\${cleanWord}/\`,
            type: 'Kelime',
            example: \`The word "\${cleanWord}" is used in this article.\`,
            isGrammar: false
        };
    }`;

const newGetWordDefSnippet = `    function getWordDefinition(rawWord) {
        if (!rawWord) return null;
        const cleanWord = String(rawWord).toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (!cleanWord) return null;

        // 1. Current article glossary
        const currentArticle = (typeof appState !== 'undefined' && appState.activeArticleObject && (!appState.currentArticleId || appState.activeArticleObject.id === appState.currentArticleId))
            ? appState.activeArticleObject
            : ((typeof articlesDB !== 'undefined' && Array.isArray(articlesDB))
                ? articlesDB.find(a => a.id === (typeof appState !== 'undefined' ? appState.currentArticleId : null))
                : (typeof appState !== 'undefined' ? appState.activeArticleObject : null));

        function findGeneralDefinition(word) {
            if (!word) return null;
            if (typeof dictionaryDB !== 'undefined' && dictionaryDB && dictionaryDB[word]) {
                const d = dictionaryDB[word];
                return {
                    primary: d.turkish || d.tr || '',
                    context: d.context || d.turkish || d.tr || '',
                    phonetic: d.phonetic || '',
                    type: d.type || '',
                    example: (Array.isArray(d.examples) ? d.examples[0] : d.example) || ''
                };
            }
            if (typeof commonVocabularyDB !== 'undefined' && commonVocabularyDB && commonVocabularyDB[word]) {
                const cv = commonVocabularyDB[word];
                return {
                    primary: cv.primary || cv.tr || '',
                    context: cv.context || cv.tr || cv.primary || '',
                    phonetic: cv.phonetic || '',
                    type: cv.type || 'Kelime',
                    example: cv.example || ''
                };
            }
            if (typeof languageRecommendations !== 'undefined' && languageRecommendations.en) {
                const lr = languageRecommendations.en.find(item => item && item.english && item.english.toLowerCase() === word);
                if (lr) {
                    return {
                        primary: lr.turkish || '',
                        context: lr.turkish || '',
                        phonetic: '',
                        type: 'Kelime',
                        example: (Array.isArray(lr.examples) ? lr.examples[0] : '') || ''
                    };
                }
            }
            return null;
        }

        function findWithStemming(word) {
            if (!word) return null;
            let direct = findGeneralDefinition(word);
            if (direct) return direct;

            // Morphological stemming & lemmatization candidates
            const candidates = [];
            if (word.endsWith('ies') && word.length > 4) candidates.push(word.slice(0, -3) + 'y');
            if (word.endsWith('es') && word.length > 3) candidates.push(word.slice(0, -2));
            if (word.endsWith('s') && word.length > 2 && !word.endsWith('ss')) candidates.push(word.slice(0, -1));
            if (word.endsWith('ed') && word.length > 3) {
                candidates.push(word.slice(0, -2));
                candidates.push(word.slice(0, -1));
            }
            if (word.endsWith('ing') && word.length > 4) {
                candidates.push(word.slice(0, -3));
                candidates.push(word.slice(0, -3) + 'e');
            }
            if (word.endsWith('ly') && word.length > 3) candidates.push(word.slice(0, -2));
            if (word.endsWith('est') && word.length > 4) candidates.push(word.slice(0, -3));
            if (word.endsWith('er') && word.length > 3) candidates.push(word.slice(0, -2));

            for (const cand of candidates) {
                const candRes = findGeneralDefinition(cand);
                if (candRes) {
                    return {
                        primary: candRes.primary,
                        context: candRes.context || candRes.primary,
                        phonetic: candRes.phonetic || \`/\${word}/\`,
                        type: candRes.type || 'Kelime',
                        example: candRes.example || '',
                        derivedFrom: cand
                    };
                }
            }
            return null;
        }

        function findInGlossary(glossary, word) {
            if (!glossary) return null;
            if (glossary[word]) return glossary[word];
            if (word.endsWith('s') && glossary[word.slice(0, -1)]) return glossary[word.slice(0, -1)];
            if (word.endsWith('ed') && glossary[word.slice(0, -2)]) return glossary[word.slice(0, -2)];
            if (word.endsWith('ing') && glossary[word.slice(0, -3)]) return glossary[word.slice(0, -3)];
            return null;
        }

        // 1. Check current article glossary
        const articleGlossaryItem = currentArticle ? findInGlossary(currentArticle.glossary, cleanWord) : null;
        if (articleGlossaryItem) {
            const contextMeaning = articleGlossaryItem.turkish || articleGlossaryItem.tr || '';
            const phonetic = articleGlossaryItem.phonetic || \`/\${cleanWord}/\`;
            const type = articleGlossaryItem.type || 'Kelime';
            const example = articleGlossaryItem.example || (Array.isArray(articleGlossaryItem.examples) ? articleGlossaryItem.examples[0] : '') || '';

            const gen = findWithStemming(cleanWord);
            const primaryMeaning = (gen && gen.primary) ? gen.primary : (articleGlossaryItem.primaryMeaning || contextMeaning);

            return {
                english: cleanWord,
                turkish: contextMeaning || primaryMeaning,
                primaryMeaning: primaryMeaning || contextMeaning,
                contextMeaning: contextMeaning || primaryMeaning,
                phonetic: phonetic,
                type: type,
                example: example,
                isGrammar: false
            };
        }

        // 2. Check grammar function words (the, a, of, to, in, etc.)
        if (typeof grammarFunctionWords !== 'undefined' && grammarFunctionWords[cleanWord]) {
            const gw = grammarFunctionWords[cleanWord];
            return {
                english: cleanWord,
                turkish: gw.context || gw.primary,
                primaryMeaning: gw.primary,
                contextMeaning: gw.context,
                phonetic: gw.phonetic || \`/\${cleanWord}/\`,
                type: gw.type || 'Gramer',
                example: \`The word "\${cleanWord}" is a grammatical function word.\`,
                isGrammar: true
            };
        }

        // 3. Check general dictionaryDB & commonVocabularyDB (with smart stemming)
        const genDef = findWithStemming(cleanWord);
        if (genDef) {
            const primaryMeaning = genDef.primary;
            const contextMeaning = genDef.context || primaryMeaning;
            return {
                english: cleanWord,
                turkish: contextMeaning,
                primaryMeaning: primaryMeaning,
                contextMeaning: contextMeaning,
                phonetic: genDef.phonetic || \`/\${cleanWord}/\`,
                type: genDef.type || 'Kelime',
                example: genDef.example || '',
                isGrammar: false
            };
        }

        // 4. Check other articles in articlesDB
        if (typeof articlesDB !== 'undefined' && Array.isArray(articlesDB)) {
            for (const art of articlesDB) {
                const otherItem = findInGlossary(art.glossary, cleanWord);
                if (otherItem) {
                    const otherTr = otherItem.turkish || otherItem.tr || '';
                    return {
                        english: cleanWord,
                        turkish: otherTr,
                        primaryMeaning: otherTr,
                        contextMeaning: otherTr,
                        phonetic: otherItem.phonetic || \`/\${cleanWord}/\`,
                        type: otherItem.type || 'Kelime',
                        example: otherItem.example || (Array.isArray(otherItem.examples) ? otherItem.examples[0] : '') || '',
                        isGrammar: false
                    };
                }
            }
        }

        // 5. Fallback definition
        return {
            english: cleanWord,
            turkish: \`\${cleanWord} (Türkçe karşılığı)\`,
            primaryMeaning: \`\${cleanWord} (Genel anlamı)\`,
            contextMeaning: \`\${cleanWord} (Metin içi karşılığı)\`,
            phonetic: \`/\${cleanWord}/\`,
            type: 'Kelime',
            example: \`The word "\${cleanWord}" is used in this article.\`,
            isGrammar: false
        };
    }`;

if (!indexContent.includes(oldGetWordDefSnippet)) {
    console.error("Could not find oldGetWordDefSnippet in index.html!");
    process.exit(1);
}

// Perform replacement
const replacementBlock = `${vocabJs}\n${newGetWordDefSnippet}`;
indexContent = indexContent.replace(oldGetWordDefSnippet, replacementBlock);

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log("Successfully updated index.html with commonVocabularyDB and enhanced getWordDefinition!");
