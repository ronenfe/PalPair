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
      title: 'FlashLive - Live Streaming',
      subtitle: 'Watch & stream live',
      peopleOnline: 'people online now',
      safetyNote: 'FlashLive - Random Video Chat allows users to report child safety concerns in-app. To learn more about reporting requirements, visit the <a href="/help-center.html" target="_blank" rel="noopener">Help center</a>.',
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
      statusPublicRoom: 'Public room',
      statusReturnedPublic: 'Back in public room',
      reportPrompt: 'Report safety concern (child safety, harassment, explicit content, etc.). Please include useful details:',
      reportSubmitted: 'Safety report submitted. Thank you for helping keep FlashLive safe.',
      goLive: '📡 Go Live',
      stopLive: '⏹ Stop Live',
      goRandom: '🎥 Go Random',
      streamLive: 'LIVE',
      nextStreamer: '⏭ Next'
    },
    es: {
      subtitle: 'Mira y transmite en vivo',
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
      statusConnected: 'Conectado',
      goLive: '📡 En Vivo',
      stopLive: '⏹ Parar',
      goRandom: '🎥 Aleatorio',
      streamLive: 'EN VIVO',
      nextStreamer: '⏭ Siguiente'
    },
    fr: {
      subtitle: 'Regardez et diffusez en direct',
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
      language: 'Langue',
      goLive: '📡 En Direct',
      stopLive: '⏹ Arrêter',
      goRandom: '🎥 Aléatoire',
      streamLive: 'EN DIRECT',
      nextStreamer: '⏭ Suivant'
    },
    de: {
      subtitle: 'Live ansehen & senden',
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
      language: 'Sprache',
      goLive: '📡 Live gehen',
      stopLive: '⏹ Stoppen',
      goRandom: '🎥 Zufällig',
      streamLive: 'LIVE',
      nextStreamer: '⏭ Nächster'
    },
    pt: {
      subtitle: 'Assista e transmita ao vivo',
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
      language: 'Idioma',
      goLive: '📡 Ao Vivo',
      stopLive: '⏹ Parar',
      goRandom: '🎥 Aleatório',
      streamLive: 'AO VIVO',
      nextStreamer: '⏭ Próximo'
    },
    ru: {
      subtitle: 'Смотрите и стримьте в прямом эфире',
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
      language: 'Язык',
      goLive: '📡 Начать трансляцию',
      stopLive: '⏹ Остановить',
      goRandom: '🎥 Случайный',
      streamLive: 'ПРЯМОЙ ЭФИР',
      nextStreamer: '⏭ Следующий'
    },
    zh: {
      title: 'FlashLive - 随机视频聊天',
      subtitle: '观看和直播',
      peopleOnline: '人正在线上',
      safetyNote: 'FlashLive - 随机视频聊天允许用户在应用内举报儿童安全问题。如需了解更多举报要求，请访问<a href="/help-center.html" target="_blank" rel="noopener">帮助中心</a>。',
      yourProfile: '你的资料',
      namePlaceholder: '昵称',
      agePlaceholder: '年龄',
      selectGender: '选择性别',
      male: '男',
      female: '女',
      other: '其他',
      selectCountry: '选择国家/地区',
      filterPreferences: '筛选偏好',
      ageRange: '年龄范围：',
      minPlaceholder: '最小',
      maxPlaceholder: '最大',
      to: '至',
      anyGender: '不限性别',
      maleOnly: '仅限男性',
      femaleOnly: '仅限女性',
      otherOnly: '仅限其他',
      anyCountry: '不限国家',
      saveContinue: '保存并继续',
      start: '开始',
      stop: '停止',
      findNext: '下一个',
      reportConcern: '举报问题',
      idle: '空闲',
      typeMessage: '输入消息...',
      send: '发送',
      language: '语言',
      alertFillProfile: '请填写所有资料字段',
      alertAgeRange: '年龄必须在18到100之间',
      alertMinMax: '最小年龄不能大于最大年龄',
      statusFindingPartner: '正在匹配...',
      statusCameraError: '无法启动摄像头',
      statusStopped: '已停止',
      statusFindingNext: '正在寻找下一个...',
      statusWaiting: '正在等待匹配...',
      statusConnected: '已连接',
      statusConnectedBot: '已连接 {name}，{age}岁，来自{country}',
      statusPublicRoom: '公共房间',
      statusReturnedPublic: '已返回公共房间',
      reportPrompt: '举报安全问题（儿童安全、骚扰、不当内容等）。请提供详细信息：',
      reportSubmitted: '安全举报已提交。感谢您帮助维护FlashLive的安全环境。',
      goLive: '📡 开始直播',
      stopLive: '⏹ 停止直播',
      goRandom: '🎥 随机聊天',
      streamLive: '直播中',
      nextStreamer: '⏭ 下一个'
    },
    hi: {
      subtitle: 'लाइव देखें और प्रसारण करें',
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
      language: 'भाषा',
      goLive: '📡 लाइव जाएं',
      stopLive: '⏹ बंद करें',
      goRandom: '🎥 रैंडम',
      streamLive: 'लाइव',
      nextStreamer: '⏭ अगला'
    },
    ar: {
      subtitle: 'شاهد وبث مباشر',
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
      language: 'اللغة',
      goLive: '📡 بث مباشر',
      stopLive: '⏹ إيقاف',
      goRandom: '🎥 عشوائي',
      streamLive: 'مباشر',
      nextStreamer: '⏭ التالي'
    },
    bn: { subtitle: 'লাইভ দেখুন ও সম্প্রচার করুন', language: 'ভাষা', start: 'শুরু', stop: 'বন্ধ', send: 'পাঠান', saveContinue: 'সেভ করে চালিয়ে যান', goLive: '📡 লাইভ', stopLive: '⏹ বন্ধ', goRandom: '🎥 র্যান্ডম', streamLive: 'লাইভ', nextStreamer: '⏭ পরবর্তী' },
    pa: { subtitle: 'ਲਾਈਵ ਦੇਖੋ ਅਤੇ ਪ੍ਰਸਾਰਣ ਕਰੋ', language: 'ਭਾਸ਼ਾ', start: 'ਸ਼ੁਰੂ', stop: 'ਰੋਕੋ', send: 'ਭੇਜੋ', saveContinue: 'ਸੇਵ ਕਰੋ ਅਤੇ ਜਾਰੀ ਰੱਖੋ', goLive: '📡 ਲਾਈਵ', stopLive: '⏹ ਰੋਕੋ', goRandom: '🎥 ਰੈਂਡਮ', streamLive: 'ਲਾਈਵ', nextStreamer: '⏭ ਅਗਲਾ' },
    ja: {
      subtitle: 'ライブ配信を視聴＆配信',
      goLive: '📡 ライブ配信',
      stopLive: '⏹ 配信停止',
      goRandom: '🎥 ランダム',
      streamLive: 'ライブ',
      nextStreamer: '⏭ 次へ',
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
      subtitle: '라이브 시청 & 방송',
      goLive: '📡 라이브',
      stopLive: '⏹ 중지',
      goRandom: '🎥 랜덤',
      streamLive: '라이브',
      nextStreamer: '⏭ 다음',
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
    vi: { subtitle: 'Xem và phát trực tiếp', language: 'Ngôn ngữ', start: 'Bắt đầu', stop: 'Dừng', send: 'Gửi', saveContinue: 'Lưu & Tiếp tục', goLive: '📡 Trực tiếp', stopLive: '⏹ Dừng', goRandom: '🎥 Ngẫu nhiên', streamLive: 'TRỰC TIẾ́P', nextStreamer: '⏭ Tiếp' },
    tr: { subtitle: 'Canlı izleyin ve yayınlayın', language: 'Dil', start: 'Başlat', stop: 'Durdur', send: 'Gönder', saveContinue: 'Kaydet ve Devam Et', goLive: '📡 Canlı', stopLive: '⏹ Durdur', goRandom: '🎥 Rastgele', streamLive: 'CANLI', nextStreamer: '⏭ Sonraki' },
    it: { subtitle: 'Guarda e trasmetti in diretta', language: 'Lingua', start: 'Avvia', stop: 'Ferma', send: 'Invia', saveContinue: 'Salva e continua', goLive: '📡 In Diretta', stopLive: '⏹ Ferma', goRandom: '🎥 Casuale', streamLive: 'IN DIRETTA', nextStreamer: '⏭ Prossimo' },
    pl: { subtitle: 'Oglądaj i nadawaj na żywo', language: 'Język', start: 'Start', stop: 'Stop', send: 'Wyślij', saveContinue: 'Zapisz i kontynuuj', goLive: '📡 Na żywo', stopLive: '⏹ Zakończ', goRandom: '🎥 Losowo', streamLive: 'NA ŻYWO', nextStreamer: '⏭ Następny' },
    nl: { subtitle: 'Bekijk en stream live', language: 'Taal', start: 'Start', stop: 'Stop', send: 'Verzenden', saveContinue: 'Opslaan en doorgaan', goLive: '📡 Ga Live', stopLive: '⏹ Stoppen', goRandom: '🎥 Willekeurig', streamLive: 'LIVE', nextStreamer: '⏭ Volgende' },
    uk: { subtitle: 'Дивіться та транслюйте наживо', language: 'Мова', start: 'Почати', stop: 'Зупинити', send: 'Надіслати', saveContinue: 'Зберегти і продовжити', goLive: '📡 Прямий ефір', stopLive: '⏹ Зупинити', goRandom: '🎥 Випадково', streamLive: 'НАЖИВО', nextStreamer: '⏭ Наступний' },
    fa: { subtitle: 'پخش زنده تماشا کنید و بث کنید', language: 'زبان', start: 'شروع', stop: 'توقف', send: 'ارسال', saveContinue: 'ذخیره و ادامه', goLive: '📡 پخش زنده', stopLive: '⏹ توقف', goRandom: '🎥 تصادفی', streamLive: 'زنده', nextStreamer: '⏭ بعدی' }
  };

  const english = translations.en;
  for (const lang of LANGUAGES) {
    if (!translations[lang.code]) {
      translations[lang.code] = { ...english };
    }
  }

  function getInitialLanguage() {
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

    window.dispatchEvent(new CustomEvent('flashlive-language-changed', { detail: { language: currentLanguage } }));
  }

  function setLanguage(languageCode) {
    if (!translations[languageCode]) return;
    currentLanguage = languageCode;
    applyTranslations();
  }

  function getLanguage() {
    return currentLanguage;
  }

  function getLanguages() {
    return LANGUAGES.slice();
  }

  window.FLASHLIVE_I18N = {
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
