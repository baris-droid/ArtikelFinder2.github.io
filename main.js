// main.js (Tüm özellikleri ve Özel Test Modlarını içeren en güncel sürüm)

function normalizeGermanString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue');
}

// Bir diziyi yerinde karıştıran Fisher-Yates shuffle algoritması
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Global Değişkenler
let quizWords = [];
let currentQuizDeck = [];
let currentQuizWord = null;
let score = 0;
let totalQuestions = 0;
let favorites = [];
let allWords = []; // Tüm kelimeleri burada saklayacağız

document.addEventListener('DOMContentLoaded', () => {
    // Menüyü yükle ve YÜKLENDİKTEN SONRA diğer işlemleri yap
    if (document.getElementById('menu-placeholder')) {
        fetch('menu.html')
            .then(response => response.text())
            .then(data => {
                // 1. Menüyü sayfaya yerleştiriyoruz.
                document.getElementById('menu-placeholder').innerHTML = data;

                // 2. Menü yüklendiği için artık içindeki elementleri bulabiliriz.
                
                // --- KOYU TEMA MANTIĞI ---
                const themeToggle = document.getElementById('theme-toggle');
                if (localStorage.getItem('theme') === 'dark') {
                    if (themeToggle) themeToggle.checked = true;
                }
                if (themeToggle) {
                    themeToggle.addEventListener('change', function() {
                        if (this.checked) {
                            document.documentElement.classList.add('dark-mode');
                            localStorage.setItem('theme', 'dark');
                        } else {
                            document.documentElement.classList.remove('dark-mode');
                            localStorage.setItem('theme', 'light');
                        }
                    });
                }
                
                // --- SERİ SAYACINI GÜNCELLEME KODUNU BURAYA TAŞIDIK ---
                updateStreakDisplay();
            });
    }

    // Tüm kelimeleri ve favorileri başlangıçta yükle
    loadAllWords().then(() => {
        // İlgili sayfanın fonksiyonunu çalıştır
        if (document.getElementById('favorites-list')) {
            loadFavoritesPage();
        }
        if (document.getElementById('stats-summary')) {
            loadStatsPage();
        }
        if (document.getElementById('quiz-area')) {
            initQuiz();
        }
    });

	if (document.getElementById('quizLength')) { // Ayarlar sayfasında olup olmadığını kontrol eder
		loadSettingsPage();
	}
    // --- DİĞER OLAY DİNLEYİCİLERİ ---
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
	const randomWordButton = document.getElementById('randomWordButton');
    if (searchButton) searchButton.addEventListener('click', search);
    if (searchInput) searchInput.addEventListener('keypress', checkEnter);

    if (document.getElementById('wordList')) loadWordList();
    if (document.getElementById('daily-word-container')) displayDailyWord();
	if (randomWordButton) { // Bu if bloğunu ekleyin
        randomWordButton.addEventListener('click', showRandomWord);
    }
	
});

function toggleMenu() {
    const menu = document.querySelector('.button-container .menu');
    if (menu) menu.classList.toggle('show');
}async function showRandomWord() {
    await loadAllWords(); // Tüm kelimelerin yüklendiğinden emin ol
    const resultsContainer = document.getElementById('results-container');
    
    // Rastgele bir kelime seç
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    
    // Sonucu ekranda göster
    displayResult(resultsContainer, randomWord);
}

// --- SESLENDİRME FONKSİYONU ---
function speak(wordToSpeak, event) {
    if (event) event.stopPropagation();
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(wordToSpeak);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    } else {
        alert('Tarayıcınız sesli okuma özelliğini desteklemiyor.');
    }
}

// --- FAVORİ SİSTEMİ FONKSİYONLARI ---
async function loadAllWords() {
    if (allWords.length > 0) return;
    try {
        const response = await fetch('words.json?t=' + new Date().getTime());
        allWords = await response.json();
        loadFavorites(); // Kelimeler yüklendikten sonra favorileri yükle
    } catch (error) {
        console.error("Tüm kelimeler yüklenirken hata oluştu:", error);
    }
}

function loadFavorites() {
    favorites = JSON.parse(localStorage.getItem('favorites')) || [];
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function isFavorite(wordId) {
    return favorites.includes(wordId);
}

function toggleFavorite(wordId, event) {
    if (event) event.stopPropagation();
    
    const button = event.currentTarget;
    loadFavorites(); // En güncel listeyi al
    const isCurrentlyFavorite = isFavorite(wordId);

    if (isCurrentlyFavorite) {
        favorites = favorites.filter(id => id !== wordId);
        button.classList.remove('favorited');
    } else {
        favorites.push(wordId);
        button.classList.add('favorited');
    }
    saveFavorites();
}

// --- ANASAYFA FONKSİYONLARI ---
async function search() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    if (query.length === 0) {
        resultsContainer.innerHTML = '<p>Lütfen bir kelime yazın.</p>';
        return;
    }

    await loadAllWords(); // Kelimelerin yüklendiğinden emin ol
    const normalizedQuery = normalizeGermanString(query);
    
    const filteredData = allWords.filter(item => {
        const normalizedWord = normalizeGermanString(item.word);
        const normalizedPlural = item.plural ? normalizeGermanString(item.plural.replace('die ', '')) : null;
        return normalizedWord === normalizedQuery || normalizedPlural === normalizedQuery;
    });

    if (filteredData.length > 0) {
        displayResult(resultsContainer, filteredData[0]);
    } else {
        resultsContainer.innerHTML = '<p>Kelime bulunamadı. Lütfen kontrol edip tekrar deneyin.</p>';
    }
}

function displayResult(container, item) {
    const turkishMeaningHTML = item.turkish ? `<p class="turkish-meaning">${item.turkish}</p>` : '';
    const pluralHTML = item.plural ? `<p class="plural-form">Çoğul: ${item.plural}</p>` : '';
    const isFav = isFavorite(item.id);
    const favClass = isFav ? 'favorited' : '';
    
    const speakIconSVG = `<svg class="speak-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.313-1.063-2.375-2.375-2.375S8.75 2.747 8.75 4.06v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781 0-2.094 1.703-3.797 3.797-3.797s3.797 1.703 3.797 3.797v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781zM11.25 18.062c-3.14-1.297-4.5-3-4.5-6.328v-2.672a.75.75 0 011.5 0v2.672c0 2.406 1.016 3.469 3 4.5v-2.14a.75.75 0 011.5 0v2.14c1.984-1.031 3-2.094 3-4.5v-2.672a.75.75 0 011.5 0v2.672c0 3.328-1.36 5.031-4.5 6.328a24.219 24.219 0 01-3 0zM11.25 18.062a.75.75 0 010 1.5 25.717 25.717 0 01-3.375 0 .75.75 0 010-1.5 24.217 24.217 0 003.375 0zM12.75 18.062a.75.75 0 010 1.5 25.717 25.717 0 003.375 0 .75.75 0 010-1.5 24.217 24.217 0 01-3.375 0z"/></svg>`;
    const starIconSVG = `<svg class="favorite-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>`;

    container.innerHTML = `
        <div class="result-item">
            <h2>
                <span class="article">${item.article}</span> ${item.word}
                <button class="speak-button" onclick="speak('${item.word}', event)">${speakIconSVG}</button>
                <button class="favorite-button ${favClass}" onclick="toggleFavorite(${item.id}, event)">${starIconSVG}</button>
            </h2>
            ${pluralHTML}
            ${turkishMeaningHTML}
        </div>`;
}


function checkEnter(event) {
    if (event.key === "Enter") {
        search();
    }
}


// --- LİSTE SAYFASI FONKSİYONLARI ---
async function loadWordList() {
    await loadAllWords();
    const wordList = document.getElementById('wordList');
    const searchInput = document.getElementById('listSearchInput');
    const alphabetFilter = document.getElementById('alphabet-filter');
    const speakIconSVG = `<svg class="speak-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.313-1.063-2.375-2.375-2.375S8.75 2.747 8.75 4.06v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781 0-2.094 1.703-3.797 3.797-3.797s3.797 1.703 3.797 3.797v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781zM11.25 18.062c-3.14-1.297-4.5-3-4.5-6.328v-2.672a.75.75 0 011.5 0v2.672c0 2.406 1.016 3.469 3 4.5v-2.14a.75.75 0 011.5 0v2.14c1.984-1.031 3-2.094 3-4.5v-2.672a.75.75 0 011.5 0v2.672c0 3.328-1.36 5.031-4.5 6.328a24.219 24.219 0 01-3 0zM11.25 18.062a.75.75 0 010 1.5 25.717 25.717 0 01-3.375 0 .75.75 0 010-1.5 24.217 24.217 0 003.375 0zM12.75 18.062a.75.75 0 010 1.5 25.717 25.717 0 003.375 0 .75.75 0 010-1.5 24.217 24.217 0 01-3.375 0z"/></svg>`;
    const starIconSVG = `<svg class="favorite-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>`;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    ['Tümü', ...alphabet].forEach(letter => {
        const button = document.createElement('button');
        button.className = 'alphabet-button';
        button.textContent = letter;
        if (letter === 'Tümü') button.classList.add('active');
        button.addEventListener('click', () => {
            const filter = letter === 'Tümü' ? '' : letter;
            renderList(filter);
            searchInput.value = '';
            document.querySelectorAll('.alphabet-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
        alphabetFilter.appendChild(button);
    });
    
    allWords.sort((a, b) => a.word.localeCompare(b.word, 'de'));
    
    const renderList = (filter = '', search = false) => {
        wordList.innerHTML = '';
        const filteredWords = allWords.filter(w => {
            if (search) {
                const normalizedFilter = normalizeGermanString(filter);
                const normalizedWord = normalizeGermanString(w.word);
                const normalizedPlural = w.plural ? normalizeGermanString(w.plural.replace('die ', '')) : null;
                return normalizedWord.startsWith(normalizedFilter) || (normalizedPlural && normalizedPlural.startsWith(normalizedFilter));
            } else {
                return w.word.toLowerCase().startsWith(filter.toLowerCase());
            }
        });

        filteredWords.forEach(word => {
            const li = document.createElement('li');
            const isFav = isFavorite(word.id);
            const favClass = isFav ? 'favorited' : '';
            
            const contentHTML = `
                <div class="list-word-main">
                    <b>${word.article} ${word.word}</b>
                </div>
                <div class="list-word-actions">
                    <button class="speak-button" onclick="speak('${word.word}', event)">${speakIconSVG}</button>
                    <button class="favorite-button ${favClass}" onclick="toggleFavorite(${word.id}, event)">${starIconSVG}</button>
                </div>
            `;
            const originalContent = contentHTML;
            li.innerHTML = originalContent;

            li.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;

                const extraInfo = li.querySelector('.extra-info');
                if (extraInfo) {
                    li.innerHTML = originalContent;
                } else {
                    let extraContent = '<div class="extra-info">';
                    if (word.plural) extraContent += `<span class="list-plural-form">(${word.plural})</span>`;
                    if (word.turkish) extraContent += `<span class="list-turkish-meaning">- ${word.turkish}</span>`;
                    extraContent += '</div>';
                    li.querySelector('.list-word-main').insertAdjacentHTML('beforeend', extraContent);
                }
            });
            wordList.appendChild(li);
        });
    };

    searchInput.addEventListener('input', (e) => {
        document.querySelectorAll('.alphabet-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.alphabet-button').classList.add('active');
        renderList(e.target.value, true);
    });

    renderList();
}


// --- GÜNLÜK KELİME FONKSİYONLARI ---
async function displayDailyWord() {
    await loadAllWords();
    try {
        const word = await loadDailyWord();
        const container = document.getElementById('daily-word-container');
        container.innerHTML = `<h1>Günün Kelimesi</h1>`;
        displayResult(container, word);
    } catch (error) {
        console.error('Günlük kelime gösterilirken hata oluştu:', error);
    }
}

async function loadDailyWord() {
    const nextUpdate = localStorage.getItem('nextUpdate');
    const now = new Date().getTime();
    if (!nextUpdate || now >= nextUpdate) {
        return await setDailyWord();
    } else {
        return JSON.parse(localStorage.getItem('dailyWord'));
    }
}

async function setDailyWord() {
    await loadAllWords();
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    localStorage.setItem('dailyWord', JSON.stringify(randomWord));
    localStorage.setItem('nextUpdate', tomorrow.getTime());
    return randomWord;
}

function updateCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;
    const nextUpdate = localStorage.getItem('nextUpdate');
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = nextUpdate - now;
        if (distance < 0) {
            clearInterval(interval);
            countdownElement.innerHTML = "Yeni kelime hazır!";
            displayDailyWord();
            return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        countdownElement.innerHTML = `Yeni kelime için kalan süre: ${hours}s ${minutes}d ${seconds}s`;
    }, 1000);
}


// --- MİNİ TEST FONKSİYONLARI ---
async function initQuiz() {
    await loadAllWords();
    
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('mode');
    const wordListParam = urlParams.get('list');

    if (testMode === 'special' && wordListParam) {
        const difficultWords = JSON.parse(decodeURIComponent(wordListParam));
        quizWords = allWords.filter(word => difficultWords.includes(word.word));
        const modeSelector = document.querySelector('.quiz-mode-selector');
        if (modeSelector) modeSelector.style.display = 'none';
        setQuizWordSource('special'); // Özel test için kelimeler zaten ayarlandı.
    } else {
        document.querySelectorAll('input[name="quizMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                setQuizWordSource(e.target.value);
            });
        });
        setQuizWordSource('all');
    }
    
    document.querySelectorAll('.option-button').forEach(button => {
        button.addEventListener('click', () => checkAnswer(button.textContent));
    });
    document.getElementById('next-word-button').addEventListener('click', showNextQuestion);
}

// main.js içindeki mevcut setQuizWordSource fonksiyonunu bununla değiştirin
function setQuizWordSource(mode) {
    let sourceWords = [];
    if (mode === 'favorites') {
        loadFavorites();
        sourceWords = allWords.filter(word => favorites.includes(word.id));
        if (sourceWords.length === 0) {
            document.getElementById('quiz-word').textContent = "Teste başlamak için önce favori kelime eklemelisiniz.";
            document.getElementById('quiz-options').style.display = 'none';
            return;
        }
    } else if (mode === 'all') {
        sourceWords = allWords;
    } else { // 'special' modu için
        sourceWords = quizWords;
    }

    // Seçilen kelime listesini karıştır ve test destesine ata
    currentQuizDeck = [...sourceWords]; 
    shuffleArray(currentQuizDeck); 

    // Test uzunluğunu ayarlardan al
    const settings = JSON.parse(localStorage.getItem('settings')) || { quizLength: 10 };
    const quizLength = parseInt(settings.quizLength, 10);
    
    // Eğer "Tümü" seçilmediyse ve deste daha uzunsa, desteyi belirtilen uzunlukta kes
    if (quizLength > 0 && currentQuizDeck.length > quizLength) {
        currentQuizDeck = currentQuizDeck.slice(0, quizLength);
    }
    
    // Skorları sıfırla ve ilk soruyu göster
    score = 0;
    totalQuestions = 0; // Toplam soru sayısını sıfırla
    document.getElementById('quiz-options').style.display = 'flex';
    document.getElementById('quiz-word').style.display = 'block';
    document.getElementById('quiz-feedback').textContent = '';
    showNextQuestion();
}

// main.js içindeki mevcut showNextQuestion fonksiyonunu bununla değiştirin
function showNextQuestion() {
    // Önceki sorunun cevap renklerini temizle
    document.querySelectorAll('.option-button').forEach(button => {
        button.disabled = false;
        button.classList.remove('correct', 'incorrect');
    });
    document.getElementById('quiz-feedback').innerHTML = '';
    document.getElementById('next-word-button').style.display = 'none';

    // Karıştırılmış destede hala kelime var mı VE sorulan soru sayısı hedefe ulaşmadı mı KONTROL ET
    if (currentQuizDeck.length > 0) {
        // Destenin sonundaki kelimeyi al (ve desteden çıkar)
        currentQuizWord = currentQuizDeck.pop();
        document.getElementById('quiz-word').textContent = currentQuizWord.word;
    } else {
        // Deste boşaldı, test bitti
        document.getElementById('quiz-word').textContent = 'Test Bitti!';
        document.getElementById('quiz-options').style.display = 'none';
        const finalScore = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(0) : 0;
        document.getElementById('quiz-feedback').innerHTML = `Nihai skorunuz: ${score} / ${totalQuestions} (%${finalScore} başarı)`;
    }
    
    updateScore();
}

function checkAnswer(selectedArticle) {
    totalQuestions++;
    const correctArticle = currentQuizWord.article;
    const feedbackEl = document.getElementById('quiz-feedback');
    let quizStats = JSON.parse(localStorage.getItem('quizStats')) || {};
    const word = currentQuizWord.word;
    if (!quizStats[word]) {
        quizStats[word] = { correct: 0, incorrect: 0 };
    }

    document.querySelectorAll('.option-button').forEach(button => {
        button.disabled = true;
        if (button.textContent === correctArticle) button.classList.add('correct');
    });

    if (selectedArticle === correctArticle) {
        score++;
        feedbackEl.textContent = 'Harika, doğru cevap!';
        feedbackEl.className = 'correct';
        quizStats[word].correct++;
    } else {
        feedbackEl.textContent = `Yanlış! Doğru cevap "${correctArticle}" olmalıydı.`;
        feedbackEl.className = 'incorrect';
        quizStats[word].incorrect++;
        document.querySelectorAll('.option-button').forEach(button => {
            if (button.textContent === selectedArticle) button.classList.add('incorrect');
        });
    }
    localStorage.setItem('quizStats', JSON.stringify(quizStats));
    const nextButton = document.getElementById('next-word-button');
    if (nextButton) nextButton.style.display = 'inline-block';
    updateScore();
	
    //const GOAL_COUNT = 10; // Günlük hedef: 10 soru
	const settings = JSON.parse(localStorage.getItem('settings')) || { dailyGoal: 10 };
	const GOAL_COUNT = parseInt(settings.dailyGoal, 10);
	
    if (totalQuestions === GOAL_COUNT) {
        checkAndCompleteDailyGoal();
    }
}

function updateScore() {
    const scoreEl = document.getElementById('quiz-score');
    if (scoreEl) {
        scoreEl.textContent = `Skor: ${score} / ${totalQuestions}`;
    }
}

// --- İSTATİSTİK SAYFASI FONKSİYONLARI ---
function loadStatsPage() {
    const quizStats = JSON.parse(localStorage.getItem('quizStats')) || {};
    const statsArray = Object.entries(quizStats);

    if (statsArray.length === 0) {
        document.getElementById('stats-summary').innerHTML = '<p>Henüz test çözülmemiş. İstatistikler için teste başlayın!</p>';
        document.querySelector('.stats-columns').style.display = 'none';
        document.getElementById('reset-stats-button').style.display = 'none';
        return;
    }
    let totalCorrect = 0;
    let totalIncorrect = 0;
    statsArray.forEach(([word, stats]) => {
        totalCorrect += stats.correct;
        totalIncorrect += stats.incorrect;
    });
    const totalAnswers = totalCorrect + totalIncorrect;
    const accuracy = totalAnswers > 0 ? ((totalCorrect / totalAnswers) * 100).toFixed(1) : 0;
    document.getElementById('stats-summary').innerHTML = `
        <p>Toplam Cevaplanan Soru: <span>${totalAnswers}</span></p>
        <p>Doğruluk Oranı: <span>% ${accuracy}</span></p>
    `;

    statsArray.sort((a, b) => b[1].incorrect - a[1].incorrect);
    const difficultList = document.getElementById('difficult-words-list');
    difficultList.innerHTML = '';
    const difficultWordsForTest = [];
    statsArray.slice(0, 5).forEach(([word, stats]) => {
        if (stats.incorrect > 0) {
            difficultWordsForTest.push(word);
            const li = document.createElement('li');
            li.innerHTML = `<span>${word}</span> <span class="stat-counts"><span class="incorrect">${stats.incorrect} Yanlış</span></span>`;
            difficultList.appendChild(li);
        }
    });

    const testDifficultButton = document.getElementById('test-difficult-button');
    if (difficultWordsForTest.length > 0) {
        testDifficultButton.style.display = 'block';
        testDifficultButton.addEventListener('click', () => {
            const wordListParam = JSON.stringify(difficultWordsForTest);
            window.location.href = `quiz.html?mode=special&list=${encodeURIComponent(wordListParam)}`;
        });
    }

    statsArray.sort((a, b) => b[1].correct - a[1].correct);
    const masteredList = document.getElementById('mastered-words-list');
    masteredList.innerHTML = '';
    statsArray.slice(0, 5).forEach(([word, stats]) => {
        if (stats.correct > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${word}</span> <span class="stat-counts"><span class="correct">${stats.correct} Doğru</span></span>`;
            masteredList.appendChild(li);
        }
    });

    document.getElementById('reset-stats-button').addEventListener('click', () => {
        if (confirm('Tüm test istatistikleriniz silinecek. Emin misiniz?')) {
            localStorage.removeItem('quizStats');
            location.reload();
        }
    });
}

// --- FAVORİLER SAYFASI FONKSİYONLARI ---
function loadFavoritesPage() {
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<li><p>Henüz favori kelimeniz yok.</p></li>';
        return;
    }
    const favoriteWords = allWords.filter(word => favorites.includes(word.id));
    const speakIconSVG = `<svg class="speak-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.313-1.063-2.375-2.375-2.375S8.75 2.747 8.75 4.06v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781 0-2.094 1.703-3.797 3.797-3.797s3.797 1.703 3.797 3.797v.281c0 1.281.078 2.531.234 3.75a.75.75 0 01-1.484.234c-.156-1.25-.234-2.5-.234-3.781zM11.25 18.062c-3.14-1.297-4.5-3-4.5-6.328v-2.672a.75.75 0 011.5 0v2.672c0 2.406 1.016 3.469 3 4.5v-2.14a.75.75 0 011.5 0v2.14c1.984-1.031 3-2.094 3-4.5v-2.672a.75.75 0 011.5 0v2.672c0 3.328-1.36 5.031-4.5 6.328a24.219 24.219 0 01-3 0zM11.25 18.062a.75.75 0 010 1.5 25.717 25.717 0 01-3.375 0 .75.75 0 010-1.5 24.217 24.217 0 003.375 0zM12.75 18.062a.75.75 0 010 1.5 25.717 25.717 0 003.375 0 .75.75 0 010-1.5 24.217 24.217 0 01-3.375 0z"/></svg>`;
    const starIconSVG = `<svg class="favorite-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>`;
    
    favoriteWords.forEach(word => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <b>${word.article} ${word.word}</b>
                <span class="list-plural-form">(${word.plural})</span>
                <span class="list-turkish-meaning">- ${word.turkish}</span>
            </div>
            <div class="list-word-actions">
                <button class="speak-button" onclick="speak('${word.word}', event)">${speakIconSVG}</button>
                <button class="favorite-button favorited" onclick="toggleFavorite(${word.id}, event); this.closest('li').remove();">${starIconSVG}</button>
            </div>
        `;
        favoritesList.appendChild(li);
    });
}


// --- GÜNLÜK HEDEF VE SERİ TAKİBİ FONKSİYONLARI ---

function checkAndCompleteDailyGoal() {
    let streakData = JSON.parse(localStorage.getItem('streakData')) || {
        streak: 0,
        lastCompleted: null
    };

    const today = new Date().toISOString().split('T')[0]; // Bugünün tarihini YYYY-MM-DD formatında al
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Dünün tarihini al

    // Bugünün hedefi daha önce tamamlanmadıysa
    if (streakData.lastCompleted !== today) {
        // En son tamamlanan gün dün ise seriyi artır
        if (streakData.lastCompleted === yesterday) {
            streakData.streak++;
        } else {
            // Dünden daha eski bir tarih ise seriyi 1'e sıfırla
            streakData.streak = 1;
        }

        streakData.lastCompleted = today;
        localStorage.setItem('streakData', JSON.stringify(streakData));
        
        // Ekranda tebrik mesajı göster
        const messageEl = document.getElementById('goal-completion-message');
        if (messageEl) {
            messageEl.textContent = `Tebrikler! Günlük 10 soru hedefini tamamladınız. Seriniz: ${streakData.streak} gün!`;
            messageEl.style.display = 'block';
        }
        
        // Menüdeki sayacı anında güncelle
        updateStreakDisplay();
    }
}

function updateStreakDisplay() {
    let streakData = JSON.parse(localStorage.getItem('streakData')) || { streak: 0, lastCompleted: null };
    
    // Eğer en son tamamlanan gün dün veya dünden daha eski ise seriyi sıfırla
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (streakData.lastCompleted !== today && streakData.lastCompleted !== yesterday) {
        streakData.streak = 0;
        localStorage.setItem('streakData', JSON.stringify(streakData));
    }

    const streakCountEl = document.getElementById('streak-count');
    if (streakCountEl) {
        streakCountEl.textContent = streakData.streak;
    }
}

// --- AYARLAR SAYFASI FONKSİYONLARI ---

function loadSettingsPage() {
    // Mevcut ayarları yükle ve form elemanlarına yansıt
    const settings = JSON.parse(localStorage.getItem('settings')) || {
        quizLength: 10,
        dailyGoal: 10
    };

    const quizLengthSelect = document.getElementById('quizLength');
    const dailyGoalRange = document.getElementById('dailyGoal');
    const dailyGoalValue = document.getElementById('dailyGoalValue');


    quizLengthSelect.value = settings.quizLength;
    dailyGoalRange.value = settings.dailyGoal;
    dailyGoalValue.textContent = settings.dailyGoal;

    // Ayarlar değiştiğinde kaydet
    quizLengthSelect.addEventListener('change', (e) => saveSetting('quizLength', e.target.value));
    dailyGoalRange.addEventListener('input', (e) => {
        dailyGoalValue.textContent = e.target.value;
        saveSetting('dailyGoal', e.target.value);
    });
	
    // Dosya seçme input'unda bir değişiklik olduğunda çalışacak fonksiyon
    if (importDataInput && fileUploadLabel) {
        importDataInput.addEventListener('change', function() {
            // Eğer bir dosya seçildiyse...
            if (this.files && this.files.length > 0) {
                // Etiketin metnini seçilen dosyanın adıyla değiştir
                fileUploadLabel.textContent = this.files[0].name;
            } else {
                // Dosya seçilmediyse metni eski haline getir
                fileUploadLabel.textContent = 'Dosya Seç';
            }
        });
    }

    // Butonların olay dinleyicileri
    document.getElementById('exportDataButton').addEventListener('click', exportUserData);
	document.getElementById('importDataButton').addEventListener('click', importUserData);
    document.getElementById('resetAllDataButton').addEventListener('click', resetAllData);
	
}

function saveSetting(key, value) {
    let settings = JSON.parse(localStorage.getItem('settings')) || {};
    settings[key] = value;
    localStorage.setItem('settings', JSON.stringify(settings));
}

function exportUserData() {
    const favorites = localStorage.getItem('favorites') || '[]';
    const quizStats = localStorage.getItem('quizStats') || '{}';
    const streakData = localStorage.getItem('streakData') || '{}';

    const dataToExport = {
        favorites: JSON.parse(favorites),
        quizStats: JSON.parse(quizStats),
        streakData: JSON.parse(streakData)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "artikelfinder_verilerim.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function resetAllData() {
    if (confirm('TÜM verileriniz (Favoriler, İstatistikler, Seri) kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?')) {
        localStorage.removeItem('favorites');
        localStorage.removeItem('quizStats');
        localStorage.removeItem('streakData');
        localStorage.removeItem('settings'); // Ayarları da sıfırla
        alert('Tüm verileriniz başarıyla sıfırlandı.');
        location.reload();
    }
}

function importUserData() {
    const fileInput = document.getElementById('importDataInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Lütfen önce bir dosya seçin.');
        return;
    }

    if (file.type !== "application/json") {
        alert('Lütfen geçerli bir JSON dosyası seçin (artikelfinder_verilerim.json).');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            // Yüklenen verinin beklenen anahtarları içerip içermediğini kontrol et
            const hasFavorites = 'favorites' in data;
            const hasQuizStats = 'quizStats' in data;
            const hasStreakData = 'streakData' in data;

            if (!hasFavorites || !hasQuizStats || !hasStreakData) {
                throw new Error('Dosya formatı geçerli değil.');
            }

            // Mevcut verilerin üzerine yazılacağına dair son bir onay al
            if (confirm('Mevcut tüm favorileriniz, istatistikleriniz ve seri bilginiz bu dosyadan gelen verilerle değiştirilecek. Emin misiniz?')) {
                // Verileri localStorage'a kaydet
                localStorage.setItem('favorites', JSON.stringify(data.favorites));
                localStorage.setItem('quizStats', JSON.stringify(data.quizStats));
                localStorage.setItem('streakData', JSON.stringify(data.streakData));

                alert('Verileriniz başarıyla geri yüklendi! Değişikliklerin tam olarak yansıması için sayfa yenilenecek.');
                location.reload(); // Değişikliklerin uygulanması için sayfayı yenile
            }

        } catch (error) {
            alert('Dosya okunurken bir hata oluştu. Lütfen dosyanın bozuk olmadığından emin olun. Hata: ' + error.message);
        }
    };

    reader.onerror = function() {
        alert('Dosya okunamadı.');
    };

    reader.readAsText(file);
}

async function showRandomWord() {
    await loadAllWords(); // Tüm kelimelerin yüklendiğinden emin ol
    const resultsContainer = document.getElementById('results-container');
    
    // Rastgele bir kelime seç
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    
    // Sonucu ekranda göster
    displayResult(resultsContainer, randomWord);
}