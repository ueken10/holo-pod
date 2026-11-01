(() => {
  'use strict';

  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
  const SETTINGS_KEY = 'holo-pod.settings.v1';
  const WEATHER_REFRESH_MS = 30 * 60 * 1000;
  const THEME_STYLES = {
    simple: '',
    game: 'https://unpkg.com/nes.css@2.3.0/css/nes-core.min.css',
    rpg: 'https://cdn.jsdelivr.net/gh/RonenNess/RPGUI@1.0.3/dist/rpgui.min.css',
    terminal: 'https://unpkg.com/terminal.css@0.7.4/dist/terminal.min.css',
    tsukuyomi: ''
  };
  const WEATHER_CODES = {
    0: ['快晴', '☀️'],
    1: ['おおむね晴れ', '🌤️'],
    2: ['一部曇り', '⛅'],
    3: ['曇り', '☁️'],
    45: ['霧', '🌫️'],
    48: ['着氷性の霧', '🌫️'],
    51: ['弱い霧雨', '🌦️'],
    53: ['霧雨', '🌦️'],
    55: ['強い霧雨', '🌧️'],
    56: ['弱い着氷性の霧雨', '🌧️'],
    57: ['強い着氷性の霧雨', '🌧️'],
    61: ['弱い雨', '🌦️'],
    63: ['雨', '🌧️'],
    65: ['強い雨', '🌧️'],
    66: ['弱い凍雨', '🌧️'],
    67: ['強い凍雨', '🌧️'],
    71: ['弱い雪', '🌨️'],
    73: ['雪', '❄️'],
    75: ['強い雪', '❄️'],
    77: ['霧雪', '🌨️'],
    80: ['にわか雨', '🌦️'],
    81: ['強いにわか雨', '🌧️'],
    82: ['非常に強いにわか雨', '⛈️'],
    85: ['にわか雪', '🌨️'],
    86: ['強いにわか雪', '❄️'],
    95: ['雷雨', '⛈️'],
    96: ['ひょうを伴う雷雨', '⛈️'],
    99: ['強いひょうを伴う雷雨', '⛈️']
  };
  const PAGES = [
    { path: '/simple', key: 'simple', title: 'シンプルダッシュボード' },
    { path: '/game', key: 'game', title: 'ゲーム風ダッシュボード' },
    { path: '/rpg', key: 'rpg', title: 'RPG風ダッシュボード' },
    { path: '/terminal', key: 'terminal', title: 'ターミナル風ダッシュボード' },
    { path: '/tsukuyomi', key: 'tsukuyomi', title: '3Dモデルビューアー' },
    { path: '/settings', key: 'settings', title: '設定' }
  ];

  function supportedTimezone(zone) {
    if (typeof zone !== 'string' || !zone) return false;
    try {
      new Intl.DateTimeFormat('ja-JP', { timeZone: zone }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  function defaultTimezone() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return supportedTimezone(zone) ? zone : 'Asia/Tokyo';
    } catch {
      return 'Asia/Tokyo';
    }
  }

  function timezoneList(current) {
    let zones = ['Asia/Tokyo', 'UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Seoul', 'Asia/Taipei', 'Australia/Sydney'];
    if (typeof Intl.supportedValuesOf === 'function') {
      try {
        zones = Intl.supportedValuesOf('timeZone');
      } catch {
        // Use the portable fallback list.
      }
    }
    if (current && !zones.includes(current)) zones.unshift(current);
    return [...new Set(zones)].sort((a, b) => a.localeCompare(b));
  }

  function appShell() {
    return {
      pages: PAGES,
      currentPath: '/simple',
      currentTitle: 'シンプルダッシュボード',
      activeTheme: 'simple',
      selectedIndex: 0,
      menuOpen: false,
      loading: true,
      errorMessage: '',
      pageContent: '',
      pageController: null,
      navigationSequence: 0,
      timezone: 'Asia/Tokyo',
      timezones: [],
      currentTime: '--:--:--',
      currentDate: '',
      weather: {
        loading: true,
        description: '天気データを取得中',
        icon: '…',
        temperature: '--',
        humidity: '--',
        precipitation: '--',
        probability: '--',
        updatedAt: '',
        error: ''
      },
      themeStyle: null,
      clockTimer: null,
      weatherTimer: null,
      weatherController: null,
      settingsMessage: '',
      viewerCleanup: null,
      routerStartHandler: null,
      routerEndHandler: null,
      routerErrorHandler: null,
      get isDashboard() {
        return ['simple', 'game', 'rpg', 'terminal'].includes(this.activeTheme);
      },

      init() {
        this.themeStyle = document.getElementById('page-theme-import');
        this.loadSettings();
        this.timezones = timezoneList(this.timezone);
        this.updateClock();
        this.clockTimer = window.setInterval(() => this.updateClock(), 1000);
        this.fetchWeather();
        this.weatherTimer = window.setInterval(() => this.fetchWeather(), WEATHER_REFRESH_MS);
        this.routerStartHandler = () => { this.loading = true; this.errorMessage = ''; };
        this.routerEndHandler = () => {
          this.loading = false;
        };
        this.routerErrorHandler = () => {
          this.loading = false;
          this.errorMessage = 'ページを読み込めませんでした。通信状態を確認して再試行してください。';
        };
        document.addEventListener('pinecone-start', this.routerStartHandler);
        document.addEventListener('pinecone-end', this.routerEndHandler);
        document.addEventListener('fetch-error', this.routerErrorHandler);

        if (!window.location.hash) {
          window.location.hash = '#/simple';
        }
      },

      destroy() {
        window.clearInterval(this.clockTimer);
        window.clearInterval(this.weatherTimer);
        if (this.weatherController) this.weatherController.abort();
        if (this.pageController) this.pageController.abort();
        if (this.viewerCleanup) this.viewerCleanup();
        document.removeEventListener('pinecone-start', this.routerStartHandler);
        document.removeEventListener('pinecone-end', this.routerEndHandler);
        document.removeEventListener('fetch-error', this.routerErrorHandler);
      },

      loadSettings() {
        let saved = {};
        try {
          saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        } catch {
          saved = {};
        }
        const candidate = saved && typeof saved === 'object' ? saved.timezone : null;
        this.timezone = supportedTimezone(candidate) ? candidate : defaultTimezone();
      },

      saveTimezone() {
        if (!supportedTimezone(this.timezone)) {
          this.timezone = defaultTimezone();
        }
        try {
          const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...saved, timezone: this.timezone }));
          this.settingsMessage = '設定を保存しました';
        } catch {
          this.settingsMessage = 'このブラウザーでは設定を保存できません';
        }
        this.updateClock();
        this.fetchWeather();
      },

      updateClock() {
        const now = new Date();
        try {
          this.currentTime = new Intl.DateTimeFormat('ja-JP', {
            timeZone: this.timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
          }).format(now);
          this.currentDate = new Intl.DateTimeFormat('ja-JP', {
            timeZone: this.timezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
          }).format(now);
        } catch {
          this.timezone = 'Asia/Tokyo';
          this.currentTime = new Intl.DateTimeFormat('ja-JP', { timeZone: this.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
          this.currentDate = new Intl.DateTimeFormat('ja-JP', { timeZone: this.timezone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
        }
      },

      async fetchWeather() {
        if (this.weatherController) this.weatherController.abort();
        const controller = new AbortController();
        this.weatherController = controller;
        const timeout = window.setTimeout(() => controller.abort(), 12000);
        this.weather.loading = true;
        this.weather.error = '';
        const query = new URLSearchParams({
          latitude: '35.6895',
          longitude: '139.6917',
          current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
          hourly: 'precipitation_probability',
          timezone: this.timezone,
          forecast_days: '1'
        });

        try {
          const response = await fetch(`${WEATHER_URL}?${query}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
          const data = await response.json();
          if (controller.signal.aborted || this.weatherController !== controller) return;
          if (!data.current || !Number.isFinite(data.current.weather_code)) throw new Error('Invalid weather response');

          const [description, icon] = WEATHER_CODES[data.current.weather_code] || ['不明な天気', '🌡️'];
          this.weather.description = description;
          this.weather.icon = icon;
          this.weather.temperature = Number.isFinite(data.current.temperature_2m) ? `${Math.round(data.current.temperature_2m * 10) / 10} °C` : '--';
          this.weather.humidity = Number.isFinite(data.current.relative_humidity_2m) ? `${data.current.relative_humidity_2m}%` : '--';
          this.weather.precipitation = Number.isFinite(data.current.precipitation) ? `${data.current.precipitation} mm` : '--';
          this.weather.probability = this.currentPrecipitationProbability(data) ?? '--';
          this.weather.updatedAt = new Intl.DateTimeFormat('ja-JP', { timeZone: this.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date());
        } catch (error) {
          if (controller.signal.aborted && this.weatherController !== controller) return;
          if (error.name !== 'AbortError') console.warn('Weather update failed:', error);
          this.weather.error = '天気データを更新できません。';
          if (!this.weather.updatedAt) this.weather.description = '天気データを取得できません';
        } finally {
          window.clearTimeout(timeout);
          if (this.weatherController === controller) {
            this.weather.loading = false;
            this.weatherController = null;
          }
        }
      },

      currentPrecipitationProbability(data) {
        const times = data.hourly?.time;
        const values = data.hourly?.precipitation_probability;
        if (!Array.isArray(times) || !Array.isArray(values) || !times.length) return null;
        const currentTime = data.current?.time;
        let bestIndex = 0;
        if (currentTime) {
          const currentEpoch = Date.parse(currentTime);
          let smallestDifference = Infinity;
          times.forEach((time, index) => {
            const difference = Math.abs(Date.parse(time) - currentEpoch);
            if (difference < smallestDifference) {
              smallestDifference = difference;
              bestIndex = index;
            }
          });
        }
        return Number.isFinite(values[bestIndex]) ? `${values[bestIndex]}%` : null;
      },

      syncTheme(theme) {
        if (!this.themeStyle) return;
        const href = THEME_STYLES[theme] || '';
        if (!href) {
          this.themeStyle.textContent = '';
          return;
        }
        const pixelFont = theme === 'game'
          ? '@import url("https://fonts.googleapis.com/css2?family=DotGothic16&display=swap");\n'
          : '';
        this.themeStyle.textContent = `${pixelFont}@import url("${href}") layer(framework);`;
      },

      setRoute(key) {
        const page = PAGES.find((item) => item.key === key);
        if (!page) return;
        if (this.activeTheme === 'tsukuyomi' && key !== 'tsukuyomi' && this.viewerCleanup) {
          this.viewerCleanup();
          this.viewerCleanup = null;
        }
        this.currentPath = page.path;
        this.currentTitle = page.title;
        this.selectedIndex = PAGES.indexOf(page);
        this.activeTheme = key;
        this.syncTheme(key);
        if (key !== 'tsukuyomi' && this.viewerCleanup) {
          this.viewerCleanup();
          this.viewerCleanup = null;
        }
      },

      async loadPage(key) {
        const page = PAGES.find((item) => item.key === key);
        if (!page) return;
        if (this.pageController) this.pageController.abort();
        const controller = new AbortController();
        const sequence = ++this.navigationSequence;
        this.pageController = controller;
        this.pageContent = '';
        this.errorMessage = '';
        this.loading = true;
        this.setRoute(key);

        try {
          const url = new URL(`./pages/${key}.html`, document.baseURI);
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Page request returned ${response.status}`);
          const html = await response.text();
          if (controller.signal.aborted || sequence !== this.navigationSequence) return;
          this.pageContent = html;
          await this.$nextTick();
          if (key === 'tsukuyomi' && sequence === this.navigationSequence) this.startViewer();
        } catch (error) {
          if (sequence !== this.navigationSequence || controller.signal.aborted) return;
          console.error(`Failed to load page ${key}:`, error);
          this.pageContent = '';
          this.activeTheme = '';
          this.syncTheme('');
          this.errorMessage = 'ページを読み込めませんでした。通信状態を確認して再試行してください。';
        } finally {
          if (sequence === this.navigationSequence) {
            this.loading = false;
            this.pageController = null;
          }
        }
      },

      routeSimple() { return this.loadPage('simple'); },
      routeGame() { return this.loadPage('game'); },
      routeRpg() { return this.loadPage('rpg'); },
      routeTerminal() { return this.loadPage('terminal'); },
      routeTsukuyomi() { return this.loadPage('tsukuyomi'); },
      routeSettings() { return this.loadPage('settings'); },

      startViewer() {
        window.setTimeout(async () => {
          if (this.activeTheme !== 'tsukuyomi') return;
          const mount = document.querySelector('#app [data-vrm-viewer]');
          if (!mount) return;
          try {
            const viewer = await import('./pages/tsukuyomi.js');
            const cleanup = await viewer.mountTsukuyomiViewer(mount);
            if (this.activeTheme !== 'tsukuyomi' || !mount.isConnected) {
              cleanup();
              return;
            }
            this.viewerCleanup = cleanup;
          } catch (error) {
            console.error('VRM viewer failed to initialize:', error);
            const status = mount.querySelector('[data-vrm-status]');
            if (status) status.textContent = '3Dビューワーを初期化できませんでした。';
          }
        }, 0);
      },

      showNotFound() {
        if (this.pageController) this.pageController.abort();
        this.navigationSequence += 1;
        this.pageController = null;
        this.pageContent = '';
        this.loading = false;
        this.errorMessage = 'お探しのページは見つかりませんでした。メニューからページを選択してください。';
        this.currentTitle = 'ページが見つかりません';
        this.activeTheme = '';
        this.syncTheme('');
        document.getElementById('app')?.replaceChildren();
      },

      retry() {
        window.location.reload();
      },

      toggleMenu() {
        this.menuOpen = !this.menuOpen;
        if (this.menuOpen) this.syncSelectedIndex();
      },

      closeMenu() {
        this.menuOpen = false;
      },

      syncSelectedIndex() {
        const index = PAGES.findIndex((page) => page.path === this.currentPath);
        if (index >= 0) this.selectedIndex = index;
      },

      selectPage(index) {
        const page = PAGES[index];
        if (!page) return;
        this.selectedIndex = index;
        this.menuOpen = false;
        window.location.hash = `#${page.path}`;
      },

      navigateBy(direction) {
        const nextIndex = (this.selectedIndex + direction + PAGES.length) % PAGES.length;
        this.selectPage(nextIndex);
      },

      isEditableTarget(target) {
        return Boolean(target && (
          target.isContentEditable ||
          (typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
        ));
      },

      handleKeydown(event) {
        if (event.isComposing) return;

        if (event.key === '/') {
          if (this.isEditableTarget(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
          event.preventDefault();
          if (event.repeat) return;
          if (this.menuOpen) this.selectPage(this.selectedIndex);
          else this.toggleMenu();
          return;
        }

        if (this.menuOpen) {
          if (event.key === 'Escape') {
            event.preventDefault();
            this.closeMenu();
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (this.isEditableTarget(event.target)) return;
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            this.selectedIndex = (this.selectedIndex + direction + PAGES.length) % PAGES.length;
          }
          return;
        }
        if (this.isEditableTarget(event.target)) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          this.navigateBy(event.key === 'ArrowDown' ? 1 : -1);
        }
      }
    };
  }

  document.addEventListener('alpine:init', () => {
    if (window.PineconeRouter) window.PineconeRouter.settings.hash = true;
    window.Alpine.data('appShell', appShell);
  });
})();
