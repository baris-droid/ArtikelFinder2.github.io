// main.js (Tüm özellikleri ve Özel Test Modlarını içeren en güncel sürüm)

// ===================================
// GENEL YARDIMCI FONKSİYONLAR
// ===================================

/**
 * Almanca kelimelerdeki özel karakterleri (ß, ä, ö, ü) normalize eder ve küçük harfe çevirir.
 * @param {string} str - Normalleştirilecek metin.
 * @returns {string} Normalleştirilmiş metin.
 */
function normalizeGermanString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue');
}

/**
 * Bir diziyi yerinde karıştıran Fisher-Yates shuffle algoritması.
 * @param {Array} array - Karıştırılacak dizi.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Sadece konuşma simgesini (speak.svg) yükler ve SVG kodunu global değişkene atar.
 */
async function loadSpeakIconSVG() {
    try {
        const response = await fetch('speak.svg');
        speakIconSVGCode = await response.text();
    } catch (error) {
        console.error("Konuşma simgesi (speak.svg) yüklenirken bir hata oluştu:", error);
    }
}

/**
 * Menüdeki seri sayacını günceller.
 */
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


// ===================================
// GLOBAL DEĞİŞKENLER VE OLAY DİNLEYİCİLER
// ===================================
let quizWords = [];
let currentQuizDeck = [];
let currentQuizWord = null;
let score = 0;
let totalQuestions = 0;
let favorites = [];
let allWords = [];
let speakIconSVGCode = '';


document.addEventListener('DOMContentLoaded', async () => {
    await loadSpeakIconSVG();

    // Menüyü yükle ve yüklendikten sonraki işlemleri yap
    if (document.getElementById('menu-placeholder')) {
        fetch('menu.html')
            .then(response => response.text())
            .then(data => {
                document.getElementById('menu-placeholder').innerHTML = data;

                // Tema değiştirme mantığı
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

                // Random ikonunu yükle
                const randomIconPlaceholder = document.getElementById('randomIconPlaceholder');
                if (randomIconPlaceholder) {
                    fetch('random.svg')
                        .then(response => response.text())
                        .then(svgData => {
                            randomIconPlaceholder.innerHTML = svgData;
                        })
                        .catch(error => console.error('SVG dosyası yüklenirken bir hata oluştu:', error));
                }
                
                updateStreakDisplay();
            });
    }

    // Tüm kelimeleri ve favorileri başlangıçta yükle
    await loadAllWords();
    
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
    if (document.getElementById('quizLength')) {
        loadSettingsPage();
    }
    
    // Diğer sayfalardaki olay dinleyicileri
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const randomWordButton = document.getElementById('randomWordButton');
    
    if (searchButton) searchButton.addEventListener('click', search);
    if (searchInput) searchInput.addEventListener('keypress', checkEnter);
    if (document.getElementById('wordList')) loadWordList();
    if (document.getElementById('daily-word-container')) displayDailyWord();
    if (randomWordButton) {
        randomWordButton.addEventListener('click', showRandomWord);
    }
});


// ===================================
// GENEL SİSTEM FONKSİYONLARI
// ===================================

/**
 * JSON dosyasından tüm kelimeleri yükler.
 */
async function loadAllWords() {
    if (allWords.length > 0) return;
    try {
        const response = await fetch('words.json?t=' + new Date().getTime());
        allWords = await response.json();
        loadFavorites();
    } catch (error) {
        console.error("Tüm kelimeler yüklenirken hata oluştu:", error);
    }
}

/**
 * Sayfadaki menüyü gösterir veya gizler.
 */
function toggleMenu() {
    const menu = document.querySelector('.button-container .menu');
    if (menu) menu.classList.toggle('show');
}

/**
 * Belirtilen kelimeyi seslendirir.
 * @param {string} wordToSpeak - Seslendirilecek kelime.
 * @param {Event} event - Tıklama olayı.
 */
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

/**
 * Bir kelimeyi ekranda gösterir.
 * @param {HTMLElement} container - Kelimenin gösterileceği HTML elementi.
 * @param {object} item - Kelime verisi.
 */
function displayResult(container, item) {
    const turkishMeaningHTML = item.turkish ? `<p class="turkish-meaning">${item.turkish}</p>` : '';
    const pluralHTML = item.plural ? `<p class="plural-form">Çoğul: ${item.plural}</p>` : '';
    const isFav = isFavorite(item.id);
    const favClass = isFav ? 'favorited' : '';
    const starIconSVG = `<svg class="favorite-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>`;
    
    container.innerHTML = `
        <div class="result-item">
            <h2>
                <span class="article">${item.article}</span> ${item.word}
                <button class="speak-button" onclick="speak('${item.word}', event)">${speakIconSVGCode}</button>
                <button class="favorite-button ${favClass}" onclick="toggleFavorite(${item.id}, event)">${starIconSVG}</button>
            </h2>
            ${pluralHTML}
            ${turkishMeaningHTML}
        </div>`;
}


// ===================================
// ANASAYFA FONKSİYONLARI
// ===================================

/**
 * Arama kutusundaki kelimeyi bulur ve sonucu ekranda gösterir.
 */
async function search() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    if (query.length === 0) {
        resultsContainer.innerHTML = '<p>Lütfen bir kelime yazın.</p>';
        return;
    }

    await loadAllWords();
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

/**
 * Arama kutusunda Enter tuşuna basıldığında arama fonksiyonunu tetikler.
 * @param {Event} event - Klavye olayı.
 */
function checkEnter(event) {
    if (event.key === "Enter") {
        search();
    }
}

/**
 * Rastgele bir kelime seçer ve ekranda gösterir.
 */
async function showRandomWord() {
    await loadAllWords();
    const resultsContainer = document.getElementById('results-container');
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    displayResult(resultsContainer, randomWord);
}


// ===================================
// LİSTE SAYFASI FONKSİYONLARI
// ===================================

/**
 * Kelime listesini ve harf filtreleme butonlarını yükler.
 */
async function loadWordList() {
    await loadAllWords();
    const wordList = document.getElementById('wordList');
    const searchInput = document.getElementById('listSearchInput');
    const alphabetFilter = document.getElementById('alphabet-filter');
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
                    <button class="speak-button" onclick="speak('${word.word}', event)">${speakIconSVGCode}</button>
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


// ===================================
// FAVORİ SİSTEMİ FONKSİYONLARI
// ===================================

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
    loadFavorites();
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

function loadFavoritesPage() {
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<li><p>Henüz favori kelimeniz yok.</p></li>';
        return;
    }
    const favoriteWords = allWords.filter(word => favorites.includes(word.id));
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
                <button class="speak-button" onclick="speak('${word.word}', event)">${speakIconSVGCode}</button>
                <button class="favorite-button favorited" onclick="toggleFavorite(${word.id}, event); this.closest('li').remove();">${starIconSVG}</button>
            </div>
        `;
        favoritesList.appendChild(li);
    });
}


// ===================================
// GÜNLÜK KELİME FONKSİYONLARI
// ===================================

/**
 * Günün kelimesini ekranda gösterir ve geri sayımı başlatır.
 */
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


// ===================================
// MİNİ TEST (QUIZ) FONKSİYONLARI
// ===================================

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
        setQuizWordSource('special');
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
    } else {
        sourceWords = quizWords;
    }

    currentQuizDeck = [...sourceWords];
    shuffleArray(currentQuizDeck);
    
    const settings = JSON.parse(localStorage.getItem('settings')) || { quizLength: 10 };
    const quizLength = parseInt(settings.quizLength, 10);
    
    if (quizLength > 0 && currentQuizDeck.length > quizLength) {
        currentQuizDeck = currentQuizDeck.slice(0, quizLength);
    }
    
    score = 0;
    totalQuestions = 0;
    document.getElementById('quiz-options').style.display = 'flex';
    document.getElementById('quiz-word').style.display = 'block';
    document.getElementById('quiz-feedback').textContent = '';
    showNextQuestion();
}

function showNextQuestion() {
    document.querySelectorAll('.option-button').forEach(button => {
        button.disabled = false;
        button.classList.remove('correct', 'incorrect');
    });
    document.getElementById('quiz-feedback').innerHTML = '';
    document.getElementById('next-word-button').style.display = 'none';

    if (currentQuizDeck.length > 0) {
        currentQuizWord = currentQuizDeck.pop();
        document.getElementById('quiz-word').textContent = currentQuizWord.word;
    } else {
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


// ===================================
// İSTATİSTİK SAYFASI FONKSİYONLARI
// ===================================

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


// ===================================
// GÜNLÜK HEDEF VE SERİ TAKİBİ
// ===================================

function checkAndCompleteDailyGoal() {
    let streakData = JSON.parse(localStorage.getItem('streakData')) || {
        streak: 0,
        lastCompleted: null
    };

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (streakData.lastCompleted !== today) {
        if (streakData.lastCompleted === yesterday) {
            streakData.streak++;
        } else {
            streakData.streak = 1;
        }

        streakData.lastCompleted = today;
        localStorage.setItem('streakData', JSON.stringify(streakData));
        
        const messageEl = document.getElementById('goal-completion-message');
        if (messageEl) {
            messageEl.textContent = `Tebrikler! Günlük hedefi tamamladınız. Seriniz: ${streakData.streak} gün!`;
            messageEl.style.display = 'block';
        }
        
        updateStreakDisplay();
    }
}


// ===================================
// AYARLAR SAYFASI FONKSİYONLARI
// ===================================

function loadSettingsPage() {
    const settings = JSON.parse(localStorage.getItem('settings')) || {
        quizLength: 10,
        dailyGoal: 10
    };

    const quizLengthSelect = document.getElementById('quizLength');
    const dailyGoalRange = document.getElementById('dailyGoal');
    const dailyGoalValue = document.getElementById('dailyGoalValue');

    if (quizLengthSelect) quizLengthSelect.value = settings.quizLength;
    if (dailyGoalRange) dailyGoalRange.value = settings.dailyGoal;
    if (dailyGoalValue) dailyGoalValue.textContent = settings.dailyGoal;

    if (quizLengthSelect) quizLengthSelect.addEventListener('change', (e) => saveSetting('quizLength', e.target.value));
    if (dailyGoalRange) dailyGoalRange.addEventListener('input', (e) => {
        dailyGoalValue.textContent = e.target.value;
        saveSetting('dailyGoal', e.target.value);
    });
    
    const importDataInput = document.getElementById('importDataInput');
    const fileUploadLabel = document.querySelector('.custom-file-upload');
    if (importDataInput && fileUploadLabel) {
        importDataInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                fileUploadLabel.textContent = this.files[0].name;
            } else {
                fileUploadLabel.textContent = 'Dosya Seç';
            }
        });
    }

    if (document.getElementById('exportDataButton')) {
        document.getElementById('exportDataButton').addEventListener('click', exportUserData);
    }
    if (document.getElementById('importDataButton')) {
        document.getElementById('importDataButton').addEventListener('click', importUserData);
    }
    if (document.getElementById('resetAllDataButton')) {
        document.getElementById('resetAllDataButton').addEventListener('click', resetAllData);
    }
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
        localStorage.removeItem('settings');
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

            const hasFavorites = 'favorites' in data;
            const hasQuizStats = 'quizStats' in data;
            const hasStreakData = 'streakData' in data;

            if (!hasFavorites || !hasQuizStats || !hasStreakData) {
                throw new Error('Dosya formatı geçerli değil.');
            }

            if (confirm('Mevcut tüm favorileriniz, istatistikleriniz ve seri bilginiz bu dosyadan gelen verilerle değiştirilecek. Emin misiniz?')) {
                localStorage.setItem('favorites', JSON.stringify(data.favorites));
                localStorage.setItem('quizStats', JSON.stringify(data.quizStats));
                localStorage.setItem('streakData', JSON.stringify(data.streakData));

                alert('Verileriniz başarıyla geri yüklendi! Değişikliklerin tam olarak yansıması için sayfa yenilenecek.');
                location.reload();
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