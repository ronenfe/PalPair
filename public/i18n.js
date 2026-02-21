(function () {
  const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ar', name: 'العربية' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'it', name: 'Italiano' },
    { code: 'pl', name: 'Polski' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'uk', name: 'Українська' },
    { code: 'fa', name: 'فارسی' }
  ];

  const translations = {
    en: {
      title: 'Palpair - Random Video Chat',
      subtitle: 'Meet new people instantly • Video chat worldwide',
      peopleOnline: 'people online now',
      safetyNote: 'Palpair - Random Video Chat allows users to report child safety concerns in-app. To learn more about reporting requirements, visit the <a href="/help-center.html" target="_blank" rel="noopener">Help center</a>.',
      yourProfile: 'Your Profile',
      namePlaceholder: 'Name',
      agePlaceholder: 'Age',
      selectGender: 'Select Gender',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      selectCountry: 'Select Country',
      filterPreferences: 'Filter Preferences',
      ageRange: 'Age Range:',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
      to: 'to',
      anyGender: 'Any Gender',
      maleOnly: 'Male Only',
      femaleOnly: 'Female Only',
      otherOnly: 'Other Only',
      anyCountry: 'Any Country',
      saveContinue: 'Save & Continue',
      start: 'Start',
      stop: 'Stop',
      findNext: 'Find Next',
      reportConcern: 'Report Concern',
      idle: 'Idle',
      typeMessage: 'Type a message...',
      send: 'Send',
      language: 'Language',
      alertFillProfile: 'Please fill in all profile fields',
      alertAgeRange: 'Age must be between 18 and 100',
      alertMinMax: 'Minimum age cannot be greater than maximum age',
      statusFindingPartner: 'Finding partner...',
      statusCameraError: 'Could not start camera',
      statusStopped: 'Stopped',
      statusFindingNext: 'Finding next...',
      statusWaiting: 'Waiting for a partner...',
      statusConnected: 'Connected',
      statusConnectedBot: 'Connected to {name}, {age}, from {country}',
      reportPrompt: 'Report safety concern (child safety, harassment, explicit content, etc.). Please include useful details:',
      reportSubmitted: 'Safety report submitted. Thank you for helping keep Palpair safe.'
    },
    es: {
      subtitle: 'Conoce gente nueva al instante • Videochat en todo el mundo',
      peopleOnline: 'personas en línea ahora',
      yourProfile: 'Tu perfil',
      selectGender: 'Selecciona género',
      male: 'Hombre',
      female: 'Mujer',
      other: 'Otro',
      selectCountry: 'Selecciona país',
      filterPreferences: 'Preferencias de filtro',
      ageRange: 'Rango de edad:',
      anyGender: 'Cualquier género',
      maleOnly: 'Solo hombres',
      femaleOnly: 'Solo mujeres',
      otherOnly: 'Solo otro',
      anyCountry: 'Cualquier país',
      saveContinue: 'Guardar y continuar',
      start: 'Iniciar',
      stop: 'Detener',
      findNext: 'Buscar siguiente',
      reportConcern: 'Reportar problema',
      idle: 'Inactivo',
      typeMessage: 'Escribe un mensaje...',
      send: 'Enviar',
      language: 'Idioma',
      statusFindingPartner: 'Buscando pareja...',
      statusWaiting: 'Esperando a una pareja...',
      statusConnected: 'Conectado'
    },
    fr: {
      subtitle: 'Rencontrez de nouvelles personnes instantanément • Chat vidéo mondial',
      peopleOnline: 'personnes en ligne maintenant',
      yourProfile: 'Votre profil',
      selectGender: 'Sélectionner le genre',
      male: 'Homme',
      female: 'Femme',
      other: 'Autre',
      selectCountry: 'Sélectionner un pays',
      filterPreferences: 'Préférences de filtre',
      ageRange: 'Tranche d\'âge :',
      anyGender: 'Tous genres',
      maleOnly: 'Hommes uniquement',
      femaleOnly: 'Femmes uniquement',
      otherOnly: 'Autres uniquement',
      anyCountry: 'Tous pays',
      saveContinue: 'Enregistrer et continuer',
      start: 'Démarrer',
      stop: 'Arrêter',
      findNext: 'Trouver le suivant',
      reportConcern: 'Signaler un problème',
      idle: 'Inactif',
      typeMessage: 'Tapez un message...',
      send: 'Envoyer',
      language: 'Langue'
    },
    de: {
      subtitle: 'Triff sofort neue Leute • Videochat weltweit',
      peopleOnline: 'Personen jetzt online',
      yourProfile: 'Dein Profil',
      selectGender: 'Geschlecht wählen',
      male: 'Männlich',
      female: 'Weiblich',
      other: 'Andere',
      selectCountry: 'Land auswählen',
      filterPreferences: 'Filtereinstellungen',
      ageRange: 'Altersbereich:',
      anyGender: 'Beliebiges Geschlecht',
      maleOnly: 'Nur männlich',
      femaleOnly: 'Nur weiblich',
      otherOnly: 'Nur andere',
      anyCountry: 'Beliebiges Land',
      saveContinue: 'Speichern & Weiter',
      start: 'Start',
      stop: 'Stopp',
      findNext: 'Nächsten finden',
      reportConcern: 'Problem melden',
      idle: 'Leerlauf',
      typeMessage: 'Nachricht eingeben...',
      send: 'Senden',
      language: 'Sprache'
    },
    pt: {
      subtitle: 'Conheça novas pessoas instantaneamente • Chat por vídeo no mundo todo',
      peopleOnline: 'pessoas online agora',
      yourProfile: 'Seu perfil',
      selectGender: 'Selecione o gênero',
      male: 'Masculino',
      female: 'Feminino',
      other: 'Outro',
      selectCountry: 'Selecione o país',
      filterPreferences: 'Preferências de filtro',
      ageRange: 'Faixa etária:',
      anyGender: 'Qualquer gênero',
      saveContinue: 'Salvar e continuar',
      findNext: 'Encontrar próximo',
      reportConcern: 'Denunciar problema',
      typeMessage: 'Digite uma mensagem...',
      send: 'Enviar',
      language: 'Idioma'
    },
    ru: {
      subtitle: 'Знакомьтесь с новыми людьми мгновенно • Видеочат по всему миру',
      peopleOnline: 'пользователей онлайн',
      yourProfile: 'Ваш профиль',
      selectGender: 'Выберите пол',
      male: 'Мужской',
      female: 'Женский',
      other: 'Другой',
      selectCountry: 'Выберите страну',
      filterPreferences: 'Настройки фильтра',
      ageRange: 'Возрастной диапазон:',
      anyGender: 'Любой пол',
      anyCountry: 'Любая страна',
      saveContinue: 'Сохранить и продолжить',
      start: 'Начать',
      stop: 'Стоп',
      findNext: 'Следующий',
      reportConcern: 'Сообщить о проблеме',
      idle: 'Ожидание',
      typeMessage: 'Введите сообщение...',
      send: 'Отправить',
      language: 'Язык'
    },
    zh: {
      subtitle: '立即认识新朋友 • 全球视频聊天',
      peopleOnline: '人在线',
      yourProfile: '你的资料',
      selectGender: '选择性别',
      male: '男',
      female: '女',
      other: '其他',
      selectCountry: '选择国家',
      filterPreferences: '筛选偏好',
      ageRange: '年龄范围：',
      anyGender: '不限性别',
      anyCountry: '不限国家',
      saveContinue: '保存并继续',
      start: '开始',
      stop: '停止',
      findNext: '下一个',
      reportConcern: '举报问题',
      idle: '空闲',
      typeMessage: '输入消息...',
      send: '发送',
      language: '语言'
    },
    hi: {
      subtitle: 'तुरंत नए लोगों से मिलें • दुनिया भर में वीडियो चैट',
      peopleOnline: 'लोग अभी ऑनलाइन',
      yourProfile: 'आपकी प्रोफ़ाइल',
      selectGender: 'लिंग चुनें',
      male: 'पुरुष',
      female: 'महिला',
      other: 'अन्य',
      selectCountry: 'देश चुनें',
      filterPreferences: 'फ़िल्टर प्राथमिकताएँ',
      ageRange: 'आयु सीमा:',
      saveContinue: 'सेव करें और जारी रखें',
      start: 'शुरू करें',
      stop: 'रोकें',
      findNext: 'अगला खोजें',
      reportConcern: 'चिंता रिपोर्ट करें',
      typeMessage: 'संदेश लिखें...',
      send: 'भेजें',
      language: 'भाषा'
    },
    ar: {
      subtitle: 'تعرّف على أشخاص جدد فورًا • دردشة فيديو حول العالم',
      peopleOnline: 'شخص متصل الآن',
      yourProfile: 'ملفك الشخصي',
      selectGender: 'اختر الجنس',
      male: 'ذكر',
      female: 'أنثى',
      other: 'آخر',
      selectCountry: 'اختر الدولة',
      filterPreferences: 'تفضيلات التصفية',
      ageRange: 'الفئة العمرية:',
      saveContinue: 'حفظ ومتابعة',
      start: 'ابدأ',
      stop: 'إيقاف',
      findNext: 'التالي',
      reportConcern: 'الإبلاغ عن مشكلة',
      typeMessage: 'اكتب رسالة...',
      send: 'إرسال',
      language: 'اللغة'
    },
    bn: { subtitle: 'তাৎক্ষণিক নতুন মানুষের সাথে পরিচিত হন • বিশ্বজুড়ে ভিডিও চ্যাট', language: 'ভাষা', start: 'শুরু', stop: 'বন্ধ', send: 'পাঠান', saveContinue: 'সেভ করে চালিয়ে যান' },
    pa: { subtitle: 'ਤੁਰੰਤ ਨਵੇਂ ਲੋਕਾਂ ਨੂੰ ਮਿਲੋ • ਦੁਨੀਆ ਭਰ ਵਿੱਚ ਵੀਡੀਓ ਚੈਟ', language: 'ਭਾਸ਼ਾ', start: 'ਸ਼ੁਰੂ', stop: 'ਰੋਕੋ', send: 'ਭੇਜੋ', saveContinue: 'ਸੇਵ ਕਰੋ ਅਤੇ ਜਾਰੀ ਰੱਖੋ' },
    ja: {
      subtitle: 'すぐに新しい人と出会う • 世界中でビデオチャット',
      peopleOnline: '人がオンライン',
      yourProfile: 'あなたのプロフィール',
      selectGender: '性別を選択',
      selectCountry: '国を選択',
      saveContinue: '保存して続行',
      start: '開始',
      stop: '停止',
      findNext: '次を探す',
      reportConcern: '問題を報告',
      idle: '待機中',
      typeMessage: 'メッセージを入力...',
      send: '送信',
      language: '言語'
    },
    ko: {
      subtitle: '즉시 새로운 사람을 만나보세요 • 전 세계 영상 채팅',
      peopleOnline: '명 온라인',
      yourProfile: '내 프로필',
      selectGender: '성별 선택',
      selectCountry: '국가 선택',
      saveContinue: '저장하고 계속',
      start: '시작',
      stop: '중지',
      findNext: '다음 찾기',
      reportConcern: '문제 신고',
      typeMessage: '메시지 입력...',
      send: '보내기',
      language: '언어'
    },
    vi: { subtitle: 'Gặp người mới ngay lập tức • Trò chuyện video toàn cầu', language: 'Ngôn ngữ', start: 'Bắt đầu', stop: 'Dừng', send: 'Gửi', saveContinue: 'Lưu & Tiếp tục' },
    tr: { subtitle: 'Anında yeni insanlarla tanışın • Dünya çapında görüntülü sohbet', language: 'Dil', start: 'Başlat', stop: 'Durdur', send: 'Gönder', saveContinue: 'Kaydet ve Devam Et' },
    it: { subtitle: 'Incontra nuove persone all’istante • Video chat in tutto il mondo', language: 'Lingua', start: 'Avvia', stop: 'Ferma', send: 'Invia', saveContinue: 'Salva e continua' },
    pl: { subtitle: 'Poznawaj nowych ludzi od razu • Czat wideo na całym świecie', language: 'Język', start: 'Start', stop: 'Stop', send: 'Wyślij', saveContinue: 'Zapisz i kontynuuj' },
    nl: { subtitle: 'Ontmoet direct nieuwe mensen • Videochat wereldwijd', language: 'Taal', start: 'Start', stop: 'Stop', send: 'Verzenden', saveContinue: 'Opslaan en doorgaan' },
    uk: { subtitle: 'Знайомтеся з новими людьми миттєво • Відеочат по всьому світу', language: 'Мова', start: 'Почати', stop: 'Зупинити', send: 'Надіслати', saveContinue: 'Зберегти і продовжити' },
    fa: { subtitle: 'فوراً با افراد جدید آشنا شوید • چت تصویری در سراسر جهان', language: 'زبان', start: 'شروع', stop: 'توقف', send: 'ارسال', saveContinue: 'ذخیره و ادامه' }
  };

  const english = translations.en;
  for (const lang of LANGUAGES) {
    if (!translations[lang.code]) {
      translations[lang.code] = { ...english };
    }
  }

  const storageKey = 'palpairLanguage';

  function getInitialLanguage() {
    const saved = localStorage.getItem(storageKey);
    if (saved && translations[saved]) return saved;
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (translations[browser]) return browser;
    return 'en';
  }

  let currentLanguage = getInitialLanguage();

  function t(key, params = {}) {
    const table = translations[currentLanguage] || english;
    const fallback = english[key] || key;
    let text = table[key] || fallback;
    Object.keys(params).forEach((name) => {
      text = text.replaceAll(`{${name}}`, String(params[name]));
    });
    return text;
  }

  function applyTranslations() {
    document.documentElement.lang = currentLanguage;
    document.title = t('title');

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (!key) return;
      element.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (!key) return;
      element.setAttribute('placeholder', t(key));
    });

    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const key = element.getAttribute('data-i18n-html');
      if (!key) return;
      element.innerHTML = t(key);
    });

    window.dispatchEvent(new CustomEvent('palpair-language-changed', { detail: { language: currentLanguage } }));
  }

  function setLanguage(languageCode) {
    if (!translations[languageCode]) return;
    currentLanguage = languageCode;
    localStorage.setItem(storageKey, languageCode);
    applyTranslations();
  }

  function getLanguage() {
    return currentLanguage;
  }

  function getLanguages() {
    return LANGUAGES.slice();
  }

  window.PALPAIR_I18N = {
    t,
    setLanguage,
    getLanguage,
    getLanguages,
    applyTranslations
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
})();
